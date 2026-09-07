import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Linking, Pressable } from 'react-native'
import { Text, Surface, Button, List, TextInput } from 'react-native-paper'
import { colors } from '../theme/theme'
import { exportDailyReport } from '../utils/export'
import { createBackup, restoreFromSql } from '../utils/backup'
import { getSetting, setSetting } from '../utils/settings'

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

  const saveStore = () => {
    setSetting('storeName', storeName.trim())
    setEditingStore(false)
    setStatus('Nama toko disimpan')
    setTimeout(() => setStatus(''), 3000)
  }

  const saveLink = () => {
    setSetting('buyLink', buyLink.trim())
    setEditingLink(false)
    setStatus('Link pembelian disimpan')
    setTimeout(() => setStatus(''), 3000)
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
      const FileSystem = await import('expo-file-system')
      const content = await FileSystem.readAsStringAsync(res.assets[0].uri)
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
        <List.Item title="POS UMKM v1.3" description="Kasir offline untuk warung & kedai" />
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
