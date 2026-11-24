'use client';
/**
 * Inicio de Subdirección (y de quien ve el dashboard): los 4 gráficos de prioridad alta en una
 * sola ventana, con filtros de período, sede y tipo de espacio. Los datos vienen ya calculados de
 * GET /dashboard/inicio, así la pantalla carga rápido y coincide con el dashboard y el Excel.
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePanel } from './Panel';
import { Cargando, Icono, useDatos } from './ui';

interface Inicio {
  salas: number;
  indicadores: { ocupacion: number; horasOcupadas: number; horasDisponibles: number; aprobadas: number; pendientes: number; solicitudes: number; noUsadas: number; proporcionNoUsadas: number };
  ocupacionPorSala: { espacioId: string; codigo: string; nombre: string; sede: string; tipo: string; capacidad: number; horasReservadas: number; indice: number }[];
  mapaCalor: { horas: number[]; dias: string[]; valores: number[][] };
  capacidadPorJornada: { nombre: string; desde: number; hasta: number; horasOcupadas: number; horasLibres: number; horasDisponibles: number }[];
  noUsadasPorSala: { codigo: string; canceladas: number; liberadas: number; vencidas: number; total: number }[];
}
type Periodo = 'semana' | 'mes' | 'anterior' | 'proximas';

const PERIODOS: { v: Periodo; t: string }[] = [
  { v: 'semana', t: 'Esta semana' },
  { v: 'mes', t: 'Este mes' },
  { v: 'anterior', t: 'Mes anterior' },
  { v: 'proximas', t: 'Próximas 4 semanas' },
];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const pct = (x: number) => `${(x * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`;
const num = (x: number) => Math.round(x).toLocaleString('es-CL');

/** Desde y hasta (exclusivo) del período, en hora local. */
function rango(p: Periodo): [Date, Date] {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const mes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  switch (p) {
    case 'semana': return [lunes, new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 7)];
    case 'anterior': return [new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), mes];
    case 'proximas': return [lunes, new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 28)];
    default: return [mes, new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)];
  }
}

function leerFiltros(): { periodo: Periodo; sedeId: string; tipo: string } {
  try {
    const f = JSON.parse(localStorage.getItem('inicio-filtros') ?? '{}');
    return { periodo: PERIODOS.some((p) => p.v === f.periodo) ? f.periodo : 'mes', sedeId: f.sedeId ?? '', tipo: f.tipo ?? '' };
  } catch {
    return { periodo: 'mes', sedeId: '', tipo: '' };
  }
}

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

export function InicioSubdireccion() {
  const { sesion } = usePanel();
  const [filtros, setFiltros] = useState(leerFiltros);
  useEffect(() => {
    try { localStorage.setItem('inicio-filtros', JSON.stringify(filtros)); } catch { /* sin almacenamiento */ }
  }, [filtros]);

  const sedes = useDatos<{ id: string; nombre: string }[]>('/sedes');
  const catalogos = useDatos<{ tiposEspacio: { codigo: string; nombre: string }[] }>('/catalogos');
  const [desde, hasta] = useMemo(() => rango(filtros.periodo), [filtros.periodo]);
  const ruta = `/dashboard/inicio?desde=${encodeURIComponent(desde.toISOString())}&hasta=${encodeURIComponent(hasta.toISOString())}`
    + (filtros.sedeId ? `&sedeId=${filtros.sedeId}` : '') + (filtros.tipo ? `&tipo=${filtros.tipo}` : '');
  const { datos: d, error } = useDatos<Inicio>(ruta);

  const nombre = sesion.usuario.nombre.split(' ')[0];
  const etiquetaPeriodo = PERIODOS.find((p) => p.v === filtros.periodo)!.t.toLowerCase();
  const cambiar = (k: keyof typeof filtros) => (e: React.ChangeEvent<HTMLSelectElement>) => setFiltros((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="inicio-sub">
      <div className="inicio-sub-cab">
        <div>
          <h1>{saludo()}, {nombre}</h1>
          <p className="muted">Así se usan las salas del ITN · {etiquetaPeriodo} ({desde.toLocaleDateString('es-CL')} – {new Date(hasta.getTime() - 1).toLocaleDateString('es-CL')})</p>
        </div>
        <form className="inicio-sub-filtros" aria-label="Filtros del inicio" onSubmit={(e) => e.preventDefault()}>
          <label>Período
            <select id="inicio-periodo" value={filtros.periodo} onChange={cambiar('periodo')}>
              {PERIODOS.map((p) => <option key={p.v} value={p.v}>{p.t}</option>)}
            </select>
          </label>
          <label>Sede
            <select id="inicio-sede" value={filtros.sedeId} onChange={cambiar('sedeId')}>
              <option value="">Todas</option>
              {sedes.datos?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <label>Tipo de espacio
            <select id="inicio-tipo" value={filtros.tipo} onChange={cambiar('tipo')}>
              <option value="">Todos</option>
              {catalogos.datos?.tiposEspacio.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
            </select>
          </label>
        </form>
      </div>

      {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
      {!d ? !error && <div className="card"><Cargando filas={6} /></div> : <Contenido d={d} />}
    </div>
  );
}

function Contenido({ d }: { d: Inicio }) {
  const i = d.indicadores;
  const promedio = d.ocupacionPorSala.length ? d.ocupacionPorSala.reduce((s, x) => s + x.indice, 0) / d.ocupacionPorSala.length : 0;
  const tope = Math.max(0.05, ...d.ocupacionPorSala.map((x) => x.indice));

  // Mapa de calor: el bloque más y el menos usados (entre días con horario)
  let pico = { v: -1, d: 0, h: 0 };
  d.mapaCalor.valores.forEach((fila, dia) => fila.forEach((v, h) => { if (v > pico.v) pico = { v, d: dia, h }; }));
  const maxCalor = Math.max(0.01, pico.v);
  const jornadaLibre = [...d.capacidadPorJornada].sort((a, b) => b.horasLibres / (b.horasDisponibles || 1) - a.horasLibres / (a.horasDisponibles || 1))[0];
  // Solo las 8 salas con más reservas perdidas: con más columnas no se leen
  const conPerdidas = d.noUsadasPorSala.filter((x) => x.total > 0).slice(0, 8);
  const maxNoUso = Math.max(1, ...conPerdidas.map((x) => x.total));

  return (
    <>
      <section className="inicio-sub-kpis" aria-label="Indicadores del período">
        <div className="card kpi destacado"><span className="etiqueta">Ocupación</span><span className="valor">{pct(i.ocupacion)}</span><span className="nota">{num(i.horasOcupadas)} h de {num(i.horasDisponibles)} h disponibles</span></div>
        <div className="card kpi"><span className="etiqueta">Reservas aprobadas</span><span className="valor">{num(i.aprobadas)}</span><span className="nota">{num(i.solicitudes)} en el período</span></div>
        <Link href="/aprobaciones" className="card kpi kpi-enlace"><span className="etiqueta">Por aprobar</span><span className="valor">{num(i.pendientes)}</span><span className="nota">Revisar en Aprobaciones →</span></Link>
        <div className="card kpi"><span className="etiqueta">No usadas</span><span className="valor">{pct(i.proporcionNoUsadas)}</span><span className="nota">{num(i.noUsadas)} canceladas, liberadas o vencidas</span></div>
      </section>

      <div className="inicio-sub-grilla">
        <section className="card inicio-graf" aria-labelledby="g1">
          <div className="inicio-graf-cab"><h2 id="g1">Ocupación por sala</h2><span className="muted chico">% de las horas disponibles</span></div>
          <div className="barras-sala">
            {d.ocupacionPorSala.map((s) => (
              <Link key={s.espacioId} href={`/calendario?espacioId=${s.espacioId}`} className="barra-sala" title={`${s.nombre} · ${s.tipo} · capacidad ${s.capacidad} · ${num(s.horasReservadas)} h`}>
                <span className="cod">{s.codigo}</span>
                <span className="pista"><span className={s.indice < promedio * 0.9 ? 'relleno bajo' : 'relleno'} style={{ width: `${(s.indice / tope) * 100}%` }} /></span>
                <span className="val">{pct(s.indice)}</span>
              </Link>
            ))}
            {!d.ocupacionPorSala.length && <p className="muted">No hay salas con estos filtros.</p>}
          </div>
          <p className="inicio-graf-pie">En naranja, bajo el promedio ({pct(promedio)}). Clic en una sala para ver su calendario.</p>
        </section>

        <section className="card inicio-graf" aria-labelledby="g2">
          <div className="inicio-graf-cab"><h2 id="g2">Mapa de calor: día y hora</h2><span className="muted chico">% de salas ocupadas</span></div>
          <div className="calor-mini" role="img" aria-label={`Mapa de calor. Mayor uso: ${DIAS_LARGOS[pico.d]} de ${d.mapaCalor.horas[pico.h]} a ${d.mapaCalor.horas[pico.h] + 1} h, ${pct(Math.max(0, pico.v))}`}>
            <span />
            {d.mapaCalor.horas.map((h) => <span key={h} className="eje">{h}</span>)}
            {d.mapaCalor.valores.map((fila, dia) => [
              <span key={`d${dia}`} className="eje dia">{d.mapaCalor.dias[dia]}</span>,
              ...fila.map((v, h) => (
                <span key={`${dia}-${h}`} className="celda" title={`${DIAS_LARGOS[dia]} ${d.mapaCalor.horas[h]}:00–${d.mapaCalor.horas[h] + 1}:00 · ${pct(v)}`}
                  style={{ background: v <= 0 ? undefined : `color-mix(in srgb, var(--accent) ${Math.round(12 + 88 * Math.min(1, v / maxCalor))}%, var(--surface-2))` }} />
              )),
            ])}
          </div>
          <p className="inicio-graf-pie">
            {pico.v > 0
              ? <>Pico: <b>{DIAS_LARGOS[pico.d]} de {d.mapaCalor.horas[pico.h]} a {d.mapaCalor.horas[pico.h] + 1} h</b> ({pct(pico.v)}). Lo más claro es tiempo disponible.</>
              : 'Sin reservas aprobadas en este período.'}
          </p>
        </section>

        <section className="card inicio-graf" aria-labelledby="g3">
          <div className="inicio-graf-cab"><h2 id="g3">Reservas que no se usaron</h2><Link href="/dashboard" className="chico">Ver detalle →</Link></div>
          <div className="nouso-columnas">
            {conPerdidas.map((s) => (
              <div key={s.codigo} className="nouso-col" title={`${s.codigo}: ${s.canceladas} canceladas, ${s.liberadas} liberadas sin check-in, ${s.vencidas} vencidas`}>
                <span className="n">{s.total || ''}</span>
                <span className="pila" style={{ height: `${(s.total / maxNoUso) * 100}%` }}>
                  <span className="c" style={{ flex: s.canceladas }} /><span className="l" style={{ flex: s.liberadas }} /><span className="e" style={{ flex: s.vencidas }} />
                </span>
                <span className="cod">{s.codigo}</span>
              </div>
            ))}
          </div>
          <p className="inicio-graf-pie leyenda-nouso">
            <span><i className="c" /> Cancelada</span><span><i className="l" /> Liberada sin check-in</span><span><i className="e" /> Vencida sin respuesta</span>
            {!conPerdidas.length && <span>· Ninguna en este período</span>}
          </p>
        </section>

        <section className="card inicio-graf" aria-labelledby="g4">
          <div className="inicio-graf-cab"><h2 id="g4">Capacidad libre por jornada</h2><span className="muted chico">horas de sala, {d.salas} salas</span></div>
          <div className="jornadas">
            {d.capacidadPorJornada.map((j) => (
              <div key={j.nombre} className="jornada">
                <div className="jornada-cab"><b>{j.nombre} · {j.desde} a {j.hasta} h</b><span className="muted">{num(j.horasLibres)} h libres de {num(j.horasDisponibles)} ({pct(j.horasDisponibles ? j.horasLibres / j.horasDisponibles : 0)})</span></div>
                <span className="jornada-pista"><span style={{ width: `${j.horasDisponibles ? (j.horasOcupadas / j.horasDisponibles) * 100 : 0}%` }} /></span>
              </div>
            ))}
          </div>
          <p className="inicio-graf-pie">
            {jornadaLibre?.horasDisponibles
              ? <><b>{num(jornadaLibre.horasLibres)} h libres en la jornada {jornadaLibre.nombre.toLowerCase()}</b>: espacio para cursos, capacitación o arriendo.</>
              : 'Sin días hábiles en este período.'}
          </p>
        </section>
      </div>
    </>
  );
}
