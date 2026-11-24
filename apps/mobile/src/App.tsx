import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { alExpirarSesion, api, cargarSesion, guardarSesion, tiene, type Sesion } from './api';
import { colores } from './ui';
import { Login } from './comun/Login';
import { Notificaciones } from './comun/Notificaciones';
import { EscanerQR } from './comun/EscanerQR';
import { registrarPush } from './comun/push';
import { Reservar } from './docentes/Reservar';
import { MisReservas } from './docentes/MisReservas';
import { Inventario } from './mantencion/Inventario';
import { ReporteDanio } from './mantencion/ReporteDanio';
import { PanelSubdireccion } from './subdireccion/Panel';
import { Solicitudes } from './subdireccion/Solicitudes';
import { ReservasDelDia } from './subdireccion/Reservas';

type Pestana = 'panel' | 'solicitudes' | 'todas' | 'reservar' | 'mias' | 'inventario' | 'danio' | 'avisos';
const CONSULTA_AVISOS_MS = 30_000;

/**
 * Una sola app con pestañas según los permisos de la persona (ADR 0003):
 * Subdirección (dashboard:ver) entra a su panel con gráficos, decide solicitudes y ve las reservas
 * de todas las cuentas por día; docentes y estudiantes reservan y hacen check-in (E11); aseo y
 * mantención cuentan inventario y reportan daños (E12). Todos ven sus avisos.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <Contenido />
    </SafeAreaProvider>
  );
}

function Contenido() {
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined);
  const [pestana, setPestana] = useState<Pestana>('reservar');
  const [noLeidas, setNoLeidas] = useState(0);
  const [escaner, setEscaner] = useState(false);
  const [version, setVersion] = useState(0); // fuerza recargar listas tras reservar o hacer check-in
  const [porDecidir, setPorDecidir] = useState(0);
  const [estadoReservas, setEstadoReservas] = useState<string | undefined>(undefined);
  const supervisa = sesion ? sesion.usuario.permisos.includes('dashboard:ver') : false;
  const aprueba = sesion ? sesion.usuario.permisos.includes('reserva:aprobar') : false;

  const pestanas: { id: Pestana; texto: string; contador?: number }[] = sesion
    ? [
        ...(supervisa ? [{ id: 'panel' as const, texto: 'Panel' }] : []),
        ...(aprueba ? [{ id: 'solicitudes' as const, texto: 'Solicitudes', contador: porDecidir }] : []),
        ...(supervisa ? [{ id: 'todas' as const, texto: 'Reservas' }] : []),
        ...(tiene('reserva:solicitar') ? [{ id: 'reservar' as const, texto: 'Reservar' }] : []),
        ...(tiene('reserva:solicitar') && !supervisa ? [{ id: 'mias' as const, texto: 'Mis reservas' }] : []),
        ...(tiene('inventario:registrar') ? [{ id: 'inventario' as const, texto: 'Inventario' }] : []),
        ...(tiene('danio:reportar') ? [{ id: 'danio' as const, texto: 'Daños' }] : []),
        { id: 'avisos' as const, texto: 'Avisos', contador: noLeidas },
      ]
    : [];

  const entrar = useCallback((s: Sesion | null) => {
    setSesion(s);
    if (!s) return;
    const p = s.usuario.permisos;
    setPestana(p.includes('dashboard:ver') ? 'panel' : p.includes('reserva:solicitar') ? 'reservar' : p.includes('inventario:registrar') ? 'inventario' : 'avisos');
    registrarPush(); // silencioso: en Expo Go no aplica
  }, []);

  useEffect(() => {
    alExpirarSesion(() => setSesion(null));
    cargarSesion().then(entrar);
  }, [entrar]);

  const contarAvisos = useCallback(() => {
    api<{ total: number }>('/notificaciones/no-leidas').then((r) => setNoLeidas(r.total)).catch(() => {});
    if (tiene('reserva:aprobar')) api<unknown[]>('/solicitudes/pendientes').then((l) => setPorDecidir(l.length)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!sesion) return;
    contarAvisos();
    const t = setInterval(contarAvisos, CONSULTA_AVISOS_MS);
    return () => clearInterval(t);
  }, [sesion, contarAvisos]);

  if (sesion === undefined) return null;
  if (!sesion)
    return (
      <Login
        onIngreso={async (s) => {
          await guardarSesion(s);
          entrar(s);
        }}
      />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colores.fondo }} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={{ backgroundColor: colores.institucional, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>ReservaITN</Text>
          <Text style={{ color: '#c7d2e8', fontSize: 12 }}>{sesion.usuario.nombre}</Text>
        </View>
        <Pressable onPress={async () => { await guardarSesion(null); setSesion(null); }} hitSlop={10}>
          <Text style={{ color: '#fff' }}>Salir</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {pestana === 'panel' && <PanelSubdireccion irA={(d, e) => { if (d === 'reservas') setEstadoReservas(e ?? ''); setPestana(d === 'reservas' ? 'todas' : 'solicitudes'); }} />}
        {pestana === 'solicitudes' && <Solicitudes alDecidir={() => { contarAvisos(); setVersion((v) => v + 1); }} />}
        {pestana === 'todas' && <ReservasDelDia estadoInicial={estadoReservas} alCambiar={() => { contarAvisos(); setVersion((v) => v + 1); }} />}
        {pestana === 'reservar' && <Reservar alReservar={() => setVersion((v) => v + 1)} />}
        {pestana === 'mias' && <MisReservas abrirEscaner={() => setEscaner(true)} version={version} />}
        {pestana === 'inventario' && <Inventario />}
        {pestana === 'danio' && <ReporteDanio />}
        {pestana === 'avisos' && <Notificaciones alLeer={contarAvisos} version={version} />}
      </View>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colores.borde }}>
        <View style={{ flexDirection: 'row' }}>
          {pestanas.map((p) => (
            <Pressable key={p.id} onPress={() => { setPestana(p.id); if (p.id === 'avisos') contarAvisos(); }} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderTopWidth: 3, borderTopColor: pestana === p.id ? colores.acento : 'transparent' }}>
              <View>
                <Text numberOfLines={1} style={{ fontSize: pestanas.length > 4 ? 12 : 13, fontWeight: pestana === p.id ? '700' : '500', color: pestana === p.id ? colores.acento : colores.suave }}>{p.texto}</Text>
                {!!p.contador && (
                  <View style={{ position: 'absolute', top: -10, right: -12, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#f2a01e', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{p.contador > 99 ? '99+' : p.contador}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <EscanerQR visible={escaner} onCerrar={() => setEscaner(false)} onListo={() => setVersion((v) => v + 1)} />
    </SafeAreaView>
  );
}
