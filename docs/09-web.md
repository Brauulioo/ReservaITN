# 9. Web (`apps/web`)

Aplicación Next.js 14 (App Router) para administración, aprobaciones, reportes y reservas desde el
computador. Habla solo con la API (`NEXT_PUBLIC_API_URL`) y reutiliza roles, permisos y validaciones de
`packages/shared`, así que una regla se escribe una vez para API, web y móvil.

## Estructura

```
apps/web/
├── app/
│   ├── layout.tsx           html raíz, título y color de tema
│   ├── globals.css          sistema visual ITN (variables, componentes, oscuro, celular, impresión)
│   ├── page.tsx             redirige a /inicio
│   ├── login/               ingreso (fuera del panel)
│   └── (panel)/             todo lo que exige sesión; el grupo no aparece en la URL
│       ├── layout.tsx       envuelve cada página con <Panel>
│       └── <pantalla>/page.tsx
├── components/
│   ├── Panel.tsx            menú lateral por rol, barra superior, usePanel(), ConPermiso
│   ├── ui.tsx               Icono, Logo, Cabecera, Badge, Modal, Vacio, Cargando, useAviso, useDatos
│   └── Historial.tsx        modal de trazabilidad de una reserva (R7)
└── lib/
    ├── api.ts               api(), enviar(), mensajeError(), sesión en localStorage
    ├── formato.ts           nombres de roles y estados, fechas es-CL, descargarCsv()
    └── tipos.ts             forma de las respuestas JSON de la API
```

## Pantallas

| Ruta | Permiso | Requisitos | API que usa |
|---|---|---|---|
| `/login` | público | E4 | `POST /auth/login` |
| `/inicio` | sesión | — | `GET /reservas/mias`, `/notificaciones/mias`, `/reservas/pendientes` |
| `/reservar` | `reserva:solicitar` | R2, R8, R10, R11, R19 | `GET /salas`, `/sedes`, `POST /sugerencia`, `POST /reservas` |
| `/disponibilidad` | sesión | R3 | `GET /salas`, `GET /reservas/ocupacion` |
| `/mis-reservas` | `reserva:solicitar` | R5, R7 | `GET /reservas/mias`, `POST /reservas/:id/cancelar`, `GET /reservas/:id/historial` |
| `/aprobaciones` | `reserva:aprobar` | R4, R8, R11 | `GET /reservas/pendientes`, `POST /reservas/:id/aprobar` · `rechazar` |
| `/dashboard` | `dashboard:ver` | R12, R13, R14 | `GET /dashboard/ocupacion`, `/dashboard/indicadores`, `/proyeccion` |
| `/salas` | `recurso:gestionar` | R8 | `GET /salas?todas=1`, `/carreras`, `POST /salas`, `PATCH /salas/:id` |
| `/importacion` | `planificacion:importar` | R9 | `POST /importaciones` (multipart), `GET /importaciones` |
| `/mantencion` | `danio:reportar` · `danio:gestionar` · `inventario:registrar` | R15, R17 | `/mantencion/*` |
| `/usuarios` | `usuario:gestionar` | E4 | `GET /usuarios`, `POST /usuarios`, `PATCH /usuarios/:id` |
| `/notificaciones` | sesión | R6 | `GET /notificaciones/mias`, `PATCH /notificaciones/leidas` · `:id/leida` |
| `/perfil` | sesión | E4 | `POST /auth/cambiar-clave` |

Ocultar una opción en la web es solo comodidad: la API vuelve a validar cada permiso con `@RequierePermiso`.

## Identidad visual

| Token | Valor | Uso |
|---|---|---|
| `--navy-700` | `#1c3f7a` | Azul institucional: botones, enlaces, barras |
| `--navy-900` | `#0e2347` | Menú lateral, fondo del login |
| `--orange-500` | `#f2a01e` | Triángulo del logo: acción destacada, sala recomendada, menú activo |
| `--ok` / `--warn` / `--danger` | verde / ámbar / rojo | Estados aprobada / pendiente / rechazada |

Los colores se usan siempre por variable (`var(--accent)`, `var(--surface)`…), nunca en hexadecimal dentro
de los componentes; así el modo oscuro (`prefers-color-scheme: dark`) funciona sin código extra.

## Cómo agregar una pantalla

1. Crear `app/(panel)/<ruta>/page.tsx` con `'use client'`.
2. Envolver el contenido en `<ConPermiso permiso="…">` si no es para todos los roles.
3. Cargar datos con `useDatos<T>('/ruta-api')` (devuelve `datos`, `error`, `cargando`, `recargar`).
4. Escribir con `enviar('/ruta', cuerpo, 'POST' | 'PATCH')` y mostrar el resultado con `useAviso()`;
   para errores de validación, `mensajeError(e)` junta los mensajes por campo.
5. Agregar la entrada a `MENU` en `components/Panel.tsx` con su ícono y permiso.
6. Si la API devuelve una forma nueva, declararla en `lib/tipos.ts`.

Next.js no permite exportar nada más que el componente por defecto desde un `page.tsx`: los componentes
compartidos entre pantallas van en `components/`.
