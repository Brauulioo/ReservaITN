'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { periodoNoDisponibleSchema } from '@reservaitn/shared';
import { ConPermiso } from '@/components/Panel';
import { Badge, Cabecera, Cargando, Icono, Vacio, useAviso, useDatos } from '@/components/ui';
import { SelectorDia } from '@/components/SelectorDia';
import { api, enviar, mensajeError } from '@/lib/api';

interface Sede { id: string; nombre: string }
interface Periodo {
  id: string;
  motivo: string;
  desde: string;
  hasta: string;
  sedeId: string | null;
  sede: string | null;
  repetirAnios: number;
  dias: number;
  ultimoHasta: string;
}
interface Afectada { id: string; inicio: string; fin: string; estado: string; espacio: string; solicitante: string }

type Unidad = 'dias' | 'semanas' | 'meses';
const UNIDADES: { v: Unidad; uno: string; varios: string }[] = [
  { v: 'dias', uno: 'día', varios: 'días' },
  { v: 'semanas', uno: 'semana', varios: 'semanas' },
  { v: 'meses', uno: 'mes', varios: 'meses' },
];
const RAPIDOS: { texto: string; n: number; u: Unidad }[] = [
  { texto: '1 día', n: 1, u: 'dias' },
  { texto: '1 semana', n: 1, u: 'semanas' },
  { texto: '2 semanas', n: 2, u: 'semanas' },
  { texto: '1 mes', n: 1, u: 'meses' },
];

/** Fechas como texto AAAA-MM-DD, sin horas: el bloqueo es por días completos (00:00 a 23:59). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const desdeIso = (s: string) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const hoy = () => iso(new Date());
/** Último día de un período que empieza en `desde` y dura `n` unidades. */
function calcularHasta(desde: string, n: number, u: Unidad): string {
  const d = desdeIso(desde);
  if (u === 'dias') d.setDate(d.getDate() + n - 1);
  if (u === 'semanas') d.setDate(d.getDate() + 7 * n - 1);
  if (u === 'meses') { d.setMonth(d.getMonth() + n); d.setDate(d.getDate() - 1); }
  return iso(d);
}
const largo = (s: string) => desdeIso(s).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const corto = (s: string) => desdeIso(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
const diasEntre = (a: string, b: string) => Math.round((desdeIso(b).getTime() - desdeIso(a).getTime()) / 86_400_000) + 1;
const anio = (s: string) => s.slice(0, 4);

/**
 * Días no disponibles (V014). Sábados y domingos no se reservan nunca; aquí Subdirección agrega
 * vacaciones, recesos o eventos por días completos, para una sede o todas, y puede repetirlos cada año.
 */
export default function DiasNoDisponibles() {
  return (
    <ConPermiso permiso="calendario:gestionar">
      <Cabecera
        miga="Gestión"
        titulo="Días no disponibles"
        sub="Bloquee días completos (de 00:00 a 23:59) en que no se puede reservar. Los sábados y domingos ya están bloqueados siempre."
      />
      <Contenido />
    </ConPermiso>
  );
}

function Contenido() {
  const avisar = useAviso();
  const periodos = useDatos<Periodo[]>('/calendario/periodos');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [motivo, setMotivo] = useState('');
  const [desde, setDesde] = useState(hoy());
  const [n, setN] = useState(1);
  const [unidad, setUnidad] = useState<Unidad>('semanas');
  const [hasta, setHasta] = useState(calcularHasta(hoy(), 1, 'semanas'));
  const [personalizado, setPersonalizado] = useState(false);
  const [sedeId, setSedeId] = useState('');
  const [repetir, setRepetir] = useState(false);
  const [anios, setAnios] = useState(1);
  const [cancelar, setCancelar] = useState(false);
  const [afectadas, setAfectadas] = useState<Afectada[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [quitando, setQuitando] = useState<Periodo | null>(null);

  useEffect(() => { api<Sede[]>('/sedes').then(setSedes).catch(() => {}); }, []);
  // Con una duración elegida, la fecha final se calcula sola
  useEffect(() => { if (!personalizado && desde) setHasta(calcularHasta(desde, Math.max(1, n), unidad)); }, [desde, n, unidad, personalizado]);

  const repetirAnios = repetir ? Math.max(1, Math.min(30, anios)) : 0;
  const valido = desde && hasta && hasta >= desde;

  // Vista previa: reservas ya hechas que caerían en el período
  useEffect(() => {
    if (!valido) { setAfectadas(null); return; }
    const q = new URLSearchParams({ desde, hasta, repetirAnios: String(repetirAnios) });
    if (sedeId) q.set('sedeId', sedeId);
    const t = setTimeout(() => api<Afectada[]>(`/calendario/periodos/afectadas?${q}`).then(setAfectadas).catch(() => setAfectadas(null)), 300);
    return () => clearTimeout(t);
  }, [desde, hasta, sedeId, repetirAnios, valido]);

  const elegirRapido = (r: (typeof RAPIDOS)[number]) => { setPersonalizado(false); setN(r.n); setUnidad(r.u); };
  const dias = valido ? diasEntre(desde, hasta) : 0;
  const resumen = useMemo(() => {
    if (!valido) return '';
    const base = desde === hasta ? largo(desde) : `${largo(desde)} al ${largo(hasta)}`;
    return repetirAnios ? `${base}, y lo mismo cada año hasta ${Number(anio(hasta)) + repetirAnios}` : base;
  }, [desde, hasta, repetirAnios, valido]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError('');
    const datos = { motivo, desde, hasta, sedeId: sedeId || null, repetirAnios, cancelarAfectadas: cancelar };
    const v = periodoNoDisponibleSchema.safeParse(datos);
    if (!v.success) { setError(v.error.issues[0]?.message ?? 'Revise los datos'); return; }
    setGuardando(true);
    try {
      const r = await enviar<{ afectadas: number; canceladas: number; sinCancelar: number }>('/calendario/periodos', datos);
      avisar(
        r.canceladas ? `Período guardado. Se cancelaron ${r.canceladas} reserva(s) y se avisó a cada solicitante.`
          : r.sinCancelar ? `Período guardado. ${r.sinCancelar} reserva(s) ya hechas se mantienen.`
          : 'Período guardado: esos días ya no se pueden reservar.',
      );
      setMotivo(''); setCancelar(false); setRepetir(false); setPersonalizado(false); setN(1); setUnidad('semanas'); setDesde(hoy());
      periodos.recargar();
      setAfectadas([]);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(p: Periodo) {
    try {
      await enviar(`/calendario/periodos/${p.id}/quitar`, {}, 'PATCH');
      avisar(`Se quitó «${p.motivo}»: esos días vuelven a estar disponibles.`);
      setQuitando(null);
      periodos.recargar();
    } catch (err) {
      avisar(mensajeError(err), true);
    }
  }

  return (
    <div className="ndisp">
      <form className="card ndisp-form" onSubmit={guardar}>
        <h2>Nuevo período no disponible</h2>
        <div className="campos">
          <label style={{ gridColumn: '1 / -1' }}>
            Motivo
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: Receso de invierno, Aniversario, Fiestas Patrias" maxLength={120} required />
          </label>
        </div>

        <div className="ndisp-bloque">
          <span className="etiqueta-campo">Duración</span>
          <div className="chips">
            {RAPIDOS.map((r) => (
              <button type="button" key={r.texto} className={`chip${!personalizado && n === r.n && unidad === r.u ? ' activo' : ''}`} onClick={() => elegirRapido(r)}>
                {r.texto}
              </button>
            ))}
            <button type="button" className={`chip${personalizado ? ' activo' : ''}`} onClick={() => setPersonalizado(true)}>Elegir fechas</button>
          </div>
        </div>

        <div className="campos">
          <SelectorDia libre etiqueta="Desde (00:00)" valor={desde} onCambio={setDesde} sedeId={sedeId || undefined} />
          {personalizado ? (
            <SelectorDia libre etiqueta="Hasta (23:59)" valor={hasta} minimo={desde} onCambio={setHasta} sedeId={sedeId || undefined} />
          ) : (
            <label>
              Cuántos
              <span className="ndisp-cantidad">
                <input type="number" min={1} max={unidad === 'dias' ? 366 : unidad === 'semanas' ? 52 : 12} value={n} onChange={(e) => setN(Number(e.target.value) || 1)} />
                <select value={unidad} onChange={(e) => setUnidad(e.target.value as Unidad)} aria-label="Unidad">
                  {UNIDADES.map((u) => <option key={u.v} value={u.v}>{n === 1 ? u.uno : u.varios}</option>)}
                </select>
              </span>
            </label>
          )}
          <label>
            Sede
            <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
              <option value="">Todas las sedes</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
        </div>

        <div className="ndisp-bloque ndisp-repetir">
          <label className="check">
            <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} /> Repetir cada año
          </label>
          {repetir && (
            <label className="ndisp-anios">
              durante
              <input type="number" min={1} max={30} value={anios} onChange={(e) => setAnios(Number(e.target.value) || 1)} aria-label="Años" />
              {anios === 1 ? 'año más' : 'años más'}
            </label>
          )}
        </div>

        {valido && (
          <div className="ndisp-resumen">
            <Icono n="calendario" />
            <div>
              <strong>{dias} {dias === 1 ? 'día' : 'días'} no disponibles</strong>
              <span>{resumen}</span>
            </div>
          </div>
        )}

        {afectadas && afectadas.length > 0 && (
          <div className="ndisp-afectadas">
            <p><Icono n="alerta" /> <strong>{afectadas.length} reserva(s) ya hechas</strong> caen en esos días.</p>
            <ul>
              {afectadas.slice(0, 6).map((r) => (
                <li key={r.id}>
                  {new Date(r.inicio).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                  {new Date(r.inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · {r.espacio} · {r.solicitante}
                </li>
              ))}
              {afectadas.length > 6 && <li>y {afectadas.length - 6} más…</li>}
            </ul>
            <label className="check">
              <input type="checkbox" checked={cancelar} onChange={(e) => setCancelar(e.target.checked)} /> Cancelarlas y avisar a cada solicitante
            </label>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="submit" disabled={guardando || !valido}>{guardando ? 'Guardando…' : 'Bloquear días'}</button>
        </div>
      </form>

      <section className="card">
        <h2>Períodos vigentes</h2>
        <p className="etiqueta" style={{ marginTop: 0 }}>Además, todos los sábados y domingos.</p>
        {periodos.cargando && !periodos.datos ? <Cargando /> : !periodos.datos?.length ? (
          <Vacio titulo="Sin períodos">Agregue vacaciones o recesos con el formulario.</Vacio>
        ) : (
          <ul className="ndisp-lista">
            {periodos.datos.map((p) => (
              <li key={p.id}>
                <div className="ndisp-fecha">
                  <strong>{corto(p.desde)}</strong>
                  {p.desde !== p.hasta && <span>al {corto(p.hasta)}</span>}
                </div>
                <div className="ndisp-info">
                  <strong>{p.motivo}</strong>
                  <span>
                    {p.dias} {p.dias === 1 ? 'día' : 'días'} · {anio(p.desde)}{anio(p.hasta) !== anio(p.desde) ? `–${anio(p.hasta)}` : ''} · {p.sede ?? 'Todas las sedes'}
                  </span>
                  {p.repetirAnios > 0 && <Badge tono="info">Se repite cada año hasta {anio(p.ultimoHasta)}</Badge>}
                </div>
                <button type="button" className="sec chico" onClick={() => setQuitando(p)}>Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {quitando && (
        <div className="dialogo-fondo" role="dialog" aria-modal="true" onClick={() => setQuitando(null)}>
          <div className="card dialogo" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>¿Quitar «{quitando.motivo}»?</h2>
            <p>Esos días volverán a estar disponibles para reservar{quitando.repetirAnios ? ', en todos los años en que se repetía' : ''}.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="sec" onClick={() => setQuitando(null)}>Volver</button>
              <button type="button" onClick={() => quitar(quitando)}>Quitar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
