# Registro de cambios

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según el roadmap
(`v0.4.0` = H4, `v0.5.0` = H5). Cada entrada indica el requisito (R), entregable (E) o paquete de la EDT.

## [Sin publicar] — hacia H4 (13/11/2026) y H5 (27/11/2026)

### Seguridad
- **Dependencias actualizadas por avisos de seguridad:** Next.js 16.4.6; NestJS 11.2 (Express 5,
  multer 2, body-parser y path-to-regexp corregidos); nodemailer 10.5; zod 4.6 en API, web, app y
  `shared` (mensajes en español migrados a `z.config`); `uuid` 11 dentro de exceljs. Quedan solo avisos
  menores en herramientas de compilación de Expo, que no forman parte de la app instalada.
- `GET /espacios` responde 400 (no 500) si `sedeId` no es un identificador válido.

### Agregado
- **Días no disponibles (V014):** no se reserva sábado ni domingo; las vacaciones de verano
  (25 de diciembre al 1 de marzo) quedan bloqueadas cada año. Subdirección agrega períodos por días
  completos (00:00 a 23:59) en **Gestión → Días no disponibles**: duración en días, semanas o meses,
  una sede o todas, repetición anual por N años y vista previa de las reservas afectadas, que puede
  cancelar avisando a cada solicitante. La base rechaza cualquier reserva en esos días (web, app e
  importación); la mantención sí se permite. API `GET/POST /calendario/periodos`,
  `GET /calendario/periodos/afectadas`, `PATCH /calendario/periodos/:id/quitar` y
  `GET /calendario/no-disponibles`. El calendario sombrea los días bloqueados y muestra lunes a viernes;
  las series semanales saltan esos días y el dashboard cuenta solo días hábiles.
- **Inicio de Subdirección con 4 gráficos** en una sola ventana (ocupación por sala, mapa de calor
  día × hora, reservas no usadas, capacidad libre por jornada), filtros de período, sede y tipo, y
  `GET /api/dashboard/inicio` (R12, R14).
- **Barra lateral deslizante:** íconos en reposo; se despliega al pasar el mouse sin mover la página.
- **App móvil: elegir cualquier sala**, con su estado libre u ocupado en el horario pedido (R3).
- **Publicación en la nube por servicios:** web en Vercel, API en Render (aplica migraciones al iniciar),
  PostgreSQL en Neon y app Android compilada con EAS (`@jgb-team/reservaitn`).
- **Notificaciones push en Android** con Expo Push y Firebase; el login de la web despierta la API.
- **Supervisión de Subdirección (V013):** recibe el aviso de todas las solicitudes, además del aprobador.
- **Datos de demostración (D002):** ~880 reservas realistas que se cargan una vez en una base nueva.
- **Web con la identidad del ITN** (diseño de Braulio Campos, integrado sobre la API v1): menú lateral según
  permisos, modo oscuro, vista de celular, impresión, login con fotografía del campus y avisos flotantes
  ([docs/09-web.md](docs/09-web.md)).
- Pantallas nuevas: inicio con accesos y resumen personal, mis reservas con historial (R5, R7, R18),
  notificaciones (R6), mi cuenta con cambio de contraseña (E4) e importación de la planificación desde la
  web (R9, criterio E5).
- Administración separada en **Salas y laboratorios** (con QR de check-in) y **Usuarios** (roles con ámbito).
- API: `POST /auth/cambiar-clave`, `PATCH /notificaciones/leidas`, períodos abiertos en `GET /catalogos`,
  responsable y período en `GET /importaciones`, línea de tiempo legible (`linea`) en
  `GET /reservas/:id/historial` y sede, asistentes y origen en `GET /reservas/mias`.
- App móvil completa para docentes, estudiantes y aseo: reservar, mis reservas, check-in por QR, avisos
  push, inventario y reporte de daños (E11, E12).
- Mantención en la web: órdenes de trabajo, asignación de personal y bloqueo del espacio (R15, R17).
- Calendario semanal por espacio con clic para reservar (R3).
- Envío real de correos con cola, reintentos y plantilla HTML (R6).
- Cancelación de cualquier reserva por Subdirección con motivo obligatorio y reporte Excel profesional (R5, R13).
- Reservas al minuto, únicas o semanales (R1, R2).
- Documentación de infraestructura de producción dimensionada y presupuestada ([docs/08-despliegue.md](docs/08-despliegue.md)).

### Cambiado
- La API usa el modelo de datos v1 normalizado (FNBC): roles y permisos desde la base, reglas de
  aprobación configurables, anti-choques con `EXCLUDE` (incluye pendientes).
- PostgreSQL local publicado en el puerto 5434 por defecto para no chocar con instalaciones de Windows.

### Corregido
- Solicitudes con "Error interno" cuando la API y la base están en regiones distintas (transacciones
  de hasta 20 s y avisos en una sola consulta).
- App Android: campos aplastados en el login y mayúscula automática en la contraseña.
- El rango del dashboard incluye el último día y muestra todas las reservas del período.
- Mensajes claros cuando la base de datos no está disponible.

## [0.1.0] — 04/11/2026 · Incremento 1

### Agregado
- Login y roles (M1), CRUD de salas y laboratorios (M2), reserva con anti-choques (M3) y dashboard de
  ocupación (M4), aprobados en el acta ACT-P05-REV-01.
