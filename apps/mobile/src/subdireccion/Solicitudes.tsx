import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { api, post } from '../api';
import { Aviso, Boton, colores } from '../ui';
import { paleta } from '../comun/graficos';
import { cadaRato, hora } from './fechas';

interface Pendiente {
  id: string;
  descripcion: string;
  asistentes: number;
  creado_en: string;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  tipo_actividad: { nombre: string };
  usuario: { persona: { nombres: string; apellido_paterno: string } };
  reserva: { id: string; inicio: string; fin: string; estado: string; expira_en: string | null; espacio: { codigo: string } }[];
}

const fechaCorta = (d: string) => new Date(d).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
const hace = (d: string) => {
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
};
const venceEn = (d: string | null) => {
  if (!d) return '';
  const h = (new Date(d).getTime() - Date.now()) / 3_600_000;
  return h < 1 ? 'vence en menos de 1 h' : `vence en ${Math.round(h)} h`;
};

/** Solicitudes que la persona puede decidir (Subdirección: todas). Aprobar o rechazar con motivo. */
export function Solicitudes({ alDecidir }: { alDecidir: () => void }) {
  const [items, setItems] = useState<Pendiente[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [rechazo, setRechazo] = useState<Pendiente | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);

  const cargar = useCallback(() =>
    api<Pendiente[]>('/solicitudes/pendientes')
      .then((l) => setItems(l.sort((a, b) => new Date(a.reserva[0]?.inicio ?? 0).getTime() - new Date(b.reserva[0]?.inicio ?? 0).getTime())))
      .catch((e) => setMsg({ ok: false, texto: (e as Error).message }))
      .finally(() => setRefrescando(false)), []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => cadaRato(cargar, 30_000), [cargar]);

  async function decidir(s: Pendiente, decision: 'aprobar' | 'rechazar', comentario?: string) {
    setEnviando(s.id + decision);
    try {
      await post(`/solicitudes/${s.id}/${decision}`, comentario ? { comentario } : {});
      setItems((l) => l?.filter((x) => x.id !== s.id) ?? null);
      setMsg({ ok: true, texto: `${decision === 'aprobar' ? 'Aprobada' : 'Rechazada'}: ${s.descripcion}. Se avisó a ${s.usuario.persona.nombres}.` });
      setRechazo(null);
      setMotivo('');
      alDecidir();
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setEnviando(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colores.fondo }} contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar(); }} colors={[paleta.azul]} />}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colores.texto }}>Solicitudes por decidir</Text>
        {items && <Text style={{ color: paleta.ambar, fontWeight: '800' }}>{items.length}</Text>}
      </View>
      <Text style={{ color: colores.suave, marginTop: -6 }}>Se actualiza sola cada 30 segundos. Deslice hacia abajo para actualizar ahora.</Text>
      {msg && <Aviso ok={msg.ok} texto={msg.texto} />}

      {!items ? <ActivityIndicator color={paleta.azul} style={{ marginTop: 30 }} /> : items.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 30, gap: 8 }}>
          <Text style={{ fontSize: 34 }}>✓</Text>
          <Text style={{ fontWeight: '700', color: colores.texto }}>No hay solicitudes pendientes</Text>
          <Text style={{ color: colores.suave, textAlign: 'center' }}>Cuando alguien pida una sala que requiera aprobación, aparecerá aquí y le llegará un aviso.</Text>
        </View>
      ) : items.map((s) => {
        const r0 = s.reserva[0];
        const serie = s.reserva.length > 1;
        return (
          <View key={s.id} style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colores.borde, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', gap: 12, padding: 14 }}>
              <View style={{ width: 58, borderRadius: 12, backgroundColor: paleta.naranjaSuave, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
                <Text style={{ color: paleta.ambar, fontSize: 11, fontWeight: '700' }}>{r0 ? new Date(r0.inicio).toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase() : ''}</Text>
                <Text style={{ color: paleta.ambar, fontSize: 22, fontWeight: '800' }}>{r0 ? new Date(r0.inicio).getDate() : ''}</Text>
                <Text style={{ color: paleta.ambar, fontSize: 11 }}>
                  {r0 ? new Date(r0.inicio).toLocaleDateString('es-CL', { month: 'short' }) : ''}
                  {r0 && new Date(r0.inicio).getFullYear() !== new Date().getFullYear() ? ` ${new Date(r0.inicio).getFullYear()}` : ''}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontWeight: '800', fontSize: 15, color: colores.texto }}>{s.descripcion}</Text>
                <Text style={{ color: colores.texto }}>{s.usuario.persona.nombres} {s.usuario.persona.apellido_paterno}</Text>
                <Text style={{ color: colores.suave, fontSize: 13 }}>
                  {r0 ? `${r0.espacio.codigo} · ${hora(r0.inicio)}–${hora(r0.fin)}` : ''} · {s.tipo_actividad.nombre} · {s.asistentes} pers.
                </Text>
                {serie && <Text style={{ color: paleta.azulMedio, fontSize: 13, fontWeight: '600' }}>Serie semanal: {s.reserva.length} fechas, hasta {fechaCorta(s.reserva[s.reserva.length - 1].inicio)}</Text>}
                <Text style={{ color: colores.suave, fontSize: 12 }}>Pedida {hace(s.creado_en)}{r0?.expira_en ? ` · ${venceEn(r0.expira_en)}` : ''}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colores.borde }}>
              <Pressable onPress={() => { setRechazo(s); setMotivo(''); }} style={({ pressed }) => [{ flex: 1, paddingVertical: 13, alignItems: 'center', borderRightWidth: 1, borderRightColor: colores.borde }, pressed && { backgroundColor: paleta.rojoSuave }]}>
                <Text style={{ color: paleta.rojo, fontWeight: '800' }}>Rechazar</Text>
              </Pressable>
              <Pressable disabled={!!enviando} onPress={() => decidir(s, 'aprobar')} style={({ pressed }) => [{ flex: 1, paddingVertical: 13, alignItems: 'center', backgroundColor: pressed ? '#176b46' : paleta.verde }]}>
                {enviando === s.id + 'aprobar' ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Aprobar{serie ? ' serie' : ''}</Text>}
              </Pressable>
            </View>
          </View>
        );
      })}

      <Modal visible={!!rechazo} transparent animationType="fade" onRequestClose={() => setRechazo(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(8,26,56,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colores.texto }}>Rechazar solicitud</Text>
            <Text style={{ color: colores.suave }}>{rechazo?.descripcion} · {rechazo?.usuario.persona.nombres} {rechazo?.usuario.persona.apellido_paterno}</Text>
            <Text style={{ color: colores.texto, fontWeight: '600' }}>Motivo (lo recibirá el solicitante)</Text>
            <TextInput value={motivo} onChangeText={setMotivo} multiline placeholder="Ej.: la sala está reservada para un evento institucional" placeholderTextColor={colores.suave}
              style={{ borderWidth: 1, borderColor: colores.borde, borderRadius: 10, padding: 12, minHeight: 80, textAlignVertical: 'top', color: colores.texto }} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Boton titulo="Volver" variante="secundario" onPress={() => setRechazo(null)} /></View>
              <View style={{ flex: 1 }}><Boton titulo="Rechazar" variante="peligro" deshabilitado={motivo.trim().length < 3} cargando={!!enviando} onPress={() => rechazo && decidir(rechazo, 'rechazar', motivo.trim())} /></View>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
