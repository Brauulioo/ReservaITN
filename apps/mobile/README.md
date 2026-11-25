# @reservaitn/mobile

App Android de ReservaITN (Expo SDK 58, React Native). Una sola app con pestañas según los permisos de
la persona; usa la misma API y los mismos esquemas de validación que la web.

Última versión: **1.3.0** (APK en [expo.dev · brauulioo/reservaitn](https://expo.dev/accounts/brauulioo/projects/reservaitn/builds)).

## Pestañas por rol

| Rol (permiso) | Pestañas | Archivos |
|---|---|---|
| Subdirección (`dashboard:ver`) | Panel con gráficos, Solicitudes, Reservas de todas las cuentas por día, Reservar, Avisos | `src/subdireccion/` |
| Director de carrera (`reserva:aprobar`) | Reservar, Mis reservas, Solicitudes, Avisos | `src/subdireccion/Solicitudes.tsx` |
| Docente y estudiante (`reserva:solicitar`) | Reservar (sala sugerida o elegida), Mis reservas con check-in por QR, Avisos | `src/docentes/` |
| Aseo y mantención | Inventario, Daños, Avisos | `src/mantencion/` |

Comunes: `src/comun/Login.tsx` (foto del campus y cuentas demo), `Notificaciones.tsx`, `EscanerQR.tsx`,
`push.ts` (Expo Push + Firebase), `graficos.tsx` (gráficos animados sin librerías extra).
La sesión se guarda cifrada con `expo-secure-store` (`src/api.ts`).

## Ejecutar en el celular

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @reservaitn/mobile dev
```

Escanee el QR con Expo Go. `EXPO_PUBLIC_API_URL` apunta a la API: la de Render funciona desde cualquier
red; una API local necesita la IP del computador en la misma WiFi (nunca `localhost`).

## Compilar el APK

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

El perfil `preview` (`eas.json`) genera un APK instalable que apunta a Render y muestra las cuentas
demo. Antes de compilar, suba `version` y `android.versionCode` en `app.json` para que se instale encima
de la anterior. Las notificaciones push requieren `google-services.json` y la clave FCM cargada en Expo.
