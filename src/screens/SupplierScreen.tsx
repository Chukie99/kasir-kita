import React from 'react'
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native'
import { Text as RNText } from 'react-native'
import { Text, Surface, Button, TextInput, Modal, SegmentedButtons } from 'react-native-paper'
import { colors } from '../theme/theme'
import { getDb } from '../db/database'
import { addPurchase, payPurchase, purchaseSummary, labaRugi } from '../utils/purchases'

export default function SupplierScreen() {
  const [refresh, setRefresh] = React.useState(0)
  const [period, setPeriod] = React.useState<'today'|'week'|'month'>('month')
  const [showAdd, setShowAdd] = React.useState(false)
  const [supName, setSupName] = React.useState('')
  const [note, setNote] = React.useState('')
  const [paidStr, setPaidStr] = React.useState('')
  const [items, setItems] = React.useState<{ name: string; qty: string; cost: string }[]>([{ name: '', qty: '1', cost: '' }])
  const [payFor, setPayFor] = React.useState<any | null>(null)
  const [payAmt, setPayAmt] = React.useState('')

  const summary = React.useMemo(() => { try { return purchaseSummary() } catch { return { count: 0, total: 0, paid: 0, sisa: 0 } } }, [refresh])
  const labarugi = React.useMemo(() => { try { return labaRugi(period) } catch { return { omzet: 0, hpp: 0, laba: 0, kulakan: 0 } } }, [period, refresh])

  const purchases = React.useMemo(() => {
    try {
      return getDb().getAllSync<any>(`SELECT p.*, GROUP_CONCAT(pi.qty || 'x ' || pi.name || ' @' || pi.cost, ', ') AS items FROM purchases p LEFT JOIN purchase_items pi ON pi.purchase_id=p.id GROUP BY p.id ORDER BY p.id DESC LIMIT 50`)
    } catch { return [] }
  }, [refresh])

  const addItemRow = () => setItems(prev => [...prev, { name: '', qty: '1', cost: '' }])
  const updateItem = (idx: number, field: 'name'|'qty'|'cost', v: string) => setItems(prev => prev.map((it, i) => i===idx ? { ...it, [field]: v } : it))
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const total = items.reduce((s, it) => s + (parseInt(it.qty.replace(/\D/g,'')||'0',10) * parseInt(it.cost.replace(/\D/g,'')||'0',10)), 0)

  const doAdd = () => {
    const cleanItems = items.filter(it => it.name.trim() && parseInt(it.qty.replace(/\D/g,'')||'0',10) > 0 && parseInt(it.cost.replace(/\D/g,'')||'0',10) >= 0).map(it => ({ name: it.name.trim(), qty: parseInt(it.qty.replace(/\D/g,'')||'0',10), cost: parseInt(it.cost.replace(/\D/g,'')||'0',10) }))
    if (cleanItems.length === 0) { Alert.alert('Item kosong', 'Isi minimal 1 item dengan nama & qty'); return }
    const paid = parseInt(paidStr.replace(/\D/g,'')||'0',10)
    try {
      addPurchase(supName.trim() || 'Umum', cleanItems, paid, note.trim())
      setSupName(''); setNote(''); setPaidStr(''); setItems([{ name: '', qty: '1', cost: '' }]); setShowAdd(false); setRefresh(k=>k+1)
    } catch (e:any) { Alert.alert('Gagal', String(e?.message||e)) }
  }

  const doPay = () => {
    if (!payFor) return
    const v = parseInt(payAmt.replace(/\D/g,'')||'0',10)
    if (v<=0) { Alert.alert('Nominal salah'); return }
    try { payPurchase(payFor.id, v); setPayFor(null); setPayAmt(''); setRefresh(k=>k+1) } catch(e:any){ Alert.alert('Gagal', String(e?.message||e)) }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Surface style={[styles.card, { flex: 1 }]} elevation={0}><Text style={styles.cardLabel}>Sisa Hutang</Text><Text style={styles.cardValBad}>Rp {summary.sisa.toLocaleString('id-ID')}</Text><RNText style={styles.cardSub}>{summary.count} nota • Total Rp {summary.total.toLocaleString('id-ID')}</RNText></Surface>
          <Surface style={[styles.card, { flex: 1 }]} elevation={0}><Text style={styles.cardLabel}>Laba Kotor ({period})</Text><Text style={[styles.cardVal, labarugi.laba < 0 && { color: '#B91C1C' }]}>Rp {labarugi.laba.toLocaleString('id-ID')}</Text><RNText style={styles.cardSub}>Omzet Rp {labarugi.omzet.toLocaleString('id-ID')} • HPP Rp {labarugi.hpp.toLocaleString('id-ID')}</RNText></Surface>
        </View>
        <SegmentedButtons value={period} onValueChange={v=>setPeriod(v as any)} buttons={[{value:'today',label:'Hari'},{value:'week',label:'Minggu'},{value:'month',label:'Bulan'}]} />
        <Surface style={styles.card} elevation={0}>
          <Text style={styles.sectionTitle}>Ringkasan Kulakan vs Jual</Text>
          <View style={styles.row}><RNText style={styles.k}>Omzet jual</RNText><RNText style={styles.v}>Rp {labarugi.omzet.toLocaleString('id-ID')}</RNText></View>
          <View style={styles.row}><RNText style={styles.k}>HPP (qty × modal)</RNText><RNText style={styles.v}>Rp {labarugi.hpp.toLocaleString('id-ID')}</RNText></View>
          <View style={styles.row}><RNText style={styles.k}>Kulakan ({period})</RNText><RNText style={styles.v}>Rp {labarugi.kulakan.toLocaleString('id-ID')}</RNText></View>
          <View style={[styles.row, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 }]}><RNText style={[styles.k, { fontWeight:'900' }]}>Laba Kotor</RNText><RNText style={[styles.v, { fontWeight:'900', color: labarugi.laba < 0 ? '#B91C1C' : colors.greenDark }]}>Rp {labarugi.laba.toLocaleString('id-ID')}</RNText></View>
          <RNText style={styles.help}>HPP dihitung dari modal produk × qty terjual (isi modal di Kelola Produk). Kulakan = total nota kulakan periode.</RNText>
        </Surface>
        <Button mode="contained" icon="plus" onPress={() => setShowAdd(true)}>Tambah Kulakan / Hutang Supplier</Button>
        <Text style={styles.sectionTitle}>Riwayat Kulakan (50 terbaru)</Text>
        {purchases.length === 0 ? <Surface style={styles.empty} elevation={0}><Text style={styles.emptyTxt}>Belum ada kulakan.</Text></Surface> : purchases.map((p:any) => {
          const sisa = p.total - (p.paid ?? 0)
          return (
            <Surface key={p.id} style={styles.card} elevation={0}>
              <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={styles.inv}>#{p.id} {p.supplier_name}</Text>
                <View style={[styles.badge, sisa===0 ? styles.badgePaid : styles.badgeDebt]}><RNText style={styles.badgeTxt}>{sisa===0 ? 'Lunas' : `Hutang Rp ${sisa.toLocaleString('id-ID')}`}</RNText></View>
              </View>
              <RNText style={styles.items} numberOfLines={2}>{p.items || ''}</RNText>
              <RNText style={styles.meta}>{p.created_at.slice(0,16)}{p.note ? ` • ${p.note}` : ''}</RNText>
              <View style={styles.moneyRow}><RNText style={styles.money}>Total Rp {p.total.toLocaleString('id-ID')}</RNText><RNText style={styles.moneyMuted}>Bayar Rp {(p.paid ?? 0).toLocaleString('id-ID')}</RNText></View>
              {sisa > 0 ? <Button mode="outlined" compact onPress={() => { setPayFor(p); setPayAmt(String(sisa)) }} style={{ marginTop: 8 }}>Bayar Hutang</Button> : null}
            </Surface>
          )
        })}
      </ScrollView>

      <Modal visible={showAdd} onDismiss={() => setShowAdd(false)} contentContainerStyle={styles.modalWide}>
        <Text style={styles.modalTitle}>Kulakan Baru</Text>
        <TextInput value={supName} onChangeText={setSupName} placeholder="Nama supplier (contoh: Agen Sembako)" dense style={{ backgroundColor: colors.surface, marginTop: 8 }} />
        {items.map((it, idx) => (
          <View key={idx} style={{ flexDirection:'row', gap:6, marginTop:8, alignItems:'center' }}>
            <TextInput value={it.name} onChangeText={v=>updateItem(idx,'name',v)} placeholder="Nama barang" dense style={{ flex:2, backgroundColor: colors.surface }} />
            <TextInput value={it.qty} onChangeText={v=>updateItem(idx,'qty',v.replace(/\D/g,''))} keyboardType="number-pad" placeholder="Qty" dense style={{ flex:1, backgroundColor: colors.surface }} />
            <TextInput value={it.cost} onChangeText={v=>updateItem(idx,'cost',v.replace(/\D/g,''))} keyboardType="number-pad" placeholder="Modal" dense style={{ flex:1, backgroundColor: colors.surface }} left={<TextInput.Affix text="Rp" />} />
            <Pressable onPress={() => removeItem(idx)} hitSlop={8}><RNText style={{ color:'#B91C1C', fontWeight:'900' }}>×</RNText></Pressable>
          </View>
        ))}
        <Button mode="text" onPress={addItemRow} compact style={{ alignSelf:'flex-start', marginTop:6 }}>+ Tambah item</Button>
        <View style={{ backgroundColor: colors.chipBg, padding:10, borderRadius:10, marginTop:8 }}><RNText style={{ fontWeight:'900', color: colors.text }}>Total kulakan: Rp {total.toLocaleString('id-ID')}</RNText></View>
        <TextInput value={paidStr} onChangeText={v=>setPaidStr(v.replace(/\D/g,''))} keyboardType="number-pad" placeholder="Sudah bayar (0 = hutang penuh)" dense style={{ backgroundColor: colors.surface, marginTop:8 }} left={<TextInput.Affix text="Rp " />} />
        <TextInput value={note} onChangeText={setNote} placeholder="Catatan (jatuh tempo dll)" dense style={{ backgroundColor: colors.surface, marginTop:8 }} />
        <RNText style={styles.help}>Sisa hutang = Total − Sudah bayar. Bayar nanti via daftar kulakan.</RNText>
        <View style={{ flexDirection:'row', gap:10, marginTop:14 }}><Button mode="outlined" onPress={() => setShowAdd(false)} style={{ flex:1 }}>Batal</Button><Button mode="contained" onPress={doAdd} style={{ flex:1 }}>Simpan</Button></View>
      </Modal>

      <Modal visible={!!payFor} onDismiss={() => setPayFor(null)} contentContainerStyle={styles.modal}>
        <Text style={styles.modalTitle}>Bayar Hutang #{payFor?.id} {payFor?.supplier_name}</Text>
        <RNText style={styles.meta}>Sisa Rp {payFor ? (payFor.total - (payFor.paid ?? 0)).toLocaleString('id-ID') : '0'}</RNText>
        <TextInput value={payAmt} onChangeText={v=>setPayAmt(v.replace(/\D/g,''))} keyboardType="number-pad" dense style={{ backgroundColor: colors.surface, marginTop:10 }} left={<TextInput.Affix text="Rp " />} />
        <View style={{ flexDirection:'row', gap:10, marginTop:14 }}><Button mode="outlined" onPress={() => setPayFor(null)} style={{ flex:1 }}>Batal</Button><Button mode="contained" onPress={doPay} style={{ flex:1 }}>Konfirmasi</Button></View>
      </Modal>
    </View>
  )
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  cardLabel: { fontSize: 11, fontWeight:'700', color: colors.textMuted },
  cardVal: { fontSize: 16, fontWeight:'900', color: colors.greenDark, marginTop: 4 },
  cardValBad: { fontSize: 16, fontWeight:'900', color: '#B91C1C', marginTop: 4 },
  cardSub: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight:'900', color: colors.text, marginBottom: 4 },
  row: { flexDirection:'row', justifyContent:'space-between', paddingVertical:6 },
  k: { fontSize: 13, color: colors.textMuted },
  v: { fontSize: 13, fontWeight:'800', color: colors.text },
  help: { fontSize: 11, color: colors.textMuted, marginTop: 8, lineHeight: 14 },
  empty: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems:'center' },
  emptyTxt: { color: colors.textMuted, fontSize: 13 },
  inv: { fontSize: 13, fontWeight:'900', color: colors.text },
  items: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  moneyRow: { flexDirection:'row', justifyContent:'space-between', marginTop: 8 },
  money: { fontSize: 13, fontWeight:'900', color: colors.text },
  moneyMuted: { fontSize: 13, fontWeight:'700', color: colors.textMuted },
  badge: { paddingHorizontal:8, paddingVertical:3, borderRadius:8 },
  badgeDebt: { backgroundColor:'#F59E0B' },
  badgePaid: { backgroundColor:'#10B981' },
  badgeTxt: { color:'#FFF', fontWeight:'900', fontSize:11 },
  modal: { backgroundColor: colors.surface, margin: 20, borderRadius: 16, padding: 18 },
  modalWide: { backgroundColor: colors.surface, margin: 16, borderRadius: 16, padding: 18, maxHeight:'90%' },
  modalTitle: { fontSize: 16, fontWeight:'900', color: colors.text },
})
