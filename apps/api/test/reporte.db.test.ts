import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { ReservasService } from '../src/reservas/reservas.service';
import { NotificacionesService } from '../src/notificaciones/notificaciones.module';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { construirReporteExcel } from '../src/dashboard/reporte-excel';
import type { UsuarioSesion } from '../src/comun/auth.guard';
import { a, espacio, lunesAlAzar, prisma, sesion } from './ayuda';

/** Reporte Excel (R13): mismas cifras que el dashboard, horas en hora de Chile, trazabilidad. */
const reservas = new ReservasService(prisma, new NotificacionesService());
const dashboard = new DashboardService(prisma);
const lunes = lunesAlAzar();
let libro: ExcelJS.Workbook;
let semana: { desde: Date; hasta: Date };
let docente: UsuarioSesion;

beforeAll(async () => {
  const [doc, dirInf, sub, est] = await Promise.all(['docente', 'dir.inf', 'subdireccion', 'estudiante'].map((x) => sesion(`${x}@itn.cl`)));
  docente = doc;
  const [a101, est1] = await Promise.all([espacio('A-101'), espacio('EST-1')]);
  const pedir = (u: UsuarioSesion, esp: string, dia: number, desde: string, hasta: string, descripcion: string, tipo = 'CLASE') =>
    reservas.solicitar({ espacioId: esp, inicio: a(lunes, dia, desde), fin: a(lunes, dia, hasta), tipoActividad: tipo, descripcion, asistentes: 5 }, u);

  const aprobada = await pedir(doc, a101.id, 0, '08:55', '10:10', 'Clase de recuperación');
  await reservas.decidir(aprobada.id, 'APROBADA', dirInf);
  await pedir(est, est1.id, 1, '15:00', '17:00', 'Grupo de estudio', 'ESTUDIO'); // pendiente
  const cancelada = await pedir(doc, a101.id, 2, '11:00', '12:00', 'Tutoría');
  await reservas.cancelar(cancelada.reserva[0].id, sub, 'Evento institucional en la sala');

  const q = { desde: a(lunes, 0, '00:00'), hasta: a(lunes, 7, '00:00') };
  semana = q;
  const [ocupacion, indicadores, filas] = await Promise.all([dashboard.ocupacion(q), dashboard.indicadores(q), dashboard.reservas(q)]);
  const buffer = await construirReporteExcel({
    institucion: 'Instituto Técnico del Norte', desde: q.desde, hasta: q.hasta, sede: null, generadoPor: sub.nombre,
    ocupacion, indicadores, reservas: filas,
  });
  libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ArrayBuffer);
});
afterAll(() => prisma.$disconnect());

const filasDeDatos = (hoja: string) => {
  const ws = libro.getWorksheet(hoja)!;
  const filas: ExcelJS.CellValue[][] = [];
  ws.eachRow((row, n) => { if (n > 4) filas.push((row.values as ExcelJS.CellValue[]).slice(1)); });
  return filas;
};

describe('lista de reservas para la app de Subdirección', () => {
  it('trae solicitud, solicitante y código del espacio para aprobar y filtrar por cuenta', async () => {
    const filas = await dashboard.reservas(semana);
    const delDocente = filas.filter((f) => f.solicitanteId === docente.id);
    expect(delDocente.length).toBeGreaterThanOrEqual(2);
    expect(delDocente.every((f) => f.solicitudId && f.codigoEspacio === 'A-101')).toBe(true);
  });
});

describe('reporte Excel', () => {
  it('tiene las cuatro hojas', () => {
    expect(libro.worksheets.map((w) => w.name)).toEqual(['Resumen', 'Ocupación por espacio', 'Reservas', 'Uso por jornada']);
  });

  it('el detalle trae cada reserva con hora de Chile, estado, aprobador y motivo de cancelación', () => {
    const ws = libro.getWorksheet('Reservas')!;
    expect((ws.getRow(4).values as string[]).slice(1, 4)).toEqual(['Fecha', 'Inicio', 'Término']);
    const filas = filasDeDatos('Reservas');
    expect(filas).toHaveLength(3);
    const [aprobada, pendiente, cancelada] = filas;
    const inicio = aprobada[1] as Date;
    expect([inicio.getUTCHours(), inicio.getUTCMinutes()]).toEqual([8, 55]); // se lee 08:55 en Excel
    expect(aprobada.slice(11, 13)).toEqual(['Aprobada', 'Director Informática']);
    expect(pendiente[11]).toBe('Pendiente');
    expect(cancelada[11]).toBe('Cancelada');
    expect(cancelada.slice(15, 17)).toEqual(['Pedro Fernández', 'Evento institucional en la sala']);
    expect(cancelada[9]).toBe(`${docente.nombre}`);
  });

  it('el resumen coincide con el dashboard', () => {
    const ws = libro.getWorksheet('Resumen')!;
    const valores: Record<string, ExcelJS.CellValue> = {};
    ws.eachRow((row) => { const v = row.values as ExcelJS.CellValue[]; if (typeof v[1] === 'string') valores[v[1]] = v[2]; });
    expect(valores['Reservas aprobadas']).toBe(1);
    expect(valores['Pendientes de aprobación']).toBe(1);
    expect(valores['Canceladas']).toBe(1);
    expect(valores['Generado por']).toBe('Pedro Fernández');
  });

  it('el uso por jornada suma las horas aprobadas en el día y la jornada correctos', () => {
    const lunesFila = filasDeDatos('Uso por jornada').find((f) => f[0] === 'Lunes')!;
    expect(lunesFila.slice(1, 5)).toEqual([1.3, 0, 0, 1.3]); // 08:55–10:10 = 1,25 h → mañana
  });
});

describe('inicio de Subdirección (4 gráficos)', () => {
  it('mapa de calor, jornadas, no usadas e indicadores salen de las mismas reservas', async () => {
    const r = await dashboard.inicio(semana);
    expect(r.indicadores).toMatchObject({ aprobadas: 1, pendientes: 1, solicitudes: 3, noUsadas: 1 });
    // 08:55–10:10 del lunes: 5 min en el bloque de 8, la hora completa de 9 y 10 min en el de 10
    const lunesCalor = r.mapaCalor.valores[0];
    expect(lunesCalor[1]).toBeCloseTo(1 / r.salas, 3);
    expect(lunesCalor[0]).toBeCloseTo(5 / 60 / r.salas, 3);
    expect(r.mapaCalor.valores[1].every((v) => v === 0)).toBe(true); // la del martes está pendiente
    const [manana, tarde] = r.capacidadPorJornada;
    expect(manana.horasOcupadas).toBe(1.3);
    expect(tarde.horasOcupadas).toBe(0);
    expect(manana.horasOcupadas + manana.horasLibres).toBeCloseTo(manana.horasDisponibles, 1);
    expect(r.noUsadasPorSala.find((x) => x.codigo === 'A-101')).toMatchObject({ canceladas: 1, total: 1 });
    expect(r.ocupacionPorSala).toHaveLength(r.salas);
  });

  it('el filtro por tipo de espacio deja fuera la sala de estudio', async () => {
    const r = await dashboard.inicio(semana, 'SALA');
    expect(r.ocupacionPorSala.every((s) => s.tipo === 'Sala de clases')).toBe(true);
    expect(r.indicadores.pendientes).toBe(0); // la pendiente era en EST-1
    expect(r.indicadores.aprobadas).toBe(1);
  });
});
