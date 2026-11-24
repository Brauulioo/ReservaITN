import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReservasService } from '../src/reservas/reservas.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.module';
import { CalendarioController } from '../src/calendario/calendario.module';
import type { UsuarioSesion } from '../src/comun/auth.guard';
import { a, espacio, lunesAlAzar, prisma, sesion } from './ayuda';

/** Días no disponibles (V014): Subdirección bloquea días completos y puede cancelar lo ya reservado. */
const reservas = new ReservasService(prisma, new NotificacionesService());
const calendario = new CalendarioController(prisma, reservas);
const lunes = lunesAlAzar();
const dia = (d: Date) => d.toLocaleDateString('sv-SE');
let docente: UsuarioSesion;
let sub: UsuarioSesion;
let sala: string;
let sedeId: string;
const creados: string[] = [];

beforeAll(async () => {
  [docente, sub] = await Promise.all(['docente', 'subdireccion'].map((x) => sesion(`${x}@itn.cl`)));
  const e = await espacio('A-101');
  sala = e.id;
  sedeId = (await prisma.edificio.findUniqueOrThrow({ where: { id: e.edificio_id } })).sede_id;
});
afterAll(async () => {
  for (const id of creados) await calendario.quitar(id, sub).catch(() => undefined);
  await prisma.$disconnect();
});

const pedir = (inicio: Date, fin: Date, repetirHasta?: Date) =>
  reservas.solicitar({ espacioId: sala, inicio, fin, tipoActividad: 'CLASE', descripcion: 'Clase de prueba', asistentes: 20, repetirHasta }, docente);

describe('calendario institucional', () => {
  it('no se puede pedir un sábado', async () => {
    await expect(pedir(a(lunes, 5, '10:00'), a(lunes, 5, '11:00'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Subdirección bloquea una semana: ve lo afectado, lo cancela con aviso y ya nadie puede pedir esos días', async () => {
    const martes = a(lunes, 1, '10:00');
    const previa = await pedir(martes, a(lunes, 1, '11:00'));
    const afectadas = await calendario.afectadas({ desde: dia(a(lunes, 0, '00:00')), hasta: dia(a(lunes, 4, '00:00')), sedeId, repetirAnios: 0 });
    expect(afectadas.map((r) => r.id)).toContain(previa.reserva[0].id);

    const r = await calendario.crear(
      { motivo: 'Semana de prueba', desde: dia(a(lunes, 0, '00:00')), hasta: dia(a(lunes, 4, '00:00')), sedeId, repetirAnios: 0, cancelarAfectadas: true },
      sub,
    );
    creados.push(r.id);
    expect(r.canceladas).toBeGreaterThanOrEqual(1);
    const cancelada = await prisma.reserva.findUniqueOrThrow({ where: { id: previa.reserva[0].id } });
    expect(cancelada.estado).toBe('CANCELADA');
    const aviso = await prisma.notificacion.findFirst({ where: { usuario_id: docente.id, reserva_id: previa.reserva[0].id, evento_codigo: 'RESERVA_CANCELADA' } });
    expect(aviso?.cuerpo).toContain('Día no disponible: Semana de prueba');

    await expect(pedir(a(lunes, 2, '10:00'), a(lunes, 2, '11:00'))).rejects.toThrow(/no está disponible/);
    const bloqueados = await calendario.noDisponibles({ desde: dia(a(lunes, 0, '00:00')), hasta: dia(a(lunes, 6, '00:00')), sedeId });
    expect(bloqueados.map((b) => b.motivo)).toEqual(['Semana de prueba', 'Semana de prueba', 'Semana de prueba', 'Semana de prueba', 'Semana de prueba', 'Fin de semana', 'Fin de semana']);

    // Una serie semanal salta la semana bloqueada
    const serie = await pedir(a(lunes, -7, '15:00'), a(lunes, -7, '16:00'), new Date(dia(a(lunes, 7, '00:00'))));
    expect(serie.reserva.map((x) => dia(new Date(x.inicio)))).toEqual([dia(a(lunes, -7, '00:00')), dia(a(lunes, 7, '00:00'))]);

    // Al quitar el período, el día vuelve a estar disponible
    await calendario.quitar(r.id, sub);
    const ahora = await pedir(a(lunes, 2, '10:00'), a(lunes, 2, '11:00'));
    expect(ahora.reserva).toHaveLength(1);
  });
});
