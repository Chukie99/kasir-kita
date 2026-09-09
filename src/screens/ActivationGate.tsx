import React from 'react'
import { View, StyleSheet, TextInput, Pressable, Linking, ActivityIndicator, ScrollView } from 'react-native'
import { Text, Surface } from 'react-native-paper'
import { colors } from '../theme/theme'
import { VENDOR_WA, activateOnline, fetchLicenseByEmail } from '../license/license'
import * as Clipboard from 'expo-clipboard'

export default function ActivationGate({ deviceCode, onActivate }: { deviceCode: string; onActivate: (token: string) => boolean }) {
  const [license, setLicense] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState('')
  const [emailMsg, setEmailMsg] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [emailLoading, setEmailLoading] = React.useState(false)
  const [found, setFound] = React.useState<{code:string,status:string}[]>([])
  const inputRef = React.useRef<TextInput>(null)

  const submit = async (codeOverride?: string) => {
    const v = (codeOverride || license).trim().toUpperCase()
    if (!v) { setError('Masukkan kode lisensi (KITA-XXXX-XXXX-XXXX)'); return }
    setLoading(true); setError('')
    const r = await activateOnline(v)
    setLoading(false)
    if (!r.ok) { setError(r.error || 'Gagal aktivasi'); return }
    if (r.token) onActivate(r.token)
  }

  const fetchByEmail = async () => {
    setEmailMsg(''); setError(''); setFound([])
    if (!email.trim() || !email.includes('@')) { setEmailMsg('Masukkan email pembeli yang dipakai di Lynk.id'); return }
    setEmailLoading(true)
    const r = await fetchLicenseByEmail(email)
    setEmailLoading(false)
    if (!r.ok) { setEmailMsg(r.error || 'Gagal ambil lisensi'); return }
    const unused = (r.licenses || []).filter(l => l.status === 'UNUSED')
    if (unused.length === 0) {
      if ((r.licenses||[]).length>0) setEmailMsg('Semua lisensi email ini sudah terikat ke HP lain. Hubungi WA admin.')
      else setEmailMsg('Belum ada lisensi untuk email ini.')
      return
    }
    setFound(unused)
    setEmailMsg(`Ditemukan ${unused.length} lisensi UNUSED — tap Aktifkan`)
    // auto-fill first code
    setLicense(unused[0].code)
  }

  return (
    <ScrollView contentContainerStyle={styles.root} keyboardShouldPersistTaps="handled">
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
        <Text style={styles.helpText}>Lisensi terikat 1 HP = 1 kode. Butuh internet sekali saat aktivasi, setelah itu offline 100%.</Text>

        {/* OPSI A: Ambil via Email */}
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>⚡ Ambil Lisensi via Email (Instant, tanpa tunggu email)</Text>
        <Text style={styles.hint}>Masukkan email pembeli yang dipakai bayar di Lynk.id → Cari</Text>
        <View style={styles.row}>
          <TextInput
            value={email}
            onChangeText={(v)=>{ setEmail(v); setEmailMsg(''); }}
            placeholder="email pembeli@gmail.com"
            placeholderTextColor="#C9BFA8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[styles.inputBox, { flex:1, textAlign:'left', fontSize:14, letterSpacing:0.5 }]}
          />
          <Pressable onPress={fetchByEmail} disabled={emailLoading} style={[styles.smallBtn, emailLoading?{opacity:0.6}:null]}>
            {emailLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.smallBtnTxt}>CARI</Text>}
          </Pressable>
        </View>
        {emailMsg ? <Text style={[styles.msg, emailMsg.includes('Ditemukan')?styles.msgOk:null]}>{emailMsg}</Text> : null}
        {found.length>0 && (
          <View style={styles.foundBox}>
            {found.map(f=> (
              <Pressable key={f.code} onPress={()=>submit(f.code)} disabled={loading} style={styles.foundRow}>
                <Text style={styles.foundCode}>{f.code}</Text>
                <Text style={styles.foundBadge}>{f.status}</Text>
                <View style={styles.activateMini}><Text style={styles.activateMiniTxt}>AKTIFKAN</Text></View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>Atau Paste Kode Lisensi dari Email</Text>
        <Text style={styles.hint}>Format: KITA-XXXX-XXXX-XXXX</Text>
        <TextInput
          ref={inputRef}
          value={license}
          onChangeText={(v) => { setLicense(v.toUpperCase()); setError('') }}
          onSubmitEditing={()=>submit()}
          placeholder="KITA-XXXX-XXXX-XXXX"
          placeholderTextColor="#C9BFA8"
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          keyboardType="default"
          returnKeyType="done"
          maxLength={19}
          editable={!loading}
          style={[styles.inputBox, error ? styles.inputError : null]}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={()=>submit()} disabled={loading} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={[styles.activateBtn, loading ? { opacity: 0.7 } : null]}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.activateBtnText}>AKTIVASI ONLINE</Text>}
        </Pressable>
        {!loading ? <Text style={styles.onlineHint}>Butuh internet sekali. Setelah aktif, offline 100%.</Text> : null}

        <Pressable
          onPress={() => {
            const msg = encodeURIComponent(`Halo admin Kasir Kita, saya mau aktivasi.\nDevice ID: ${deviceCode}\nKode: ${license.trim() || '(belum isi)'}\nEmail: ${email.trim()||'-'}`)
            Linking.openURL(`https://wa.me/${VENDOR_WA}?text=${msg}`)
          }}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          style={styles.waBtn}
        >
          <Text style={styles.waBtnText}>💬 Chat Admin via WhatsApp</Text>
        </Pressable>
        <Pressable onPress={() => inputRef.current?.focus()} style={styles.focusHelper}>
          <Text style={styles.focusHelperText}>Ketuk di sini kalau keyboard tidak muncul</Text>
        </Pressable>
      </Surface>
      <Text style={styles.footer}>1 lisensi = 1 HP. Sharing APK beda HP = ditolak.</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flexGrow:1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  brand: { fontSize: 34, fontWeight: '900', color: colors.greenDark, letterSpacing: 2 },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 18 },
  card: { width: '100%', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  deviceBox: { backgroundColor: colors.chipBg, borderRadius: 12, borderWidth: 1, borderColor: colors.green, alignItems: 'center', paddingVertical: 14 },
  deviceCode: { fontSize: 20, fontWeight: '900', color: colors.greenDark, letterSpacing: 3 },
  copyBtn: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10, alignSelf: 'center' },
  copyBtnTxt: { color: colors.greenDark, fontWeight: '800', fontSize: 12 },
  helpText: { fontSize: 12, color: colors.textMuted, marginTop: 8, lineHeight: 17 },
  waBtn: { backgroundColor: '#25D366', borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  waBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  hint: { fontSize: 11, color: '#AEBDCA', marginBottom: 6 },
  inputBox: { backgroundColor: colors.chipBg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 12, color: colors.text, fontSize: 16, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  inputError: { borderColor: colors.error },
  error: { color: colors.error, fontWeight: '600', marginTop: 8, fontSize:12 },
  msg: { fontSize:12, color: colors.error, marginTop:6 },
  msgOk: { color: colors.green },
  row: { flexDirection:'row', gap:8, alignItems:'center' },
  smallBtn: { backgroundColor: colors.green, borderRadius:10, paddingHorizontal:16, height:44, alignItems:'center', justifyContent:'center' },
  smallBtnTxt: { color:'#FFF', fontWeight:'800', fontSize:13 },
  foundBox: { marginTop:10, gap:8 },
  foundRow: { flexDirection:'row', alignItems:'center', backgroundColor: colors.chipBg, borderRadius:10, padding:10, borderWidth:1, borderColor: colors.green },
  foundCode: { flex:1, fontWeight:'900', color: colors.greenDark, letterSpacing:1.5, fontSize:13 },
  foundBadge: { fontSize:10, color: colors.textMuted, marginRight:8 },
  activateMini: { backgroundColor: colors.green, borderRadius:8, paddingHorizontal:10, paddingVertical:6 },
  activateMiniTxt: { color:'#FFF', fontWeight:'800', fontSize:11 },
  activateBtn: { backgroundColor: colors.green, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  activateBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 1.2 },
  onlineHint: { fontSize: 11, color: '#AEBDCA', textAlign: 'center', marginTop: 6 },
  divider: { height:1, backgroundColor: colors.border, marginVertical:14 },
  focusHelper: { alignItems: 'center', marginTop: 12 },
  focusHelperText: { fontSize: 11, color: '#C9BFA8' },
  footer: { marginTop: 14, fontSize: 11, color: colors.textMuted, textAlign:'center' },
})
