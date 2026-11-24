import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { colores } from '../ui';
import { BarraH, Columnas, Indicador, MapaCalor, Pastilla, Segmentos, Seccion, paleta, pct } from '../comun/graficos';
import { cadaRato, consulta, esFinDeSemana, fechaLarga, hora, rango, type Periodo } from './fechas';

interface Inicio {
  salas: number;
  indicadores: { ocupacion: number; horasOcupadas: number; horasDisponibles: number; aprobadas: number; pendientes: number; solicitudes: number; noUsadas: number; proporcionNoUsadas: number };
  ocupacionPorSala: { espacioId: string; codigo: string; nombre: string; sede: string; tipo: string; capacidad: number; horasReservadas: number; indice: number }[];
  mapaCalor: { horas: number[]; dias: string[]; valores: number[][] };
  capacidadPorJornada: { nombre: string; desde: number; hasta: number; horasOcupadas: number; horasLibres: number; horasDisponibles: number }[];
  noUsadasPorSala: { codigo: string; canceladas: number; liberadas: number; vencidas: number; total: number }[];
}
interface Fila { reservaId: string; estado: string; inicio: string; fin: string; codigoEspacio: string; solicitante: string; descripcion: string; origen: string }
interface Sede { id: string; nombre: string }

const TIPOS = [
  { valor: '', texto: 'Todos' },
  { valor: 'SALA', texto: 'Salas' },
  { valor: 'LABORATORIO', texto: 'Laboratorios' },
];
const ESTADOS = [
  { clave: 'APROBADA', texto: 'Aprobadas', color: paleta.verde },
  { clave: 'PENDIENTE', texto: 'Pendientes', color: paleta.naranja },
  { clave: 'CANCELADA', texto: 'Canceladas', color: paleta.rojo },
  { clave: 'RECHAZADA', texto: 'Rechazadas', color: '#7d2a8a' },
  { clave: 'OTRAS', texto: 'Vencidas o liberadas', color: paleta.gris },
];
const ACTUALIZAR_MS = 60_000;

/**
 * Dashboard de Subdirección en la app: los mismos gráficos del inicio web (ocupación por sala,
 * mapa de calor, capacidad por jornada y no usadas), con “hoy” por defecto y actualización sola.
 */
export function PanelSubdireccion({ irA }: { irA: (destino: 'solicitudes' | 'reservas', estado?: string) => void }) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy');
  const [sedeId, setSedeId] = useState('');
  const [tipo, setTipo] = useState('');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [datos, setDatos] = useState<Inicio | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [sala, setSala] = useState<string | null>(null);
  const [celda, setCelda] = useState<[number, number] | null>(null);
  const [horaSel, setHoraSel] = useState<number | null>(null);
  const [estadoSel, setEstadoSel] = useState<string | null>(null);
  const [porDecidir, setPorDecidir] = useState<number | null>(null);

  useEffect(() => { api<Sede[]>('/sedes').then(setSedes).catch(() => {}); }, []);

  const cargar = useCallback(async () => {
    const r = rango(periodo);
    const q = consulta(r) + (sedeId ? `&sedeId=${sedeId}` : '');
    try {
      const [ini, res, pend] = await Promise.all([
        api<Inicio>(`/dashboard/inicio?${q}${tipo ? `&tipo=${tipo}` : ''}`),
        api<Fila[]>(`/dashboard/reservas?${q}`),
        api<unknown[]>('/solicitudes/pendientes').catch(() => null),
      ]);
      setPorDecidir(pend ? pend.length : null);
      setDatos(ini);
      setFilas(res.filter((f) => f.origen !== 'MANTENCION'));
      setError('');
      setActualizado(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [periodo, sedeId, tipo]);

  useEffect(() => { setCargando(true); setSala(null); setCelda(null); setHoraSel(null); setEstadoSel(null); cargar(); }, [cargar]);
  useEffect(() => cadaRato(cargar, ACTUALIZAR_MS), [cargar]);

  const porEstado = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of filas) {
      const k = ['APROBADA', 'PENDIENTE', 'CANCELADA', 'RECHAZADA'].includes(f.estado) ? f.estado : 'OTRAS';
      c[k] = (c[k] ?? 0) + 1;
    }
    return ESTADOS.map((e) => ({ ...e, valor: c[e.clave] ?? 0 }));
  }, [filas]);

  // Uso por hora: en “hoy” es la fila del día; en semana o mes, el promedio de los días hábiles
  const porHora = useMemo(() => {
    if (!datos) return [];
    const { horas, valores } = datos.mapaCalor;
    const hoy = (new Date().getDay() + 6) % 7;
    return horas.map((h, i) => ({
      etiqueta: String(h),
      valor: periodo === 'hoy' ? (valores[hoy]?.[i] ?? 0) : valores.reduce((s, f) => s + (f[i] ?? 0), 0) / Math.max(1, valores.filter((f) => f.some((v) => v > 0)).length),
    }));
  }, [datos, periodo]);

  const proximas = useMemo(() => {
    const ahora = Date.now();
    return filas.filter((f) => ['APROBADA', 'PENDIENTE'].includes(f.estado) && new Date(f.fin).getTime() > ahora).slice(0, 5);
  }, [filas]);

  const hoy = new Date();
  const ind = datos?.indicadores;
  const salas = (datos?.ocupacionPorSala ?? []).slice().sort((a, b) => b.indice - a.indice).slice(0, 8);
  const maxSala = Math.max(0.0001, ...salas.map((s) => s.indice));
  const noUsadas = (datos?.noUsadasPorSala ?? []).filter((x) => x.total > 0).slice(0, 5);
  const maxNoUsadas = Math.max(1, ...noUsadas.map((x) => x.total));
  const sinDiasHabiles = datos && ind && ind.horasDisponibles === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colores.fondo }}
      contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar(); }} colors={[paleta.azul]} />}
    >
      {/* Encabezado: saludo, fecha y filtros */}
      <View style={{ backgroundColor: paleta.azul, borderRadius: 18, padding: 16, gap: 12, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -40, top: -50, width: 170, height: 170, borderRadius: 85, borderWidth: 26, borderColor: 'rgba(255,255,255,0.06)' }} />
        <View style={{ position: 'absolute', right: 70, bottom: -60, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: paleta.naranja }} />
        <View>
          <Text style={{ color: paleta.naranja, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>PANEL DE SUBDIRECCIÓN</Text>
          <Text style={{ color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 2 }}>{fechaLarga(hoy)}</Text>
          <Text style={{ color: '#c9d6ec', fontSize: 12, marginTop: 2 }}>
            {actualizado ? `Actualizado ${hora(actualizado)} · se renueva cada minuto` : 'Cargando…'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['hoy', 'semana', 'mes'] as const).map((p) => (
            <Pastilla key={p} claro texto={p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Esta semana' : 'Este mes'} activa={periodo === p} onPress={() => setPeriodo(p)} />
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pastilla claro texto="Ambas sedes" activa={!sedeId} onPress={() => setSedeId('')} />
          {sedes.map((s) => <Pastilla key={s.id} claro texto={s.nombre} activa={sedeId === s.id} onPress={() => setSedeId(s.id)} />)}
          <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 2 }} />
          {TIPOS.map((t) => <Pastilla key={t.valor} claro texto={t.texto} activa={tipo === t.valor} onPress={() => setTipo(t.valor)} />)}
        </ScrollView>
      </View>

      {cargando && !datos ? (
        <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={paleta.azul} size="large" />
          <Text style={{ color: colores.suave }}>Cargando el panel…</Text>
        </View>
      ) : error && !datos ? (
        <Seccion titulo="No se pudo cargar el panel" sub={error}><Text style={{ color: colores.suave }}>Deslice hacia abajo para reintentar.</Text></Seccion>
      ) : datos && ind ? (
        <>
          {sinDiasHabiles && (
            <View style={{ backgroundColor: paleta.ambarSuave, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: paleta.ambar, fontWeight: '700' }}>
                {periodo === 'hoy' && esFinDeSemana(hoy) ? 'Hoy es fin de semana: no hay reservas.' : 'Este período no tiene días hábiles (vacaciones o días bloqueados).'}
              </Text>
            </View>
          )}

          {/* Indicadores */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Indicador titulo="Ocupación" valor={pct(ind.ocupacion)} detalle={`${ind.horasOcupadas} de ${ind.horasDisponibles} h · ${datos.salas} espacios`} />
            <Indicador titulo="Por decidir" valor={String(porDecidir ?? ind.pendientes)} detalle={`${ind.pendientes} en este período · toque para decidir`} tono="naranja" onPress={() => irA('solicitudes')} />
            <Indicador titulo="Reservas" valor={String(ind.solicitudes)} detalle={`${ind.aprobadas} aprobadas`} tono="verde" onPress={() => irA('reservas')} />
            <Indicador titulo="No usadas" valor={pct(ind.proporcionNoUsadas)} detalle={`${ind.noUsadas} canceladas, liberadas o vencidas`} tono="rojo" />
          </View>

          {/* Reservas por estado */}
          <Seccion titulo={periodo === 'hoy' ? 'Reservas de hoy por estado' : 'Reservas del período por estado'} sub="Toque un estado para destacarlo"
            accion={<Text onPress={() => irA('reservas', estadoSel ?? undefined)} style={{ color: paleta.azulMedio, fontWeight: '700', fontSize: 13 }}>Ver lista ›</Text>}>
            <Segmentos partes={porEstado} seleccion={estadoSel} onSeleccion={(k) => setEstadoSel(estadoSel === k ? null : k)} />
          </Seccion>

          {/* Uso por hora */}
          <Seccion titulo={periodo === 'hoy' ? 'Uso por hora de hoy' : 'Uso promedio por hora'} sub="Proporción de espacios ocupados · toque una barra">
            <Columnas datos={porHora} seleccion={horaSel} onSeleccion={(i) => setHoraSel(horaSel === i ? null : i)} />
          </Seccion>

          {/* Ocupación por sala */}
          <Seccion titulo="Ocupación por sala" sub={`Las ${salas.length} con más uso · toque una sala para el detalle`}>
            {salas.length === 0 ? <Text style={{ color: colores.suave }}>Sin espacios para este filtro.</Text> : salas.map((s, i) => (
              <BarraH key={s.espacioId} etiqueta={`${s.codigo} · ${s.nombre}`} valor={pct(s.indice)} proporcion={s.indice / maxSala}
                activa={sala === null ? undefined : sala === s.espacioId} retraso={i * 60}
                color={i === 0 ? paleta.naranja : paleta.azul}
                detalle={`${s.horasReservadas} h reservadas · ${s.tipo} · ${s.capacidad} personas · ${s.sede}`}
                onPress={() => setSala(sala === s.espacioId ? null : s.espacioId)} />
            ))}
          </Seccion>

          {/* Mapa de calor (semana o mes) */}
          {periodo !== 'hoy' && (
            <Seccion titulo="Mapa de calor día × hora" sub="Más oscuro = más salas ocupadas · toque una celda">
              <MapaCalor dias={datos.mapaCalor.dias} horas={datos.mapaCalor.horas} valores={datos.mapaCalor.valores} seleccion={celda} onSeleccion={(d, h) => setCelda(celda?.[0] === d && celda?.[1] === h ? null : [d, h])} />
              {celda && (
                <Text style={{ color: colores.texto }}>
                  <Text style={{ fontWeight: '700' }}>{datos.mapaCalor.dias[celda[0]]} {datos.mapaCalor.horas[celda[1]]}:00–{datos.mapaCalor.horas[celda[1]] + 1}:00</Text> · {pct(datos.mapaCalor.valores[celda[0]][celda[1]])} de las salas ocupadas
                </Text>
              )}
            </Seccion>
          )}

          {/* Capacidad por jornada */}
          <Seccion titulo="Capacidad libre por jornada" sub="Horas ocupadas sobre las disponibles">
            {datos.capacidadPorJornada.map((j, i) => (
              <BarraH key={j.nombre} etiqueta={`${j.nombre} (${j.desde}:00–${j.hasta}:00)`} valor={`${j.horasLibres} h libres`}
                proporcion={j.horasDisponibles ? j.horasOcupadas / j.horasDisponibles : 0} retraso={i * 80}
                color={paleta.azulMedio} detalle={`${j.horasOcupadas} de ${j.horasDisponibles} h ocupadas`} activa={undefined} />
            ))}
          </Seccion>

          {/* No usadas */}
          <Seccion titulo="Reservas no usadas" sub="Canceladas, liberadas por no hacer check-in o vencidas">
            {noUsadas.length === 0 ? <Text style={{ color: colores.suave }}>Ninguna en este período. 👍</Text> : noUsadas.map((x, i) => (
              <BarraH key={x.codigo} etiqueta={x.codigo} valor={String(x.total)} proporcion={x.total / maxNoUsadas} retraso={i * 60}
                color={paleta.rojo} fondo={paleta.rojoSuave}
                detalle={`${x.canceladas} canceladas · ${x.liberadas} liberadas · ${x.vencidas} vencidas`} activa={undefined} />
            ))}
          </Seccion>

          {/* Próximas */}
          <Seccion titulo={periodo === 'hoy' ? 'Lo que viene hoy' : 'Próximas reservas'} accion={<Text onPress={() => irA('reservas')} style={{ color: paleta.azulMedio, fontWeight: '700', fontSize: 13 }}>Todas ›</Text>}>
            {proximas.length === 0 ? <Text style={{ color: colores.suave }}>No quedan reservas en este período.</Text> : proximas.map((f) => (
              <View key={f.reservaId} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ width: 54, paddingVertical: 6, borderRadius: 10, backgroundColor: paleta.azulSuave, alignItems: 'center' }}>
                  <Text style={{ color: paleta.azul, fontWeight: '800', fontSize: 13 }}>{hora(f.inicio)}</Text>
                  {periodo !== 'hoy' && <Text style={{ color: colores.suave, fontSize: 10 }}>{new Date(f.inicio).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colores.texto }} numberOfLines={1}>{f.codigoEspacio} · {f.descripcion}</Text>
                  <Text style={{ color: colores.suave, fontSize: 12 }} numberOfLines={1}>{f.solicitante}</Text>
                </View>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: f.estado === 'PENDIENTE' ? paleta.naranja : paleta.verde }} />
              </View>
            ))}
          </Seccion>
        </>
      ) : null}
    </ScrollView>
  );
}
