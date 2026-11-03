'use client';
import { useState, type FormEvent } from 'react';
import { MATRIZ_PERMISOS } from '@reservaitn/shared';
import { usePanel } from '@/components/Panel';
import { Badge, Cabecera, Icono, useAviso } from '@/components/ui';
import { enviar, mensajeError } from '@/lib/api';
import { ROL_NOMBRE, iniciales } from '@/lib/formato';

const PERMISO_TEXTO: Record<string, string> = {
  'reserva:solicitar': 'Solicitar reservas',
  'reserva:aprobar': 'Aprobar reservas',
  'reserva:cancelar_cualquiera': 'Cancelar cualquier reserva',
  'recurso:gestionar': 'Gestionar salas',
  'planificacion:importar': 'Importar planificación',
  'dashboard:ver': 'Ver dashboard',
  'reporte:generar': 'Generar reportes',
  'mantencion:planificar': 'Planificar mantención',
  'inventario:registrar': 'Registrar inventario',
  'danio:reportar': 'Reportar daños',
  'danio:gestionar': 'Gestionar daños',
  'usuario:gestionar': 'Gestionar usuarios',
};

/** Mi cuenta: datos del usuario, permisos de su rol (E4) y cambio de contraseña. */
export default function Perfil() {
  const { sesion } = usePanel();
  const avisar = useAviso();
  const [error, setError] = useState('');
  const u = sesion.usuario;

  async function cambiar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get('nueva') !== f.get('repetir')) return setError('Las contraseñas nuevas no coinciden');
    try {
      await enviar('/auth/cambiar-clave', { actual: f.get('actual'), nueva: f.get('nueva') });
      setError('');
      form.reset();
      avisar('Contraseña actualizada');
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <>
      <Cabecera miga="Cuenta" titulo="Mi cuenta" />
      <div className="grid-2">
        <section className="card" style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span className="avatar" style={{ width: 56, height: 56, fontSize: '1.1rem' }}>{iniciales(u.nombre)}</span>
            <div><h2>{u.nombre}</h2><span className="muted">{ROL_NOMBRE[u.rol]}</span></div>
          </div>
          <div className="campo">
            Lo que puedes hacer con tu rol
            <div className="chips">
              {MATRIZ_PERMISOS[u.rol].map((p) => <Badge key={p} tono="info">{PERMISO_TEXTO[p] ?? p}</Badge>)}
            </div>
          </div>
        </section>
        <form className="card" onSubmit={cambiar} style={{ display: 'grid', gap: '0.9rem' }}>
          <h2><Icono n="llave" t={17} /> Cambiar contraseña</h2>
          <label>Contraseña actual<input name="actual" type="password" required autoComplete="current-password" /></label>
          <label>Nueva contraseña<input name="nueva" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label>Repetir nueva contraseña<input name="repetir" type="password" required minLength={8} autoComplete="new-password" /></label>
          {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
          <div><button type="submit">Guardar contraseña</button></div>
        </form>
      </div>
    </>
  );
}
