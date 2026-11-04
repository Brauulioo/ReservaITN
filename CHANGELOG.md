# Registro de cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según el roadmap
(`v0.4.0` = H4, `v0.5.0` = H5).

## [Sin publicar] (03/11/2026)

### Agregado
- Web rediseñada con la identidad del ITN (azul institucional y naranja del logo), menú lateral por rol,
  modo oscuro, vista de celular e impresión ([docs/09-web.md](docs/09-web.md)).
- Pantallas nuevas: inicio, nueva reserva con sugerencia de sala (R10), disponibilidad semanal (R3),
  mis reservas con historial (R7), salas y laboratorios (R8), importar planificación (R9), mantención
  (R17), usuarios (E4), notificaciones (R6) y mi cuenta.
- Dashboard: filtro por sede, períodos rápidos, mapa de calor día × jornada (R14), exportación CSV e
  impresión a PDF (R13).
- API: `GET /reservas/mias`, `GET /carreras`, `PATCH /salas/:id`, `PATCH /usuarios/:id`,
  `POST /auth/cambiar-clave`, `PATCH /notificaciones/leidas`.
- `GET /salas?todas=1` incluye salas desactivadas; `GET /reservas/pendientes` incluye sala y sede.
- `pnpm --filter @reservaitn/api prisma:seed-demo`: ~10 semanas de reservas de demostración (sin choques,
  marcadas en su historial) para el dashboard y los reportes. Se ejecuta una sola vez por base.
- CSV del dashboard con decimales con coma, tipo de sala legible y horas de 24 h (Excel en español los
  reconoce como números y horas).

### Cambiado
- Los avisos de reservas muestran la fecha en formato chileno en vez de ISO.
- `GET /salas` ordena por nombre de sede y código.
- La web cierra la sesión y vuelve al login cuando la API responde 401 (token vencido).
- `Encabezado.tsx` pasa a `components/Panel.tsx`; dashboard y aprobaciones se mueven a `app/(panel)/`.

### Corregido
- Indicador B6 (tiempo medio de aprobación): excluye las reservas autoaprobadas, que lo dejaban negativo.
- README: pasos para usar PostgreSQL local sin Docker y para reparar los enlaces de pnpm tras mover la carpeta.
