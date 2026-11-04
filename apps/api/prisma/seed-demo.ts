/*
 * Datos de demostración: ~10 semanas de reservas para que el dashboard, la proyección y los
 * reportes CSV tengan contenido. Requiere haber corrido antes `prisma:seed` (usuarios y salas).
 *
 * - Respeta el anti-choques: no crea reservas APROBADAS que se solapen entre sí ni con las existentes.
 * - Es determinista (misma semilla = mismos datos) y se ejecuta una sola vez: la bitácora es de solo
 *   inserción (R7), así que estos datos no se pueden borrar. Cada uno queda marcado en su historial.
 *
 * Uso: pnpm --filter @reservaitn/api prisma:seed-demo
 */
process.env.TZ ??= 'America/Santiago';
import { randomUUID } from 'node:crypto';
import { PrismaClient, type EstadoReserva, type OrigenReserva, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const MARCA = 'Dato de demostración (seed-demo)';
const SEMANAS_ATRAS = 8;
const SEMANAS_ADELANTE = 2;

/** Bloques de clase del ITN (hora, minuto, duración en minutos). Sin solape entre ellos. */
const BLOQUES = [
  [8, 30, 90], [10, 15, 90], [12, 0, 90], [14, 30, 90], [16, 15, 90], [19, 0, 90], [20, 45, 90],
] as const;

/** Probabilidad de que un bloque esté ocupado, por día (1 = lunes) y bloque: más uso a media semana en la mañana. */
const DEMANDA: Record<number, number[]> = {
  1: [0.65, 0.7, 0.45, 0.5, 0.4, 0.35, 0.2],
  2: [0.8, 0.85, 0.55, 0.6, 0.5, 0.45, 0.3],
  3: [0.85, 0.9, 0.6, 0.65, 0.55, 0.5, 0.3],
  4: [0.8, 0.85, 0.55, 0.6, 0.5, 0.45, 0.25],
  5: [0.6, 0.65, 0.4, 0.3, 0.2, 0.15, 0.05],
  6: [0.35, 0.4, 0.2, 0.05, 0.0, 0.0, 0.0],
};

const ASIGNATURAS: Record<string, string[]> = {
  INF: ['Programación I', 'Programación II', 'Bases de Datos', 'Redes y Comunicaciones', 'Desarrollo Web', 'Soporte Computacional', 'Taller de Integración'],
  ENF: ['Fundamentos de Enfermería', 'Anatomía', 'Procedimientos Clínicos', 'Primeros Auxilios', 'Farmacología Básica'],
  GEN: ['Matemática Aplicada', 'Comunicación Efectiva', 'Inglés Técnico', 'Emprendimiento', 'Ética Profesional'],
};
const SOLICITUDES = ['Ayudantía', 'Reunión de carrera', 'Taller de reforzamiento', 'Evaluación recuperativa', 'Charla de empleabilidad', 'Estudio grupal'];

/** Generador pseudoaleatorio con semilla (mulberry32), para que los datos sean reproducibles. */
function azar(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = azar(20261104);
const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const horas = (ms: number) => ms * 3_600_000;

async function main() {
  if (await prisma.eventoReserva.findFirst({ where: { comentario: MARCA } })) {
    console.log('Los datos de demostración ya estaban cargados; no se agregó nada.');
    return;
  }

  const salas = await prisma.sala.findMany({ where: { activa: true }, include: { carreraExclusiva: true } });
  const u = Object.fromEntries((await prisma.usuario.findMany()).map((x) => [x.email, x]));
  const req = ['subdireccion@itn.cl', 'academica@itn.cl', 'dir.inf@itn.cl', 'docente@itn.cl', 'estudiante@itn.cl', 'operaciones@itn.cl'];
  const faltan = req.filter((e) => !u[e]);
  if (!salas.length || faltan.length) throw new Error(`Ejecute primero prisma:seed (faltan salas o usuarios: ${faltan.join(', ')})`);

  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7) - 7 * SEMANAS_ATRAS);
  const fin = new Date(lunes.getTime() + horas(24 * 7 * (SEMANAS_ATRAS + SEMANAS_ADELANTE)));

  // Reservas aprobadas que ya existen: las nuevas no pueden chocar con ellas
  const ocupadas = await prisma.reserva.findMany({
    where: { estado: 'APROBADA', inicio: { lt: fin }, fin: { gt: lunes } },
    select: { salaId: true, inicio: true, fin: true },
  });
  const choca = (salaId: string, i: Date, f: Date) => ocupadas.some((o) => o.salaId === salaId && o.inicio < f && o.fin > i);

  const reservas: Prisma.ReservaCreateManyInput[] = [];
  const eventos: Prisma.EventoReservaCreateManyInput[] = [];

  for (let d = new Date(lunes); d < fin; d.setDate(d.getDate() + 1)) {
    const dia = d.getDay();
    if (dia === 0) continue;
    for (const sala of salas) {
      const carrera = sala.carreraExclusiva?.codigo ?? elegir(['INF', 'ENF', 'GEN', 'GEN'] as const);
      BLOQUES.forEach(([h, m, dur], b) => {
        const factorSala = sala.tipo === 'LABORATORIO' ? 0.9 : 1;
        if (r() > DEMANDA[dia]![b]! * factorSala) return;
        const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        const termino = new Date(inicio.getTime() + dur * 60_000);
        if (choca(sala.id, inicio, termino)) return;

        const pasada = termino < hoy;
        // Sábado en la tarde de los laboratorios: bloqueo de mantención (R15)
        const origen: OrigenReserva = dia === 6 && b === 2 && sala.tipo === 'LABORATORIO' ? 'MANTENCION' : r() < 0.6 ? 'PLANIFICACION' : 'SOLICITUD';
        const solicitante =
          origen === 'MANTENCION' ? u['operaciones@itn.cl']! :
          origen === 'PLANIFICACION' ? u['academica@itn.cl']! :
          elegir([u['docente@itn.cl']!, u['docente@itn.cl']!, u['estudiante@itn.cl']!, u['dir.inf@itn.cl']!]);
        const autoaprobada = origen !== 'SOLICITUD' || solicitante.rol === 'DIRECCION_ACADEMICA' || solicitante.rol === 'SUBDIRECCION';

        // Estado según el resultado típico de cada tipo de reserva
        const x = r();
        let estado: EstadoReserva = 'APROBADA';
        if (origen === 'SOLICITUD') {
          if (!pasada && x < 0.3) estado = 'PENDIENTE';
          else if (x < 0.08) estado = 'RECHAZADA';
          else if (x < 0.14) estado = 'CANCELADA';
          else if (pasada && x < 0.22) estado = 'LIBERADA';
        } else if (pasada && origen === 'PLANIFICACION' && x < 0.05) estado = 'LIBERADA';

        const creadaEn = origen === 'PLANIFICACION'
          ? new Date(lunes.getTime() - horas(24 * 10))
          : new Date(inicio.getTime() - horas(24 * (1 + Math.floor(r() * 9))));
        const aprobador = autoaprobada ? solicitante : elegir([u['dir.inf@itn.cl']!, u['academica@itn.cl']!]);
        const decidida = estado !== 'PENDIENTE';
        const decididaEn = decidida ? new Date(creadaEn.getTime() + (autoaprobada ? 0 : horas(1 + r() * 30))) : null;
        const asistentes = Math.max(5, Math.min(sala.capacidad, Math.round(sala.capacidad * (0.55 + r() * 0.45))));
        const motivo = origen === 'MANTENCION' ? 'Mantención preventiva de equipos' : origen === 'PLANIFICACION' ? elegir(ASIGNATURAS[carrera]!) : elegir(SOLICITUDES);

        const id = randomUUID();
        reservas.push({
          id, salaId: sala.id, solicitanteId: solicitante.id, inicio, fin: termino, motivo, asistentes, estado, origen, creadaEn,
          aprobadorId: decidida && estado !== 'CANCELADA' ? aprobador.id : null,
          decididaEn: estado === 'CANCELADA' ? null : decididaEn,
          checkInEn: pasada && estado === 'APROBADA' ? new Date(inicio.getTime() + 5 * 60_000) : null,
        });
        if (estado === 'APROBADA') ocupadas.push({ salaId: sala.id, inicio, fin: termino });

        const inicial: EstadoReserva = autoaprobada ? 'APROBADA' : 'PENDIENTE';
        eventos.push({ reservaId: id, actorId: solicitante.id, accion: 'CREADA', estadoNuevo: inicial, comentario: MARCA, creadoEn: creadaEn });
        if (!autoaprobada && decidida && estado !== 'CANCELADA') {
          const aprobada = estado !== 'RECHAZADA';
          eventos.push({ reservaId: id, actorId: aprobador.id, accion: aprobada ? 'APROBADA' : 'RECHAZADA', estadoAnterior: 'PENDIENTE', estadoNuevo: aprobada ? 'APROBADA' : 'RECHAZADA', creadoEn: decididaEn! });
        }
        if (estado === 'CANCELADA') {
          eventos.push({ reservaId: id, actorId: solicitante.id, accion: 'CANCELADA', estadoAnterior: inicial, estadoNuevo: 'CANCELADA', comentario: 'Ya no se necesita la sala', creadoEn: new Date(creadaEn.getTime() + horas(12)) });
        }
        if (estado === 'LIBERADA') {
          eventos.push({ reservaId: id, actorId: u['operaciones@itn.cl']!.id, accion: 'LIBERADA', estadoAnterior: 'APROBADA', estadoNuevo: 'LIBERADA', comentario: 'Sin check-in a los 15 minutos', creadoEn: new Date(inicio.getTime() + 15 * 60_000) });
        }
      });
    }
  }

  await prisma.$transaction([
    prisma.reserva.createMany({ data: reservas }),
    prisma.eventoReserva.createMany({ data: eventos }),
  ]);
  const por = (e: EstadoReserva) => reservas.filter((x) => x.estado === e).length;
  console.log(
    `Datos de demostración cargados: ${reservas.length} reservas (${por('APROBADA')} aprobadas, ${por('PENDIENTE')} pendientes, ` +
      `${por('RECHAZADA')} rechazadas, ${por('CANCELADA')} canceladas, ${por('LIBERADA')} liberadas) y ${eventos.length} eventos.`,
  );
}

main().finally(() => prisma.$disconnect());
