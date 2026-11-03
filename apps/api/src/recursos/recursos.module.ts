import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { salaCreateSchema, type SalaCreate } from '@reservaitn/shared';
import { PrismaService } from '../comun/prisma.service';
import { RequierePermiso } from '../comun/auth.guard';
import { ZodPipe } from '../comun/zod.pipe';

const salaUpdateSchema = salaCreateSchema.partial().extend({ activa: z.boolean().optional() });
type SalaUpdate = z.infer<typeof salaUpdateSchema>;

/** Recursos: sedes, salas y laboratorios (E5 / WBS 1.4.2). */
@Controller()
class RecursosController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /sedes */
  @Get('sedes')
  sedes() {
    return this.prisma.sede.findMany({ orderBy: { nombre: 'asc' } });
  }

  /** GET /carreras: para salas exclusivas (R8) y usuarios. */
  @Get('carreras')
  carreras() {
    return this.prisma.carrera.findMany({ orderBy: { nombre: 'asc' } });
  }

  /** GET /salas?sedeId&tipo&todas: solo activas; `todas=1` incluye las desactivadas (pantalla de gestión). */
  @Get('salas')
  salas(@Query('sedeId') sedeId?: string, @Query('tipo') tipo?: 'SALA' | 'LABORATORIO', @Query('todas') todas?: string) {
    return this.prisma.sala.findMany({
      where: { activa: todas === '1' ? undefined : true, sedeId, tipo },
      include: { sede: true, carreraExclusiva: true },
      orderBy: [{ sede: { nombre: 'asc' } }, { codigo: 'asc' }],
    });
  }

  /** POST /salas: el código es único por sede. */
  @RequierePermiso('recurso:gestionar')
  @Post('salas')
  crear(@Body(new ZodPipe(salaCreateSchema)) dto: SalaCreate) {
    return this.prisma.sala.create({ data: dto });
  }

  /** PATCH /salas/:id: cambios parciales; `activa: false` la saca de reservas y sugerencias. */
  @RequierePermiso('recurso:gestionar')
  @Patch('salas/:id')
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(salaUpdateSchema)) dto: SalaUpdate) {
    return this.prisma.sala.update({ where: { id }, data: dto });
  }
}

@Module({ controllers: [RecursosController] })
export class RecursosModule {}
