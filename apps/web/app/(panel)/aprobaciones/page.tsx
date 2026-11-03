'use client';
import { useState } from 'react';
import { ConPermiso, usePanel } from '@/components/Panel';
import { HistorialModal } from '@/components/Historial';
import { Badge, Cabecera, Cargando, Icono, Vacio, useAviso, useDatos } from '@/components/ui';
import { enviar, mensajeError } from '@/lib/api';
import { ROL_NOMBRE, fecha, hace, iniciales, rangoHora } from '@/lib/formato';
import type { Pendiente } from '@/lib/tipos';

/** Bandeja de aprobación (R4, R8, R11). Un 409 indica que otra reserva ya se aprobó en ese horario. */
function Aprobaciones() {
  const avisar = useAviso();
  const { refrescarContadores } = usePanel();
  const { datos, error, recargar } = useDatos<Pendiente[]>('/reservas/pendientes');
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Pendiente | null>(null);

  async function decidir(r: Pendiente, accion: 'aprobar' | 'rechazar') {
    setOcupado(r.id);
    try {
      await enviar(`/reservas/${r.id}/${accion}`, { comentario: comentarios[r.id]?.trim() || undefined });
      avisar(accion === 'aprobar' ? `Reserva de ${r.sala.codigo} aprobada` : `Reserva de ${r.sala.codigo} rechazada`);
    } catch (e) {
      avisar(mensajeError(e), true);
    }
    setOcupado(null);
    await recargar();
    refrescarContadores();
  }

  return (
    <>
      <Cabecera miga="Reservas" titulo="Aprobaciones"
        sub="Solicitudes que te corresponde decidir según tu rol y carrera. Al aprobar, el sistema verifica que no choque con otra reserva." />

      {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
      {!datos ? <section className="card"><Cargando filas={4} /></section> : datos.length === 0 ? (
        <section className="card">
          <Vacio icono="aprobar" titulo="Todo al día">No hay solicitudes pendientes de aprobación.</Vacio>
        </section>
      ) : (
        <section style={{ display: 'grid', gap: '0.85rem' }}>
          <p className="muted chico">{datos.length} {datos.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}, ordenadas por fecha de uso.</p>
          {datos.map((r) => (
            <article key={r.id} className="card" style={{ display: 'grid', gap: '0.85rem' }}>
              <div className="card-head" style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="avatar" style={{ width: 40, height: 40 }}>{iniciales(r.solicitante.nombre)}</span>
                  <div>
                    <strong>{r.solicitante.nombre}</strong>
                    <div className="muted chico">{ROL_NOMBRE[r.solicitante.rol]} · solicitó {hace(r.creadaEn)}</div>
                  </div>
                </div>
                <Badge tono="warn">Pendiente</Badge>
              </div>
              <div className="form-grid">
                <div><div className="ayuda">Sala</div><strong>{r.sala.codigo}</strong> <span className="muted chico">{r.sala.nombre} · {r.sala.sede.nombre}</span></div>
                <div><div className="ayuda">Fecha</div><strong>{fecha(r.inicio)}</strong></div>
                <div><div className="ayuda">Horario</div><strong className="tnum">{rangoHora(r.inicio, r.fin)}</strong></div>
                <div><div className="ayuda">Asistentes</div><strong className="tnum">{r.asistentes}</strong></div>
                <div className="ancho"><div className="ayuda">Motivo</div>{r.motivo}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input style={{ flex: 1, minWidth: 220 }} placeholder="Comentario para el solicitante (opcional)" maxLength={300}
                  value={comentarios[r.id] ?? ''} onChange={(e) => setComentarios((c) => ({ ...c, [r.id]: e.target.value }))} />
                <button className="fantasma chico" onClick={() => setHistorial(r)}><Icono n="historial" t={16} />Historial</button>
                <button className="sec" disabled={ocupado === r.id} onClick={() => decidir(r, 'rechazar')}><Icono n="cerrar" t={16} />Rechazar</button>
                <button disabled={ocupado === r.id} onClick={() => decidir(r, 'aprobar')}><Icono n="check" t={16} />Aprobar</button>
              </div>
            </article>
          ))}
        </section>
      )}
      {historial && <HistorialModal reserva={historial} onCerrar={() => setHistorial(null)} />}
    </>
  );
}

export default function Pagina() {
  return <ConPermiso permiso="reserva:aprobar"><Aprobaciones /></ConPermiso>;
}
