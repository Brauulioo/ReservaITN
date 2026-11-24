# @reservaitn/api

API REST de ReservaITN (NestJS 11 + Prisma 5). Concentra las reglas de negocio, los permisos por rol y
las validaciones; las reglas críticas (anti-choques, transiciones, auditoría, días no disponibles)
también las garantiza la base de datos (`packages/db`).

Publicada en Render: <https://reservaitn.onrender.com/api/health>. Documento técnico de los módulos:
`Documento técnico · ReservaITN` (M1–M4).

## Módulos

Un módulo NestJS por paquete de la EDT. Todas las rutas cuelgan de `/api`.

| Carpeta | EDT | Módulo DoD | Rutas principales | Permiso |
|---|---|---|---|---|
| `usuarios/` | 1.4.1 | M1 Login y roles | `POST /auth/login`, `GET /auth/yo`, `POST /auth/cambiar-clave`, `/usuarios` | público / sesión / `usuario:gestionar` |
| `recursos/` | 1.4.2 | M2 CRUD de salas | `/sedes`, `/espacios`, `/catalogos`, `/carreras`, `/espacios/:id/qr` | sesión / `recurso:gestionar` |
| `importacion/` | 1.4.3 | — | `POST /importaciones` (Excel), `GET /importaciones` | `planificacion:importar` |
| `reservas/` | 1.4.4 | M3 Reserva | `/reservas`, `/reservas/mias`, `/reservas/:id/cancelar`, `/solicitudes/pendientes`, `/solicitudes/:id/aprobar` | `reserva:solicitar` / `reserva:aprobar` |
| `sugerencia/` | 1.4.5 | M3 Reserva | `POST /sugerencia` | `reserva:solicitar` |
| `notificaciones/` | 1.4.6 | — | `/notificaciones/mias`, `/notificaciones/no-leidas`, `/notificaciones/leidas`, `POST /notificaciones/dispositivos` (push) | sesión |
| `dashboard/` | 1.4.7 | M4 Dashboard | `/dashboard/inicio`, `/ocupacion`, `/indicadores`, `/reservas`, `/reporte.xlsx` | `dashboard:ver` / `reporte:generar` |
| `proyeccion/` | 1.4.8 | M4 Dashboard | `GET /proyeccion` | `dashboard:ver` |
| `mantencion/` | 1.4.10 | — | `/mantencion/danios`, `/mantencion/ordenes`, `/mantencion/inspecciones` | `danio:reportar`, `danio:gestionar`, `inventario:registrar` |
| `calendario/` | — | M3 (V014) | `/calendario/periodos`, `/calendario/no-disponibles` | sesión / `calendario:gestionar` |
| `tareas/` | — | — | Procesos cada 15 s y cada minuto: cola de avisos, vencer pendientes, liberar sin check-in | — |
| `comun/` | — | — | `AuthGuard` (JWT + `@RequierePermiso`), `ZodPipe`, filtro de errores, Prisma con actor | — |

## Cómo funciona una petición

1. `AuthGuard` (global) valida el token `Bearer` y el permiso declarado con `@RequierePermiso`.
2. `ZodPipe` valida el cuerpo o la consulta con los esquemas de `@reservaitn/shared`.
3. El servicio escribe dentro de `prisma.conActor(usuarioId, …)`, que deja el autor en la auditoría.
4. `FiltroErrores` traduce los errores de la base (por ejemplo `reserva_sin_choque`) a mensajes en español.

## Ejecutar

```bash
cp apps/api/.env.example apps/api/.env
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm --filter @reservaitn/api dev
```

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | PostgreSQL 16 |
| `JWT_SECRET` | Firma de los tokens (8 h) |
| `PORT` | Puerto, 3001 por defecto |
| `CORS_ORIGIN` | Orígenes permitidos, separados por coma |
| `SMTP_URL`, `SMTP_FROM` | Envío de correos; sin `SMTP_URL` los correos quedan en cola |
| `WEB_URL` | Enlaces de los correos |
| `TZ` | `America/Santiago`: las reglas de horario son en hora de Chile |
| `TAREAS` | `off` desactiva los procesos periódicos (pruebas) |

## Probar

```bash
pnpm --filter @reservaitn/api test
pnpm --filter @reservaitn/api test:db
```

`test` corre las unitarias; `test:db` las de integración contra una base con migraciones y datos demo
(`apps/api/test/*.db.test.ts`). Las pruebas escriben en fechas lejanas al azar para no chocar entre sí.
