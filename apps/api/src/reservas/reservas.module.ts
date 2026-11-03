import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { decisionReservaSchema, reservaCreateSchema, type ReservaCreate } from '@reservaitn/shared';
import { ReservasService } from './reservas.service';
import { RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const disponibilidadSchema = z.object({
  desde: z.coerce.date(),
  hasta: z.coerce.date(),
  salaId: z.string().uuid().optional(),
});
type Decision = z.infer<typeof decisionReservaSchema>;

/** Reservas, aprobaciones, cancelación y anti-choques (E6 / WBS 1.4.4). */
@Controller('reservas')
class ReservasController {
  constructor(private readonly svc: ReservasService) {}

  /** GET /reservas/ocupacion?desde&hasta&salaId: reservas aprobadas en el rango (calendario, R3). */
  @Get('ocupacion')
  ocupacion(@Query(new ZodPipe(disponibilidadSchema)) q: z.infer<typeof disponibilidadSchema>) {
    return this.svc.ocupaciones(q.desde, q.hasta, q.salaId);
  }

  /** GET /reservas/mias: reservas del usuario conectado (pantalla "Mis reservas"). */
  @Get('mias')
  mias(@UsuarioActual() u: UsuarioSesion) {
    return this.svc.mias(u);
  }

  /** GET /reservas/pendientes: bandeja del aprobador, filtrada por rol y carrera. */
  @RequierePermiso('reserva:aprobar')
  @Get('pendientes')
  pendientes(@UsuarioActual() u: UsuarioSesion) {
    return this.svc.pendientes(u);
  }

  /** POST /reservas: Subdirección y Dirección Académica quedan aprobadas; el resto, pendientes. */
  @RequierePermiso('reserva:solicitar')
  @Post()
  solicitar(@Body(new ZodPipe(reservaCreateSchema())) dto: ReservaCreate, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.solicitar(dto, u);
  }

  /** POST /reservas/:id/aprobar: 409 si choca con otra aprobada (EXCLUDE en la BD). */
  @RequierePermiso('reserva:aprobar')
  @Post(':id/aprobar')
  aprobar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionReservaSchema)) b: Decision, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.decidir(id, 'APROBAR', u, b.comentario);
  }

  /** POST /reservas/:id/rechazar */
  @RequierePermiso('reserva:aprobar')
  @Post(':id/rechazar')
  rechazar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionReservaSchema)) b: Decision, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.decidir(id, 'RECHAZAR', u, b.comentario);
  }

  /** POST /reservas/:id/cancelar: la propia, o cualquiera con `reserva:cancelar_cualquiera` (R5). */
  @Post(':id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(decisionReservaSchema)) b: Decision, @UsuarioActual() u: UsuarioSesion) {
    return this.svc.decidir(id, 'CANCELAR', u, b.comentario);
  }

  /** GET /reservas/:id/historial: bitácora de eventos (R7). */
  @Get(':id/historial')
  historial(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.historial(id);
  }
}

@Module({ controllers: [ReservasController], providers: [ReservasService], exports: [ReservasService] })
export class ReservasModule {}
