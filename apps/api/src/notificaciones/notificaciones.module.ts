import { Controller, Get, Global, Injectable, Module, Param, Patch } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';

/**
 * Notificaciones (R6 / E8 / WBS 1.4.6). Hoy registra en BD (bandeja in-app).
 * Siguiente paso: un worker que envíe correo (SMTP) y push (Expo) usando `enviadaEn`.
 */
@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea un aviso por usuario (sin duplicados) dentro de la transacción de quien lo origina. */
  notificar(
    tx: Prisma.TransactionClient,
    usuarioIds: string[],
    titulo: string,
    cuerpo: string,
    reservaId?: string,
  ) {
    const unicos = [...new Set(usuarioIds)];
    return tx.notificacion.createMany({
      data: unicos.map((usuarioId) => ({ usuarioId, titulo, cuerpo, reservaId })),
    });
  }
}

@Controller('notificaciones')
class NotificacionesController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /notificaciones/mias: los 50 avisos más recientes del usuario. */
  @Get('mias')
  mias(@UsuarioActual() u: UsuarioSesion) {
    return this.prisma.notificacion.findMany({
      where: { usuarioId: u.id },
      orderBy: { creadaEn: 'desc' },
      take: 50,
    });
  }

  /** PATCH /notificaciones/leidas: marca como leídos todos los avisos del usuario. */
  @Patch('leidas')
  todasLeidas(@UsuarioActual() u: UsuarioSesion) {
    return this.prisma.notificacion.updateMany({ where: { usuarioId: u.id, leida: false }, data: { leida: true } });
  }

  /** PATCH /notificaciones/:id/leida: solo afecta avisos del propio usuario. */
  @Patch(':id/leida')
  leida(@UsuarioActual() u: UsuarioSesion, @Param('id') id: string) {
    return this.prisma.notificacion.updateMany({ where: { id, usuarioId: u.id }, data: { leida: true } });
  }
}

@Global()
@Module({
  providers: [NotificacionesService],
  controllers: [NotificacionesController],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
