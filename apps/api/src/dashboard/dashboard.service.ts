import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HORARIO, horasOcupadas, indiceOcupacion, type RangoFechas } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';

const partesChile = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
/** Día de la semana en Chile: 0 = lunes … 6 = domingo. */
export function diaSemanaChile(d: Date): number {
  const dia = partesChile.formatToParts(d).find((p) => p.type === 'weekday')!.value;
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dia);
}
/** Hora decimal en Chile (10:30 → 10.5). */
export function horaChile(d: Date): number {
  const p = Object.fromEntries(partesChile.formatToParts(d).map((x) => [x.type, x.value]));
  return Number(p.hour) + Number(p.minute) / 60;
}

/**
 * Días hábiles (lunes a viernes) en el rango × horas del horario institucional. Referencia sin
 * base de datos; el dashboard descuenta además feriados y períodos no disponibles (diasDisponibles).
 */
export function horasDisponiblesPorSala(desde: Date, hasta: Date): number {
  const horasDia = HORARIO.cierreHora - HORARIO.aperturaHora;
  let dias = 0;
  for (let d = new Date(desde); d < hasta; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) dias++;
  return dias * horasDia;
}
const fechaChile = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });

export interface FilaEspacio {
  espacioId: string;
  codigo: string;
  nombre: string;
  sede: string;
  tipo: string;
  capacidad: number;
  horasReservadas: number;
  horasDisponibles: number;
  indice: number;
}

export interface FilaReserva {
  reservaId: string;
  solicitudId: string;
  solicitanteId: string;
  codigoEspacio: string;
  inicio: Date;
  fin: Date;
  estado: string;
  espacio: string;
  sede: string;
  tipoActividad: string;
  origen: string;
  asistentes: number;
  descripcion: string;
  solicitadoEn: Date;
  solicitante: string;
  aprobador: string | null;
  aprobacionAutomatica: boolean;
  horasAprobacion: number | null;
  canceladoPor: string | null;
  canceladoEn: Date | null;
  motivoCancelacion: string | null;
}

/**
 * Cálculos del dashboard y de los reportes (E9 / WBS 1.4.7). La pantalla y el Excel usan este
 * mismo servicio, así ambos muestran exactamente los mismos números.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reservas aprobadas de uso real (la mantención no cuenta como uso, B3). */
  /** Días en que se puede reservar dentro del período (sin fines de semana, feriados ni períodos bloqueados, V014). */
  async diasDisponibles(q: RangoFechas): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<{ d: Date }[]>`
      SELECT institucion.dias_disponibles(${q.sedeId ?? null}::uuid, ${fechaChile(q.desde)}::date, ${fechaChile(new Date(q.hasta.getTime() - 1))}::date) AS d`;
    return filas.map((f) => f.d.toISOString().slice(0, 10));
  }

  reservasAprobadas(q: RangoFechas, espacioIds?: string[]) {
    return this.prisma.reserva.findMany({
      where: {
        estado: 'APROBADA',
        solicitud: { origen: { not: 'MANTENCION' } },
        inicio: { lt: q.hasta },
        fin: { gt: q.desde },
        ...(espacioIds ? { espacio_id: { in: espacioIds } } : {}),
        ...(q.sedeId ? { espacio: { edificio: { sede_id: q.sedeId } } } : {}),
      },
      select: { espacio_id: true, inicio: true, fin: true },
    });
  }

  /**
   * Inicio de Subdirección: los 4 gráficos de prioridad alta y sus indicadores en una sola
   * consulta, con los mismos filtros (período, sede y tipo de espacio). Reutiliza `ocupacion`,
   * así las cifras coinciden con el dashboard detallado y el Excel.
   */
  async inicio(q: RangoFechas, tipo?: string) {
    const ocu = await this.ocupacion(q, tipo);
    const ids = ocu.porEspacio.map((e) => e.espacioId);
    const salas = ids.length;
    const { aperturaHora: H0, cierreHora: H1 } = HORARIO;

    // Días disponibles del período por día de la semana (0 = lunes … 4 = viernes), en hora de Chile
    const diasPorDia = [0, 0, 0, 0, 0];
    for (const d of ocu.dias) {
      const dia = diaSemanaChile(new Date(`${d}T12:00:00-03:00`));
      if (dia <= 4) diasPorDia[dia]++;
    }

    // Mapa de calor: horas ocupadas en cada bloque de una hora ÷ horas posibles (días × salas)
    const calor = diasPorDia.map(() => Array<number>(H1 - H0).fill(0));
    // Capacidad por jornada: horas ocupadas vs disponibles
    const JORNADAS = [
      { nombre: 'Mañana', desde: 8, hasta: 13 },
      { nombre: 'Tarde', desde: 13, hasta: 18 },
      { nombre: 'Vespertina', desde: 18, hasta: 23 },
    ];
    const ocupadasJornada = JORNADAS.map(() => 0);
    for (const r of ocu.reservas) {
      const ini = Math.max(r.inicio.getTime(), q.desde.getTime());
      const fin = Math.min(r.fin.getTime(), q.hasta.getTime());
      if (fin <= ini) continue;
      const dia = diaSemanaChile(new Date(ini));
      if (dia > 4) continue;
      const h0 = horaChile(new Date(ini));
      const h1 = h0 + (fin - ini) / 3_600_000;
      for (let h = H0; h < H1; h++) calor[dia][h - H0] += Math.max(0, Math.min(h1, h + 1) - Math.max(h0, h));
      JORNADAS.forEach((j, i) => (ocupadasJornada[i] += Math.max(0, Math.min(h1, j.hasta) - Math.max(h0, j.desde))));
    }
    const diasHabiles = diasPorDia.reduce((a, b) => a + b, 0);
    const redondo = (x: number) => Math.round(x * 10) / 10;

    // Reservas del período por estado y sala (no usadas = canceladas, liberadas y vencidas)
    const porEstado = ids.length
      ? await this.prisma.reserva.groupBy({
          by: ['espacio_id', 'estado'],
          where: { espacio_id: { in: ids }, inicio: { gte: q.desde, lt: q.hasta }, solicitud: { origen: { not: 'MANTENCION' } } },
          _count: { _all: true },
        })
      : [];
    const contar = (estados: string[], espacioId?: string) =>
      porEstado
        .filter((x) => estados.includes(x.estado) && (!espacioId || x.espacio_id === espacioId))
        .reduce((s, x) => s + x._count._all, 0);
    const total = contar(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'LIBERADA', 'EXPIRADA']);
    const noUsadas = contar(['CANCELADA', 'LIBERADA', 'EXPIRADA']);
    const horasOcupadasTotal = ocu.porEspacio.reduce((s, e) => s + e.horasReservadas, 0);
    const horasDisponiblesTotal = salas * ocu.dias.length * (H1 - H0);

    return {
      rango: ocu.rango,
      salas,
      indicadores: {
        ocupacion: ocu.indiceGlobal,
        horasOcupadas: redondo(horasOcupadasTotal),
        horasDisponibles: horasDisponiblesTotal,
        aprobadas: contar(['APROBADA']),
        pendientes: contar(['PENDIENTE']),
        solicitudes: total,
        noUsadas,
        proporcionNoUsadas: total ? noUsadas / total : 0,
      },
      ocupacionPorSala: ocu.porEspacio.map(({ espacioId, codigo, nombre, sede, tipo: t, capacidad, horasReservadas, indice }) => ({
        espacioId, codigo, nombre, sede, tipo: t, capacidad, horasReservadas, indice,
      })),
      mapaCalor: {
        horas: Array.from({ length: H1 - H0 }, (_, i) => H0 + i),
        dias: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
        // proporción de salas ocupadas en cada bloque (0 a 1)
        valores: calor.map((fila, d) => fila.map((h) => (diasPorDia[d] && salas ? Math.round((h / (diasPorDia[d] * salas)) * 1000) / 1000 : 0))),
      },
      capacidadPorJornada: JORNADAS.map((j, i) => {
        const disponibles = diasHabiles * salas * (j.hasta - j.desde);
        const ocupadas = redondo(ocupadasJornada[i]);
        return { ...j, horasOcupadas: ocupadas, horasLibres: redondo(Math.max(0, disponibles - ocupadas)), horasDisponibles: disponibles };
      }),
      noUsadasPorSala: ocu.porEspacio
        .map((e) => ({
          codigo: e.codigo,
          canceladas: contar(['CANCELADA'], e.espacioId),
          liberadas: contar(['LIBERADA'], e.espacioId),
          vencidas: contar(['EXPIRADA'], e.espacioId),
        }))
        .map((x) => ({ ...x, total: x.canceladas + x.liberadas + x.vencidas }))
        .sort((a, b) => b.total - a.total || a.codigo.localeCompare(b.codigo)),
    };
  }

  async ocupacion(q: RangoFechas, tipo?: string) {
    const espacios = await this.prisma.espacio.findMany({
      where: {
        activo: true,
        reservable: true,
        ...(q.sedeId ? { edificio: { sede_id: q.sedeId } } : {}),
        ...(tipo ? { tipo_espacio: { codigo: tipo } } : {}),
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        capacidad: true,
        tipo_espacio: { select: { nombre: true } },
        edificio: { select: { sede: { select: { nombre: true } } } },
      },
    });
    const [reservas, dias] = await Promise.all([this.reservasAprobadas(q, espacios.map((e) => e.id)), this.diasDisponibles(q)]);
    const rango = { inicio: q.desde, fin: q.hasta };
    const disponibles = dias.length * (HORARIO.cierreHora - HORARIO.aperturaHora);

    const porEspacio: FilaEspacio[] = espacios
      .map((e) => {
        const horas = horasOcupadas(reservas.filter((r) => r.espacio_id === e.id), rango);
        return {
          espacioId: e.id,
          codigo: e.codigo,
          nombre: e.nombre,
          sede: e.edificio.sede.nombre,
          tipo: e.tipo_espacio.nombre,
          capacidad: e.capacidad,
          horasReservadas: Math.round(horas * 10) / 10,
          horasDisponibles: disponibles,
          indice: indiceOcupacion(horas, disponibles),
        };
      })
      .sort((a, b) => b.indice - a.indice || a.codigo.localeCompare(b.codigo));

    const total = porEspacio.reduce((acc, s) => acc + s.horasReservadas, 0);
    return {
      rango: { desde: q.desde, hasta: q.hasta },
      indiceGlobal: indiceOcupacion(total, disponibles * espacios.length),
      totalReservas: reservas.length,
      porEspacio,
      reservas,
      dias,
    };
  }

  /** Indicadores del Plan de Gestión de Beneficios, calculados desde la vista de trazabilidad. */
  async indicadores(q: RangoFechas) {
    const [r] = await this.prisma.$queryRaw<
      {
        total: bigint;
        pendientes: bigint;
        aprobadas: bigint;
        rechazadas: bigint;
        canceladas: bigint;
        liberadas: bigint;
        expiradas: bigint;
        horas_aprobacion: number | null;
      }[]
    >`
      SELECT count(*)                                         AS total,
             count(*) FILTER (WHERE estado = 'PENDIENTE')     AS pendientes,
             count(*) FILTER (WHERE estado = 'APROBADA')      AS aprobadas,
             count(*) FILTER (WHERE estado = 'RECHAZADA')     AS rechazadas,
             count(*) FILTER (WHERE estado = 'CANCELADA')     AS canceladas,
             count(*) FILTER (WHERE estado = 'LIBERADA')      AS liberadas,
             count(*) FILTER (WHERE estado = 'EXPIRADA')      AS expiradas,
             avg(extract(epoch FROM tiempo_aprobacion) / 3600)
               FILTER (WHERE origen = 'SOLICITUD' AND decidido_por_usuario_id IS NOT NULL) AS horas_aprobacion
        FROM reservas.v_reserva_trazabilidad
       WHERE inicio < ${q.hasta} AND fin > ${q.desde}
         ${q.sedeId ? Prisma.sql`AND sede_id = ${q.sedeId}::uuid` : Prisma.empty}`;
    const n = (x: bigint) => Number(x);
    const confirmadas = n(r.aprobadas) + n(r.liberadas);
    return {
      totalReservas: n(r.total),
      pendientes: n(r.pendientes),
      aprobadas: n(r.aprobadas),
      rechazadas: n(r.rechazadas),
      canceladas: n(r.canceladas),
      liberadas: n(r.liberadas),
      expiradas: n(r.expiradas),
      // B3: reservas no usadas = liberadas por falta de check-in ÷ confirmadas (meta ≤ 10 %)
      B3_reservasNoUsadas: confirmadas ? n(r.liberadas) / confirmadas : 0,
      // B6: tiempo promedio de aprobación (meta ≤ 24 h)
      B6_tiempoPromedioAprobacionHoras: r.horas_aprobacion === null ? null : Number(r.horas_aprobacion),
      // B6: trazabilidad completa. Por diseño, toda reserva tiene solicitante y fecha (columnas obligatorias)
      B6_trazabilidadCompleta: 1,
    };
  }

  /** Todas las reservas del período con su trazabilidad (R7), incluida la cancelación. */
  async reservas(q: RangoFechas): Promise<FilaReserva[]> {
    const filas = await this.prisma.$queryRaw<(Omit<FilaReserva, 'horasAprobacion'> & { horasAprobacion: number | null })[]>`
      SELECT t.reserva_id                                      AS "reservaId",
             t.solicitud_id                                    AS "solicitudId",
             t.solicitante_usuario_id                          AS "solicitanteId",
             es.codigo                                         AS "codigoEspacio",
             t.inicio, t.fin,
             t.estado::text                                    AS estado,
             t.espacio,
             se.nombre                                         AS sede,
             ta.nombre                                         AS "tipoActividad",
             t.origen::text                                    AS origen,
             t.asistentes,
             s.descripcion,
             t.solicitado_en                                   AS "solicitadoEn",
             ps.nombres || ' ' || ps.apellido_paterno          AS solicitante,
             pa.nombres || ' ' || pa.apellido_paterno          AS aprobador,
             (t.decision IS NOT NULL AND t.decidido_por_usuario_id IS NULL) AS "aprobacionAutomatica",
             extract(epoch FROM t.tiempo_aprobacion)::float / 3600 AS "horasAprobacion",
             pc.nombres || ' ' || pc.apellido_paterno          AS "canceladoPor",
             t.cancelado_en                                    AS "canceladoEn",
             t.motivo_cancelacion                              AS "motivoCancelacion"
        FROM reservas.v_reserva_trazabilidad t
        JOIN reservas.solicitud s       ON s.id = t.solicitud_id
        JOIN reservas.tipo_actividad ta ON ta.codigo = t.tipo_actividad
        JOIN reservas.reserva rr        ON rr.id = t.reserva_id
        JOIN institucion.espacio es     ON es.id = rr.espacio_id
        JOIN institucion.sede se        ON se.id = t.sede_id
        JOIN seguridad.usuario us       ON us.id = t.solicitante_usuario_id
        JOIN seguridad.persona ps       ON ps.id = us.persona_id
        LEFT JOIN seguridad.usuario ua  ON ua.id = t.decidido_por_usuario_id
        LEFT JOIN seguridad.persona pa  ON pa.id = ua.persona_id
        LEFT JOIN seguridad.usuario uc  ON uc.id = t.cancelado_por_usuario_id
        LEFT JOIN seguridad.persona pc  ON pc.id = uc.persona_id
       WHERE t.inicio < ${q.hasta} AND t.fin > ${q.desde}
         ${q.sedeId ? Prisma.sql`AND t.sede_id = ${q.sedeId}::uuid` : Prisma.empty}
       ORDER BY t.inicio
       LIMIT 5000`;
    return filas;
  }
}
