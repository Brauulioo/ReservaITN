import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Ejecuta `fn` en una transacción identificando al usuario que actúa, para que
   * auditoria.evento registre quién hizo cada cambio (ver V009). Toda escritura de negocio
   * debe pasar por aquí.
   */
  conActor<T>(usuarioId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    // Límites holgados: en la nube la API y la base pueden estar en regiones distintas y cada
    // consulta suma la latencia de red (el valor por defecto de Prisma es 5 s)
    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.usuario_id', ${usuarioId}, true)`;
        return fn(tx);
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
