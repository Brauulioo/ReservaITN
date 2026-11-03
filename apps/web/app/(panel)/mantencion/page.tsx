'use client';
import { useState, type FormEvent } from 'react';
import { ConPermiso, usePanel } from '@/components/Panel';
import { Badge, Cabecera, Cargando, Icono, Vacio, useAviso, useDatos } from '@/components/ui';
import { enviar, mensajeError } from '@/lib/api';
import { ESTADO_DANIO, SEVERIDAD, fechaHora, hace } from '@/lib/formato';
import type { Sala } from '@/lib/tipos';

interface Danio {
  id: string; descripcion: string; severidad: string; estado: string; creadoEn: string; resueltoEn: string | null;
  sala: { codigo: string }; reportadoPor: { nombre: string };
}
interface Item { id: string; nombre: string; cantidadEsperada: number }

/** Formulario de reporte de daño; al enviarlo la API avisa a Operaciones. */
function ReportarDanio({ salas, alReportar }: { salas: Sala[]; alReportar: () => void }) {
  const avisar = useAviso();
  const [error, setError] = useState('');
  const [severidad, setSeveridad] = useState<'BAJA' | 'MEDIA' | 'ALTA'>('MEDIA');

  async function reportar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await enviar('/mantencion/danios', { salaId: f.get('salaId'), descripcion: f.get('descripcion'), severidad });
      avisar('Daño reportado: se avisó a Operaciones');
      form.reset();
      setError('');
      alReportar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form className="card" onSubmit={reportar} style={{ display: 'grid', gap: '0.9rem' }}>
      <h2>Reportar un daño</h2>
      <label>Sala o laboratorio
        <select name="salaId" required>{salas.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}</select>
      </label>
      <div className="campo">Severidad
        <div className="segmentado">
          {(['BAJA', 'MEDIA', 'ALTA'] as const).map((s) => (
            <button type="button" key={s} className={severidad === s ? 'activo' : ''} onClick={() => setSeveridad(s)}>{SEVERIDAD[s]!.texto}</button>
          ))}
        </div>
      </div>
      <label>Descripción<textarea name="descripcion" required minLength={5} maxLength={500} placeholder="Ej.: proyector no enciende, silla rota, filtración en el techo…" /></label>
      {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
      <div><button type="submit" className="acento"><Icono n="alerta" />Enviar reporte</button></div>
    </form>
  );
}

/** Conteo de inventario por sala; marca en ámbar lo que difiere de lo esperado. */
function Inventario({ salas }: { salas: Sala[] }) {
  const avisar = useAviso();
  const [salaId, setSalaId] = useState(salas[0]?.id ?? '');
  const items = useDatos<Item[]>(salaId ? `/mantencion/salas/${salaId}/inventario` : null);
  const [conteo, setConteo] = useState<Record<string, number>>({});

  async function registrar(e: FormEvent) {
    e.preventDefault();
    try {
      const lista = (items.datos ?? []).map((i) => ({ itemId: i.id, cantidad: conteo[i.id] ?? i.cantidadEsperada }));
      await enviar('/mantencion/inventario', { salaId, items: lista });
      avisar('Conteo de inventario registrado');
      setConteo({});
    } catch (err) {
      avisar(mensajeError(err), true);
    }
  }

  return (
    <form className="card" onSubmit={registrar} style={{ display: 'grid', gap: '0.9rem' }}>
      <h2>Conteo de inventario</h2>
      <label>Sala
        <select value={salaId} onChange={(e) => { setSalaId(e.target.value); setConteo({}); }}>
          {salas.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}
        </select>
      </label>
      {!items.datos ? <Cargando /> : items.datos.length === 0 ? (
        <Vacio icono="caja" titulo="Esta sala no tiene inventario registrado" />
      ) : (
        <>
          <div className="tabla-wrap">
            <table>
              <thead><tr><th>Ítem</th><th>Esperado</th><th style={{ width: 110 }}>Contado</th></tr></thead>
              <tbody>{items.datos.map((i) => {
                const v = conteo[i.id] ?? i.cantidadEsperada;
                return (
                  <tr key={i.id}>
                    <td>{i.nombre}</td><td className="tnum">{i.cantidadEsperada}</td>
                    <td><input type="number" min={0} value={v} style={{ borderColor: v !== i.cantidadEsperada ? 'var(--warn)' : undefined }}
                      onChange={(e) => setConteo((c) => ({ ...c, [i.id]: Number(e.target.value) }))} /></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <div><button type="submit"><Icono n="check" />Registrar conteo</button></div>
        </>
      )}
    </form>
  );
}

/** Mantención y aseo: reporte de daños e inventario por sala (R15, R17 / WBS 1.4.10). */
function Mantencion() {
  const avisar = useAviso();
  const { puede } = usePanel();
  const gestiona = puede('danio:gestionar');
  const [estado, setEstado] = useState('ABIERTO');
  const salas = useDatos<Sala[]>('/salas');
  const danios = useDatos<Danio[]>(gestiona ? `/mantencion/danios${estado ? `?estado=${estado}` : ''}` : null);

  async function cambiar(d: Danio, nuevo: 'EN_PROCESO' | 'RESUELTO') {
    try {
      await enviar(`/mantencion/danios/${d.id}`, { estado: nuevo }, 'PATCH');
      avisar(`Daño en ${d.sala.codigo}: ${ESTADO_DANIO[nuevo]!.texto.toLowerCase()}`);
      danios.recargar();
    } catch (err) {
      avisar(mensajeError(err), true);
    }
  }

  return (
    <>
      <Cabecera miga="Gestión" titulo="Mantención" sub="Reporta daños desde la sala y lleva el control de su resolución e inventario." />

      {!salas.datos ? <section className="card"><Cargando /></section> : (
        <div className="grid-2">
          {puede('danio:reportar') && <ReportarDanio salas={salas.datos} alReportar={danios.recargar} />}
          {puede('inventario:registrar') && <Inventario salas={salas.datos} />}
        </div>
      )}

      {gestiona && (
        <section className="card">
          <div className="card-head">
            <h2>Daños reportados</h2>
            <div className="segmentado">
              {[['ABIERTO', 'Abiertos'], ['EN_PROCESO', 'En proceso'], ['RESUELTO', 'Resueltos'], ['', 'Todos']].map(([v, t]) => (
                <button key={v} className={estado === v ? 'activo' : ''} onClick={() => setEstado(v!)}>{t}</button>
              ))}
            </div>
          </div>
          {!danios.datos ? <Cargando /> : danios.datos.length === 0 ? <Vacio icono="herramienta" titulo="No hay daños en este estado" /> : (
            <div className="tabla-wrap">
              <table>
                <thead><tr><th>Sala</th><th>Descripción</th><th>Severidad</th><th>Reportado</th><th>Estado</th><th /></tr></thead>
                <tbody>{danios.datos.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.sala.codigo}</strong></td>
                    <td>{d.descripcion}</td>
                    <td><Badge tono={SEVERIDAD[d.severidad]?.tono}>{SEVERIDAD[d.severidad]?.texto}</Badge></td>
                    <td title={fechaHora(d.creadoEn)}>{d.reportadoPor.nombre}<div className="muted chico">{hace(d.creadoEn)}</div></td>
                    <td><Badge tono={ESTADO_DANIO[d.estado]?.tono}>{ESTADO_DANIO[d.estado]?.texto}</Badge></td>
                    <td className="acciones-celda">
                      {d.estado === 'ABIERTO' && <button className="sec chico" onClick={() => cambiar(d, 'EN_PROCESO')}>Tomar</button>}
                      {d.estado !== 'RESUELTO' && <button className="chico" onClick={() => cambiar(d, 'RESUELTO')}><Icono n="check" t={14} />Resuelto</button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default function Pagina() {
  return <ConPermiso permiso={['danio:reportar', 'danio:gestionar', 'inventario:registrar']}><Mantencion /></ConPermiso>;
}
