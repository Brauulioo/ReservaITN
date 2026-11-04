'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ConPermiso } from '@/components/Panel';
import { Badge, Cabecera, Cargando, Icono, Vacio, useDatos } from '@/components/ui';
import { api, mensajeError } from '@/lib/api';
import { ORIGEN, descargarCsv, fecha, isoLocal, pct, rangoHora, sumarDias } from '@/lib/formato';
import type { Ocupacion, Sede } from '@/lib/tipos';

interface FilaSala { salaId: string; codigo: string; sede: string; tipo: string; horasReservadas: number; indice: number }
interface OcupacionGlobal { indiceGlobal: number; totalReservas: number; porSala: FilaSala[] }
type Jornada = 'MANANA' | 'TARDE' | 'VESPERTINA';
interface Bloque { dia: string; jornada: Jornada; horas: number }
interface Proyeccion { mayorUso: Bloque[]; menorUso: Bloque[]; ranking: Bloque[] }
interface Indicadores { totalReservas: number; pendientes: number; B6_tiempoPromedioAprobacionHoras: number | null; B3_reservasNoUsadas: number }

/** "14:30": hora de 24 h para el CSV (Excel la reconoce como hora; "02:30 p. m." no). */
const hora24 = (s: string) => new Date(s).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });

const JORNADA: Record<Jornada, string> = { MANANA: 'Mañana', TARDE: 'Tarde', VESPERTINA: 'Vespertina' };
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const PRESETS = [
  { texto: '7 días', dias: 7 },
  { texto: '30 días', dias: 30 },
  { texto: '90 días', dias: 90 },
];

/** Dashboard de ocupación (R12, WBS 1.4.7), reporte desde–hasta exportable (R13) y proyección de uso (R14, WBS 1.4.8). */
function Dashboard() {
  const hoy = new Date();
  const [rango, setRango] = useState({ desde: isoLocal(sumarDias(hoy, -30)), hasta: isoLocal(sumarDias(hoy, 1)), sedeId: '' });
  const [datos, setDatos] = useState<OcupacionGlobal | null>(null);
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [proy, setProy] = useState<Proyeccion | null>(null);
  const [detalle, setDetalle] = useState<{ sala: FilaSala; reservas: Ocupacion[] } | null>(null);
  const [error, setError] = useState('');
  const sedes = useDatos<Sede[]>('/sedes');

  const q = `desde=${rango.desde}&hasta=${rango.hasta}${rango.sedeId ? `&sedeId=${rango.sedeId}` : ''}`;
  useEffect(() => {
    setDatos(null);
    Promise.all([
      api<OcupacionGlobal>(`/dashboard/ocupacion?${q}`),
      api<Indicadores>(`/dashboard/indicadores?${q}`),
      api<Proyeccion>(`/proyeccion?${q}`),
    ])
      .then(([o, i, p]) => { setDatos(o); setInd(i); setProy(p); setError(''); })
      .catch((e) => setError(mensajeError(e)));
  }, [q]);

  async function verSala(sala: FilaSala) {
    const reservas = await api<Ocupacion[]>(`/reservas/ocupacion?desde=${rango.desde}&hasta=${rango.hasta}&salaId=${sala.salaId}`);
    setDetalle({ sala, reservas });
  }

  function aplicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setRango({ desde: String(f.get('desde')), hasta: String(f.get('hasta')), sedeId: String(f.get('sedeId') ?? '') });
    setDetalle(null);
  }

  function preset(dias: number) {
    setRango((r) => ({ ...r, desde: isoLocal(sumarDias(hoy, -dias)), hasta: isoLocal(sumarDias(hoy, 1)) }));
    setDetalle(null);
  }

  function exportar() {
    if (!datos) return;
    // Decimales con coma para que Excel en español los lea como números
    const num = (n: number) => String(n).replace('.', ',');
    const pctCsv = (n: number) => `${num(Number((n * 100).toFixed(1)))} %`;
    descargarCsv(`ocupacion_${rango.desde}_${rango.hasta}.csv`, [
      ['Reporte de ocupación ReservaITN', `${rango.desde} a ${rango.hasta}`],
      ['Índice global', pctCsv(datos.indiceGlobal)],
      ['Reservas aprobadas', datos.totalReservas],
      [],
      ['Sala', 'Sede', 'Tipo', 'Horas reservadas', 'Índice de ocupación'],
      ...datos.porSala.map((s) => [s.codigo, s.sede, s.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Sala', num(s.horasReservadas), pctCsv(s.indice)]),
    ]);
  }

  function exportarDetalle() {
    if (!detalle) return;
    descargarCsv(`detalle_${detalle.sala.codigo}_${rango.desde}_${rango.hasta}.csv`, [
      ['Fecha', 'Inicio', 'Término', 'Motivo', 'Origen'],
      ...detalle.reservas.map((r) => [isoLocal(new Date(r.inicio)), hora24(r.inicio), hora24(r.fin), r.motivo, ORIGEN[r.origen] ?? r.origen]),
    ]);
  }

  const maxHoras = Math.max(1, ...(proy?.ranking ?? []).map((b) => b.horas));
  const celda = (dia: string, j: Jornada) => proy?.ranking.find((b) => b.dia === dia && b.jornada === j)?.horas ?? 0;

  return (
    <>
      <Cabecera miga="Análisis" titulo="Dashboard y reportes" sub="Ocupación de salas y laboratorios, tiempos de aprobación y proyección de uso por jornada.">
        <button className="sec no-imprimir" onClick={() => window.print()}><Icono n="imprimir" />Imprimir / PDF</button>
        <button className="no-imprimir" onClick={exportar} disabled={!datos}><Icono n="bajar" />Exportar CSV</button>
      </Cabecera>

      <section className="card no-imprimir">
        <form className="fila" onSubmit={aplicar} key={`${rango.desde}${rango.hasta}${rango.sedeId}`}>
          <label>Desde<input type="date" name="desde" defaultValue={rango.desde} /></label>
          <label>Hasta<input type="date" name="hasta" defaultValue={rango.hasta} /></label>
          <label>Sede
            <select name="sedeId" defaultValue={rango.sedeId}>
              <option value="">Todas las sedes</option>
              {sedes.datos?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <button type="submit">Generar reporte</button>
          <div className="chips" style={{ marginLeft: 'auto' }}>
            {PRESETS.map((p) => <button type="button" key={p.dias} className="chip" onClick={() => preset(p.dias)}>Últimos {p.texto}</button>)}
          </div>
        </form>
      </section>

      {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
      {!datos || !ind ? !error && <section className="card"><Cargando filas={5} /></section> : (
        <>
          <section className="grid">
            <div className="card kpi destacado"><span className="etiqueta"><Icono n="grafico" t={15} />Índice de ocupación</span><span className="valor">{pct(datos.indiceGlobal)}</span><span className="nota">Horas reservadas ÷ horas disponibles</span></div>
            <div className="card kpi"><span className="etiqueta"><Icono n="check" t={15} />Reservas aprobadas</span><span className="valor">{datos.totalReservas}</span><span className="nota">En el período, sin mantención</span></div>
            <div className="card kpi"><span className="etiqueta"><Icono n="reloj" t={15} />Pendientes</span><span className="valor">{ind.pendientes}</span><span className="nota">Solicitudes creadas en el período</span></div>
            <div className="card kpi"><span className="etiqueta"><Icono n="historial" t={15} />Tiempo medio de aprobación</span><span className="valor">{ind.B6_tiempoPromedioAprobacionHoras === null ? '—' : `${ind.B6_tiempoPromedioAprobacionHoras.toFixed(1)} h`}</span><span className="nota">Indicador B6</span></div>
            <div className="card kpi"><span className="etiqueta"><Icono n="alerta" t={15} />Reservas no usadas</span><span className="valor">{pct(ind.B3_reservasNoUsadas)}</span><span className="nota">Liberadas por no presentarse (B3)</span></div>
          </section>

          <div className="grid-lateral">
            <section className="card">
              <div className="card-head">
                <h2>Ocupación por sala</h2>
                <span className="muted chico">Haz clic en una sala para ver el detalle</span>
              </div>
              {datos.porSala.length === 0 ? <Vacio icono="edificio" titulo="No hay salas en esta sede" /> : (
                <div className="tabla-wrap">
                  <table>
                    <thead><tr><th>Sala</th><th>Sede</th><th>Tipo</th><th>Horas</th><th style={{ width: '32%' }}>Ocupación</th><th /></tr></thead>
                    <tbody>
                      {datos.porSala.map((s) => (
                        <tr key={s.salaId} className={`click${detalle?.sala.salaId === s.salaId ? ' seleccionada' : ''}`} onClick={() => verSala(s)}>
                          <td><strong>{s.codigo}</strong></td><td>{s.sede}</td>
                          <td><Badge tono={s.tipo === 'LABORATORIO' ? 'info' : ''}>{s.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Sala'}</Badge></td>
                          <td className="tnum">{s.horasReservadas}</td>
                          <td><div className={`barra${s.indice > 0.75 ? ' alta' : ''}`}><span style={{ width: `${(s.indice * 100).toFixed(1)}%` }} /></div></td>
                          <td className="tnum">{pct(s.indice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {proy && (
              <section className="card" style={{ display: 'grid', gap: '0.9rem' }}>
                <h2>Proyección de uso</h2>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Jornadas de mayor uso</h3>
                  {proy.mayorUso.map((b) => (
                    <div key={b.dia + b.jornada} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{b.dia} · {JORNADA[b.jornada].toLowerCase()}</span><strong className="tnum">{b.horas.toFixed(1)} h</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Horas ociosas (menor uso)</h3>
                  {proy.menorUso.map((b) => (
                    <div key={b.dia + b.jornada} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{b.dia} · {JORNADA[b.jornada].toLowerCase()}</span><strong className="tnum">{b.horas.toFixed(1)} h</strong>
                    </div>
                  ))}
                </div>
                <p className="ayuda">Candidatas para mantención o reprogramación de clases (beneficio B8).</p>
              </section>
            )}
          </div>

          {proy && (
            <section className="card">
              <div className="card-head">
                <h2>Mapa de calor: día × jornada</h2>
                <div className="escala"><span>0 h</span><span className="grad" /><span>{maxHoras.toFixed(0)} h</span></div>
              </div>
              <div className="heatmap">
                <span />
                {DIAS.map((d) => <span key={d} className="eje col">{d.slice(0, 3)}</span>)}
                {(Object.keys(JORNADA) as Jornada[]).map((j) => (
                  <div key={j} style={{ display: 'contents' }}>
                    <span className="eje">{JORNADA[j]}</span>
                    {DIAS.map((d) => {
                      const h = celda(d, j);
                      const t = h / maxHoras;
                      return (
                        <span key={d} className="celda" title={`${d} ${JORNADA[j].toLowerCase()}: ${h.toFixed(1)} h`}
                          style={{ background: `color-mix(in srgb, var(--navy-700) ${Math.round(t * 100)}%, var(--neutral-bg))`, color: t > 0.5 ? '#fff' : undefined }}>
                          {h > 0 ? h.toFixed(1) : '·'}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {detalle && (
            <section className="card">
              <div className="card-head">
                <h2>Detalle de {detalle.sala.codigo}</h2>
                <button className="sec chico no-imprimir" onClick={exportarDetalle}><Icono n="bajar" t={15} />CSV</button>
                <button className="fantasma chico no-imprimir" onClick={() => setDetalle(null)} aria-label="Cerrar detalle"><Icono n="cerrar" t={16} /></button>
              </div>
              {detalle.reservas.length === 0 ? <Vacio titulo="Sin reservas aprobadas en el período" /> : (
                <div className="tabla-wrap">
                  <table>
                    <thead><tr><th>Fecha</th><th>Horario</th><th>Motivo</th><th>Origen</th></tr></thead>
                    <tbody>{detalle.reservas.map((r) => (
                      <tr key={r.id}><td>{fecha(r.inicio)}</td><td className="tnum">{rangoHora(r.inicio, r.fin)}</td><td>{r.motivo}</td><td>{ORIGEN[r.origen] ?? r.origen}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

export default function Pagina() {
  return <ConPermiso permiso="dashboard:ver"><Dashboard /></ConPermiso>;
}
