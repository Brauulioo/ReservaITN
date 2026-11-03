'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState, type FormEvent } from 'react';
import { HORARIO, ROLES_AUTOAPROBADOS } from '@reservaitn/shared';
import { ConPermiso, usePanel } from '@/components/Panel';
import { Badge, Cabecera, EstadoBadge, Icono, useAviso, useDatos } from '@/components/ui';
import { enviar, mensajeError } from '@/lib/api';
import { fecha, isoLocal, rangoHora, sumarDias } from '@/lib/formato';
import type { Sala, Sede } from '@/lib/tipos';
import type { EstadoReserva } from '@reservaitn/shared';

/** Sala tal como la devuelve POST /sugerencia; `esperaMin` > 0 = se libera dentro de 30 min. */
interface Candidata { id: string; codigo: string; nombre: string; capacidad: number; equipamiento: string[]; sedeId: string; carreraExclusivaId: string | null }
interface Sugerencia { sala: Candidata; esperaMin: number; puntaje: number }
interface Opcion { sala: Candidata; esperaMin: number; recomendada?: boolean; manual?: boolean }

/** Mañana, o el lunes si mañana es domingo (no se reserva en domingo). */
function siguienteHabil(): Date {
  let d = sumarDias(new Date(), 1);
  if (d.getDay() === 0) d = sumarDias(d, 1);
  return d;
}

/** Nueva reserva con sugerencia de sala y alternativas ≤ 30 min (R10, R19, WBS 1.4.5). */
function Reservar() {
  const q = useSearchParams();
  const avisar = useAviso();
  const { sesion, refrescarContadores } = usePanel();
  const salas = useDatos<Sala[]>('/salas');
  const sedes = useDatos<Sede[]>('/sedes');

  const [form, setForm] = useState({
    fecha: q.get('fecha') ?? isoLocal(siguienteHabil()),
    inicio: q.get('hora') ?? '10:00',
    fin: q.get('hora') ? `${String(Number(q.get('hora')!.slice(0, 2)) + 1).padStart(2, '0')}:30` : '11:30',
    asistentes: 20,
    sedeId: '',
    motivo: '',
  });
  const [equipos, setEquipos] = useState<string[]>([]);
  const [opciones, setOpciones] = useState<Opcion[] | null>(null);
  const [elegida, setElegida] = useState<Opcion | null>(null);
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<{ estado: EstadoReserva; sala: string; inicio: Date; fin: Date } | null>(null);

  const salaInicial = q.get('salaId');
  const equipamientos = useMemo(() => [...new Set((salas.datos ?? []).flatMap((s) => s.equipamiento))].sort(), [salas.datos]);
  const sedeNombre = (id: string) => sedes.datos?.find((s) => s.id === id)?.nombre ?? '';
  const inicio = new Date(`${form.fecha}T${form.inicio}`);
  const fin = new Date(`${form.fecha}T${form.fin}`);
  const desplazar = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);
  const autoaprobada = ROLES_AUTOAPROBADOS.includes(sesion.usuario.rol);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: k === 'asistentes' ? Number(e.target.value) : e.target.value }));
    setOpciones(null);
    setElegida(null);
  };

  async function buscar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBuscando(true);
    try {
      const r = await enviar<{ sugerida: Sugerencia | null; alternativas: Sugerencia[] }>('/sugerencia', {
        inicio, fin, asistentes: form.asistentes, sedeId: form.sedeId || undefined, equipamiento: equipos.length ? equipos : undefined,
      });
      const lista: Opcion[] = [
        ...(r.sugerida ? [{ ...r.sugerida, recomendada: true }] : []),
        ...r.alternativas.map((a) => ({ sala: a.sala, esperaMin: a.esperaMin })),
      ];
      // Si se llegó desde el calendario con una sala, se ofrece también aunque no sea la sugerida
      const pedida = salas.datos?.find((s) => s.id === salaInicial);
      if (pedida && !lista.some((o) => o.sala.id === pedida.id)) lista.push({ sala: pedida, esperaMin: 0, manual: true });
      setOpciones(lista);
      setElegida(lista.find((o) => o.sala.id === salaInicial) ?? lista[0] ?? null);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setBuscando(false);
    }
  }

  async function solicitar() {
    if (!elegida) return;
    setError('');
    const ini = desplazar(inicio, elegida.esperaMin);
    const fn = desplazar(fin, elegida.esperaMin);
    try {
      const r = await enviar<{ estado: EstadoReserva }>('/reservas', {
        salaId: elegida.sala.id, inicio: ini, fin: fn, motivo: form.motivo, asistentes: form.asistentes,
      });
      setResultado({ estado: r.estado, sala: elegida.sala.codigo, inicio: ini, fin: fn });
      avisar(r.estado === 'APROBADA' ? 'Reserva confirmada' : 'Solicitud enviada para aprobación');
      refrescarContadores();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  if (resultado) {
    const ok = resultado.estado === 'APROBADA';
    return (
      <>
        <Cabecera miga="Reservas" titulo={ok ? 'Reserva confirmada' : 'Solicitud enviada'} />
        <section className="card" style={{ maxWidth: 640 }}>
          <div className="vacio">
            <div className="ico" style={{ background: ok ? 'var(--ok-bg)' : 'var(--warn-bg)', color: ok ? 'var(--ok)' : 'var(--warn)' }}>
              <Icono n={ok ? 'check' : 'reloj'} t={26} />
            </div>
            <strong style={{ fontSize: '1.1rem' }}>{resultado.sala} · {fecha(resultado.inicio)}</strong>
            <span>{rangoHora(resultado.inicio, resultado.fin)} · <EstadoBadge estado={resultado.estado} /></span>
            <p className="chico" style={{ maxWidth: '44ch' }}>
              {ok ? 'La sala quedó reservada a tu nombre.' : 'Tu solicitud llegó al aprobador correspondiente. Te avisaremos en Notificaciones cuando se decida.'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Link href="/mis-reservas" className="btn">Ver mis reservas</Link>
              <button className="sec" onClick={() => { setResultado(null); setOpciones(null); setForm((f) => ({ ...f, motivo: '' })); }}>Hacer otra reserva</button>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Cabecera miga="Reservas" titulo="Nueva reserva" sub="Indica cuándo y para cuántas personas; el sistema te sugiere la sala más adecuada.">
        <div className="pasos">
          <span className={`paso ${opciones ? 'hecho' : 'actual'}`}><b>1</b>Datos</span>
          <span className={`paso ${opciones ? 'actual' : ''}`}><b>2</b>Sala</span>
          <span className="paso"><b>3</b>Enviar</span>
        </div>
      </Cabecera>

      <div className="grid-lateral">
        <form className="card" onSubmit={buscar} style={{ display: 'grid', gap: '1rem' }}>
          <h2>¿Cuándo la necesitas?</h2>
          <div className="form-grid">
            <label>Fecha<input type="date" required value={form.fecha} min={isoLocal(new Date())} max={isoLocal(sumarDias(new Date(), HORARIO.anticipacionMaxDias))} onChange={set('fecha')} /></label>
            <label>Desde<input type="time" required step={900} value={form.inicio} min={`0${HORARIO.aperturaHora}:00`.slice(-5)} max={`${HORARIO.cierreHora}:00`} onChange={set('inicio')} /></label>
            <label>Hasta<input type="time" required step={900} value={form.fin} min={`0${HORARIO.aperturaHora}:00`.slice(-5)} max={`${HORARIO.cierreHora}:00`} onChange={set('fin')} /></label>
            <label>Asistentes<input type="number" required min={1} max={500} value={form.asistentes} onChange={set('asistentes')} /></label>
            <label>Sede
              <select value={form.sedeId} onChange={set('sedeId')}>
                <option value="">Cualquier sede</option>
                {sedes.datos?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
          </div>
          {equipamientos.length > 0 && (
            <div className="campo">
              Equipamiento necesario
              <div className="chips">
                {equipamientos.map((eq) => (
                  <button type="button" key={eq} className={`chip${equipos.includes(eq) ? ' activo' : ''}`}
                    onClick={() => { setEquipos((l) => (l.includes(eq) ? l.filter((x) => x !== eq) : [...l, eq])); setOpciones(null); }}>
                    {equipos.includes(eq) && <Icono n="check" t={14} />}{eq}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="ayuda">
            Horario institucional {HORARIO.aperturaHora}:00–{HORARIO.cierreHora}:00, de lunes a sábado. Duración entre {HORARIO.duracionMinMin} min y {HORARIO.duracionMaxHoras} h.
          </p>
          {error && !opciones && <div className="alerta error"><Icono n="alerta" />{error}</div>}
          <div><button type="submit" className="acento" disabled={buscando}><Icono n="destello" />{buscando ? 'Buscando…' : 'Buscar salas disponibles'}</button></div>
        </form>

        <aside className="card" style={{ display: 'grid', gap: '0.9rem' }}>
          <h2>Cómo funciona</h2>
          <ul className="timeline">
            <li><strong>Sugerencia inteligente</strong><small>Prioriza la sala que mejor se ajusta a la capacidad y al equipamiento.</small></li>
            <li><strong>Alternativas</strong><small>Si no hay sala libre, te propone opciones que se liberan dentro de 30 minutos.</small></li>
            <li><strong>Sin choques</strong><small>La base de datos impide que dos reservas aprobadas se solapen.</small></li>
            <li><strong>Aprobación</strong><small>{autoaprobada ? 'Tus reservas quedan aprobadas al instante.' : 'Tu director de carrera o Dirección Académica aprueba la solicitud.'}</small></li>
          </ul>
        </aside>
      </div>

      {opciones && (
        <section className="card" style={{ display: 'grid', gap: '1rem' }}>
          <div className="card-head">
            <h2>Salas para el {fecha(inicio)}, {rangoHora(inicio, fin)}</h2>
            <span className="muted chico">{opciones.length} opciones</span>
          </div>
          {opciones.length === 0 ? (
            <div className="alerta info"><Icono n="alerta" />No hay salas libres con esa capacidad y equipamiento, ni que se liberen en 30 minutos. Prueba otro horario, otra sede o menos equipamiento.</div>
          ) : (
            <div className="opciones">
              {opciones.map((o) => (
                <button type="button" key={o.sala.id} onClick={() => setElegida(o)}
                  className={`opcion${o.recomendada ? ' recomendada' : ''}${elegida?.sala.id === o.sala.id ? ' elegida' : ''}`}>
                  <span className="ico"><Icono n={o.recomendada ? 'destello' : 'sala'} t={20} /></span>
                  <span className="det">
                    <strong>{o.sala.codigo} · {o.sala.nombre}</strong>
                    <small>{sedeNombre(o.sala.sedeId)} · capacidad {o.sala.capacidad}{o.sala.equipamiento.length ? ` · ${o.sala.equipamiento.join(', ')}` : ''}</small>
                  </span>
                  {o.recomendada && <Badge tono="naranja">Recomendada</Badge>}
                  {o.manual && <Badge tono="info">Elegida en el calendario</Badge>}
                  {o.esperaMin > 0 && <Badge tono="warn">Libre en {o.esperaMin} min</Badge>}
                  {o.sala.carreraExclusivaId && o.sala.carreraExclusivaId !== sesion.usuario.carreraId && <Badge tono="info">Préstamo de laboratorio</Badge>}
                </button>
              ))}
            </div>
          )}

          {elegida && (
            <div className="form-grid" style={{ alignItems: 'end' }}>
              <label className="ancho">Motivo de la reserva
                <textarea required minLength={3} maxLength={300} placeholder="Ej.: Clase de Programación II, ayudantía, reunión de carrera…" value={form.motivo}
                  onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} />
              </label>
              {elegida.esperaMin > 0 && (
                <div className="alerta info ancho"><Icono n="reloj" />La reserva se moverá {elegida.esperaMin} min: {rangoHora(desplazar(inicio, elegida.esperaMin), desplazar(fin, elegida.esperaMin))}.</div>
              )}
              {error && <div className="alerta error ancho"><Icono n="alerta" />{error}</div>}
              <div className="ancho" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={form.motivo.trim().length < 3} onClick={solicitar}>
                  <Icono n="check" />{autoaprobada ? 'Confirmar reserva' : 'Enviar solicitud'} · {elegida.sala.codigo}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function Pagina() {
  return (
    <ConPermiso permiso="reserva:solicitar">
      <Suspense><Reservar /></Suspense>
    </ConPermiso>
  );
}
