# @reservaitn/shared

Código compartido por la API, la web y la app: los mismos esquemas de validación, roles y reglas de
negocio en los tres lados, para que un dato inválido se rechace igual en todas partes.

| Archivo | Contenido | Lo usan |
|---|---|---|
| `src/schemas.ts` | Esquemas Zod: `loginSchema`, `usuarioCreateSchema`, `espacioCreateSchema`, `reservaCreateSchema` (horario, duración, fines de semana, series), `rangoFechasSchema`, `periodoNoDisponibleSchema`, importación, mantención | M1–M4 |
| `src/roles.ts` | Roles, permisos (`PERMISOS`) y `tienePermiso()` | M1 |
| `src/errores-zod.ts` | Mensajes de validación en español (`z.config`), activos al importar el paquete | Todos |
| `src/validaciones.ts` | RUT chileno: validar y normalizar | M1 |
| `src/reglas/sugerencia.ts` | Sala sugerida y alternativas a ± 30 min | M3 |
| `src/reglas/choques.ts`, `estados.ts` | Solapes de horario y transiciones de estado (espejo de la base) | M3 |
| `src/reglas/ocupacion.ts`, `planificacion.ts` | Índice de ocupación y ranking de jornadas | M4 |

## Uso

```ts
import { reservaCreateSchema, tienePermiso } from '@reservaitn/shared';
```

La app y la web importan la versión compilada (`dist/`): después de cambiar algo aquí, compile con
`pnpm --filter @reservaitn/shared build`. EAS lo compila solo (`eas-build-post-install`).

## Probar

```bash
pnpm --filter @reservaitn/shared test
```
