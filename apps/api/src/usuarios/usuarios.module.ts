import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ROLES, usuarioCreateSchema, type Rol, type UsuarioCreate } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { AuthGuard, Publico, RequierePermiso, UsuarioActual, type UsuarioSesion } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const loginSchema = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) });
const nuevoUsuarioSchema = usuarioCreateSchema.extend({ password: z.string().min(8, 'Mínimo 8 caracteres') });
const usuarioUpdateSchema = z.object({
  nombre: z.string().trim().min(3).max(120).optional(),
  rol: z.enum(ROLES).optional(),
  carreraId: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
});
const cambioClaveSchema = z.object({
  actual: z.string().min(1),
  nueva: z.string().min(8, 'Mínimo 8 caracteres'),
});
const SIN_HASH = { id: true, rut: true, email: true, nombre: true, rol: true, activo: true, carreraId: true } as const;

/** Usuarios, roles y acceso (E4 / WBS 1.4.1). */
@Controller()
class UsuariosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** POST /auth/login: devuelve el token JWT (8 h) y los datos de sesión. Rechaza cuentas inactivas. */
  @Publico()
  @Post('auth/login')
  async login(@Body(new ZodPipe(loginSchema)) dto: z.infer<typeof loginSchema>) {
    const u = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (!u || !u.activo || !(await bcrypt.compare(dto.password, u.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const sesion: UsuarioSesion = { id: u.id, rol: u.rol, carreraId: u.carreraId, nombre: u.nombre };
    return { token: this.jwt.sign(sesion), usuario: sesion };
  }

  /** GET /usuarios?rol: sin el hash de la contraseña. */
  @RequierePermiso('usuario:gestionar')
  @Get('usuarios')
  listar(@Query('rol') rol?: Rol) {
    return this.prisma.usuario.findMany({ where: { rol }, select: SIN_HASH, orderBy: { nombre: 'asc' } });
  }

  /** POST /usuarios: RUT validado y normalizado; contraseña inicial de 8+ caracteres. */
  @RequierePermiso('usuario:gestionar')
  @Post('usuarios')
  async crear(@Body(new ZodPipe(nuevoUsuarioSchema)) dto: UsuarioCreate & { password: string }) {
    const { password, ...datos } = dto;
    return this.prisma.usuario.create({
      data: { ...datos, passwordHash: await bcrypt.hash(password, 10) },
      select: SIN_HASH,
    });
  }

  /** PATCH /usuarios/:id: nombre, rol, carrera o activo. No permite desactivarse a sí mismo. */
  @RequierePermiso('usuario:gestionar')
  @Patch('usuarios/:id')
  async actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(usuarioUpdateSchema)) dto: z.infer<typeof usuarioUpdateSchema>,
    @UsuarioActual() u: UsuarioSesion,
  ) {
    if (id === u.id && dto.activo === false) throw new BadRequestException('No puede desactivar su propia cuenta');
    return this.prisma.usuario.update({ where: { id }, data: dto, select: SIN_HASH });
  }

  /** POST /auth/cambiar-clave: exige la contraseña actual. */
  @Post('auth/cambiar-clave')
  async cambiarClave(@Body(new ZodPipe(cambioClaveSchema)) dto: z.infer<typeof cambioClaveSchema>, @UsuarioActual() u: UsuarioSesion) {
    const actual = await this.prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await bcrypt.compare(dto.actual, actual.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    await this.prisma.usuario.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(dto.nueva, 10) } });
    return { ok: true };
  }
}

@Module({
  controllers: [UsuariosController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class UsuariosModule {}
