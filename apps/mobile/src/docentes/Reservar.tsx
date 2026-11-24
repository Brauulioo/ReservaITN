import { useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { reservaCreateSchema } from '@reservaitn/shared';
import { api, esEstudiante, post } from '../api';
import { Aviso, Boton, Campo, Etiqueta, Fichas, Tarjeta, Titulo, colores } from '../ui';
import { CampoFechaHora, fechaLarga, hhmm } from '../comun/CampoFechaHora';

interface Espacio {
  id: string;
  codigo: string;
  nombre: string;
  capacidad: number;
  reservable?: boolean;
  tipo_espacio?: { codigo: string; nombre: string };
  edificio: { sede: { nombre: string } };
  espacio_item?: { cantidad_esperada: number; item: { nombre: string } }[];
}
interface Sugerencia { espacio: Espacio; esperaMin: number }
interface Ocupacion { espacio_id: string; inicio: string; fin: string; estado: string }
/** Un espacio del catálogo con su disponibilidad en el horario pedido. */
interface Opcion { espacio: Espacio; libre: boolean; cabe: boolean; choca?: Ocupacion }
interface TipoActividad { codigo: string; nombre: string }

/** Une el día de `fecha` con la hora de `hora`. */
const combinar = (fecha: Date, hora: Date) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), hora.getHours(), hora.getMinutes());
const conHora = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const manana = () => { const d = new Date(Date.now() + 86_400_000); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d; };

/**
 * Reservar (R2, R3, R10, R11, D13): día y horas al minuto con selectores nativos, actividad,
 * repetición semanal. Dos formas de elegir la sala: la que sugiere el sistema (con alternativas
 * que se liberan pronto) o cualquiera del catálogo, filtrando por sede y tipo, con su estado
 * libre u ocupado en ese horario.
 * Valida con el mismo esquema que la API antes de enviar.
 */
export function Reservar({ alReservar }: { alReservar: () => void }) {
  const [fecha, setFecha] = useState(manana());
  const [desde, setDesde] = useState(conHora(8, 55));
  const [hasta, setHasta] = useState(conHora(10, 10));
  const [asistentes, setAsistentes] = useState(esEstudiante() ? '4' : '20');
  const [motivo, setMotivo] = useState('');
  const [actividades, setActividades] = useState<TipoActividad[]>([]);
  const [actividad, setActividad] = useState(esEstudiante() ? 'ESTUDIO' : 'CLASE');
  const [semanal, setSemanal] = useState(false);
  const [repetirHasta, setRepetirHasta] = useState(new Date(Date.now() + 28 * 86_400_000));
  const [opciones, setOpciones] = useState<Sugerencia[] | null>(null);
  // Modo de elección: la sala que sugiere el sistema (R10) o cualquiera del catálogo (R3)
  const [modo, setModo] = useState<'sugerida' | 'elegir'>('sugerida');
  const [catalogo, setCatalogo] = useState<Opcion[] | null>(null);
  const [sede, setSede] = useState('TODAS');
  const [tipo, setTipo] = useState('TODOS');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api<{ tiposActividad: TipoActividad[] }>('/catalogos')
      .then((c) => setActividades(c.tiposActividad.filter((a) => a.codigo !== 'MANTENCION')))
      .catch(() => setActividades([]));
  }, []);

  const inicio = combinar(fecha, desde);
  const fin = combinar(fecha, hasta);
  const limpiar = () => { setOpciones(null); setCatalogo(null); setMsg(null); };

  /** Todas las salas reservables con su estado en ese horario: libre, ocupada o sin capacidad. */
  async function cargarCatalogo() {
    setMsg(null);
    setOcupado(true);
    try {
      const [espacios, ocupaciones] = await Promise.all([
        api<Espacio[]>('/espacios'),
        api<Ocupacion[]>(`/reservas/ocupacion?desde=${encodeURIComponent(inicio.toISOString())}&hasta=${encodeURIComponent(fin.toISOString())}`),
      ]);
      const n = Number(asistentes) || 0;
      setCatalogo(
        espacios
          .filter((e) => e.reservable !== false)
          .map((e) => {
            const choca = ocupaciones.find((o) => o.espacio_id === e.id);
            return { espacio: e, libre: !choca, cabe: e.capacidad >= n, choca };
          })
          // Primero las que sirven (libres y con capacidad), luego por código
          .sort((a, b) => Number(b.libre && b.cabe) - Number(a.libre && a.cabe) || a.espacio.codigo.localeCompare(b.espacio.codigo)),
      );
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function buscar() {
    if (modo === 'elegir') return cargarCatalogo();
    setMsg(null);
    setOcupado(true);
    try {
      const r = await post<{ sugerida: Sugerencia | null; alternativas: Sugerencia[] }>('/sugerencia', { inicio, fin, asistentes: Number(asistentes) });
      const lista = [...(r.sugerida ? [r.sugerida] : []), ...r.alternativas];
      setOpciones(lista);
      if (!lista.length) setMsg({ ok: false, texto: 'No hay espacios libres para ese horario y esa cantidad de personas.' });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function solicitar(o: Sugerencia) {
    const corrido = (d: Date) => new Date(d.getTime() + o.esperaMin * 60_000);
    const datos = {
      espacioId: o.espacio.id,
      inicio: corrido(inicio),
      fin: corrido(fin),
      tipoActividad: actividad,
      descripcion: motivo,
      asistentes: Number(asistentes),
      ...(semanal ? { repetirHasta: repetirHasta.toLocaleDateString('sv-SE') } : {}),
    };
    const v = reservaCreateSchema().safeParse(datos);
    if (!v.success) return setMsg({ ok: false, texto: [...new Set(v.error.issues.map((i) => i.message))].join('\n') });
    setOcupado(true);
    try {
      const r = await post<{ reserva: { estado: string }[] }>('/reservas', datos);
      const n = r.reserva.length;
      const aprobada = r.reserva[0]?.estado === 'APROBADA';
      setMsg({
        ok: true,
        texto: aprobada
          ? `Reserva confirmada en ${o.espacio.codigo}${n > 1 ? ` (${n} fechas)` : ''}.`
          : `Solicitud enviada para ${o.espacio.codigo}${n > 1 ? ` (${n} fechas)` : ''}. El horario queda bloqueado mientras se aprueba; recibirás un aviso.`,
      });
      setOpciones(null);
      setCatalogo(null);
      setMotivo('');
      alReservar();
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Titulo>Nueva reserva</Titulo>
      <CampoFechaHora etiqueta="Día" modo="date" valor={fecha} minimo={new Date()} onCambio={(d) => { setFecha(d); limpiar(); }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <CampoFechaHora etiqueta="Desde" modo="time" valor={desde} onCambio={(d) => { setDesde(d); limpiar(); }} />
        <CampoFechaHora etiqueta="Hasta" modo="time" valor={hasta} onCambio={(d) => { setHasta(d); limpiar(); }} />
      </View>
      <Text style={{ color: colores.suave, fontSize: 12 }}>De lunes a viernes, de 08:00 a 23:00 (sin vacaciones ni días bloqueados). Mínimo 30 minutos.</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Campo etiqueta="Asistentes" value={asistentes} onChangeText={(t) => { setAsistentes(t.replace(/\D/g, '')); limpiar(); }} keyboardType="number-pad" />
      </View>
      {actividades.length > 0 && (
        <View style={{ gap: 6 }}>
          <Etiqueta>Actividad</Etiqueta>
          <Fichas opciones={actividades.map((a) => ({ valor: a.codigo, texto: a.nombre }))} valor={actividad} onCambio={setActividad} />
        </View>
      )}
      <Campo etiqueta="Motivo" value={motivo} onChangeText={setMotivo} placeholder="Ej. clase de recuperación de Redes" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colores.texto, fontSize: 15 }}>Repetir cada semana</Text>
        <Switch value={semanal} onValueChange={setSemanal} />
      </View>
      {semanal && <CampoFechaHora etiqueta="Repetir hasta" modo="date" valor={repetirHasta} minimo={fecha} onCambio={setRepetirHasta} />}

      <View style={{ gap: 6 }}>
        <Etiqueta>¿Cómo elegir la sala?</Etiqueta>
        <Fichas
          opciones={[{ valor: 'sugerida', texto: '★ Sugerida por el sistema' }, { valor: 'elegir', texto: 'Elegir sala' }]}
          valor={modo}
          onCambio={(v) => { setModo(v as 'sugerida' | 'elegir'); limpiar(); }}
        />
      </View>
      <Boton
        titulo={`${modo === 'elegir' ? 'Ver salas' : 'Buscar sala'} · ${fechaLarga(fecha)}, ${hhmm(desde)}–${hhmm(hasta)}`}
        onPress={buscar}
        cargando={ocupado && !opciones && !catalogo}
      />
      {msg && <Aviso ok={msg.ok} texto={msg.texto} />}

      {catalogo && (() => {
        const sedes = [...new Set(catalogo.map((o) => o.espacio.edificio.sede.nombre))];
        const tipos = [...new Map(catalogo.filter((o) => o.espacio.tipo_espacio).map((o) => [o.espacio.tipo_espacio!.codigo, o.espacio.tipo_espacio!.nombre])).entries()];
        const visibles = catalogo.filter(
          (o) => (sede === 'TODAS' || o.espacio.edificio.sede.nombre === sede) && (tipo === 'TODOS' || o.espacio.tipo_espacio?.codigo === tipo),
        );
        const libres = visibles.filter((o) => o.libre && o.cabe).length;
        return (
          <View style={{ gap: 10 }}>
            {sedes.length > 1 && <Fichas opciones={[{ valor: 'TODAS', texto: 'Todas las sedes' }, ...sedes.map((x) => ({ valor: x, texto: x }))]} valor={sede} onCambio={setSede} />}
            {tipos.length > 1 && <Fichas opciones={[{ valor: 'TODOS', texto: 'Todos los tipos' }, ...tipos.map(([c, n]) => ({ valor: c, texto: n }))]} valor={tipo} onCambio={setTipo} />}
            <Text style={{ color: colores.suave }}>{libres} de {visibles.length} disponibles para {asistentes || 0} personas{semanal ? ' (se revisa la primera fecha; las demás las valida el sistema al solicitar)' : ''}.</Text>
            {visibles.map((o) => {
              const equipo = (o.espacio.espacio_item ?? []).filter((i) => !/silla|mesa/i.test(i.item.nombre)).map((i) => i.item.nombre).slice(0, 3).join(', ');
              const estado = !o.libre
                ? `Ocupada ${hhmm(new Date(o.choca!.inicio))}–${hhmm(new Date(o.choca!.fin))}${o.choca!.estado === 'PENDIENTE' ? ' (pendiente)' : ''}`
                : !o.cabe
                  ? `Capacidad ${o.espacio.capacidad}: no alcanza`
                  : 'Libre';
              return (
                <Tarjeta key={o.espacio.id}>
                  <Text style={{ fontWeight: '700', fontSize: 16 }}>{o.espacio.codigo} · {o.espacio.nombre}</Text>
                  <Text style={{ color: colores.suave }}>
                    {o.espacio.edificio.sede.nombre}{o.espacio.tipo_espacio ? ` · ${o.espacio.tipo_espacio.nombre}` : ''} · capacidad {o.espacio.capacidad}
                    {equipo ? ` · ${equipo}` : ''}
                  </Text>
                  <Text style={{ fontWeight: '700', color: o.libre && o.cabe ? '#1f7a52' : '#b42318' }}>{estado}</Text>
                  <Boton titulo="Solicitar esta sala" onPress={() => solicitar({ espacio: o.espacio, esperaMin: 0 })} deshabilitado={ocupado || !o.libre || !o.cabe} />
                </Tarjeta>
              );
            })}
          </View>
        );
      })()}

      {opciones?.map((o, i) => (
        <Tarjeta key={o.espacio.id}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>
            {i === 0 && o.esperaMin === 0 ? '★ Sugerida: ' : ''}{o.espacio.codigo} · {o.espacio.nombre}
          </Text>
          <Text style={{ color: colores.suave }}>
            {o.espacio.edificio.sede.nombre} · capacidad {o.espacio.capacidad}
            {o.esperaMin > 0 ? ` · se libera en ${o.esperaMin} min` : ' · libre'}
          </Text>
          <Boton titulo={o.esperaMin > 0 ? `Solicitar desde ${hhmm(new Date(inicio.getTime() + o.esperaMin * 60_000))}` : 'Solicitar'} onPress={() => solicitar(o)} deshabilitado={ocupado} />
        </Tarjeta>
      ))}
    </ScrollView>
  );
}
