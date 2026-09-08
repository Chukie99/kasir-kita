import React from 'react'
import { View, StyleSheet, TextInput, Pressable, Linking } from 'react-native'
import { Text, Surface } from 'react-native-paper'
import { colors } from '../theme/theme'
import { VENDOR_WA } from '../license/license'
import * as Clipboard from 'expo-clipboard'

/**
 * High-contrast license gate.
 * Shows the device code so the customer can send it to the vendor,
 * and locks the app until a valid activation key is entered.
 */
export default function ActivationGate({ deviceCode, onActivate }: { deviceCode: string; onActivate: (key: string) => boolean }) {
  const [key, setKey] = React.useState('')
  const [error, setError] = React.useState('')
  const inputRef = React.useRef<TextInput>(null)

  const submit = () => {
    if (!key.trim()) { setError('Masukkan kode aktivasi'); return }
    if (!onActivate(key)) setError('Kode aktivasi tidak valid untuk perangkat ini')
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>Kasir Kita</Text>
      <Text style={styles.tagline}>Kasir Offline untuk Warung & Kedai</Text>

      <Surface style={styles.card} elevation={0}>
        <Text style={styles.sectionLabel}>Device ID HP Ini</Text>
        <Surface style={styles.deviceBox} elevation={0}>
          <Pressable onLongPress={() => Clipboard.setStringAsync(deviceCode).catch(() => {})} delayLongPress={200}>
            <Text selectable style={styles.deviceCode}>{deviceCode}</Text>
          </Pressable>
          <Pressable
            onPress={async () => { await Clipboard.setStringAsync(deviceCode).catch(() => {}) }}
            android_ripple={{ color: 'rgba(255,255,255,0.3)' }}
            style={styles.copyBtn}
          >
            <Text style={styles.copyBtnTxt}>📋 Salin Device ID</Text>
          </Pressable>
        </Surface>
        <Text style={styles.helpText}>
          Kirim kode di atas ke penjual untuk mendapatkan Kode Aktivasi Anda.
        </Text>

        <Pressable
          onPress={() => {
            const msg = encodeURIComponent(`Halo, saya mau minta Kode Aktivasi Kasir Kita.\nDevice ID saya: ${deviceCode}`)
            Linking.openURL(`https://wa.me/${VENDOR_WA}?text=${msg}`)
          }}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          style={styles.waBtn}
        >
          <Text style={styles.waBtnText}>💬 MINTA KODE VIA WHATSAPP</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>Kode Aktivasi</Text>
        <TextInput
          ref={inputRef}
          value={key}
          onChangeText={(v) => { setKey(v.toUpperCase()); setError('') }}
          onSubmitEditing={submit}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          placeholderTextColor="#C9BFA8"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          keyboardType="default"
          returnKeyType="done"
          maxLength={19}
          style={[styles.inputBox, error ? styles.inputError : null]}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={submit} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.activateBtn}>
          <Text style={styles.activateBtnText}>AKTIVASI</Text>
        </Pressable>

        <Pressable onPress={() => inputRef.current?.focus()} style={styles.focusHelper}>
          <Text style={styles.focusHelperText}>Ketuk di sini kalau keyboard tidak muncul</Text>
        </Pressable>
      </Surface>

      <Text style={styles.footer}>Aplikasi terkunci sampai aktivasi berhasil.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  brand: { fontSize: 34, fontWeight: '900', color: colors.greenDark, letterSpacing: 2 },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 28 },
  card: { width: '100%', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 24 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  deviceBox: { backgroundColor: colors.chipBg, borderRadius: 12, borderWidth: 1, borderColor: colors.green, alignItems: 'center', paddingVertical: 16 },
  deviceCode: { fontSize: 22, fontWeight: '900', color: colors.greenDark, letterSpacing: 3 },
  copyBtn: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10, alignSelf: 'center' },
  copyBtnTxt: { color: colors.greenDark, fontWeight: '800', fontSize: 12 },
  helpText: { fontSize: 13, color: colors.textMuted, marginTop: 10, lineHeight: 18 },
  waBtn: { backgroundColor: '#25D366', borderRadius: 12, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  waBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  inputBox: {
    backgroundColor: colors.chipBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontWeight: '600', marginTop: 10 },
  activateBtn: { backgroundColor: colors.green, borderRadius: 12, height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  activateBtnText: { color: '#FFF', fontWeight: '800', fontSize: 17, letterSpacing: 1.5 },
  focusHelper: { alignItems: 'center', marginTop: 14 },
  focusHelperText: { fontSize: 11, color: '#C9BFA8' },
  footer: { marginTop: 20, fontSize: 12, color: colors.textMuted },
})
