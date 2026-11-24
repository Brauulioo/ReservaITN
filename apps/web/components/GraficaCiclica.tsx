'use client';
import { useId, useState, type KeyboardEvent } from 'react';
import { BotonPlegar } from './Plegable';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export type TipoGrafica = 'barras' | 'lineas' | 'dona';
export interface Punto { nombre: string; valor: number }

const NOMBRE: Record<TipoGrafica, string> = { barras: 'Barras', lineas: 'Líneas', dona: 'Dona' };
/** Colores del tema (cambian solos entre modo claro y oscuro). */
const PALETA = ['--accent', '--highlight', '--ok', '--info', '--danger', '--warn'];
const color = (i: number) => `var(${PALETA[i % PALETA.length]})`;

const eje = { fill: 'var(--muted)', fontSize: 12 };
const tooltipEstilo = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 9, color: 'var(--text)', boxShadow: 'var(--shadow)', fontSize: 13 },
  labelStyle: { color: 'var(--muted)' },
  itemStyle: { color: 'var(--text)' },
  cursor: { fill: 'color-mix(in srgb, var(--accent) 10%, transparent)' },
};

/**
 * Una gráfica por tarjeta: el clic (o Enter/Espacio) pasa al siguiente tipo de visualización.
 * 2D con degradado y sombra suave para dar profundidad sin perder lectura.
 */
export function GraficaCiclica({ titulo, nota, datos, tipos, formato = (n) => String(n), vacio = 'Sin datos en el período.' }: {
  titulo: string; nota?: string; datos: Punto[]; tipos: TipoGrafica[]; formato?: (n: number) => string; vacio?: string;
}) {
  const id = useId().replace(/:/g, '');
  const [i, setI] = useState(0);
  const [abierta, setAbierta] = useState(true);
  const tipo = tipos[i % tipos.length];
  const siguiente = () => setI((n) => (n + 1) % tipos.length);
  const tecla = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); siguiente(); } };
  const varios = tipos.length > 1;

  return (
    <div className="card grafica-card">
      <div className="grafica-cab">
        <div>
          <h2>{titulo}</h2>
          {nota && <p className="etiqueta">{nota}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {varios && abierta && (
            <span className="grafica-indicador" aria-hidden="true" title="Tipo de gráfica">
              {tipos.map((t, k) => <i key={t} className={k === i % tipos.length ? 'on' : ''} />)}
              <b>{NOMBRE[tipo]}</b>
            </span>
          )}
          <BotonPlegar abierto={abierta} onCambio={setAbierta} titulo={titulo} />
        </div>
      </div>

      {abierta && (datos.length === 0 ? <p className="grafica-vacio">{vacio}</p> : (
        <div
          className={`grafica-cuerpo${varios ? ' clic' : ''}`}
          role={varios ? 'button' : 'img'}
          tabIndex={varios ? 0 : undefined}
          aria-label={`${titulo}. Gráfica de ${NOMBRE[tipo].toLowerCase()}.${varios ? ' Pulsa para cambiar de tipo.' : ''}`}
          onClick={varios ? siguiente : undefined}
          onKeyDown={varios ? tecla : undefined}
        >
          <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
            <defs>
              {PALETA.map((v, k) => (
                <linearGradient key={v} id={`${id}-g${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: `var(${v})`, stopOpacity: 0.95 }} />
                  <stop offset="100%" style={{ stopColor: `var(${v})`, stopOpacity: 0.35 }} />
                </linearGradient>
              ))}
              <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.45 }} />
                <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
          </svg>

          <div key={tipo} className="grafica-anim">
            <ResponsiveContainer width="100%" height={250} minWidth={0}>
              {tipo === 'dona' ? (
                <PieChart>
                  <Pie data={datos} dataKey="valor" nameKey="nombre" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="var(--surface)" strokeWidth={2}
                    style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.28))' }}>
                    {datos.map((_, k) => <Cell key={k} fill={`url(#${id}-g${k % PALETA.length})`} />)}
                  </Pie>
                  <Tooltip {...tooltipEstilo} formatter={(v) => formato(Number(v))} />
                  <Legend iconType="circle" wrapperStyle={{ color: 'var(--muted)', fontSize: 12 }} />
                </PieChart>
              ) : tipo === 'lineas' ? (
                <AreaChart data={datos} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="nombre" tick={eje} tickLine={false} axisLine={{ stroke: 'var(--border-strong)' }} />
                  <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={formato} />
                  <Tooltip {...tooltipEstilo} cursor={{ stroke: 'var(--border-strong)' }} formatter={(v) => formato(Number(v))} />
                  <Area type="monotone" dataKey="valor" name={titulo} stroke="var(--accent)" strokeWidth={3} fill={`url(#${id}-area)`}
                    dot={{ r: 4, fill: 'var(--surface)', stroke: 'var(--highlight)', strokeWidth: 2 }} activeDot={{ r: 6, fill: 'var(--highlight)' }}
                    style={{ filter: 'drop-shadow(0 4px 5px color-mix(in srgb, var(--accent) 45%, transparent))' }} />
                </AreaChart>
              ) : (
                <BarChart data={datos} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="nombre" tick={eje} tickLine={false} axisLine={{ stroke: 'var(--border-strong)' }} />
                  <YAxis tick={eje} tickLine={false} axisLine={false} tickFormatter={formato} />
                  <Tooltip {...tooltipEstilo} formatter={(v) => formato(Number(v))} />
                  <Bar dataKey="valor" name={titulo} radius={[7, 7, 0, 0]} maxBarSize={44}
                    style={{ filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.25))' }}>
                    {datos.map((_, k) => <Cell key={k} fill={`url(#${id}-g0)`} />)}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {varios && <span className="grafica-pista">Clic para cambiar el tipo de gráfica</span>}
        </div>
      ))}
    </div>
  );
}
