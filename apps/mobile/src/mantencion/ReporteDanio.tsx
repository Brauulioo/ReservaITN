import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { reporteDanioSchema } from '@reservaitn/shared';
import { api, postFormulario } from '../api';
import { Aviso, Boton, Campo, colores, Etiqueta, Fichas, Titulo } from '../ui';

interface Espacio { id: string; codigo: string; nombre: string }
interface ItemEsperado { item: { id: string; nombre: string } }
const SEVERIDADES = [
  { valor: 'BAJA' as const, texto: 'Baja' },
  { valor: 'MEDIA' as const, texto: 'Media' },
  { valor: 'ALTA' as const, texto: 'Alta (impide usar la sala)' },
];

/**
 * Reporte de daños (R17 / E12): sala, ítem dañado (opcional), gravedad, descripción y una foto
 * opcional. Llega solo a Operaciones como aviso y queda en la bandeja de daños para crear la orden
 * de trabajo. La foto se reduce en el celular (1280 px, JPG) para que el envío sea rápido.
 * Interfaz simple a propósito (riesgo de brecha digital del personal, interesado I5).
 */
export function ReporteDanio() {
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [espacioId, setEspacioId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemEsperado[]>([]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [severidad, setSeveridad] = useState<'BAJA' | 'MEDIA' | 'ALTA'>('MEDIA');
  const [descripcion, setDescripcion] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    api<Espacio[]>('/espacios').then(setEspacios).catch((e) => setMsg({ ok: false, texto: (e as Error).message }));
  }, []);
  useEffect(() => {
    setItemId(null);
    if (espacioId) api<ItemEsperado[]>(`/mantencion/espacios/${espacioId}/inventario`).then(setItems).catch(() => setItems([]));
  }, [espacioId]);

  async function adjuntar(origen: 'camara' | 'galeria') {
    setMsg(null);
    try {
      const permiso = origen === 'camara' ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
      if (!permiso.granted) return setMsg({ ok: false, texto: 'Sin permiso de cámara. Puede elegir una foto de la galería.' });
      const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
      const r = origen === 'camara' ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
      if (r.canceled) return;
      const reducida = await manipulateAsync(r.assets[0].uri, [{ resize: { width: 1280 } }], { compress: 0.7, format: SaveFormat.JPEG });
      setFoto(reducida.uri);
    } catch (e) {
      setMsg({ ok: false, texto: `No se pudo cargar la foto: ${(e as Error).message}` });
    }
  }

  async function enviar() {
    const datos = { espacioId: espacioId ?? '', itemId: itemId ?? undefined, descripcion, severidad };
    const v = reporteDanioSchema.safeParse(datos);
    if (!v.success) return setMsg({ ok: false, texto: espacioId ? v.error.issues[0].message : 'Elige la sala' });
    setEnviando(true);
    try {
      await postFormulario(
        '/mantencion/danios',
        { espacioId: datos.espacioId, itemId: datos.itemId, descripcion: datos.descripcion, severidad: datos.severidad },
        foto ? { campo: 'foto', uri: foto, tipo: 'image/jpeg', nombre: 'dano.jpg' } : undefined,
      );
      setMsg({ ok: true, texto: `✓ Reporte${foto ? ' con foto' : ''} enviado al encargado de operaciones.` });
      setDescripcion('');
      setItemId(null);
      setFoto(null);
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Titulo>Reportar daño</Titulo>
      <Etiqueta>1. Sala</Etiqueta>
      <Fichas opciones={espacios.map((e) => ({ valor: e.id, texto: e.codigo }))} valor={espacioId} onCambio={setEspacioId} />
      {items.length > 0 && (
        <>
          <Etiqueta>2. ¿Qué está dañado? (opcional)</Etiqueta>
          <Fichas opciones={items.map((i) => ({ valor: i.item.id, texto: i.item.nombre }))} valor={itemId} onCambio={setItemId} />
        </>
      )}
      <Etiqueta>3. Gravedad</Etiqueta>
      <Fichas opciones={SEVERIDADES} valor={severidad} onCambio={setSeveridad} />
      <Campo etiqueta="4. ¿Qué pasó?" value={descripcion} onChangeText={setDescripcion} multiline placeholder="Ej. el proyector no enciende" />
      <Etiqueta>5. Foto del daño (opcional)</Etiqueta>
      {foto ? (
        <View style={{ gap: 8 }}>
          <Image source={{ uri: foto }} style={{ width: '100%', height: 220, borderRadius: 10, backgroundColor: colores.borde }} resizeMode="cover" accessibilityLabel="Foto adjunta del daño" />
          <Pressable onPress={() => setFoto(null)} accessibilityRole="button">
            <Text style={{ color: colores.error, fontWeight: '600', textAlign: 'center' }}>Quitar foto</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Boton titulo="📷 Tomar foto" variante="secundario" onPress={() => adjuntar('camara')} /></View>
          <View style={{ flex: 1 }}><Boton titulo="🖼 Galería" variante="secundario" onPress={() => adjuntar('galeria')} /></View>
        </View>
      )}
      <Boton titulo="Enviar reporte" onPress={enviar} cargando={enviando} />
      {msg && <Aviso ok={msg.ok} texto={msg.texto} />}
    </ScrollView>
  );
}
