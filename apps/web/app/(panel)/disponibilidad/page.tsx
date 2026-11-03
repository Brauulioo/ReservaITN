'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { HORARIO } from '@reservaitn/shared';
import { usePanel } from '@/components/Panel';
import { Badge, Cabecera, Cargando, Icono, useDatos } from '@/components/ui';
import { DIAS_CORTOS, ORIGEN, isoLocal, lunesDe, rangoHora, sumarDias } from '@/lib/formato';
import type { Ocupacion, Sala } from '@/lib/tipos';

const ALTO = 44; // px por hora, igual que .calendario en globals.css
const HORAS = Array.from({ length: HORARIO.cierreHora - HORARIO.aperturaHora }, (_, i) => HORARIO.aperturaHora + i);

/** Disponibilidad visible (R3): calendario semanal de una sala con sus reservas aprobadas. */
export default function Disponibilidad() {
  const router = useRouter();
  const { puede } = usePanel();
  const salas = useDatos<Sala[]>('/salas');
  const [salaId, setSalaId] = useState('');
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));

  useEffect(() => {
    if (!salaId && salas.datos?.length) setSalaId(salas.datos[0]!.id);
  }, [salas.datos, salaId]);

  const ruta = salaId ? `/reservas/ocupacion?desde=${isoLocal(lunes)}&hasta=${isoLocal(sumarDias(lunes, 7))}&salaId=${salaId}` : null;
  const ocup = useDatos<Ocupacion[]>(ruta);
  const sala = salas.datos?.find((s) => s.id === salaId);
  const dias = useMemo(() => Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i)), [lunes]);
  const hoy = isoLocal(new Date());
  const puedeReservar = puede('reserva:solicitar');

  const horasOcupadas = (ocup.datos ?? []).reduce((a, o) => a + (new Date(o.fin).getTime() - new Date(o.inicio).getTime()) / 3_600_000, 0);
  const libre = 1 - horasOcupadas / (HORAS.length * 6);

  return (
    <>
      <Cabecera miga="Reservas" titulo="Disponibilidad" sub="Revisa los horarios ocupados de cada sala y reserva un bloque libre con un clic.">
        {puedeReservar && <button className="acento" onClick={() => router.push('/reservar')}><Icono n="mas" />Nueva reserva</button>}
      </Cabecera>

      <section className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div className="card-head">
          <label style={{ minWidth: 260 }}>Sala o laboratorio
            <select value={salaId} onChange={(e) => setSalaId(e.target.value)}>
              {salas.datos?.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre} ({s.sede.nombre})</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="sec chico" onClick={() => setLunes((l) => sumarDias(l, -7))} aria-label="Semana anterior"><Icono n="izq" /></button>
            <button className="sec chico" onClick={() => setLunes(lunesDe(new Date()))}>Hoy</button>
            <button className="sec chico" onClick={() => setLunes((l) => sumarDias(l, 7))} aria-label="Semana siguiente"><Icono n="der" /></button>
            <strong style={{ marginLeft: 6 }} className="tnum">
              {lunes.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} – {sumarDias(lunes, 5).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
            </strong>
          </div>
        </div>

        {sala && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge tono="info">{sala.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Sala'}</Badge>
            <Badge tono="sin-punto"><Icono n="personas" t={13} /> {sala.capacidad} personas</Badge>
            {sala.equipamiento.map((e) => <Badge key={e} tono="sin-punto">{e}</Badge>)}
            {sala.carreraExclusiva && <Badge tono="naranja">Exclusivo {sala.carreraExclusiva.nombre}</Badge>}
            <span className="muted chico" style={{ marginLeft: 'auto' }}>{(libre * 100).toFixed(0)} % libre esta semana</span>
          </div>
        )}

        {!salas.datos ? <Cargando filas={6} /> : (
          <div className="calendario-wrap">
            <div className="calendario">
              <div className="cab" style={{ borderLeft: 0 }} />
              {dias.map((d) => (
                <div key={d.toISOString()} className={`cab${isoLocal(d) === hoy ? ' hoy' : ''}`}>
                  {DIAS_CORTOS[d.getDay()]}<small>{d.getDate()}/{d.getMonth() + 1}</small>
                </div>
              ))}
              <div className="horas">{HORAS.map((h) => <span key={h}>{h}:00</span>)}</div>
              {dias.map((d) => {
                const delDia = (ocup.datos ?? []).filter((o) => isoLocal(new Date(o.inicio)) === isoLocal(d));
                return (
                  <div key={d.toISOString()} className="dia" style={{ height: HORAS.length * ALTO }}>
                    {HORAS.map((h, i) => {
                      const pasado = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + 1) < new Date();
                      return (
                        <button key={h} className="hueco" style={{ top: i * ALTO }} disabled={!puedeReservar || pasado}
                          aria-label={`Reservar ${DIAS_CORTOS[d.getDay()]} ${h}:00`}
                          onClick={() => router.push(`/reservar?salaId=${salaId}&fecha=${isoLocal(d)}&hora=${String(h).padStart(2, '0')}:00`)} />
                      );
                    })}
                    {delDia.map((o) => {
                      const ini = new Date(o.inicio);
                      const fin = new Date(o.fin);
                      const top = (ini.getHours() + ini.getMinutes() / 60 - HORARIO.aperturaHora) * ALTO;
                      const alto = Math.max(22, ((fin.getTime() - ini.getTime()) / 3_600_000) * ALTO - 3);
                      return (
                        <div key={o.id} className={`bloque ${o.origen}`} style={{ top, height: alto }} title={`${o.motivo} · ${rangoHora(o.inicio, o.fin)}`}>
                          <strong>{o.motivo}</strong>
                          <small>{rangoHora(o.inicio, o.fin)}</small>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="leyenda">
          <span><i />{ORIGEN.SOLICITUD}</span>
          <span><i style={{ background: 'var(--navy-600)' }} />{ORIGEN.PLANIFICACION}</span>
          <span><i style={{ background: '#6b7590' }} />{ORIGEN.MANTENCION}</span>
          {puedeReservar && <span>Haz clic en un bloque vacío para reservarlo.</span>}
        </div>
      </section>
    </>
  );
}
