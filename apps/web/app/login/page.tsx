'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, guardarSesion, mensajeError, type Sesion } from '@/lib/api';
import { Icono, Logo } from '@/components/ui';

/** Cuentas del seed de desarrollo (apps/api/prisma/seed.ts); solo rellenan el correo. */
const DEMO = [
  ['subdireccion@itn.cl', 'Subdirección'],
  ['dir.inf@itn.cl', 'Director carrera'],
  ['docente@itn.cl', 'Docente'],
  ['estudiante@itn.cl', 'Estudiante'],
  ['operaciones@itn.cl', 'Operaciones'],
  ['aseo@itn.cl', 'Aseo'],
  ['datd@itn.cl', 'DATD'],
] as const;

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [email, setEmail] = useState('subdireccion@itn.cl');
  const [enviando, setEnviando] = useState(false);

  async function ingresar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    try {
      const s = await api<Sesion>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: f.get('password') }),
      });
      guardarSesion(s);
      router.replace('/inicio');
    } catch (err) {
      setError(mensajeError(err));
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <section className="lado-marca">
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo alto={44} claro />
            <div style={{ lineHeight: 1.15, borderLeft: '2px solid rgba(255,255,255,.3)', paddingLeft: 14, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: '0.85rem' }}>
              Instituto<br />Técnico<br />del Norte
            </div>
          </div>
          <h1>Reserva salas y laboratorios sin choques de horario</h1>
          <p>Solicita, aprueba y controla el uso de los espacios del ITN desde un solo lugar, con sugerencias de sala y disponibilidad en tiempo real.</p>
          <div className="lema">Formación que construye tu futuro</div>
        </div>
        <div className="valores">
          <span>Técnica</span><span>Innovación</span><span>Oportunidades</span><span>Comunidad</span>
        </div>
      </section>

      <section className="lado-form">
        <form onSubmit={ingresar}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span className="miga">ReservaITN</span>
            <h2>Iniciar sesión</h2>
            <p className="muted">Usa tu correo institucional.</p>
          </div>
          <label>Correo institucional
            <input name="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>Contraseña
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          {error && <div className="alerta error"><Icono n="alerta" />{error}</div>}
          <button type="submit" disabled={enviando} style={{ padding: '0.75rem' }}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
          <div className="demo">
            <span className="ayuda">Cuentas de demostración (entorno de desarrollo):</span>
            <div className="chips">
              {DEMO.map(([correo, texto]) => (
                <button type="button" key={correo} className={`chip${email === correo ? ' activo' : ''}`} onClick={() => setEmail(correo)}>
                  {texto}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
