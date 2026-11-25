# @reservaitn/web

Web de ReservaITN (Next.js 16 + React 19). No guarda datos: todo lo pide a la API (`apps/api`) con el
token de la sesión. Publicada en Vercel: <https://reserva-itn-v2.vercel.app>.

El detalle de pantallas, identidad visual y cómo agregar una pantalla está en
[`docs/09-web.md`](../../docs/09-web.md). Documento técnico de los módulos: `Documento técnico · ReservaITN` (M1–M4).

## Pantallas

El menú lateral muestra cada entrada solo si el rol tiene su permiso (`components/Panel.tsx`); la API
vuelve a verificarlo.

| Ruta | Permiso | Módulo DoD |
|---|---|---|
| `/login` | público | M1 |
| `/inicio` | sesión (con `dashboard:ver` muestra los 4 gráficos de Subdirección) | M4 |
| `/reservar`, `/calendario`, `/mis-reservas` | `reserva:solicitar` (calendario: sesión) | M3 |
| `/aprobaciones` | `reserva:aprobar` | M3 |
| `/dashboard` | `dashboard:ver` | M4 |
| `/salas` | `recurso:gestionar` | M2 |
| `/dias-no-disponibles` | `calendario:gestionar` | M3 (V014) |
| `/usuarios` | `usuario:gestionar` | M1 |
| `/importacion` | `planificacion:importar` | — |
| `/mantencion` | `danio:gestionar` · `mantencion:planificar` | — |
| `/notificaciones`, `/perfil` | sesión | — |

## Estructura

```
app/
  login/            inicio de sesión (foto del campus, cuentas demo)
  (panel)/          pantallas con menú lateral; layout.tsx monta el Panel
  globals.css       tokens de color (claro y oscuro), barra lateral, gráficos
components/
  Panel.tsx         menú por permisos, contadores, ConPermiso
  InicioSubdireccion.tsx  inicio con 4 gráficos y filtros
  Administracion.tsx      salas y usuarios
  ui.tsx            íconos, cabecera, avisos, useDatos
lib/api.ts          cliente de la API y sesión
```

## Ejecutar

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @reservaitn/web dev
```

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_API_URL` | Dirección de la API (`http://localhost:3001/api` en local) |
| `NEXT_PUBLIC_MOSTRAR_DEMO` | `true` muestra las cuentas de demostración en el login publicado |

Build de producción: `pnpm --filter @reservaitn/web build`. Vercel usa `apps/web/vercel.json`.
