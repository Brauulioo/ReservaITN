import { afterAll, describe, expect, it } from 'vitest';
import { enTransaccion, cerrar, mundo, rechaza, reserva, solicitud, uno } from './ayuda';

afterAll(cerrar);

/** Calendario institucional (V014): fines de semana, vacaciones y períodos de Subdirección. */
const t = (dia: string, h: string) => `${dia}T${h}:00-03:00`;
const insertar = `INSERT INTO reservas.reserva (solicitud_id, espacio_id, inicio, fin, estado, expira_en)
                  VALUES ($1, $2, $3, $4, 'PENDIENTE', now() + interval '1 day')`;

describe('días no disponibles (V014)', () => {
  it('sábado y domingo no se reservan; el lunes sí', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      await rechaza(c, insertar, [s, m.sala, t('2091-03-10', '10:00'), t('2091-03-10', '11:00')], /Día no disponible.*Fin de semana/);
      await rechaza(c, insertar, [s, m.sala, t('2091-03-11', '10:00'), t('2091-03-11', '11:00')], /Fin de semana/);
      await reserva(c, s, m.sala, t('2091-03-12', '10:00'), t('2091-03-12', '11:00'));
    }));

  it('las vacaciones de verano (25-dic al 1-mar) se repiten cada año', async () => {
    await enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await solicitud(c, m);
      await rechaza(c, insertar, [s, m.sala, t('2026-12-28', '10:00'), t('2026-12-28', '11:00')], /Vacaciones de verano/);
      await rechaza(c, insertar, [s, m.sala, t('2035-01-08', '10:00'), t('2035-01-08', '11:00')], /Vacaciones de verano/);
      await rechaza(c, insertar, [s, m.sala, t('2027-03-01', '10:00'), t('2027-03-01', '11:00')], /Vacaciones de verano/); // 1 de marzo incluido
      await reserva(c, s, m.sala, t('2027-03-02', '10:00'), t('2027-03-02', '11:00')); // 2 de marzo, se vuelve a clases
    });
  });

  it('un período de Subdirección bloquea días completos (00:00 a 23:59), solo en su sede, y se repite N años', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const otro = await mundo(c);
      const s = await solicitud(c, m);
      await c.query(`INSERT INTO institucion.periodo_no_disponible (motivo, desde, hasta, sede_id, repetir_anios)
                     VALUES ('Semana de aniversario', '2091-03-12', '2091-03-16', $1, 2)`, [m.sede]);
      await rechaza(c, insertar, [s, m.sala, t('2091-03-12', '00:00'), t('2091-03-12', '00:30')], /Semana de aniversario/);
      await rechaza(c, insertar, [s, m.sala, t('2091-03-16', '23:00'), t('2091-03-16', '23:59')], /Semana de aniversario/);
      await rechaza(c, insertar, [s, m.sala, t('2093-03-13', '10:00'), t('2093-03-13', '11:00')], /Semana de aniversario/); // 2.º año repetido
      await reserva(c, s, m.sala, t('2094-03-15', '10:00'), t('2094-03-15', '11:00')); // ya no se repite
      await reserva(c, s, m.sala, t('2091-03-09', '10:00'), t('2091-03-09', '11:00')); // viernes anterior
      // Otra sede no queda afectada
      await reserva(c, await solicitud(c, otro), otro.sala, t('2091-03-13', '10:00'), t('2091-03-13', '11:00'));
      // Al desactivarlo, deja de bloquear
      await c.query(`UPDATE institucion.periodo_no_disponible SET activo = false WHERE motivo = 'Semana de aniversario'`);
      await reserva(c, s, m.sala, t('2091-03-13', '10:00'), t('2091-03-13', '11:00'));
    }));

  it('la mantención sí puede programarse en días no disponibles', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const s = await uno(c, `INSERT INTO reservas.solicitud (solicitante_usuario_id, tipo_actividad_id, descripcion, asistentes, origen)
                               VALUES ($1, $2, 'Mantención preventiva', 1, 'MANTENCION') RETURNING id`, [m.docente.id, m.clase]);
      await reserva(c, s, m.sala, t('2091-03-10', '09:00'), t('2091-03-10', '13:00'), 'APROBADA');
    }));

  it('dias_disponibles devuelve solo días hábiles del rango', () =>
    enTransaccion(async (c) => {
      const m = await mundo(c);
      const dias = await c.query(`SELECT to_char(d, 'YYYY-MM-DD') AS d FROM institucion.dias_disponibles($1, '2091-03-08', '2091-03-14') d`, [m.sede]);
      expect(dias.rows.map((r) => r.d)).toEqual(['2091-03-08', '2091-03-09', '2091-03-12', '2091-03-13', '2091-03-14']);
    }));

  it('un período no puede terminar antes de empezar ni durar más de un año', () =>
    enTransaccion(async (c) => {
      await rechaza(c, `INSERT INTO institucion.periodo_no_disponible (motivo, desde, hasta) VALUES ('Malo', '2091-03-10', '2091-03-01')`, [], /check/);
      await rechaza(c, `INSERT INTO institucion.periodo_no_disponible (motivo, desde, hasta) VALUES ('Largo', '2091-01-01', '2092-06-01')`, [], /check/);
    }));
});
