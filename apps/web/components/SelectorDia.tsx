'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { isoLocal } from '@/lib/formato';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CABECERA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/**
 * Selector de día con calendario propio: los días en que no se puede reservar (hoy hacia atrás,
 * sábados, domingos, vacaciones y días bloqueados por Subdirección) se ven en gris y no se pueden elegir.
 * Los motivos vienen de la API (`/calendario/no-disponibles`), la misma regla que aplica la base de datos.
 */
export function SelectorDia({ valor, onCambio, sedeId, etiqueta = 'Día', minimo, libre = false, nombre }: {
  valor: string; onCambio: (fecha: string) => void; sedeId?: string; etiqueta?: string;
  /** Primer día elegible (YYYY-MM-DD); por omisión, hoy. */
  minimo?: string;
  /**
   * Modo consulta: no se bloquea ningún día (sirve para rangos históricos o para bloquear días),
   * los días no lectivos solo se ven en gris.
   */
  libre?: boolean;
  /** Si se indica, agrega un campo oculto con ese nombre para usarlo dentro de un formulario GET/POST. */
  nombre?: string;
}) {
  const hoy = isoLocal(new Date());
  const [abierto, setAbierto] = useState(false);
  const [mes, setMes] = useState(() => { const d = new Date(`${valor || hoy}T00:00`); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [bloqueados, setBloqueados] = useState<Record<string, string>>({});
  const caja = useRef<HTMLDivElement>(null);

  // Si la fecha cambia desde afuera (p. ej. llegada desde el calendario), el mes visible la sigue
  useEffect(() => {
    if (!valor) return;
    const d = new Date(`${valor}T00:00`);
    setMes((m) => (m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth() ? m : new Date(d.getFullYear(), d.getMonth(), 1)));
  }, [valor]);

  // Días bloqueados del mes que se está viendo (vacaciones y recesos; los fines de semana se calculan aquí)
  useEffect(() => {
    const desde = isoLocal(mes);
    const hasta = isoLocal(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    let vigente = true;
    api<{ fecha: string; motivo: string }[]>(`/calendario/no-disponibles?desde=${desde}&hasta=${hasta}${sedeId ? `&sedeId=${sedeId}` : ''}`)
      .then((l) => vigente && setBloqueados(Object.fromEntries(l.map((x) => [x.fecha, x.motivo]))))
      .catch(() => vigente && setBloqueados({}));
    return () => { vigente = false; };
  }, [mes, sedeId]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  const primero = (mes.getDay() + 6) % 7; // lunes = 0
  const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas = [...Array(primero).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  // Primer día elegible: en modo normal nunca antes de hoy; en modo libre solo rige `minimo`, si hay
  const primerDia = libre ? (minimo ?? '') : minimo && minimo > hoy ? minimo : hoy;
  /** Días que nunca se pueden elegir (antes del primer día elegible). */
  const motivoFijo = (f: string) => (f < primerDia ? (f < hoy ? 'Día pasado' : 'Antes de la fecha de inicio') : null);
  /** Días sin clases: en modo libre solo se marcan en gris, en modo normal tampoco se pueden elegir. */
  const motivoNoLectivo = (d: Date, f: string) => (d.getDay() === 0 || d.getDay() === 6 ? 'Fin de semana' : bloqueados[f] ?? null);
  const texto = valor
    ? new Date(`${valor}T00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : 'Elegir día…';
  const irMes = (n: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const tope = new Date(`${primerDia}T00:00`);
  const enMesActual = !libre && mes.getFullYear() === tope.getFullYear() && mes.getMonth() === tope.getMonth();

  return (
    <div className="selector-dia" ref={caja}>
      {nombre && <input type="hidden" name={nombre} value={valor} />}
      <label>
        {etiqueta}
        <button type="button" className="selector-dia-boton" aria-haspopup="dialog" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
          <span>{texto}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
      </label>
      {abierto && (
        <div className="selector-dia-pop" role="dialog" aria-label="Elegir día">
          <div className="selector-dia-mes">
            <button type="button" className="sec chico" onClick={() => irMes(-1)} disabled={enMesActual} aria-label="Mes anterior">‹</button>
            <strong>{MESES[mes.getMonth()]} {mes.getFullYear()}</strong>
            <button type="button" className="sec chico" onClick={() => irMes(1)} aria-label="Mes siguiente">›</button>
          </div>
          <div className="selector-dia-grilla">
            {CABECERA.map((c) => <span key={c} className="cab">{c}</span>)}
            {celdas.map((n, k) => {
              if (n === null) return <span key={`v${k}`} />;
              const d = new Date(mes.getFullYear(), mes.getMonth(), n);
              const f = isoLocal(d);
              const fijo = motivoFijo(f);
              const motivo = fijo ?? motivoNoLectivo(d, f);
              const deshabilitado = !!fijo || (!!motivo && !libre);
              return (
                <button
                  key={f} type="button" disabled={deshabilitado} title={motivo ?? undefined}
                  className={`${f === valor ? 'sel' : ''}${f === hoy ? ' hoy' : ''}${motivo && !deshabilitado ? ' gris' : ''}`}
                  aria-pressed={f === valor} aria-label={`${n} de ${MESES[mes.getMonth()]}${motivo ? `, no disponible: ${motivo}` : ''}`}
                  onClick={() => { onCambio(f); setAbierto(false); }}
                >{n}</button>
              );
            })}
          </div>
          <p className="selector-dia-nota"><i /> {libre
            ? 'En gris: sin clases (fin de semana, vacaciones o bloqueo de Subdirección).'
            : 'En gris: no se puede reservar (pasado, fin de semana, vacaciones o bloqueo de Subdirección).'}</p>
        </div>
      )}
    </div>
  );
}
