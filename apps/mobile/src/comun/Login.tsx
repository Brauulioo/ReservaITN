import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL, api, type Sesion } from '../api';
import { Aviso, Boton, colores } from '../ui';
import { paleta } from './graficos';

/** Cuentas de demostración (packages/db/semillas/demo), las mismas del login web. */
const DEMO = [
  ['pedro.fernandez@itn.cl', 'Pedro · Subdirección'],
  ['matias.soto@itn.cl', 'Matías · Director carrera'],
  ['andrea.munoz@itn.cl', 'Andrea · Docente'],
  ['sofia.vargas@itn.cl', 'Sofía · Estudiante'],
  ['jorge.araya@itn.cl', 'Jorge · Operaciones'],
  ['rosa.contreras@itn.cl', 'Rosa · Aseo'],
  ['francisca.urrutia@itn.cl', 'Francisca · DATD'],
] as const;
const CLAVE_DEMO = 'reservaitn';
const MOSTRAR_DEMO = __DEV__ || process.env.EXPO_PUBLIC_MOSTRAR_DEMO === 'true';

export function Login({ onIngreso }: { onIngreso: (s: Sesion) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verClave, setVerClave] = useState(false);

  async function ingresar() {
    setError('');
    setCargando(true);
    try {
      onIngreso(await api<Sesion>('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paleta.azul }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, backgroundColor: colores.fondo }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {/* Foto del campus con la marca, como el login web */}
          <View style={{ height: 210, backgroundColor: paleta.azul }}>
            <Image source={require('../../assets/itn-campus-banner.jpg')} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(8,26,56,0.55)' }} />
            <View style={{ flex: 1, justifyContent: 'flex-end', padding: 22, paddingBottom: 44 }}>
              <Text style={{ color: paleta.naranja, fontWeight: '800', letterSpacing: 1, fontSize: 12 }}>INSTITUTO TÉCNICO DEL NORTE</Text>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>Reserva<Text style={{ color: paleta.naranja }}>ITN</Text></Text>
              <Text style={{ color: '#dfe7f5', fontSize: 13 }}>Formación que construye tu futuro</Text>
            </View>
          </View>

          <View style={{ marginTop: -26, marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 14, shadowColor: '#0e2347', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colores.texto }}>Bienvenido</Text>
              <Text style={{ color: colores.suave }}>Accede con tu cuenta institucional.</Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colores.texto, fontWeight: '600', fontSize: 13 }}>Correo institucional</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colores.borde, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fbfcfe' }}>
                <Text style={{ fontSize: 16, color: colores.suave, marginRight: 8 }}>✉</Text>
                <TextInput value={email} onChangeText={(t) => { setEmail(t); setError(''); }} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address"
                  placeholder="usuario@itn.cl" placeholderTextColor={colores.suave} style={{ flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 15, color: colores.texto }} />
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ color: colores.texto, fontWeight: '600', fontSize: 13 }}>Contraseña</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colores.borde, borderRadius: 12, paddingHorizontal: 12, backgroundColor: '#fbfcfe' }}>
                <Text style={{ fontSize: 15, color: colores.suave, marginRight: 8 }}>🔒</Text>
                <TextInput value={password} onChangeText={(t) => { setPassword(t); setError(''); }} secureTextEntry={!verClave} autoCapitalize="none" autoCorrect={false}
                  autoComplete="password" textContentType="password" placeholder="Ingresa tu contraseña" placeholderTextColor={colores.suave}
                  style={{ flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 15, color: colores.texto }} onSubmitEditing={ingresar} />
                <Pressable onPress={() => setVerClave((v) => !v)} hitSlop={10} style={{ paddingLeft: 8 }}>
                  <Text style={{ color: paleta.azulMedio, fontWeight: '700', fontSize: 13 }}>{verClave ? 'Ocultar' : 'Mostrar'}</Text>
                </Pressable>
              </View>
            </View>

            {!!error && <Aviso ok={false} texto={error} />}
            <Boton titulo="Iniciar sesión" onPress={ingresar} cargando={cargando} deshabilitado={!email || !password} />

            {MOSTRAR_DEMO && (
              <View style={{ borderTopWidth: 1, borderTopColor: colores.borde, paddingTop: 14, gap: 10 }}>
                <Text style={{ color: colores.suave, fontSize: 13, textAlign: 'center' }}>
                  Cuentas de demostración (contraseña <Text style={{ fontWeight: '800', color: colores.texto }}>{CLAVE_DEMO}</Text>)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {DEMO.map(([correo, texto]) => {
                    const activa = email === correo;
                    return (
                      <Pressable key={correo} onPress={() => { setEmail(correo); setPassword(CLAVE_DEMO); setError(''); }}
                        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: activa ? paleta.azul : colores.borde, backgroundColor: activa ? paleta.azul : '#fff' }, pressed && { opacity: 0.8 }]}>
                        <Text style={{ fontSize: 12, color: activa ? '#fff' : paleta.azulMedio }}>👤</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: activa ? '#fff' : colores.texto }}>{texto}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          <Text style={{ color: colores.suave, fontSize: 11, textAlign: 'center', marginVertical: 18 }}>Servidor: {API_URL.replace(/^https?:\/\//, '')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
