import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { api } from '../api';
import { colores } from '../ui';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CABECERA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const dos = (n: number) => String(n).padStart(2, '0');
const isoLocal = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const largo = (d: Date) => {
  const t = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * Selector de día con el mismo calendario que la web: los días en que no se puede reservar (pasados,
 * sábados, domingos, vacaciones y días bloqueados por Subdirección) se ven en gris y no se pueden
 * elegir. Los motivos vienen de la API (`/calendario/no-disponibles`), la misma regla que aplica la
 * base de datos. Reemplaza al selector nativo, que no permite deshabilitar días.
 */
export function CampoDia({ etiqueta, valor, onCambio, minimo }: {
  etiqueta: string;
  valor: Date;
  onCambio: (d: Date) => void;
  /** Primer día elegible; nunca antes de hoy. */
  minimo?: Date;
}) {
  const hoy = inicioDia(new Date());
  const primerDia = minimo && inicioDia(minimo) > hoy ? inicioDia(minimo) : hoy;
  const [abierto, setAbierto] = useState(false);
  const [mes, setMes] = useState(() => new Date(valor.getFullYear(), valor.getMonth(), 1));
  const [bloqueados, setBloqueados] = useState<Record<string, string>>({});

  // Al abrir, el mes visible parte en el día elegido
  useEffect(() => {
    if (abierto) setMes(new Date(valor.getFullYear(), valor.getMonth(), 1));
  }, [abierto, valor]);

  // Días bloqueados del mes que se está viendo (vacaciones y recesos; los fines de semana se calculan aquí)
  useEffect(() => {
    if (!abierto) return;
    const desde = isoLocal(mes);
    const hasta = isoLocal(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    let vigente = true;
    api<{ fecha: string; motivo: string }[]>(`/calendario/no-disponibles?desde=${desde}&hasta=${hasta}`)
      .then((l) => vigente && setBloqueados(Object.fromEntries(l.map((x) => [x.fecha, x.motivo]))))
      .catch(() => vigente && setBloqueados({}));
    return () => { vigente = false; };
  }, [abierto, mes]);

  const primero = (mes.getDay() + 6) % 7; // lunes = 0
  const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas: (number | null)[] = [...Array<null>(primero).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);
  const filas = Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));
  const enMesTope = mes.getFullYear() === primerDia.getFullYear() && mes.getMonth() === primerDia.getMonth();
  const irMes = (n: number) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const noDisponible = (d: Date) => d < primerDia || d.getDay() === 0 || d.getDay() === 6 || !!bloqueados[isoLocal(d)];

  return (
    <View style={{ gap: 4, flexGrow: 1, flexShrink: 1 }}>
      <Text style={{ color: colores.suave, fontSize: 13 }}>{etiqueta}</Text>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        style={{ borderWidth: 1, borderColor: colores.borde, borderRadius: 8, padding: 12, backgroundColor: '#fff' }}
      >
        <Text style={{ fontSize: 15, color: colores.texto }}>{largo(valor)}</Text>
      </Pressable>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,26,56,0.5)', justifyContent: 'center', padding: 20 }} onPress={() => setAbierto(false)}>
          {/* El Pressable interno evita que tocar dentro del calendario cierre el diálogo */}
          <Pressable onPress={() => {}} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={() => irMes(-1)} disabled={enMesTope} hitSlop={8} accessibilityLabel="Mes anterior"
                style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, alignItems: 'center', justifyContent: 'center', opacity: enMesTope ? 0.35 : 1 }}>
                <Text style={{ fontSize: 20, color: colores.texto }}>‹</Text>
              </Pressable>
              <Text style={{ fontWeight: '800', fontSize: 16, color: colores.texto }}>{MESES[mes.getMonth()].replace(/^./, (c) => c.toUpperCase())} {mes.getFullYear()}</Text>
              <Pressable onPress={() => irMes(1)} hitSlop={8} accessibilityLabel="Mes siguiente"
                style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colores.borde, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20, color: colores.texto }}>›</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row' }}>
              {CABECERA.map((c, i) => (
                <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colores.suave }}>{c}</Text>
              ))}
            </View>
            {filas.map((fila, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 4 }}>
                {fila.map((n, j) => {
                  if (n === null) return <View key={j} style={{ flex: 1, height: 40 }} />;
                  const d = new Date(mes.getFullYear(), mes.getMonth(), n);
                  const gris = noDisponible(d);
                  const elegido = isoLocal(d) === isoLocal(valor);
                  const esHoy = d.getTime() === hoy.getTime();
                  return (
                    <Pressable
                      key={j}
                      disabled={gris}
                      onPress={() => { onCambio(d); setAbierto(false); }}
                      accessibilityLabel={`${n} de ${MESES[mes.getMonth()]}${gris ? ', no disponible' : ''}`}
                      style={{
                        flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: elegido ? colores.acento : gris ? '#eceef2' : 'transparent',
                        borderWidth: esHoy && !elegido ? 1 : 0, borderColor: colores.acento,
                      }}
                    >
                      <Text style={{
                        fontSize: 15, fontWeight: elegido ? '800' : '500',
                        color: elegido ? '#fff' : gris ? '#a4abb8' : colores.texto,
                      }}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#eceef2', borderWidth: 1, borderColor: colores.borde }} />
              <Text style={{ flex: 1, fontSize: 12, color: colores.suave }}>En gris: no se puede reservar (pasado, fin de semana, vacaciones o bloqueo de Subdirección).</Text>
            </View>
            <Pressable onPress={() => setAbierto(false)} style={{ alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 8 }}>
              <Text style={{ color: colores.acento, fontWeight: '700', fontSize: 15 }}>Cerrar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
