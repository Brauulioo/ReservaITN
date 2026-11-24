'use client';
import { useId, useState, type ReactNode } from 'react';

/** Flecha que oculta o despliega el contenido de una tarjeta. */
export function BotonPlegar({ abierto, onCambio, titulo, controla }: {
  abierto: boolean; onCambio: (abierto: boolean) => void; titulo: string; controla?: string;
}) {
  return (
    <button
      type="button" className="plegar-boton" aria-expanded={abierto} aria-controls={controla}
      aria-label={`${abierto ? 'Ocultar' : 'Mostrar'}: ${titulo}`} title={abierto ? 'Ocultar' : 'Mostrar'}
      onClick={() => onCambio(!abierto)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

/**
 * Tarjeta con encabezado que se puede plegar: el usuario oculta los datos y los despliega cuando quiere.
 * `acciones` (filtros, botones) se muestra junto al título y sigue visible aunque el contenido esté oculto.
 */
export function Plegable({ titulo, nota, acciones, children, abierto: abiertoInicial = true }: {
  titulo: string; nota?: string; acciones?: ReactNode; children: ReactNode; abierto?: boolean;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <section className={`card plegable${abierto ? '' : ' plegada'}`}>
      <div className="plegable-cab">
        <div className="plegable-titulo" onClick={() => setAbierto((a) => !a)}>
          <h2>{titulo}</h2>
          {nota && abierto && <p className="etiqueta">{nota}</p>}
        </div>
        {acciones && abierto && <div className="plegable-acciones">{acciones}</div>}
        <BotonPlegar abierto={abierto} onCambio={setAbierto} titulo={titulo} controla={id} />
      </div>
      {abierto && <div id={id} className="plegable-cuerpo">{children}</div>}
    </section>
  );
}
