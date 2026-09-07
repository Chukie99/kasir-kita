import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Linking, Pressable, Alert, Image } from 'react-native'
import { Text, Surface, Button, List, TextInput, SegmentedButtons } from 'react-native-paper'
import { colors } from '../theme/theme'
import { exportDailyReport } from '../utils/export'
import { createBackup, restoreFromSql } from '../utils/backup'
import { getSetting, setSetting, getPaperSize, type PaperSize } from '../utils/settings'

interface Props {
  dark: boolean
  onToggleTheme: () => void
}

export default function SettingsScreen({ dark, onToggleTheme }: Props) {
  const [status, setStatus] = useState<string>('')
  const [storeName, setStoreName] = useState(() => getSetting('storeName', ''))
  const [buyLink, setBuyLink] = useState(() => getSetting('buyLink', 'https://lynk.id/chuckie99'))
  const [editingStore, setEditingStore] = useState(false)
  const [editingLink, setEditingLink] = useState(false)
  const [paperSize, setPaperSize] = useState<PaperSize>(() => getPaperSize())
  const [logoUri, setLogoUri] = useState(() => getSetting('storeLogoUri', ''))

  const saveStore = () => {
    setSetting('storeName', storeName.trim())
    setEditingStore(false)
    setStatus('Nama toko disimpan — akan muncul di struk')
    setTimeout(() => setStatus(''), 3000)
  }

  const saveLink = () => {
    setSetting('buyLink', buyLink.trim())
    setEditingLink(false)
    setStatus('Link pembelian disimpan')
    setTimeout(() => setStatus(''), 3000)
  }

  const onPickLogo = async () => {
    try {
      const ImagePicker = await import('expo-image-picker')
      const { File, Directory, Paths } = await import('expo-file-system')
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Izin dibutuhkan', 'Berikan izin galeri untuk pilih logo.')
        return
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
      })
      if (res.canceled || !res.assets?.[0]) return
      const asset = res.assets[0]
      const dir = new Directory(Paths.document, 'pos_images')
      if (!dir.exists) dir.create()
      const dest = new File(dir, 'store_logo.png')
      if (dest.exists) dest.delete()
      const src = new File(asset.uri)
      src.copy(dest)
      setSetting('storeLogoUri', dest.uri)
      setLogoUri(dest.uri)
      setStatus('Logo disimpan — akan muncul di struk thermal & PDF')
      setTimeout(() => setStatus(''), 3000)
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : String(e))
    }
  }

  const onRemoveLogo = () => {
    setSetting('storeLogoUri', '')
    setLogoUri('')
    setStatus('Logo dihapus')
    setTimeout(() => setStatus(''), 2000)
  }

  const onPaperSizeChange = (v: string) => {
    const nv = v as PaperSize
    setPaperSize(nv)
    setSetting('paperSize', nv)
    setStatus(`Ukuran kertas: ${nv} — thermal 58mm kecil, 80mm sedang, A4 untuk PDF/email`)
    setTimeout(() => setStatus(''), 3500)
  }

  const doExport = async () => {
    try {
      setStatus('Membuat file laporan...')
      const r = await exportDailyReport()
      setStatus(r === 'shared' ? 'Laporan dibuat — pilih aplikasi tujuan (WA/Email)' : 'Share sheet tidak tersedia')
    } catch (e) {
      setStatus('Gagal: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const doBackup = async () => {
    try {
      setStatus('Membuat backup database...')
      const r = await createBackup()
      setSetting('lastBackupAt', new Date().toISOString())
      setStatus(r === 'shared' ? 'Backup dibuat — simpan ke Google Drive/WA sendiri' : 'Share tidak tersedia')
    } catch (e) {
      setStatus('Gagal backup: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const doRestore = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker')
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
      if (res.canceled) return
      const { File } = await import('expo-file-system')
      const file = new File(res.assets[0].uri)
      const content = file.textSync()
      setStatus('Memulihkan data...')
      setTimeout(() => {
        const r = restoreFromSql(content)
        setStatus(r.ok ? r.message : r.message)
      }, 50)
    } catch (e) {
      setStatus('Gagal restore: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 110 }}>
      <Text style={styles.section}>Toko</Text>
      <Surface style={styles.card} elevation={0}>
        {!editingStore ? (
          <List.Item
            title={getSetting('storeName', '') || 'Atur nama toko'}
            description="Nama tampil di header aplikasi & struk"
            left={(p) => <List.Icon {...p} icon="store" color={colors.green} />}
            right={(p) => <List.Icon {...p} icon="pencil" color={colors.textMuted} />}
            onPress={() => setEditingStore(true)}
          />
        ) : (
          <View style={{ padding: 14, gap: 10 }}>
            <TextInput value={storeName} onChangeText={setStoreName} placeholder="contoh: Warung Bu Sari"
              style={{ backgroundColor: colors.surface }} dense autoFocus />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="contained" onPress={saveStore} compact>Simpan</Button>
              <Button mode="text" onPress={() => setEditingStore(false)} textColor={colors.textMuted} compact>Batal</Button>
            </View>
          </View>
        )}
      </Surface>

      <Text style={styles.section}>Logo Struk (Upload PNG)</Text>
      <Surface style={styles.card} elevation={0}>
        <View style={{ padding: 14, gap: 12 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Logo akan muncul di atas struk thermal 58mm/80mm & PDF A4. Upload PNG transparan 512x512 ideal.</Text>
          {logoUri ? (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Image source={{ uri: logoUri }} style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }} resizeMode="contain" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button mode="contained" onPress={onPickLogo} compact>Ganti Logo</Button>
                <Button mode="text" onPress={onRemoveLogo} textColor={colors.error} compact>Hapus</Button>
              </View>
            </View>
          ) : (
            <Button mode="contained" icon="image-plus" onPress={onPickLogo}>Pilih Logo dari Galeri</Button>
          )}
        </View>
      </Surface>

      <Text style={styles.section}>Ukuran Kertas Struk</Text>
      <Surface style={styles.card} elevation={0}>
        <View style={{ padding: 14, gap: 10 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Thermal kecil (58mm) untuk printer bluetooth mini. 80mm lebih lega. A4 untuk PDF/email — gede & rapi.</Text>
          <SegmentedButtons
            value={paperSize}
            onValueChange={onPaperSizeChange}
            buttons={[
              { value: '58mm', label: '58mm' },
              { value: '80mm', label: '80mm' },
              { value: 'A4', label: 'A4 PDF' },
            ]}
            density="small"
          />
          <Text style={{ fontSize: 11, color: colors.greenDark, fontWeight: '700' }}>Aktif: {paperSize} — {paperSize === '58mm' ? 'Thermal mini (paling umum)' : paperSize === '80mm' ? 'Thermal lebar' : 'PDF A4 untuk email/WA'}</Text>
        </View>
      </Surface>

      <Text style={styles.section}>Tema</Text>
      <Surface style={styles.card} elevation={0}>
        <List.Item
          title="Mode Gelap / Terang"
          description={dark ? 'Sedang aktif: Gelap' : 'Sedang aktif: Terang'}
          left={(p) => <List.Icon {...p} icon={dark ? 'weather-night' : 'white-balance-sunny'} color={colors.green} />}
          right={() => (
            <Pressable onPress={onToggleTheme} style={[styles.themeSwitch, dark && styles.themeSwitchOn]} hitSlop={6}>
              <View style={[styles.themeKnob, dark && styles.themeKnobOn]} />
            </Pressable>
          )}
          onPress={onToggleTheme}
        />
      </Surface>

      <Text style={styles.section}>Data & Backup</Text>
      <Surface style={styles.card} elevation={0}>
        <List.Item
          title="Export Laporan Hari Ini"
          description="File Excel/CSV — kirim ke WA atau email"
          left={(p) => <List.Icon {...p} icon="file-excel" color={colors.green} />}
          onPress={doExport}
        />
        <List.Item
          title="Backup Semua Data"
          description="Simpan file backup — lakukan mingguan!"
          left={(p) => <List.Icon {...p} icon="database-export" color={colors.blue} />}
          onPress={doBackup}
        />
        <List.Item
          title="Pulihkan dari Backup"
          description="Pilih file .sql backup sebelumnya. Data saat ini akan ditimpa!"
          left={(p) => <List.Icon {...p} icon="database-import" color="#F5A623" />}
          onPress={doRestore}
        />
      </Surface>

      <Text style={styles.section}>Info Aplikasi</Text>
      <Surface style={styles.card} elevation={0}>
        {!editingLink ? (
          <List.Item
            title="Beli / Perpanjang Lisensi"
            description={getSetting('buyLink', '') || 'Belum diatur'}
            left={(p) => <List.Icon {...p} icon="cart" color={colors.green} />}
            right={(p) => (
              <Pressable hitSlop={8} onPress={() => setEditingLink(true)} style={{ justifyContent: 'center' }}>
                <List.Icon {...p} icon="pencil" color={colors.textMuted} />
              </Pressable>
            )}
            onPress={() => {
              const link = getSetting('buyLink', '')
              if (link) Linking.openURL(link).catch(() => {})
            }}
          />
        ) : (
          <View style={{ padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>Link toko / halaman pembelian (Lynk.id, WhatsApp, dll)</Text>
            <TextInput value={buyLink} onChangeText={setBuyLink} placeholder="https://lynk.id/namatoko"
              style={{ backgroundColor: colors.surface }} dense autoCapitalize="none" keyboardType="url" autoFocus />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="contained" onPress={saveLink} compact>Simpan</Button>
              <Button mode="text" onPress={() => setEditingLink(false)} textColor={colors.textMuted} compact>Batal</Button>
            </View>
          </View>
        )}
        <List.Item title="POS UMKM v1.4.2" description="Kasir offline untuk warung & kedai — thermal 58mm/80mm + A4 PDF" />
        <List.Item title="100% Offline" description="Data tersimpan di HP Anda, tanpa server" />
      </Surface>

      {status ? (
        <Surface style={styles.statusBox} elevation={0}>
          <Text style={styles.statusText}>{status}</Text>
        </Surface>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, margin: 14, marginBottom: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginHorizontal: 14 },
  statusBox: { margin: 14, backgroundColor: colors.chipBg, borderRadius: 10, padding: 12 },
  statusText: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  themeSwitch: {
    width: 52, height: 30, borderRadius: 15,
    backgroundColor: '#D8D2C2', padding: 3, justifyContent: 'center',
  },
  themeSwitchOn: { backgroundColor: colors.green },
  themeKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  themeKnobOn: { alignSelf: 'flex-end' },
})
