'use client';
import { useState, type FormEvent } from 'react';
import { ROLES, type Rol } from '@reservaitn/shared';
import { ConPermiso, usePanel } from '@/components/Panel';
import { Badge, Cabecera, Cargando, Icono, Modal, Vacio, useAviso, useDatos } from '@/components/ui';
import { enviar, mensajeError } from '@/lib/api';
import { ROL_NOMBRE, iniciales } from '@/lib/formato';
import type { Carrera, Usuario } from '@/lib/tipos';

/** Usuarios, roles y acceso (E4 / WBS 1.4.1). */
function Usuarios() {
  const avisar = useAviso();
  const { sesion } = usePanel();
  const usuarios = useDatos<Usuario[]>('/usuarios');
  const carreras = useDatos<Carrera[]>('/carreras');
  const [filtro, setFiltro] = useState({ texto: '', rol: '' });
  const [editando, setEditando] = useState<Usuario | 'nuevo' | null>(null);
  const [error, setError] = useState('');

  const carrera = (id: string | null) => carreras.datos?.find((c) => c.id === id)?.nombre;
  const lista = (usuarios.datos ?? []).filter((u) =>
    (!filtro.rol || u.rol === filtro.rol) && `${u.nombre} ${u.email} ${u.rut}`.toLowerCase().includes(filtro.texto.toLowerCase()));

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const comun = { nombre: String(f.get('nombre')), rol: String(f.get('rol')) as Rol, carreraId: String(f.get('carreraId')) || undefined };
    try {
      if (editando === 'nuevo') {
        await enviar('/usuarios', { ...comun, rut: String(f.get('rut')), email: String(f.get('email')), password: String(f.get('password')) });
      } else if (editando) {
        await enviar(`/usuarios/${editando.id}`, { ...comun, carreraId: comun.carreraId ?? null }, 'PATCH');
      }
      avisar(editando === 'nuevo' ? 'Usuario creado' : 'Usuario actualizado');
      setEditando(null);
      setError('');
      usuarios.recargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  async function alternar(u: Usuario) {
    try {
      await enviar(`/usuarios/${u.id}`, { activo: !u.activo }, 'PATCH');
      avisar(u.activo ? `${u.nombre} ya no puede ingresar` : `${u.nombre} puede volver a ingresar`);
      usuarios.recargar();
    } catch (err) {
      avisar(mensajeError(err), true);
    }
  }

  const u = editando !== 'nuevo' ? editando : null;
  const porRol = (r: Rol[]) => usuarios.datos?.filter((x) => x.activo && r.includes(x.rol)).length ?? '—';

  return (
    <>
      <Cabecera miga="Gestión" titulo="Usuarios" sub="Cuentas del personal y estudiantes, con su rol y carrera.">
        <button className="acento" onClick={() => { setError(''); setEditando('nuevo'); }}><Icono n="mas" />Nuevo usuario</button>
      </Cabecera>

      <section className="grid">
        <div className="card kpi destacado"><span className="etiqueta">Cuentas activas</span><span className="valor">{usuarios.datos?.filter((x) => x.activo).length ?? '—'}</span></div>
        <div className="card kpi"><span className="etiqueta">Docentes y estudiantes</span><span className="valor">{porRol(['DOCENTE', 'ESTUDIANTE'])}</span></div>
        <div className="card kpi"><span className="etiqueta">Aprobadores</span><span className="valor">{porRol(['DIRECTOR_CARRERA', 'DIRECCION_ACADEMICA', 'SUBDIRECCION'])}</span></div>
        <div className="card kpi"><span className="etiqueta">Operaciones y aseo</span><span className="valor">{porRol(['OPERACIONES', 'ASEO_MANTENCION'])}</span></div>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="buscador" style={{ minWidth: 240, flex: 1, maxWidth: 360 }}>
            <Icono n="buscar" t={16} />
            <input placeholder="Buscar por nombre, correo o RUT" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} />
          </div>
          <select style={{ width: 'auto' }} value={filtro.rol} onChange={(e) => setFiltro({ ...filtro, rol: e.target.value })}>
            <option value="">Todos los roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROL_NOMBRE[r]}</option>)}
          </select>
        </div>
        {usuarios.error && <div className="alerta error"><Icono n="alerta" />{usuarios.error}</div>}
        {!usuarios.datos ? <Cargando /> : lista.length === 0 ? <Vacio icono="usuarios" titulo="No hay usuarios con esos filtros" /> : (
          <div className="tabla-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>RUT</th><th>Rol</th><th>Carrera</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {lista.map((x) => (
                  <tr key={x.id} style={{ opacity: x.activo ? 1 : 0.6 }}>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="avatar" style={{ width: 34, height: 34 }}>{iniciales(x.nombre)}</span>
                        <div><strong>{x.nombre}</strong><div className="muted chico">{x.email}</div></div>
                      </div>
                    </td>
                    <td className="tnum">{x.rut}</td>
                    <td><Badge tono="info">{ROL_NOMBRE[x.rol]}</Badge></td>
                    <td>{carrera(x.carreraId) ?? <span className="muted">—</span>}</td>
                    <td>{x.activo ? <Badge tono="ok">Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                    <td className="acciones-celda">
                      <button className="fantasma chico" onClick={() => { setError(''); setEditando(x); }}><Icono n="editar" t={15} />Editar</button>
                      {x.id !== sesion.usuario.id && <button className="sec chico" onClick={() => alternar(x)}>{x.activo ? 'Desactivar' : 'Activar'}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editando && (
        <Modal titulo={u ? `Editar ${u.nombre}` : 'Nuevo usuario'} onCerrar={() => setEditando(null)}>
          <form onSubmit={guardar} style={{ display: 'grid', gap: '1rem' }}>
            <div className="form-grid">
              <label className="ancho">Nombre completo<input name="nombre" required minLength={3} maxLength={120} defaultValue={u?.nombre} /></label>
              {!u && (
                <>
                  <label>RUT<input name="rut" required placeholder="12.345.678-5" /></label>
                  <label>Correo institucional<input name="email" type="email" required placeholder="nombre@itn.cl" /></label>
                  <label className="ancho">Contraseña inicial<input name="password" type="password" required minLength={8} autoComplete="new-password" />
                    <span className="ayuda">Mínimo 8 caracteres. La persona puede cambiarla desde “Mi cuenta”.</span>
                  </label>
                </>
              )}
              <label>Rol
                <select name="rol" defaultValue={u?.rol ?? 'DOCENTE'}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROL_NOMBRE[r]}</option>)}
                </select>
              </label>
              <label>Carrera
                <select name="carreraId" defaultValue={u?.carreraId ?? ''}>
                  <option value="">Sin carrera</option>
                  {carreras.datos?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
            </div>
            {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
            <div className="pie-modal">
              <button type="button" className="sec" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="submit">{u ? 'Guardar cambios' : 'Crear usuario'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function Pagina() {
  return <ConPermiso permiso="usuario:gestionar"><Usuarios /></ConPermiso>;
}
