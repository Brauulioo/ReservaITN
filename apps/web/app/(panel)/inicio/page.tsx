'use client';
import Link from 'next/link';
import { usePanel } from '@/components/Panel';
import { Badge, Cargando, EstadoBadge, Icono, Vacio, useDatos, type NombreIcono } from '@/components/ui';
import { ROL_NOMBRE, fecha, hace, rangoHora } from '@/lib/formato';
import type { Notificacion, ReservaPropia } from '@/lib/tipos';
import type { Permiso } from '@reservaitn/shared';

/** Tarjetas de acceso rápido; cada una se muestra solo si el rol tiene el permiso. */
const ACCESOS: { href: string; titulo: string; texto: string; icono: NombreIcono; permiso?: Permiso | Permiso[]; naranja?: boolean }[] = [
  { href: '/reservar', titulo: 'Nueva reserva', texto: 'Te sugerimos la mejor sala', icono: 'destello', permiso: 'reserva:solicitar', naranja: true },
  { href: '/disponibilidad', titulo: 'Disponibilidad', texto: 'Calendario semanal por sala', icono: 'calendario' },
  { href: '/aprobaciones', titulo: 'Aprobaciones', texto: 'Solicitudes por decidir', icono: 'aprobar', permiso: 'reserva:aprobar' },
  { href: '/dashboard', titulo: 'Dashboard', texto: 'Ocupación y reportes', icono: 'grafico', permiso: 'dashboard:ver' },
  { href: '/importacion', titulo: 'Importar semestre', texto: 'Carga el Excel de planificación', icono: 'subir', permiso: 'planificacion:importar' },
  { href: '/mantencion', titulo: 'Mantención', texto: 'Daños e inventario', icono: 'herramienta', permiso: ['danio:reportar', 'danio:gestionar'] },
  { href: '/salas', titulo: 'Salas', texto: 'Recursos y equipamiento', icono: 'edificio', permiso: 'recurso:gestionar' },
  { href: '/usuarios', titulo: 'Usuarios', texto: 'Cuentas y roles', icono: 'usuarios', permiso: 'usuario:gestionar' },
];

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

/** Página de inicio de todos los roles: bienvenida, accesos según permisos, próximas reservas y avisos. */
export default function Inicio() {
  const { sesion, puede } = usePanel();
  const solicita = puede('reserva:solicitar');
  const reservas = useDatos<ReservaPropia[]>(solicita ? '/reservas/mias' : null);
  const notifs = useDatos<Notificacion[]>('/notificaciones/mias');
  const pendientes = useDatos<unknown[]>(puede('reserva:aprobar') ? '/reservas/pendientes' : null);

  const ahora = Date.now();
  const proximas = (reservas.datos ?? [])
    .filter((r) => new Date(r.fin).getTime() > ahora && (r.estado === 'APROBADA' || r.estado === 'PENDIENTE'))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const nombre = sesion.usuario.nombre.split(' ')[0];

  return (
    <>
      <section className="hero">
        <h1>{saludo()}, {nombre}</h1>
        <p>
          {ROL_NOMBRE[sesion.usuario.rol]} · {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
          {pendientes.datos && pendientes.datos.length > 0 && <> · tienes <strong style={{ color: '#fff' }}>{pendientes.datos.length} solicitudes</strong> por aprobar</>}
        </p>
        <div className="lema-hero"><span>ITN</span><span>Técnica</span><span>Innovación</span><span>Oportunidades</span><span>Comunidad</span></div>
      </section>

      <section className="accesos">
        {ACCESOS.filter((a) => puede(a.permiso)).map((a) => (
          <Link key={a.href} href={a.href} className={`acceso${a.naranja ? ' naranja' : ''}`}>
            <span className="ico"><Icono n={a.icono} t={20} /></span>
            <span><strong>{a.titulo}</strong><small>{a.texto}</small></span>
          </Link>
        ))}
      </section>

      <div className="grid-2">
        {solicita && (
          <section className="card">
            <div className="card-head">
              <h2>Mis próximas reservas</h2>
              <Link href="/mis-reservas" className="chico">Ver todas</Link>
            </div>
            {reservas.cargando && !reservas.datos ? <Cargando /> : proximas.length === 0 ? (
              <Vacio titulo="No tienes reservas próximas">
                <Link href="/reservar">Reserva una sala</Link>
              </Vacio>
            ) : (
              <ul className="timeline">
                {proximas.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{r.sala.codigo}</strong> <span className="muted chico">{r.sala.sede.nombre}</span> <EstadoBadge estado={r.estado} />
                    </div>
                    <small>{fecha(r.inicio)} · {rangoHora(r.inicio, r.fin)} · {r.motivo}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="card">
          <div className="card-head">
            <h2>Avisos recientes</h2>
            <Link href="/notificaciones" className="chico">Ver todos</Link>
          </div>
          {notifs.cargando && !notifs.datos ? <Cargando /> : !notifs.datos?.length ? (
            <Vacio icono="campana" titulo="Sin avisos por ahora" />
          ) : (
            <ul className="timeline">
              {notifs.datos.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <strong>{n.titulo}</strong> {!n.leida && <Badge tono="naranja">Nuevo</Badge>}
                  </div>
                  <small>{n.cuerpo} · {hace(n.creadaEn)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
