import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { periodoNoDisponibleSchema, type PeriodoNoDisponible } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';
import { ReservasModule } from '../reservas/reservas.module';
import { ReservasService } from '../reservas/reservas.service';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD');
const rangoSchema = z
  .object({ desde: fecha, hasta: fecha, sedeId: z.string().uuid().optional() })
  .refine((r) => r.hasta >= r.desde, { message: 'La fecha final no puede ser anterior a la inicial' })
  .refine((r) => (Date.parse(r.hasta) - Date.parse(r.desde)) / 86_400_000 <= 400, { message: 'Consulte como máximo un año' });
const afectadasSchema = z.object({
  desde: fecha,
  hasta: fecha,
  sedeId: z.string().uuid().optional(),
  repetirAnios: z.coerce.number().int().min(0).max(30).default(0),
});

type Afectada = { id: string; inicio: Date; fin: Date; estado: string; espacio: string; solicitante: string };

/**
 * Calendario institucional (V014): días y períodos no disponibles para reservar.
 * Los fines de semana se bloquean siempre; los períodos los define Subdirección por días completos
 * (00:00 a 23:59) y se pueden repetir cada año. La base rechaza las reservas en esos días.
 */
@Controller('calendario')
export class CalendarioController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservas: ReservasService,
  ) {}

  @Get('periodos')
  periodos() {
    return this.prisma.$queryRaw`
      SELECT p.id, p.motivo, to_char(p.desde, 'YYYY-MM-DD') AS desde, to_char(p.hasta, 'YYYY-MM-DD') AS hasta,
             p.sede_id AS "sedeId", s.nombre AS sede, p.repetir_anios AS "repetirAnios",
             (p.hasta - p.desde + 1) AS dias,
             to_char(p.hasta + make_interval(years => p.repetir_anios), 'YYYY-MM-DD') AS "ultimoHasta",
             p.creado_en AS "creadoEn"
        FROM institucion.periodo_no_disponible p
        LEFT JOIN institucion.sede s ON s.id = p.sede_id
       WHERE p.activo
       ORDER BY p.desde`;
  }

  /** Días no disponibles de un rango, con su motivo: para sombrear calendarios. */
  @Get('no-disponibles')
  async noDisponibles(@Query(new ZodPipe(rangoSchema)) q: z.infer<typeof rangoSchema>) {
    const filas = await this.prisma.$queryRaw<{ fecha: string; motivo: string }[]>`
      SELECT to_char(d, 'YYYY-MM-DD') AS fecha, institucion.motivo_no_disponible(${q.sedeId ?? null}::uuid, d::date) AS motivo
        FROM generate_series(${q.desde}::date, ${q.hasta}::date, interval '1 day') d
       WHERE institucion.motivo_no_disponible(${q.sedeId ?? null}::uuid, d::date) IS NOT NULL
       ORDER BY d`;
    return filas;
  }

  /** Reservas vigentes que caerían en el período (antes de crearlo). */
  @RequierePermiso('calendario:gestionar')
  @Get('periodos/afectadas')
  afectadas(@Query(new ZodPipe(afectadasSchema)) q: z.infer<typeof afectadasSchema>) {
    if (q.hasta < q.desde) throw new BadRequestException('La fecha final no puede ser anterior a la inicial');
    return this.buscarAfectadas(q.desde, q.hasta, q.sedeId ?? null, q.repetirAnios);
  }

  @RequierePermiso('calendario:gestionar')
  @Post('periodos')
  async crear(@Body(new ZodPipe(periodoNoDisponibleSchema)) dto: PeriodoNoDisponible, @UsuarioActual() u: UsuarioSesion) {
    const afectadas = await this.buscarAfectadas(dto.desde, dto.hasta, dto.sedeId ?? null, dto.repetirAnios);
    let canceladas = 0;
    if (dto.cancelarAfectadas) {
      const motivo = `Día no disponible: ${dto.motivo.trim()}`;
      for (const r of afectadas) {
        await this.reservas.cancelar(r.id, u, motivo);
        canceladas++;
      }
    }
    const [creado] = await this.prisma.conActor(u.id, (tx) =>
      tx.$queryRaw<{ id: string }[]>`
        INSERT INTO institucion.periodo_no_disponible (motivo, desde, hasta, sede_id, repetir_anios, creado_por)
        VALUES (${dto.motivo.trim()}, ${dto.desde}::date, ${dto.hasta}::date, ${dto.sedeId ?? null}::uuid, ${dto.repetirAnios}, ${u.id}::uuid)
        RETURNING id`,
    );
    return { id: creado.id, afectadas: afectadas.length, canceladas, sinCancelar: afectadas.length - canceladas };
  }

  /** Quita un período: deja de bloquear desde ya (queda en la auditoría). */
  @RequierePermiso('calendario:gestionar')
  @Patch('periodos/:id/quitar')
  async quitar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() u: UsuarioSesion) {
    const filas = await this.prisma.conActor(u.id, (tx) =>
      tx.$queryRaw<{ id: string }[]>`
        UPDATE institucion.periodo_no_disponible SET activo = false WHERE id = ${id}::uuid AND activo RETURNING id`,
    );
    if (!filas.length) throw new NotFoundException('Período no encontrado');
    return { ok: true };
  }

  private buscarAfectadas(desde: string, hasta: string, sedeId: string | null, repetirAnios: number) {
    return this.prisma.$queryRaw<Afectada[]>`
      SELECT r.id, r.inicio, r.fin, r.estado::text AS estado, es.nombre AS espacio,
             pe.nombres || ' ' || pe.apellido_paterno AS solicitante
        FROM reservas.reserva r
        JOIN reservas.solicitud s ON s.id = r.solicitud_id
        JOIN institucion.espacio es ON es.id = r.espacio_id
        JOIN institucion.edificio ed ON ed.id = es.edificio_id
        JOIN seguridad.usuario us ON us.id = s.solicitante_usuario_id
        JOIN seguridad.persona pe ON pe.id = us.persona_id
       WHERE r.estado IN ('APROBADA', 'PENDIENTE')
         AND s.origen <> 'MANTENCION'
         AND r.inicio >= now()
         AND (${sedeId}::uuid IS NULL OR ed.sede_id = ${sedeId}::uuid)
         AND EXISTS (
           SELECT 1 FROM generate_series(0, ${repetirAnios}::int) k
            WHERE (r.inicio AT TIME ZONE 'America/Santiago')::date
                  BETWEEN (${desde}::date + make_interval(years => k))::date AND (${hasta}::date + make_interval(years => k))::date)
       ORDER BY r.inicio
       LIMIT 500`;
  }
}

@Module({ imports: [ReservasModule], controllers: [CalendarioController] })
export class CalendarioModule {}
