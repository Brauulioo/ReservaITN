import { Body, Controller, Get, Global, Injectable, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { dispositivoSchema } from '@reservaitn/shared';
import { ZodPipe } from '../comun/zod.pipe';
import { PrismaService, type Tx } from '../comun/prisma.service';
import { UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { EnviosService } from './envios.service';

export interface Referencia {
  solicitudId?: string;
  reservaId?: string;
  ordenTrabajoId?: string;
}

/**
 * Notificaciones (R6 / E8 / WBS 1.4.6, D18). Se escriben en la misma transacción que la acción
 * de negocio (patrón outbox): la bandeja de la app queda en `notificacion` y los correos y push
 * en `envio`, que un proceso despacha con reintentos. Respeta las preferencias de cada usuario.
 */
@Injectable()
export class NotificacionesService {
  async notificar(tx: Tx, usuarioIds: string[], evento: string, titulo: string, cuerpo: string, ref: Referencia = {}) {
    const unicos = [...new Set(usuarioIds)];
    if (!unicos.length) return;
    const [apagadas, conDispositivo] = await Promise.all([
      tx.preferencia.findMany({ where: { usuario_id: { in: unicos }, evento_codigo: evento, activo: false } }),
      tx.dispositivo.findMany({ where: { usuario_id: { in: unicos } }, select: { usuario_id: true }, distinct: ['usuario_id'] }),
    ]);
    const apagado = (u: string, canal: string) => apagadas.some((p) => p.usuario_id === u && p.canal === canal);
    const tienePush = new Set(conDispositivo.map((d) => d.usuario_id));

    // Dos consultas en total (avisos y envíos), sin importar cuántos destinatarios haya:
    // cada viaje a la base cuenta cuando la API y la base están en regiones distintas
    const destinos = unicos
      .map((usuarioId) => ({
        usuarioId,
        canales: [
          ...(!apagado(usuarioId, 'CORREO') ? (['CORREO'] as const) : []),
          ...(tienePush.has(usuarioId) && !apagado(usuarioId, 'PUSH') ? (['PUSH'] as const) : []),
        ],
      }))
      .filter((d) => !(apagado(d.usuarioId, 'APP') && d.canales.length === 0));
    if (!destinos.length) return;
    const creadas = await tx.notificacion.createManyAndReturn({
      data: destinos.map((d) => ({
        usuario_id: d.usuarioId,
        evento_codigo: evento,
        titulo,
        cuerpo,
        solicitud_id: ref.solicitudId,
        reserva_id: ref.reservaId,
        orden_trabajo_id: ref.ordenTrabajoId,
      })),
      select: { id: true, usuario_id: true },
    });
    const envios = creadas.flatMap((n) =>
      (destinos.find((d) => d.usuarioId === n.usuario_id)?.canales ?? []).map((canal) => ({ notificacion_id: n.id, canal })),
    );
    if (envios.length) await tx.envio.createMany({ data: envios });
  }
}

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('mias')
  mias(@UsuarioActual() u: UsuarioSesion) {
    return this.prisma.notificacion.findMany({
      where: { usuario_id: u.id },
      select: { id: true, evento_codigo: true, titulo: true, cuerpo: true, leida_en: true, creado_en: true, solicitud_id: true, reserva_id: true },
      orderBy: { creado_en: 'desc' },
      take: 50,
    });
  }

  @Get('no-leidas')
  async noLeidas(@UsuarioActual() u: UsuarioSesion) {
    return { total: await this.prisma.notificacion.count({ where: { usuario_id: u.id, leida_en: null } }) };
  }

  /**
   * Registra el celular para recibir notificaciones push. Si el mismo celular se usó con otra
   * cuenta, pasa a la cuenta actual (un token = un dispositivo).
   */
  @Post('dispositivos')
  async registrarDispositivo(@Body(new ZodPipe(dispositivoSchema)) d: z.infer<typeof dispositivoSchema>, @UsuarioActual() u: UsuarioSesion) {
    await this.prisma.dispositivo.upsert({
      where: { token_push: d.token },
      create: { usuario_id: u.id, token_push: d.token, plataforma: d.plataforma },
      update: { usuario_id: u.id, plataforma: d.plataforma, ultimo_uso: new Date() },
    });
    return { registrado: true };
  }

  /** Marca como leídos todos los avisos del usuario (botón "Marcar todo como leído"). */
  @Patch('leidas')
  todasLeidas(@UsuarioActual() u: UsuarioSesion) {
    return this.prisma.notificacion.updateMany({ where: { usuario_id: u.id, leida_en: null }, data: { leida_en: new Date() } });
  }

  @Patch(':id/leida')
  leida(@UsuarioActual() u: UsuarioSesion, @Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.notificacion.updateMany({
      where: { id, usuario_id: u.id, leida_en: null },
      data: { leida_en: new Date() },
    });
  }
}

@Global()
@Module({
  providers: [NotificacionesService, EnviosService],
  controllers: [NotificacionesController],
  exports: [NotificacionesService, EnviosService],
})
export class NotificacionesModule {}
