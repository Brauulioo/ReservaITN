import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { api, post, tiene } from '../api';
import { Aviso, Boton, Insignia, colores } from '../ui';
import { Pastilla, paleta } from '../comun/graficos';
import { cadaRato, consulta, esFinDeSemana, fechaLarga, hora, inicioDia, mismoDia, sumarDias } from './fechas';

interface Fila {
  reservaId: string;
  solicitudId: string;
  solicitanteId: string;
  codigoEspacio: string;
  inicio: string;
  fin: string;
  estado: string;
  espacio: string;
  sede: string;
  tipoActividad: string;
  origen: string;
  asistentes: number;
  descripcion: string;
  solicitante: string;
  aprobador: string | null;
  aprobacionAutomatica: boolean;
  canceladoPor: string | null;
  motivoCancelacion: string | null;
}

const ESTADOS = [
  { valor: '', texto: 'Todas' },
  { valor: 'PENDIENTE', texto: 'Pendientes' },
  { valor: 'APROBADA', texto: 'Aprobadas' },
  { valor: 'CANCELADA', texto: 'Canceladas' },
  { valor: 'RECHAZADA', texto: 'Rechazadas' },
];
const COLOR: Record<string, string> = { APROBADA: paleta.verde, PENDIENTE: paleta.naranja, CANCELADA: paleta.rojo, RECHAZADA: '#7d2a8a' };

/**
 * Reservas de todas las cuentas, día por día (por defecto hoy). Se filtra por cuenta y estado,
 * se actualiza sola y, al pasar la medianoche, avanza al nuevo día si estaba mirando “hoy”.
 */
export function ReservasDelDia({ estadoInicial, alCambiar }: { estadoInicial?: string; alCambiar: () => void }) {
  const [dia, setDia] = useState(() => inicioDia(new Date()));
  const [siguiendoHoy, setSiguiendoHoy] = useState(true);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [cuenta, setCuenta] = useState('');
  const [estado, setEstado] = useState(estadoInicial ?? '');
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [detalle, setDetalle] = useState<Fila | null>(null);

  useEffect(() => { if (estadoInicial !== undefined) setEstado(estadoInicial); }, [estadoInicial]);

  const cargar = useCallback(async () => {
    // Si se mira “hoy” y cambió el día (medianoche), se pasa solo al nuevo día
    let d = dia;
    if (siguiendoHoy && !mismoDia(d, new Date())) { d = inicioDia(new Date()); setDia(d); }
    try {
      const [l, p] = await Promise.all([
        api<Fila[]>(`/dashboard/reservas?${consulta({ desde: d, hasta: sumarDias(d, 1) })}`),
        tiene('reserva:aprobar') ? api<{ id: string }[]>('/solicitudes/pendientes') : Promise.resolve([]),
      ]);
      setFilas(l.filter((f) => f.origen !== 'MANTENCION'));
      setPendientes(new Set(p.map((x) => x.id)));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefrescando(false);
    }
  }, [dia, siguiendoHoy]);

  useEffect(() => { setFilas(null); cargar(); }, [cargar]);
  useEffect(() => cadaRato(cargar, 30_000), [cargar]);

  const cambiarDia = (n: number) => {
    const d = sumarDias(dia, n);
    setDia(d);
    setSiguiendoHoy(mismoDia(d, new Date()));
  };

  // Cuentas presentes en el día (la elegida se mantiene aunque ese día no tenga reservas)
  const cuentas = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number }>();
    for (const f of filas ?? []) m.set(f.solicitanteId, { nombre: f.solicitante, n: (m.get(f.solicitanteId)?.n ?? 0) + 1 });
    return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
  }, [filas]);
  const [nombreCuenta, setNombreCuenta] = useState('');

  const visibles = (filas ?? []).filter((f) => (!cuenta || f.solicitanteId === cuenta) && (!estado || f.estado === estado));
  const conteo = (e: string) => (filas ?? []).filter((f) => (!cuenta || f.solicitanteId === cuenta) && (!e || f.estado === e)).length;
  const esHoy = mismoDia(dia, new Date());

  return (
    <View style={{ flex: 1, backgroundColor: colores.fondo }}>
      {/* Selector de día */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colores.borde, paddingHorizontal: 10, paddingVertical: 10, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => cambiarDia(-1)} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, color: paleta.azul }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colores.texto }}>{esHoy ? 'Hoy' : fechaLarga(dia)}</Text>
            <Text style={{ color: colores.suave, fontSize: 12 }}>{esHoy ? fechaLarga(dia) : esFinDeSemana(dia) ? 'Fin de semana' : `${filas?.length ?? 0} reservas`}</Text>
          </View>
          <Pressable onPress={() => cambiarDia(1)} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, color: paleta.azul }}>›</Text>
          </Pressable>
        </View>
        {!esHoy && (
          <Pressable onPress={() => { setDia(inicioDia(new Date())); setSiguiendoHoy(true); }} style={{ alignSelf: 'center', marginTop: -4 }}>
            <Text style={{ color: paleta.azulMedio, fontWeight: '700' }}>Volver a hoy</Text>
          </Pressable>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {ESTADOS.map((e) => <Pastilla key={e.valor} texto={`${e.texto} ${conteo(e.valor)}`} activa={estado === e.valor} onPress={() => setEstado(e.valor)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pastilla texto="Todas las cuentas" activa={!cuenta} onPress={() => setCuenta('')} />
          {cuenta && !cuentas.some((c) => c.id === cuenta) && <Pastilla texto={`${nombreCuenta} 0`} activa onPress={() => setCuenta('')} />}
          {cuentas.map((c) => <Pastilla key={c.id} texto={`${c.nombre} ${c.n}`} activa={cuenta === c.id} onPress={() => { setCuenta(cuenta === c.id ? '' : c.id); setNombreCuenta(c.nombre); }} />)}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar(); }} colors={[paleta.azul]} />}>
        {!!error && <Aviso ok={false} texto={error} />}
        {!filas ? <ActivityIndicator color={paleta.azul} style={{ marginTop: 30 }} /> : visibles.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 30, gap: 6 }}>
            <Text style={{ fontWeight: '700', color: colores.texto }}>{esFinDeSemana(dia) ? 'Fin de semana: no se reserva' : 'Sin reservas con estos filtros'}</Text>
            <Text style={{ color: colores.suave, textAlign: 'center' }}>Cambie de día con las flechas o quite los filtros.</Text>
          </View>
        ) : visibles.map((f) => (
          <Pressable key={f.reservaId} onPress={() => setDetalle(f)} style={({ pressed }) => [{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colores.borde, overflow: 'hidden' }, pressed && { opacity: 0.85 }]}>
            <View style={{ width: 5, backgroundColor: COLOR[f.estado] ?? paleta.gris }} />
            <View style={{ width: 66, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
              <Text style={{ fontWeight: '800', color: colores.texto }}>{hora(f.inicio)}</Text>
              <Text style={{ color: colores.suave, fontSize: 12 }}>{hora(f.fin)}</Text>
            </View>
            <View style={{ flex: 1, paddingVertical: 10, paddingRight: 12, gap: 3 }}>
              <Text style={{ fontWeight: '700', color: colores.texto }} numberOfLines={1}>{f.descripcion}</Text>
              <Text style={{ color: colores.suave, fontSize: 13 }} numberOfLines={1}>{f.codigoEspacio} · {f.solicitante}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Insignia estado={f.estado} />
                {f.estado === 'PENDIENTE' && pendientes.has(f.solicitudId) && <Text style={{ color: paleta.ambar, fontSize: 12, fontWeight: '700' }}>Toque para decidir</Text>}
                {f.origen === 'PLANIFICACION' && <Text style={{ color: colores.suave, fontSize: 12 }}>Clase planificada</Text>}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Detalle fila={detalle} puedeDecidir={!!detalle && pendientes.has(detalle.solicitudId)} onCerrar={() => setDetalle(null)} onListo={() => { setDetalle(null); cargar(); alCambiar(); }} />
    </View>
  );
}

function Detalle({ fila, puedeDecidir, onCerrar, onListo }: { fila: Fila | null; puedeDecidir: boolean; onCerrar: () => void; onListo: () => void }) {
  const [modo, setModo] = useState<'ver' | 'rechazar' | 'cancelar'>('ver');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setModo('ver'); setMotivo(''); setError(''); }, [fila]);
  if (!fila) return null;
  const futura = new Date(fila.fin).getTime() > Date.now();
  const puedeCancelar = futura && ['APROBADA', 'PENDIENTE'].includes(fila.estado) && tiene('reserva:cancelar_cualquiera');

  async function accion(ruta: string, cuerpo: object) {
    setEnviando(true);
    setError('');
    try {
      await post(ruta, cuerpo);
      onListo();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const linea = (etiqueta: string, valor: string | null | undefined) => !!valor && (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ width: 96, color: colores.suave }}>{etiqueta}</Text>
      <Text style={{ flex: 1, color: colores.texto, fontWeight: '600' }}>{valor}</Text>
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,26,56,0.5)' }} onPress={onCerrar} />
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 10 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colores.borde, marginBottom: 4 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: colores.texto }}>{fila.descripcion}</Text>
          <Insignia estado={fila.estado} />
        </View>
        {linea('Cuándo', `${fechaLarga(new Date(fila.inicio))}, ${hora(fila.inicio)}–${hora(fila.fin)}`)}
        {linea('Espacio', `${fila.codigoEspacio} · ${fila.sede}`)}
        {linea('Solicitante', fila.solicitante)}
        {linea('Actividad', `${fila.tipoActividad} · ${fila.asistentes} personas`)}
        {linea('Aprobó', fila.aprobacionAutomatica ? 'Aprobación automática' : fila.aprobador)}
        {linea('Canceló', fila.canceladoPor)}
        {linea('Motivo', fila.motivoCancelacion)}
        {!!error && <Aviso ok={false} texto={error} />}

        {modo !== 'ver' ? (
          <>
            <Text style={{ fontWeight: '700', color: colores.texto }}>Motivo de {modo === 'rechazar' ? 'rechazo' : 'cancelación'} (lo recibe el solicitante)</Text>
            <TextInput value={motivo} onChangeText={setMotivo} multiline placeholderTextColor={colores.suave} placeholder="Escriba el motivo"
              style={{ borderWidth: 1, borderColor: colores.borde, borderRadius: 10, padding: 12, minHeight: 70, textAlignVertical: 'top', color: colores.texto }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Boton titulo="Volver" variante="secundario" onPress={() => setModo('ver')} /></View>
              <View style={{ flex: 1 }}>
                <Boton titulo={modo === 'rechazar' ? 'Rechazar' : 'Cancelar reserva'} variante="peligro" cargando={enviando} deshabilitado={motivo.trim().length < 5}
                  onPress={() => modo === 'rechazar' ? accion(`/solicitudes/${fila.solicitudId}/rechazar`, { comentario: motivo.trim() }) : accion(`/reservas/${fila.reservaId}/cancelar`, { motivo: motivo.trim() })} />
              </View>
            </View>
          </>
        ) : (
          <View style={{ gap: 10, marginTop: 6 }}>
            {puedeDecidir && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Boton titulo="Rechazar" variante="peligro" onPress={() => setModo('rechazar')} /></View>
                <View style={{ flex: 1 }}><Boton titulo="Aprobar" cargando={enviando} onPress={() => accion(`/solicitudes/${fila.solicitudId}/aprobar`, {})} /></View>
              </View>
            )}
            {puedeCancelar && !puedeDecidir && <Boton titulo="Cancelar esta reserva" variante="secundario" onPress={() => setModo('cancelar')} />}
            <Boton titulo="Cerrar" variante="secundario" onPress={onCerrar} />
          </View>
        )}
      </View>
    </Modal>
  );
}
