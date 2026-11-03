'use client';
import { useState, type FormEvent } from 'react';
import { ConPermiso } from '@/components/Panel';
import { Badge, Cabecera, Cargando, Icono, Modal, Vacio, useAviso, useDatos } from '@/components/ui';
import { enviar, mensajeError } from '@/lib/api';
import type { Carrera, Sala, Sede } from '@/lib/tipos';

/** Recursos: sedes, salas, laboratorios, exclusividad y equipamiento (R8 / WBS 1.4.2). */
function Salas() {
  const avisar = useAviso();
  const salas = useDatos<Sala[]>('/salas?todas=1');
  const sedes = useDatos<Sede[]>('/sedes');
  const carreras = useDatos<Carrera[]>('/carreras');
  const [filtro, setFiltro] = useState({ texto: '', sedeId: '', tipo: '' });
  const [editando, setEditando] = useState<Sala | 'nueva' | null>(null);
  const [error, setError] = useState('');

  const lista = (salas.datos ?? []).filter((s) =>
    (!filtro.sedeId || s.sedeId === filtro.sedeId) &&
    (!filtro.tipo || s.tipo === filtro.tipo) &&
    `${s.codigo} ${s.nombre} ${s.equipamiento.join(' ')}`.toLowerCase().includes(filtro.texto.toLowerCase()));

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const datos = {
      codigo: String(f.get('codigo')),
      nombre: String(f.get('nombre')),
      tipo: String(f.get('tipo')),
      sedeId: String(f.get('sedeId')),
      capacidad: Number(f.get('capacidad')),
      equipamiento: String(f.get('equipamiento')).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
      carreraExclusivaId: String(f.get('carreraExclusivaId')) || null,
    };
    try {
      if (editando === 'nueva') await enviar('/salas', datos);
      else if (editando) await enviar(`/salas/${editando.id}`, datos, 'PATCH');
      avisar(editando === 'nueva' ? 'Sala creada' : 'Sala actualizada');
      setEditando(null);
      setError('');
      salas.recargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  async function alternar(s: Sala) {
    try {
      await enviar(`/salas/${s.id}`, { activa: !s.activa }, 'PATCH');
      avisar(s.activa ? `${s.codigo} quedó fuera de servicio` : `${s.codigo} vuelve a estar disponible`);
      salas.recargar();
    } catch (err) {
      avisar(mensajeError(err), true);
    }
  }

  const sala = editando !== 'nueva' ? editando : null;
  const total = salas.datos?.filter((s) => s.activa) ?? [];

  return (
    <>
      <Cabecera miga="Gestión" titulo="Salas y laboratorios" sub="Administra los espacios reservables, su capacidad, equipamiento y exclusividad por carrera.">
        <button className="acento" onClick={() => { setError(''); setEditando('nueva'); }}><Icono n="mas" />Nueva sala</button>
      </Cabecera>

      <section className="grid">
        <div className="card kpi destacado"><span className="etiqueta">Espacios activos</span><span className="valor">{total.length}</span></div>
        <div className="card kpi"><span className="etiqueta">Laboratorios</span><span className="valor">{total.filter((s) => s.tipo === 'LABORATORIO').length}</span></div>
        <div className="card kpi"><span className="etiqueta">Capacidad total</span><span className="valor">{total.reduce((a, s) => a + s.capacidad, 0)}</span><span className="nota">personas en simultáneo</span></div>
        <div className="card kpi"><span className="etiqueta">Sedes</span><span className="valor">{sedes.datos?.length ?? '—'}</span></div>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="buscador" style={{ minWidth: 240, flex: 1, maxWidth: 360 }}>
            <Icono n="buscar" t={16} />
            <input placeholder="Buscar por código, nombre o equipo" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} />
          </div>
          <select style={{ width: 'auto' }} value={filtro.sedeId} onChange={(e) => setFiltro({ ...filtro, sedeId: e.target.value })}>
            <option value="">Todas las sedes</option>
            {sedes.datos?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <select style={{ width: 'auto' }} value={filtro.tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })}>
            <option value="">Salas y laboratorios</option>
            <option value="SALA">Solo salas</option>
            <option value="LABORATORIO">Solo laboratorios</option>
          </select>
        </div>
        {!salas.datos ? <Cargando /> : lista.length === 0 ? <Vacio icono="edificio" titulo="No hay salas con esos filtros" /> : (
          <div className="tabla-wrap">
            <table>
              <thead><tr><th>Código</th><th>Nombre</th><th>Sede</th><th>Tipo</th><th>Capacidad</th><th>Equipamiento</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {lista.map((s) => (
                  <tr key={s.id} style={{ opacity: s.activa ? 1 : 0.6 }}>
                    <td><strong>{s.codigo}</strong></td>
                    <td>{s.nombre}{s.carreraExclusiva && <div className="chico" style={{ color: 'var(--orange-600)' }}>Exclusivo {s.carreraExclusiva.nombre}</div>}</td>
                    <td>{s.sede.nombre}</td>
                    <td><Badge tono={s.tipo === 'LABORATORIO' ? 'info' : ''}>{s.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Sala'}</Badge></td>
                    <td className="tnum">{s.capacidad}</td>
                    <td><div className="chips">{s.equipamiento.length ? s.equipamiento.map((e) => <Badge key={e} tono="sin-punto">{e}</Badge>) : <span className="muted">—</span>}</div></td>
                    <td>{s.activa ? <Badge tono="ok">Disponible</Badge> : <Badge>Fuera de servicio</Badge>}</td>
                    <td className="acciones-celda">
                      <button className="fantasma chico" onClick={() => { setError(''); setEditando(s); }}><Icono n="editar" t={15} />Editar</button>
                      <button className="sec chico" onClick={() => alternar(s)}>{s.activa ? 'Desactivar' : 'Activar'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editando && (
        <Modal titulo={sala ? `Editar ${sala.codigo}` : 'Nueva sala'} onCerrar={() => setEditando(null)}>
          <form onSubmit={guardar} style={{ display: 'grid', gap: '1rem' }}>
            <div className="form-grid">
              <label>Código<input name="codigo" required maxLength={20} defaultValue={sala?.codigo} placeholder="A-103" /></label>
              <label>Tipo
                <select name="tipo" defaultValue={sala?.tipo ?? 'SALA'}><option value="SALA">Sala</option><option value="LABORATORIO">Laboratorio</option></select>
              </label>
              <label className="ancho">Nombre<input name="nombre" required minLength={2} maxLength={80} defaultValue={sala?.nombre} placeholder="Sala A-103" /></label>
              <label>Sede
                <select name="sedeId" required defaultValue={sala?.sedeId ?? sedes.datos?.[0]?.id}>
                  {sedes.datos?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
              <label>Capacidad<input name="capacidad" type="number" required min={1} max={500} defaultValue={sala?.capacidad ?? 30} /></label>
              <label className="ancho">Equipamiento<input name="equipamiento" defaultValue={sala?.equipamiento.join(', ')} placeholder="proyector, computadores, pizarra digital" />
                <span className="ayuda">Separado por comas. Se usa para la sugerencia de sala.</span>
              </label>
              <label className="ancho">Exclusivo de carrera (laboratorios)
                <select name="carreraExclusivaId" defaultValue={sala?.carreraExclusivaId ?? ''}>
                  <option value="">Ninguna: uso compartido</option>
                  {carreras.datos?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <span className="ayuda">Otras carreras pueden pedirlo en préstamo; lo aprueba el director de la carrera dueña (R8).</span>
              </label>
            </div>
            {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
            <div className="pie-modal">
              <button type="button" className="sec" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="submit">{sala ? 'Guardar cambios' : 'Crear sala'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function Pagina() {
  return <ConPermiso permiso="recurso:gestionar"><Salas /></ConPermiso>;
}
