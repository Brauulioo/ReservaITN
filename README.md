# ReservaITN

**Sistema de reservas de salas y laboratorios del Instituto Técnico del Norte (ITN), Arica.**

ReservaITN es el proyecto **P05** desarrollado por **JBG Tech**. Su objetivo es centralizar la gestión de espacios institucionales, facilitar la solicitud y aprobación de reservas, consultar disponibilidad y evitar conflictos de horario.

> **Estado:** proyecto en desarrollo · **Periodo:** 7 de octubre al 17 de diciembre de 2026 (11 semanas).

## Contenido

1. [Funcionalidades](#funcionalidades)
2. [Tecnologías](#tecnologías)
3. [Equipo](#equipo)
4. [Estructura del repositorio](#estructura-del-repositorio)
5. [Instalación local](#instalación-local)
6. [Acceso de prueba](#acceso-de-prueba)
7. [Comandos útiles](#comandos-útiles)
8. [Colaboración en GitHub](#colaboración-en-github)
9. [Documentación](#documentación)
10. [Solución de problemas](#solución-de-problemas)

## Funcionalidades

Las funcionalidades del proyecto incluyen:

- Inicio de sesión y acceso según roles y permisos.
- Consulta de sedes, salas, laboratorios y disponibilidad.
- Solicitud, aprobación, rechazo y cancelación de reservas, con control de choques de horario.
- Sugerencia de salas y alternativas.
- Importación de planificación académica desde Excel.
- Dashboard, indicadores, reportes y proyecciones de uso.
- Notificaciones y módulos de aseo, mantención e inventario.
- Aplicación móvil para docentes, estudiantes y personal de mantención.

> Algunas funciones pueden encontrarse en desarrollo. Consulta el [roadmap](docs/02-roadmap.md) y el [registro de cambios](CHANGELOG.md) para revisar el avance.

## Tecnologías

| Componente | Tecnología | Ubicación |
| --- | --- | --- |
| Aplicación web | Next.js y TypeScript | `apps/web` |
| Aplicación móvil | Expo / React Native | `apps/mobile` |
| API REST y lógica de negocio | NestJS y Prisma | `apps/api` |
| Base de datos | PostgreSQL 16 | `apps/api/prisma` y `packages/db` |
| Validaciones y reglas compartidas | Zod y TypeScript | `packages/shared` |
| Gestión del monorepositorio | pnpm y Turborepo | Raíz del repositorio |
| Servicios de desarrollo opcionales | Docker Compose (PostgreSQL + Mailpit) | `infra` |

## Equipo

| Integrante | Responsabilidad |
| --- | --- |
| Benjamín Naveas | Director del proyecto y desarrollo frontend |
| José Labarca | Desarrollo full stack |
| Gonzalo Pino | Ingeniería de sistemas |
| Braulio Campos | Pruebas y aseguramiento de calidad (tester UA) |

## Estructura del repositorio

```text
ReservaITN/
├── apps/
│   ├── api/                 API NestJS, Prisma, migraciones y pruebas
│   ├── web/                 Panel web Next.js (login, inicio, reservas, dashboard…)
│   └── mobile/              Aplicación móvil Expo / React Native
├── packages/
│   ├── db/                  Modelo SQL, migraciones, semillas y pruebas
│   └── shared/              Roles, permisos, validaciones y reglas compartidas
├── docs/                    Metodología, arquitectura, roadmap y guías
├── infra/                   Docker Compose (PostgreSQL y Mailpit)
├── scripts/                 Automatizaciones y configuración del repositorio
├── .github/                 CI y plantillas de issues y pull requests
├── package.json            Scripts generales
└── pnpm-workspace.yaml      Configuración del monorepositorio
```

## Instalación local

### 1. Requisitos

- **Git** para clonar el repositorio.
- **Node.js 22 o superior** (se recomienda usar la versión indicada por `.nvmrc`).
- **pnpm 10.28.0**, la versión declarada por el proyecto.
- **Una sola opción para PostgreSQL 16**: Docker Desktop **o** PostgreSQL instalado directamente en Windows.
- **Visual Studio Code** (opcional, recomendado).

Comprueba las versiones:

```powershell
git --version
node --version
pnpm --version
```

Si no tienes pnpm:

```powershell
npm install -g pnpm@10.28.0
```

### 2. Clonar el proyecto e instalar dependencias

Ejemplo para Windows, guardándolo en el disco `D:`:

```powershell
New-Item -ItemType Directory -Path 'D:\Proyectos' -Force
cd D:\Proyectos
git clone https://github.com/Brauulioo/ReservaITN.git
cd ReservaITN
pnpm install
```

> Si el repositorio es privado, debes aceptar la invitación como colaborador e iniciar sesión con tu cuenta autorizada de GitHub.

### 3. Crear los archivos de entorno

Desde la raíz del repositorio, en PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Estos archivos contienen configuración local. **No subas `.env` ni `.env.local` a GitHub ni compartas contraseñas o claves privadas.**

### 4. Preparar PostgreSQL: elige una opción

#### Opción A — Docker Desktop

Con Docker Desktop instalado y ejecutándose:

```powershell
pnpm db:up
```

El archivo `infra/docker-compose.yml` define los servicios de PostgreSQL y Mailpit para desarrollo. Comprueba que la conexión en `apps/api/.env` coincida con los valores de Docker.

#### Opción B — PostgreSQL 16 instalado en Windows, sin Docker

1. Instala PostgreSQL 16 y, opcionalmente, pgAdmin o DBeaver.
2. Configura PostgreSQL para escuchar en el puerto `5432` y crea una base de datos vacía llamada `reservaitn`.
3. Edita **solo** `apps/api/.env`, reemplazando `TU_CLAVE` por la contraseña local del usuario `postgres`:

   ```dotenv
   DATABASE_URL="postgresql://postgres:TU_CLAVE@localhost:5432/reservaitn?schema=public"
   ```

4. **No ejecutes `pnpm db:up`** en esta opción: utilizarías el mismo puerto de PostgreSQL local.

> Si la contraseña contiene caracteres especiales (`@`, `#`, `/`, etc.), deben codificarse para una URL. Nunca coloques tus credenciales reales en `.env.example`.

### 5. Preparar tablas y datos de prueba

Con PostgreSQL iniciado y la conexión configurada, ejecuta desde la raíz:

```powershell
pnpm --filter @reservaitn/api prisma:deploy
pnpm --filter @reservaitn/api exec prisma generate
pnpm db:seed
```

La primera instrucción aplica las migraciones existentes; la segunda genera el cliente de Prisma y la tercera carga los datos iniciales del entorno de desarrollo.

> **Atención:** `db:seed` inserta datos de demostración. Úsalo únicamente en una base de desarrollo. El proyecto también contiene scripts SQL en `packages/db`; no ejecutes indiscriminadamente ambos mecanismos sobre una misma base sin revisar la documentación del modelo de datos.

### 6. Iniciar las aplicaciones

```powershell
pnpm dev
```

| Servicio | Dirección |
| --- | --- |
| Web | <http://localhost:3000> |
| Comprobación de API | <http://localhost:3001/api/health> |
| Mailpit (solo con el servicio correspondiente activo) | <http://localhost:8025> |

Para detener el entorno, presiona **Ctrl + C** en la terminal. Si usas PostgreSQL local, su servicio de Windows debe estar activo. Si usas Docker, debes iniciar Docker Desktop antes de levantar el entorno.

La aplicación móvil también se puede iniciar por separado:

```powershell
pnpm --filter @reservaitn/mobile dev
```

Para probarla, utiliza Expo Go según las instrucciones de Expo y la versión de SDK del proyecto.

## Acceso de prueba

Después de ejecutar `pnpm db:seed`, puedes probar diferentes perfiles con la contraseña común **`reservaitn`** (solo desarrollo):

| Rol de prueba | Correo |
| --- | --- |
| Subdirección | `subdireccion@itn.cl` |
| Dirección Académica | `academica@itn.cl` |
| Director de carrera | `dir.inf@itn.cl` |
| Docente | `docente@itn.cl` |
| Estudiante | `estudiante@itn.cl` |
| Operaciones | `operaciones@itn.cl` |
| Aseo y mantención | `aseo@itn.cl` |
| DATD | `datd@itn.cl` |

Los accesos visibles y las operaciones disponibles dependen de los permisos de cada rol. Las cuentas de demostración **no deben usarse en producción**.

## Comandos útiles

| Comando | Descripción |
| --- | --- |
| `pnpm install` | Instala dependencias del monorepositorio |
| `pnpm dev` | Inicia el entorno de desarrollo |
| `pnpm build` | Compila las aplicaciones y paquetes |
| `pnpm typecheck` | Comprueba los tipos de TypeScript |
| `pnpm test` | Ejecuta pruebas unitarias |
| `pnpm --filter @reservaitn/api test:db` | Ejecuta pruebas de integración con PostgreSQL |
| `pnpm db:up` | Inicia servicios definidos en Docker Compose |
| `pnpm db:down` | Detiene esos servicios de Docker |
| `pnpm --filter @reservaitn/api prisma:deploy` | Aplica migraciones Prisma existentes |
| `pnpm --filter @reservaitn/api exec prisma generate` | Genera el cliente Prisma |
| `pnpm db:seed` | Carga los datos de demostración |

## Colaboración en GitHub

Trabajamos con ramas individuales y **pull requests**. Evita desarrollar directamente sobre `main`.

Para iniciar una rama nueva, con los cambios locales guardados:

```powershell
git switch main
git pull origin main
git switch -c nombre-de-tu-rama
```

Cuando termines una modificación:

```powershell
git status
git add ruta/del/archivo
git commit -m "feat: describir brevemente el cambio"
git push -u origin nombre-de-tu-rama
```

Revisa siempre los archivos preparados antes de confirmar el commit. Luego crea un **Pull Request** de tu rama hacia `main` para que el equipo revise y apruebe los cambios.

Más detalles: [Flujo Git y GitHub](docs/05-flujo-git.md) y [guía de contribución](CONTRIBUTING.md).

## Solución de problemas

| Problema | Qué revisar |
| --- | --- |
| `pnpm` no se reconoce | Instala pnpm 10.28.0 y abre una terminal nueva |
| No conecta PostgreSQL (`localhost:5432`) | Verifica que PostgreSQL o Docker estén iniciados y que `DATABASE_URL` sea correcta |
| Error de autenticación de PostgreSQL | Comprueba usuario, contraseña y base configurados en `.env` |
| `EPERM` durante `prisma generate` en Windows | Detén procesos Node/NestJS que puedan estar usando el motor Prisma y vuelve a intentarlo |
| Error `Cannot find module './...js'` en Next.js | Detén Next.js, elimina la carpeta temporal `apps/web/.next` y reinicia el servidor |
| El puerto `3000` o `3001` está ocupado | Cierra la otra aplicación que utiliza ese puerto |
| Se movió la carpeta del repositorio | Reinstala dependencias: `$env:CI='true'; pnpm install --prefer-offline` |

Para cambios en interfaz, valida con `pnpm --filter @reservaitn/web typecheck`; para una verificación completa ejecuta `pnpm typecheck` con los procesos de desarrollo detenidos si Prisma informa archivos bloqueados.

## Documentación

| Documento | Enlace |
| --- | --- |
| Metodología de trabajo | [docs/01-metodologia.md](docs/01-metodologia.md) |
| Roadmap y sprints | [docs/02-roadmap.md](docs/02-roadmap.md) |
| Arquitectura | [docs/03-arquitectura.md](docs/03-arquitectura.md) |
| Modelo de datos | [docs/04-modelo-datos.md](docs/04-modelo-datos.md) |
| Decisiones del modelo | [docs/modelo-datos/decisiones.md](docs/modelo-datos/decisiones.md) |
| Normalización | [docs/modelo-datos/normalizacion.md](docs/modelo-datos/normalizacion.md) |
| Flujo Git | [docs/05-flujo-git.md](docs/05-flujo-git.md) |
| Trazabilidad R1–R19 | [docs/06-trazabilidad.md](docs/06-trazabilidad.md) |
| Estrategia de pruebas | [docs/07-pruebas.md](docs/07-pruebas.md) |
| Despliegue | [docs/08-despliegue.md](docs/08-despliegue.md) |
| Convenciones de la web | [docs/09-web.md](docs/09-web.md) |
| Decisiones de arquitectura | [docs/adr](docs/adr) |
| Registro de cambios | [CHANGELOG.md](CHANGELOG.md) |

---

**JBG Tech · ReservaITN · Instituto Técnico del Norte (ITN), Arica**
