import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Linking, Pressable, Alert, Image } from 'react-native'
import { Text, Surface, Button, List, TextInput } from 'react-native-paper'
import { colors } from '../theme/theme'
import { exportDailyReport } from '../utils/export'
import { exportPeriodCsv, rangeToday, range7Days, rangeThisMonth, type ExportRange } from '../utils/export_period'
import DatePickerModal from '../components/DatePickerModal'
import { createBackup, restoreFromSql } from '../utils/backup'
import { getSetting, setSetting, getPaperSize, getPaperLabel, type PaperSize } from '../utils/settings'
import { getSavedPrinter, savePrinter, getSavedPrinterName, savePrinterName, listPairedPrinters, discoverPrinters, openSystemBluetoothSettings, ensureBluetoothOn, type BtDevice } from '../utils/bluetooth'
import PaperPickerModal from '../components/PaperPickerModal'

interface Props {
  dark: boolean
  onToggleTheme: () => void
}

export default function SettingsScreen({ dark, onToggleTheme }: Props) {
  const [status, setStatus] = useState<string>('')
  const [statusErr, setStatusErr] = useState(false)
  const showStatus = (msg: string, isErr = false) => { setStatus(msg); setStatusErr(isErr); setTimeout(() => { setStatus(''); setStatusErr(false) }, isErr ? 6000 : 3500) }
  const [storeName, setStoreName] = useState(() => getSetting('storeName', ''))
  const [kasirName, setKasirName] = useState(() => getSetting('kasirName', ''))
  const [buyLink, setBuyLink] = useState(() => getSetting('buyLink', 'https://lynk.id/chuckie99'))
  const [editingStore, setEditingStore] = useState(false)
  const [editingKasir, setEditingKasir] = useState(false)
  const [editingLink, setEditingLink] = useState(false)
  const [paperSize, setPaperSize] = useState<PaperSize>(() => getPaperSize())
  const [showPaperPicker, setShowPaperPicker] = useState(false)
  const [logoUri, setLogoUri] = useState(() => getSetting('storeLogoUri', ''))
  const [btAddr, setBtAddr] = useState(() => getSavedPrinter() || '')
  const [btName, setBtName] = useState(() => getSavedPrinterName() || '')
  const [editingBt, setEditingBt] = useState(false)
  const [paired, setPaired] = useState<BtDevice[]>([])
  const [discovered, setDiscovered] = useState<BtDevice[]>([])
  const [scanning, setScanning] = useState(false)
  // Laporan periode — CSV (anti-FC, tanpa xlsx)
  const _initR = rangeThisMonth()
  const [rangeFrom, setRangeFrom] = useState(_initR.from)
  const [rangeTo, setRangeTo] = useState(_initR.to)
  const [period, setPeriod] = useState<'today'|'7days'|'month'|'custom'>('month')
  const [showFromCal, setShowFromCal] = useState(false)
  const [showToCal, setShowToCal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fromErr, setFromErr] = useState('')
  const [toErr, setToErr] = useState('')
  const applyPeriod = (p: 'today'|'7days'|'month'|'custom') => {
    setPeriod(p)
    if (p==='today') { const r=rangeToday(); setRangeFrom(r.from); setRangeTo(r.to) }
    else if (p==='7days') { const r=range7Days(); setRangeFrom(r.from); setRangeTo(r.to) }
    else if (p==='month') { const r=rangeThisMonth(); setRangeFrom(r.from); setRangeTo(r.to) }
  }
  const fmtDate = (iso: string) => { try { const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) } catch { return iso } }
  const isValidISO = (s:string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s+'T00:00:00').getTime())
  const onChangeFrom = (v:string) => { setRangeFrom(v); if(isValidISO(v)){ setFromErr(''); setPeriod('custom')} else if(v) setFromErr('Format YYYY-MM-DD')}
  const onChangeTo = (v:string) => { setRangeTo(v); if(isValidISO(v)){ setToErr(''); setPeriod('custom')} else if(v) setToErr('Format YYYY-MM-DD')}

  const saveStore = () => {
    setSetting('storeName', storeName.trim())
    setEditingStore(false)
    setStatus('Nama toko disimpan — akan muncul di struk')
    setTimeout(() => setStatus(''), 3000)
  }

  const saveKasir = () => {
    setSetting('kasirName', kasirName.trim())
    setEditingKasir(false)
    setStatus(kasirName.trim() ? `Nama kasir disimpan: ${kasirName.trim()} — akan muncul di struk` : 'Nama kasir dikosongkan')
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

      <Surface style={[styles.card, { marginTop: 8 }]} elevation={0}>
        {!editingKasir ? (
          <List.Item
            title={getSetting('kasirName', '') || 'Atur nama kasir'}
            description="Nama kasir tampil di struk (di bawah jam). Kosongkan kalau gak perlu"
            left={(p) => <List.Icon {...p} icon="account-tie" color={colors.green} />}
            right={(p) => <List.Icon {...p} icon="pencil" color={colors.textMuted} />}
            onPress={() => setEditingKasir(true)}
          />
        ) : (
          <View style={{ padding: 14, gap: 10 }}>
            <TextInput value={kasirName} onChangeText={setKasirName} placeholder="contoh: Sopian / Kasir 1"
              style={{ backgroundColor: colors.surface }} dense autoFocus />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="contained" onPress={saveKasir} compact>Simpan</Button>
              <Button mode="text" onPress={() => setEditingKasir(false)} textColor={colors.textMuted} compact>Batal</Button>
            </View>
          </View>
        )}
      </Surface>

      <Text style={styles.section}>Logo Struk (Upload PNG)</Text>
      <Surface style={styles.card} elevation={0}>
        <View style={{ padding: 14, gap: 12 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>Logo akan muncul di atas struk thermal & label. Upload PNG transparan 512x512 ideal.</Text>
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
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Tap kotak untuk pilih. Xprinter A6 = pilih A6 — 105×148. Mau ukuran bebas → Custom W×H. PDF & Bluetooth ikut.</Text>
          <Pressable onPress={() => setShowPaperPicker(true)} style={[styles.dateInputBox, { borderColor: colors.green }]}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>{getPaperLabel(paperSize as PaperSize)}</Text>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>▾</Text>
          </Pressable>
          <Text style={{ fontSize: 10, color: colors.textMuted }}>Aktif: {getPaperLabel(paperSize as PaperSize)} — pilih lagi untuk ganti • Custom = bebas 30-210×30-297 mm</Text>
        </View>
      </Surface>
      <PaperPickerModal visible={showPaperPicker} value={paperSize as PaperSize} onSelect={(v)=>{ setPaperSize(v); setSetting('paperSize', v); setStatus(`Kertas: ${getPaperLabel(v as PaperSize)} — PDF & cetak akan pakai ini`); setTimeout(()=>setStatus(''),3500) }} onClose={()=>setShowPaperPicker(false)} />

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

      <Text style={styles.section}>Printer Bluetooth (Classic SPP — pair dulu, bukan BLE)</Text>
      <Surface style={styles.card} elevation={0}>
        <View style={{ padding: 14, gap: 10 }}>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Classic SPP (RPP02N/ZJ-5802/58mm). 1) Nyalakan Bluetooth HP  2) Pair di Bluetooth HP PIN 0000/1234  3) Tap Scan 12 detik di sini → pilih → Simpan → Test Print. Tanpa Pair tidak akan muncul.</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: btAddr ? colors.greenDark : colors.textMuted }}>{btAddr ? `✓ Tersimpan: ${btName || 'Printer'} • ${btAddr}` : 'Belum ada printer tersimpan — Scan dulu atau isi manual'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button mode="contained" icon="bluetooth-search" loading={scanning} disabled={scanning} onPress={async()=>{
              setScanning(true); setPaired([]); setDiscovered([]); showStatus('Scan 12 detik: cari paired + nearby...', false);
              try{
                const on = await ensureBluetoothOn(); if(!on){ showStatus('Bluetooth HP mati. Nyalakan Bluetooth dulu.', true); return }
                const r = await discoverPrinters(12000);
                setPaired(r.bonded); setDiscovered(r.discovered);
                if(!r.bonded.length && !r.discovered.length){
                  showStatus(r.error || 'Tidak ada printer ditemukan. Pastikan: 1) Printer nyala 2) Sudah Pair PIN 0000 di Bluetooth HP 3) Jarak <10m 4) Izin Bluetooth diizinkan.', true)
                } else {
                  const msg = `Ketemu ${r.bonded.length} paired + ${r.discovered.length} nearby. Tap nama untuk simpan.` + (r.error ? ` Note: ${r.error}` : '')
                  showStatus(msg, false)
                }
              } catch(e:any){ showStatus('Gagal scan: '+(e?.message||String(e)), true) } finally{ setScanning(false) }
            }} compact>Scan Bluetooth (12s) 🔍</Button>
            <Button mode="outlined" icon="cog" onPress={async()=>{ await openSystemBluetoothSettings(); showStatus('Buka Bluetooth HP — Pair RPP02N PIN 0000 lalu balik → Scan lagi') }} compact>Buka Bluetooth HP</Button>
          </View>
          {paired.length ? <View style={{ gap: 6, marginTop: 4 }}><Text style={{ fontSize:11, fontWeight:'800', color:colors.textMuted }}>Paired (tersimpan di HP) — tap untuk pakai:</Text>{paired.map(d=>{ const active=d.id===btAddr; return (<Pressable key={'p-'+d.id} onPress={()=>{ savePrinter(d.id); savePrinterName(d.name||''); setBtAddr(d.id); setBtName(d.name||''); showStatus(`Disimpan: ${d.name||d.id} ✓ — coba Test Print di bawah`)}} style={{ padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: active ? colors.green : colors.border, backgroundColor: active ? '#EAF4E8' : colors.surface }}><Text style={{ fontWeight:'800', color: colors.text }}>{d.name || 'Printer tanpa nama'} • {d.id} {active ? '✓ aktif' : ''}</Text><Text style={{ fontSize:10, color:colors.textMuted }}>Bonded • Classic SPP</Text></Pressable>)})}</View> : null}
          {discovered.length ? <View style={{ gap: 6, marginTop: 4 }}><Text style={{ fontSize:11, fontWeight:'800', color:colors.textMuted }}>Nearby (belum paired) — Pair dulu baru bisa cetak:</Text>{discovered.map(d=>(<Pressable key={'d-'+d.id} onPress={async()=>{ Alert.alert('Belum Paired', `${d.name||'Printer'} • ${d.id}\n\nPrinter ini belum Paired. Buka Bluetooth HP → Pair PIN 0000 dulu, lalu Scan lagi. Mau buka Bluetooth sekarang?`, [{text:'Buka Bluetooth', onPress:()=>openSystemBluetoothSettings()}, {text:'Tutup', style:'cancel'}]) }} style={{ padding: 10, borderRadius: 10, borderWidth: 1.2, borderColor: colors.border, backgroundColor: colors.bg }}><Text style={{ fontWeight:'800', color: colors.text }}>{d.name || 'Perangkat Bluetooth'} • {d.id}</Text><Text style={{ fontSize:10, color:colors.textMuted }}>Nearby • tap untuk petunjuk pairing</Text></Pressable>))}</View> : null}
          {btAddr ? <View style={{ flexDirection:'row', gap:8, marginTop:6, flexWrap:'wrap' }}>
            <Button mode="contained" icon="printer-check" onPress={async()=>{
              try{
                showStatus('Test konek ke '+btAddr+'...', false)
                const { printViaBluetooth } = await import('../utils/bluetooth')
                const { buildReceiptText } = await import('../utils/receipt')
                // buat struk dummy kalau belum ada transaksi
                let txt = 'TEST PRINT — KASIR KITA\nPrinter: '+(btName||btAddr)+'\nWaktu: '+new Date().toLocaleString('id-ID')+'\n'+'-'.repeat(32)+'\nJika ini tercetak, printer SIAP.\n'
                try{
                  const db = require('../db/database').getDb()
                  const row = db.getFirstSync('SELECT id FROM transactions ORDER BY id DESC LIMIT 1') as any
                  if(row?.id) txt = buildReceiptText(row.id)
                }catch{}
                const r = await printViaBluetooth(txt)
                if(r==='printed') showStatus('✓ Test print BERHASIL — printer siap pakai!', false)
                else if(r==='no_printer') showStatus('Belum ada printer tersimpan.', true)
                else showStatus('Dikirim sebagai share/PDF fallback — coba lagi atau cek kertas.', true)
              }catch(e:any){ showStatus('Test gagal: '+(e?.message||String(e)), true) }
            }} compact>Test Print</Button>
            <Button mode="outlined" icon="delete" onPress={()=>{ savePrinter(''); savePrinterName(''); setBtAddr(''); setBtName(''); setPaired([]); setDiscovered([]); showStatus('Printer dihapus — fallback ke PDF') }} compact>Hapus Printer</Button>
          </View> : null}
          {!editingBt ? (
            <Pressable onPress={()=>setEditingBt(true)} style={{ padding: 8 }}><Text style={{ fontSize: 12, color: colors.textMuted, textAlign:'center' }}>Atau isi manual MAC → tap disini</Text></Pressable>
          ) : (
            <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
              <TextInput value={btName} onChangeText={setBtName} placeholder="Nama (RPP02N)" style={{ backgroundColor: colors.surface }} dense />
              <TextInput value={btAddr} onChangeText={setBtAddr} placeholder="66:12:11:22:33:44" style={{ backgroundColor: colors.surface }} dense autoCapitalize="none" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button mode="contained" onPress={() => { if(!btAddr.trim()){ showStatus('Isi MAC dulu', true); return } savePrinter(btAddr); savePrinterName(btName); setEditingBt(false); showStatus(btAddr ? `Disimpan manual: ${btName || btAddr} — Test Print untuk cek konek` : 'Printer dihapus');}} compact>Simpan Manual</Button>
                <Button mode="text" onPress={() => { setBtAddr(getSavedPrinter()||''); setBtName(getSavedPrinterName()||''); setEditingBt(false)}} textColor={colors.textMuted} compact>Batal</Button>
              </View>
            </View>
          )}
        </View>
      </Surface>

      <Text style={styles.section}>Laporan & Ekspor (CSV Periode)</Text>
      <Surface style={styles.card} elevation={0}>
        <View style={{ padding: 14, gap: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>Periode</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {(['today','7days','month','custom'] as const).map(k => {
              const label = k==='today' ? 'Hari ini' : k==='7days' ? '7 Hari' : k==='month' ? 'Bulan ini' : 'Custom'
              const active = period===k
              return (
                <Pressable key={k} onPress={() => applyPeriod(k)} style={[styles.paperChip, active && styles.paperChipActive]}>
                  <Text style={[styles.paperChipLabel, active && styles.paperChipLabelActive]}>{label}</Text>
                </Pressable>
              )
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.dateLabel}>DARI — {fmtDate(rangeFrom)}</Text>
              <Pressable onPress={()=>setShowFromCal(true)} style={[styles.dateInputBox]}>
                <Text style={styles.dateVal}>{rangeFrom}  📅</Text>
              </Pressable>
              <TextInput value={rangeFrom} onChangeText={onChangeFrom} placeholder="YYYY-MM-DD" style={{ backgroundColor: colors.surface, fontSize: 12 }} dense autoCapitalize="none" />
              {!!fromErr ? <Text style={{ fontSize: 10, color: colors.error }}>{fromErr}</Text> : null}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.dateLabel}>SAMPAI — {fmtDate(rangeTo)}</Text>
              <Pressable onPress={()=>setShowToCal(true)} style={[styles.dateInputBox]}>
                <Text style={styles.dateVal}>{rangeTo}  📅</Text>
              </Pressable>
              <TextInput value={rangeTo} onChangeText={onChangeTo} placeholder="YYYY-MM-DD" style={{ backgroundColor: colors.surface, fontSize: 12 }} dense autoCapitalize="none" />
              {!!toErr ? <Text style={{ fontSize: 10, color: colors.error }}>{toErr}</Text> : null}
            </View>
          </View>
          <DatePickerModal visible={showFromCal} value={rangeFrom} onSelect={(iso)=>{ setRangeFrom(iso); setFromErr(''); setPeriod('custom') }} onClose={()=>setShowFromCal(false)} />
          <DatePickerModal visible={showToCal} value={rangeTo} onSelect={(iso)=>{ setRangeTo(iso); setToErr(''); setPeriod('custom') }} onClose={()=>setShowToCal(false)} />
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Tap kotak tanggal untuk kalender. File CSV bisa dibuka langsung di Excel. Ringkasan + Detail (exclude void).</Text>
          <Button mode="contained" icon="file-delimited" loading={exporting} disabled={exporting} onPress={async()=>{
            try{ setExporting(true); setStatus('Membuat CSV...'); const r=await exportPeriodCsv({from: rangeFrom, to: rangeTo}); setStatus(r==='shared'?'CSV dibuat — pilih WA/Drive/Email':'Share tidak tersedia') } catch(e:any){ setStatus('Gagal CSV: '+(e?.message||String(e)))} finally{ setExporting(false); setTimeout(()=>setStatus(''),4000)}
          }}>Export CSV Periode</Button>
          <Text style={{ fontSize: 10, color: colors.textMuted, textAlign:'center' }}>laporan-kasir-kita-{rangeFrom}-{rangeTo}.csv</Text>
        </View>
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
        <List.Item title="Kasir Kita v1.1.6" description="Kasbon agregat + Supplier hutang + Laba Rugi + BT + 9 kertas — offline" />
        <List.Item title="SOP Ganti HP" description="WA Device ID baru — 1x reset gratis. Chat WA di Lynk." />
        <List.Item title="Direct Bluetooth" description="Set alamat MAC di atas → Cetak Bluetooth langsung (fallback PDF jika belum paired)" />
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
  paperChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  paperChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  paperChipLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  paperChipLabelActive: { color: '#FFF' },
  themeSwitch: { width: 52, height: 30, borderRadius: 15, backgroundColor: '#D8D2C2', padding: 3, justifyContent: 'center' },
  themeSwitchOn: { backgroundColor: colors.green },
  themeKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  themeKnobOn: { alignSelf: 'flex-end' },
  dateInputBox: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D6E0E8', borderRadius: 10, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateLabel: { fontSize: 10, fontWeight: '800', color: '#5A758F', letterSpacing: 0.4 },
  dateVal: { fontSize: 13, fontWeight: '700', color: '#2E3A47' },
})
