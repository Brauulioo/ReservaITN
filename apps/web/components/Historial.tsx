'use client';
import { Cargando, EstadoBadge, Modal, useDatos } from './ui';
import { ESTADO, ROL_NOMBRE, fecha, fechaHora, rangoHora } from '@/lib/formato';
import type { Evento } from '@/lib/tipos';

/** Historial de una reserva (trazabilidad R7): quién la creó, aprobó, rechazó o canceló. */
export function HistorialModal({ reserva, onCerrar }: { reserva: { id: string; sala: { codigo: string }; inicio: string; fin: string }; onCerrar: () => void }) {
  const h = useDatos<Evento[]>(`/reservas/${reserva.id}/historial`);
  return (
    <Modal titulo={`Trazabilidad · ${reserva.sala.codigo}`} onCerrar={onCerrar}>
      <p className="muted">{fecha(reserva.inicio)} · {rangoHora(reserva.inicio, reserva.fin)}</p>
      {!h.datos ? <Cargando /> : (
        <ul className="timeline">
          {h.datos.map((e) => (
            <li key={e.id}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{e.accion === 'CREADA' ? 'Solicitud creada' : ESTADO[e.estadoNuevo].texto}</strong>
                <EstadoBadge estado={e.estadoNuevo} />
              </div>
              <small>{e.actor.nombre} ({ROL_NOMBRE[e.actor.rol]}) · {fechaHora(e.creadoEn)}</small>
              {e.comentario && <small>“{e.comentario}”</small>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
