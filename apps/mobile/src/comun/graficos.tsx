import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { colores } from '../ui';

/**
 * Gráficos hechos con vistas nativas (sin librerías extra): barras que crecen al aparecer,
 * mapa de calor tocable e indicadores. Misma paleta que el inicio de Subdirección en la web.
 */
export const paleta = {
  azul: '#1c3f7a',
  azulMedio: '#2a55a0',
  azulSuave: '#e7edf7',
  naranja: '#f2a01e',
  naranjaSuave: '#fdf1dc',
  verde: '#1f8a5b',
  verdeSuave: '#e3f4ec',
  rojo: '#c2362b',
  rojoSuave: '#fde8e6',
  ambar: '#a76300',
  ambarSuave: '#fff3dc',
  gris: '#8a94a6',
  griSuave: '#eef1f6',
};

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Valor animado de 0 a `hasta` cada vez que cambia (las barras “crecen”). */
function useCrecer(hasta: number, retraso = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: hasta, duration: 650, delay: retraso, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [hasta, retraso, v]);
  return v;
}

/** Tarjeta de sección con título, subtítulo y acción opcional. */
export function Seccion({ titulo, sub, accion, children }: { titulo: string; sub?: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colores.borde, padding: 16, gap: 12, shadowColor: '#0e2347', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colores.texto }}>{titulo}</Text>
          {!!sub && <Text style={{ color: colores.suave, fontSize: 12, marginTop: 2 }}>{sub}</Text>}
        </View>
        {accion}
      </View>
      {children}
    </View>
  );
}

/** Indicador grande (KPI) tocable. */
export function Indicador({ titulo, valor, detalle, tono = 'azul', onPress }: {
  titulo: string;
  valor: string;
  detalle?: string;
  tono?: 'azul' | 'naranja' | 'verde' | 'rojo';
  onPress?: () => void;
}) {
  const t = { azul: [paleta.azul, paleta.azulSuave], naranja: [paleta.ambar, paleta.naranjaSuave], verde: [paleta.verde, paleta.verdeSuave], rojo: [paleta.rojo, paleta.rojoSuave] }[tono];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [{ flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colores.borde, padding: 14, gap: 4, overflow: 'hidden' }, pressed && { opacity: 0.85 }]}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: t[0] }} />
      <Text style={{ color: colores.suave, fontSize: 12, fontWeight: '600' }}>{titulo}</Text>
      <Text style={{ color: t[0], fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>{valor}</Text>
      {!!detalle && <Text style={{ color: colores.suave, fontSize: 11 }} numberOfLines={2}>{detalle}</Text>}
      {!!onPress && <Text style={{ position: 'absolute', right: 10, top: 10, color: t[0], fontSize: 16 }}>›</Text>}
    </Pressable>
  );
}

/** Barra horizontal animada: etiqueta, valor y relleno proporcional (0 a 1). */
export function BarraH({ etiqueta, valor, proporcion, color = paleta.azul, fondo = paleta.azulSuave, activa, onPress, retraso = 0, detalle }: {
  etiqueta: string;
  valor: string;
  proporcion: number;
  color?: string;
  fondo?: string;
  activa?: boolean;
  onPress?: () => void;
  retraso?: number;
  detalle?: string;
}) {
  const ancho = useCrecer(Math.max(0, Math.min(1, proporcion)), retraso);
  return (
    <Pressable onPress={onPress} style={{ gap: 5, paddingVertical: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ color: colores.texto, fontWeight: activa ? '800' : '600', fontSize: 13, flex: 1 }} numberOfLines={1}>{etiqueta}</Text>
        <Text style={{ color: activa ? color : colores.suave, fontWeight: '700', fontSize: 13 }}>{valor}</Text>
      </View>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: fondo, overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', borderRadius: 999, backgroundColor: color, opacity: activa === false ? 0.45 : 1, width: ancho.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
      {activa && !!detalle && <Text style={{ color: colores.suave, fontSize: 12 }}>{detalle}</Text>}
    </Pressable>
  );
}

/** Barra segmentada (una sola fila) con leyenda tocable. */
export function Segmentos({ partes, seleccion, onSeleccion }: {
  partes: { clave: string; texto: string; valor: number; color: string }[];
  seleccion?: string | null;
  onSeleccion?: (clave: string) => void;
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const crecer = useCrecer(1);
  return (
    <View style={{ gap: 12 }}>
      <Animated.View style={{ flexDirection: 'row', height: 16, borderRadius: 999, overflow: 'hidden', backgroundColor: paleta.griSuave, width: crecer.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}>
        {total > 0 && partes.filter((p) => p.valor > 0).map((p) => (
          <View key={p.clave} style={{ flex: p.valor, backgroundColor: p.color, opacity: seleccion && seleccion !== p.clave ? 0.3 : 1 }} />
        ))}
      </Animated.View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {partes.map((p) => (
          <Pressable key={p.clave} onPress={() => onSeleccion?.(p.clave)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: seleccion === p.clave ? p.color : colores.borde, backgroundColor: seleccion === p.clave ? `${p.color}18` : '#fff' }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color }} />
            <Text style={{ fontSize: 12, color: colores.texto, fontWeight: '600' }}>{p.texto}</Text>
            <Text style={{ fontSize: 12, color: colores.suave }}>{p.valor}{total ? ` · ${pct(p.valor / total)}` : ''}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Columnas verticales animadas (p. ej. uso por hora del día). */
export function Columnas({ datos, alto = 120, seleccion, onSeleccion, formato = pct }: {
  datos: { etiqueta: string; valor: number }[];
  alto?: number;
  seleccion?: number | null;
  onSeleccion?: (i: number) => void;
  formato?: (v: number) => string;
}) {
  const max = Math.max(0.0001, ...datos.map((d) => d.valor));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: alto, gap: 3 }}>
        {datos.map((d, i) => (
          <Columna key={d.etiqueta} proporcion={d.valor / max} alto={alto} activa={seleccion === i} atenuada={seleccion != null && seleccion !== i} retraso={i * 25} onPress={() => onSeleccion?.(i)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {datos.map((d, i) => (
          <Text key={d.etiqueta} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: seleccion === i ? paleta.azul : colores.suave, fontWeight: seleccion === i ? '800' : '500' }}>
            {i % 2 === 0 || seleccion === i ? d.etiqueta : ''}
          </Text>
        ))}
      </View>
      {seleccion != null && datos[seleccion] && (
        <Text style={{ color: colores.texto, fontSize: 13 }}>
          <Text style={{ fontWeight: '700' }}>{datos[seleccion].etiqueta}:00</Text> · {formato(datos[seleccion].valor)}
        </Text>
      )}
    </View>
  );
}

function Columna({ proporcion, alto, activa, atenuada, retraso, onPress }: { proporcion: number; alto: number; activa: boolean; atenuada: boolean; retraso: number; onPress: () => void }) {
  const h = useCrecer(proporcion, retraso);
  return (
    <Pressable onPress={onPress} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }} hitSlop={4}>
      <Animated.View style={{ borderTopLeftRadius: 5, borderTopRightRadius: 5, minHeight: 3, backgroundColor: activa ? paleta.naranja : paleta.azulMedio, opacity: atenuada ? 0.4 : 1, height: h.interpolate({ inputRange: [0, 1], outputRange: [0, alto] }) }} />
    </Pressable>
  );
}

/** Mapa de calor día × hora: cada celda se puede tocar para ver su valor. */
export function MapaCalor({ dias, horas, valores, seleccion, onSeleccion }: {
  dias: string[];
  horas: number[];
  valores: number[][];
  seleccion?: [number, number] | null;
  onSeleccion?: (d: number, h: number) => void;
}) {
  const max = Math.max(0.0001, ...valores.flat());
  const mezclar = (v: number) => {
    // del gris claro al azul institucional según la intensidad
    const t = v <= 0 ? 0 : 0.15 + 0.85 * Math.min(1, v / max);
    const a = [238, 241, 246];
    const b = [28, 63, 122];
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})`;
  };
  return (
    <View style={{ gap: 3 }}>
      {valores.map((fila, d) => (
        <View key={dias[d]} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ width: 30, fontSize: 11, color: colores.suave, fontWeight: '600' }}>{dias[d]}</Text>
          {fila.map((v, h) => {
            const activa = seleccion?.[0] === d && seleccion?.[1] === h;
            return (
              <Pressable key={h} onPress={() => onSeleccion?.(d, h)} style={{ flex: 1, aspectRatio: 1, borderRadius: 4, backgroundColor: mezclar(v), borderWidth: activa ? 2 : 0, borderColor: paleta.naranja }} />
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 2 }}>
        <View style={{ width: 30 }} />
        {horas.map((h, i) => (
          <Text key={h} style={{ flex: 1, fontSize: 9, textAlign: 'center', color: colores.suave }}>{i % 3 === 0 ? h : ''}</Text>
        ))}
      </View>
    </View>
  );
}

/** Pastilla de filtro (período, sede, estado). */
export function Pastilla({ texto, activa, onPress, claro }: { texto: string; activa: boolean; onPress: () => void; claro?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{
      paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1,
      borderColor: claro ? (activa ? '#fff' : 'rgba(255,255,255,0.35)') : activa ? paleta.azul : colores.borde,
      backgroundColor: claro ? (activa ? '#fff' : 'transparent') : activa ? paleta.azul : '#fff',
    }, pressed && { opacity: 0.8 }]}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: claro ? (activa ? paleta.azul : '#fff') : activa ? '#fff' : colores.texto }}>{texto}</Text>
    </Pressable>
  );
}
