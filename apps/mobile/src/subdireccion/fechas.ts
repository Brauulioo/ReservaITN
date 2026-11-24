/** Fechas en hora local del celular (en Chile: America/Santiago). */
export const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const mismoDia = (a: Date, b: Date) => inicioDia(a).getTime() === inicioDia(b).getTime();
export const lunesDe = (d: Date) => sumarDias(inicioDia(d), -((d.getDay() + 6) % 7));

export type Periodo = 'hoy' | 'semana' | 'mes';
export function rango(periodo: Periodo, base = new Date()): { desde: Date; hasta: Date } {
  if (periodo === 'hoy') return { desde: inicioDia(base), hasta: sumarDias(inicioDia(base), 1) };
  if (periodo === 'semana') { const l = lunesDe(base); return { desde: l, hasta: sumarDias(l, 7) }; }
  return { desde: new Date(base.getFullYear(), base.getMonth(), 1), hasta: new Date(base.getFullYear(), base.getMonth() + 1, 1) };
}
export const consulta = (r: { desde: Date; hasta: Date }) => `desde=${encodeURIComponent(r.desde.toISOString())}&hasta=${encodeURIComponent(r.hasta.toISOString())}`;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const fechaLarga = (d: Date) => capital(d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }));
export const hora = (d: string | Date) => new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
export const esFinDeSemana = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/**
 * Ejecuta `fn` cada `ms`. Cada consulta recalcula “hoy” con la hora actual, así al pasar la
 * medianoche la pantalla muestra el nuevo día sin hacer nada. Devuelve la función para detenerlo.
 */
export function cadaRato(fn: () => void, ms: number) {
  const t = setInterval(fn, ms);
  return () => clearInterval(t);
}
