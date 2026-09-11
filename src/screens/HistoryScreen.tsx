import React from 'react'
import { View, StyleSheet, ScrollView, Pressable, Alert, Linking } from 'react-native'
import { Text as RNText } from 'react-native'
import { Text, Surface, Modal, Button, TextInput } from 'react-native-paper'
import { colors } from '../theme/theme'
import { getDb } from '../db/database'
import { voidTransaction } from '../utils/pos'
import { payBon } from '../utils/kasbon'
import { buildReceiptText, printReceipt, shareReceiptPdf } from '../utils/receipt'
import { shareReceipt } from '../utils/export'
import { printViaBluetoothFallback } from '../utils/bluetooth'

type Period = 'today' | 'week' | 'month'
interface Row {
  id: number
  invoice: string
  total: number
  discount: number
  payment_method: string
  created_at: string
  items: string
  customer_name: string
  voided: number
  void_reason: string | null
  is_bon: number
  bon_paid: number
  bon_due_date: string | null
}
interface TxItem { product_name: string; qty: number; unit_price: number; modifiers_label: string; line_total: number }

const PERIOD_LABEL: Record<Period, string> = { today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini' }

function whereClause(period: Period): string {
  if (period === 'today') return "date(t.created_at) = date('now','localtime')"
  if (period === 'week') return "date(t.created_at) >= date('now','localtime','-6 days')"
  return "strftime('%Y-%m', t.created_at) = strftime('%Y-%m','now','localtime')"
}

export default function HistoryScreen() {
  const [period, setPeriod] = React.useState<Period>('today')
  const [search, setSearch] = React.useState('')
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [detail, setDetail] = React.useState<Row | null>(null)
  const [voidReason, setVoidReason] = React.useState('')
  const [showVoid, setShowVoid] = React.useState(false)
  const [bonPay, setBonPay] = React.useState('')
  const [showBonPay, setShowBonPay] = React.useState(false)

  const rowsAll = React.useMemo<Row[]>(() => {
    try {
      return getDb().getAllSync<Row>(
        `SELECT t.id, t.invoice, t.total, COALESCE(t.discount,0) AS discount, t.payment_method, t.created_at,
                GROUP_CONCAT(ti.qty || 'x ' || ti.product_name, char(10)) AS items,
                COALESCE(t.customer_name,'') AS customer_name,
                COALESCE(t.voided,0) AS voided, t.void_reason,
                COALESCE(t.is_bon,0) AS is_bon, COALESCE(t.bon_paid,0) AS bon_paid, t.bon_due_date
         FROM transactions t JOIN transaction_items ti ON ti.transaction_id = t.id
         WHERE ${whereClause(period)}
         GROUP BY t.id ORDER BY t.id DESC`
      )
    } catch { return [] }
  }, [period, refreshKey])

  const q = search.trim().toLowerCase()
  const rows = q
    ? rowsAll.filter((r) => r.invoice.toLowerCase().includes(q) || r.customer_name.toLowerCase().includes(q) || (r.items || '').toLowerCase().includes(q))
    : rowsAll

  const activeRows = rows.filter((r) => !r.voided)
  const voidCount = rows.filter((r) => r.voided).length
  const bonCount = activeRows.filter(r => r.is_bon && r.bon_paid < r.total).length
  const bonSisa = activeRows.filter(r => r.is_bon && r.bon_paid < r.total).reduce((s, r) => s + (r.total - r.bon_paid), 0)
  const revenue = activeRows.reduce((s, r) => s + r.total, 0)
  const discounts = activeRows.reduce((s, r) => s + (r.discount || 0), 0)
  const cash = activeRows.filter((r) => r.payment_method === 'cash').reduce((s, r) => s + r.total, 0)
  const qris = activeRows.filter((r) => r.payment_method === 'qris').reduce((s, r) => s + r.total, 0)

  const topProducts = React.useMemo(() => {
    try {
      return getDb().getAllSync<{ name: string; qty: number; sales: number }>(
        `SELECT ti.product_name AS name, SUM(ti.qty) AS qty, SUM(ti.line_total) AS sales
         FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id
         WHERE ${whereClause(period)} AND COALESCE(t.voided,0)=0
         GROUP BY ti.product_name ORDER BY qty DESC LIMIT 5`
      )
    } catch { return [] }
  }, [period, refreshKey])

  const detailItems: TxItem[] = React.useMemo(() => {
    if (!detail) return []
    try {
      return getDb().getAllSync<TxItem>('SELECT product_name, qty, unit_price, modifiers_label, line_total FROM transaction_items WHERE transaction_id = ?', [detail.id])
    } catch { return [] }
  }, [detail])

  const doVoid = () => {
    if (!detail) return
    voidTransaction(detail.id, voidReason.trim() || 'Koreksi qty / komplain')
    setShowVoid(false)
    setVoidReason('')
    setDetail(null)
    setRefreshKey((k) => k + 1)
  }
  const doBonPay = () => {
    if (!detail) return
    const v = parseInt(bonPay.replace(/\D/g,'')||'0',10)
    if (v <= 0) { Alert.alert('Nominal salah'); return }
    try { payBon(detail.id, v); setShowBonPay(false); setBonPay(''); setDetail(null); setRefreshKey(k => k+1) } catch(e:any){ Alert.alert('Gagal', String(e?.message||e)) }
  }
  const tagihWaDetail = () => {
    if (!detail) return
    const sisa = detail.total - (detail.bon_paid ?? 0)
    const msg = `Halo ${detail.customer_name || 'Kak'} — tagihan bon ${detail.invoice} sisa Rp ${sisa.toLocaleString('id-ID')} (total Rp ${detail.total.toLocaleString('id-ID')}). Jatuh tempo ${detail.bon_due_date || '-'} — mohon dilunasi 🙏\n` + buildReceiptText(detail.id)
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`).catch(()=>{})
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p: Period) => (
          <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.tab, period === p && styles.tabActive]} android_ripple={{ color: colors.chipBg, borderless: true }}>
            <RNText style={[styles.tabTxt, period === p && styles.tabTxtActive]}>{PERIOD_LABEL[p]}</RNText>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Cari: INV-..., nama, Teh Manis..." dense style={styles.searchInput} mode="outlined" />
        {q ? <RNText style={styles.searchMeta}>{rows.length} hasil {voidCount ? `• ${voidCount} void` : ''}</RNText> : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={styles.cards}>
          <StatCard label="Transaksi" value={String(activeRows.length)} />
          <StatCard label={`Omzet ${PERIOD_LABEL[period]}`} value={'Rp ' + revenue.toLocaleString('id-ID')} highlight />
        </View>
        <View style={styles.cards}>
          <StatCard label="Tunai" value={'Rp ' + cash.toLocaleString('id-ID')} />
          <StatCard label="QRIS" value={'Rp ' + qris.toLocaleString('id-ID')} />
        </View>
        {discounts > 0 ? (
          <Surface style={styles.discBanner} elevation={0}><Text style={styles.discTxt}>Total diskon: Rp {discounts.toLocaleString('id-ID')}</Text></Surface>
        ) : null}
        {voidCount > 0 ? (
          <Surface style={styles.voidBanner} elevation={0}><Text style={styles.voidTxt}>{voidCount} transaksi void (tidak kehitung omzet)</Text></Surface>
        ) : null}
        {bonCount > 0 ? (
          <Surface style={styles.bonBanner} elevation={0}><Text style={styles.bonTxt}>{bonCount} bon aktif • Sisa Rp {bonSisa.toLocaleString('id-ID')} — lihat tab Kasbon untuk Tagih WA</Text></Surface>
        ) : null}
        {topProducts.length > 0 ? (
          <Surface style={styles.topCard} elevation={0}>
            <Text style={styles.topTitle}>Produk Terlaris — {PERIOD_LABEL[period]}</Text>
            {topProducts.map((t, i) => (
              <View key={t.name} style={styles.topRow}>
                <RNText style={styles.topRank}>{i + 1}.</RNText>
                <RNText style={styles.topName} numberOfLines={1}>{t.name}</RNText>
                <RNText style={styles.topQty}>{t.qty}x</RNText>
                <RNText style={styles.topSales}>Rp {t.sales.toLocaleString('id-ID')}</RNText>
              </View>
            ))}
          </Surface>
        ) : null}
        <TransactionList rows={rows} onPress={setDetail} />
      </ScrollView>

      <Modal visible={!!detail} onDismiss={() => setDetail(null)} contentContainerStyle={styles.detailModal}>
        {detail ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailHead}>
              <Text style={styles.detailInvoice}>{detail.invoice}</Text>
              {detail.voided ? <View style={styles.voidBadge}><RNText style={styles.voidBadgeTxt}>VOID</RNText></View> : detail.is_bon && detail.bon_paid < detail.total ? <View style={styles.bonBadge}><RNText style={styles.bonBadgeTxt}>BON</RNText></View> : null}
            </View>
            <RNText style={styles.detailMeta}>{detail.created_at.slice(0, 16)} • {detail.payment_method === 'cash' ? 'Tunai' : 'QRIS'}</RNText>
            {detail.customer_name ? <RNText style={styles.detailName}>Atas Nama: {detail.customer_name}</RNText> : <RNText style={styles.detailNameMuted}>Atas Nama: —</RNText>}
            {detail.is_bon ? <RNText style={styles.detailBon}>BON — Dibayar Rp {(detail.bon_paid ?? 0).toLocaleString('id-ID')} • Sisa Rp {(detail.total - (detail.bon_paid ?? 0)).toLocaleString('id-ID')}{detail.bon_due_date ? ` • Tempo ${detail.bon_due_date}` : ''}</RNText> : null}
            {detail.voided && detail.void_reason ? <RNText style={styles.detailVoidReason}>Alasan void: {detail.void_reason}</RNText> : null}
            <View style={styles.detailDivider} />
            {detailItems.map((it, idx) => (
              <View key={idx} style={styles.detailItem}>
                <View style={{ flex: 1 }}>
                  <RNText style={styles.detailItemName}>{it.qty}x {it.product_name}</RNText>
                  {it.modifiers_label ? <RNText style={styles.detailMods}>+ {it.modifiers_label}</RNText> : null}
                  <RNText style={styles.detailUnit}>@ Rp {it.unit_price.toLocaleString('id-ID')}</RNText>
                </View>
                <RNText style={styles.detailLineTotal}>Rp {it.line_total.toLocaleString('id-ID')}</RNText>
              </View>
            ))}
            <View style={styles.detailDivider} />
            {detail.discount ? <View style={styles.detailRow}><RNText style={styles.detailLabel}>Diskon</RNText><RNText style={styles.detailDisc}>-Rp {detail.discount.toLocaleString('id-ID')}</RNText></View> : null}
            <View style={styles.detailRow}><RNText style={styles.detailLabelBold}>Total</RNText><RNText style={styles.detailTotal}>Rp {detail.total.toLocaleString('id-ID')}</RNText></View>

            {detail.is_bon && detail.bon_paid < detail.total && !detail.voided ? (
              <View style={{ flexDirection:'row', gap:10, marginTop:8 }}>
                <Button mode="contained" icon="cash" onPress={() => { setBonPay(String(detail.total - (detail.bon_paid ?? 0))); setShowBonPay(true) }} style={{ flex:1 }} buttonColor="#F59E0B">Bayar Bon</Button>
                <Button mode="outlined" icon="whatsapp" onPress={tagihWaDetail} style={{ flex:1 }}>Tagih WA</Button>
              </View>
            ) : null}
            <View style={{ flexDirection:'row', gap:10, marginTop:6 }}>
              <Button mode="outlined" icon="bluetooth" onPress={async () => { try { const r = await printViaBluetoothFallback(buildReceiptText(detail.id)); if (r==='shared') await shareReceiptPdf(detail.id); } catch(e:any){ Alert.alert('Info', 'Belum paired — fallback ke PDF/share. Pasangkan printer di Bluetooth settings dulu.') } }} style={{ flex:1 }}>Cetak Bluetooth</Button>
            </View>
            <View style={styles.detailBtns}>
              <Button mode="outlined" icon="printer" onPress={async () => { try { await printReceipt(detail.id) } catch (e: any) { Alert.alert('Gagal cetak', String(e?.message || e)) } }} style={{ flex: 1 }}>Cetak Ulang</Button>
              <Button mode="outlined" icon="file-pdf-box" onPress={async () => { try { await shareReceiptPdf(detail.id) } catch (e: any) { Alert.alert('Gagal PDF', String(e?.message || e)) } }} style={{ flex: 1 }}>PDF</Button>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Button mode="outlined" icon="share-variant" onPress={async () => { try { await shareReceipt(buildReceiptText(detail.id)) } catch {} }} style={{ flex: 1 }}>Share WA (teks)</Button>
            </View>
            {!detail.voided ? (
              <Button mode="contained" buttonColor="#B91C1C" textColor="#FFF" onPress={() => setShowVoid(true)} style={{ marginTop: 10 }}>Void / Koreksi Qty</Button>
            ) : null}
            <Button mode="text" onPress={() => setDetail(null)} textColor={colors.textMuted} style={{ marginTop: 4 }}>Tutup</Button>
          </ScrollView>
        ) : null}
      </Modal>

      <Modal visible={showBonPay} onDismiss={() => setShowBonPay(false)} contentContainerStyle={styles.voidModal}>
        <Text style={styles.voidModalTitle}>Bayar Bon {detail?.invoice}</Text>
        <RNText style={styles.voidModalDesc}>Sisa Rp {detail ? (detail.total - (detail.bon_paid ?? 0)).toLocaleString('id-ID') : '0'}</RNText>
        <TextInput value={bonPay} onChangeText={v => setBonPay(v.replace(/\D/g,''))} keyboardType="number-pad" dense style={{ backgroundColor: colors.surface, marginTop:10 }} placeholder="Nominal" left={<TextInput.Affix text="Rp " />} />
        <View style={{ flexDirection:'row', gap:10, marginTop:14 }}><Button mode="outlined" onPress={() => setShowBonPay(false)} style={{ flex:1 }}>Batal</Button><Button mode="contained" onPress={doBonPay} style={{ flex:1 }}>Konfirmasi</Button></View>
      </Modal>

      <Modal visible={showVoid} onDismiss={() => setShowVoid(false)} contentContainerStyle={styles.voidModal}>
        <Text style={styles.voidModalTitle}>Void transaksi</Text>
        <RNText style={styles.voidModalDesc}>Transaksi {detail?.invoice} akan ditandai VOID. Tidak kehitung omzet &amp; stok tidak dikembalikan otomatis. Lanjutkan dengan transaksi baru yang benar.</RNText>
        <TextInput value={voidReason} onChangeText={setVoidReason} placeholder="Alasan: Teh Manis harusnya 2 bukan 3" style={{ backgroundColor: colors.surface, marginTop: 10 }} dense />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Button mode="outlined" onPress={() => setShowVoid(false)} style={{ flex: 1 }}>Batal</Button>
          <Button mode="contained" buttonColor="#B91C1C" onPress={doVoid} style={{ flex: 1 }}>Ya, Void</Button>
        </View>
      </Modal>
    </View>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Surface style={[styles.statCard, highlight && styles.statHighlight]} elevation={0}>
      <Text style={[styles.statLabel, highlight && { color: '#FFF' }]}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: '#FFF' }]}>{value}</Text>
    </Surface>
  )
}

function TransactionList({ rows, onPress }: { rows: Row[]; onPress: (r: Row) => void }) {
  if (rows.length === 0) {
    return <Surface style={styles.empty} elevation={0}><Text style={styles.emptyTxt}>Tidak ada transaksi.</Text></Surface>
  }
  return (
    <Surface style={styles.listCard} elevation={0}>
      {rows.map((r) => (
        <Pressable key={r.invoice} onPress={() => onPress(r)} style={({ pressed }) => [styles.txRow as any, pressed ? { backgroundColor: colors.chipBg } : null, r.voided ? styles.txRowVoid : null].filter(Boolean) as any} android_ripple={{ color: colors.chipBg }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.txInvoice, r.voided ? styles.txVoid : null].filter(Boolean) as any}>{r.invoice}</Text>
              {r.voided ? <View style={styles.inlineVoid}><RNText style={styles.inlineVoidTxt}>VOID</RNText></View> : r.is_bon && r.bon_paid < r.total ? <View style={styles.inlineBon}><RNText style={styles.inlineBonTxt}>BON sisa Rp {(r.total - (r.bon_paid ?? 0)).toLocaleString('id-ID')}</RNText></View> : r.is_bon ? <View style={styles.inlineBonPaid}><RNText style={styles.inlineBonTxt}>BON lunas</RNText></View> : null}
            </View>
            {r.customer_name ? <RNText style={styles.txName}>Atas Nama: {r.customer_name}</RNText> : null}
            <Text style={[styles.txItems, r.voided ? styles.txVoid : null].filter(Boolean) as any} numberOfLines={2}>{r.items}</Text>
            <Text style={styles.txTime}>{r.created_at.slice(10, 16)} • {r.payment_method === 'cash' ? 'Tunai' : 'QRIS'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.txTotal, r.voided ? styles.txVoid : null].filter(Boolean) as any}>Rp {r.total.toLocaleString('id-ID')}</Text>
            <RNText style={styles.tapHint}>tap ›</RNText>
          </View>
        </Pressable>
      ))}
    </Surface>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', gap: 6, padding: 14, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.green, borderColor: colors.green },
  tabTxt: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTxtActive: { color: '#FFF' },
  searchWrap: { paddingHorizontal: 14, paddingTop: 8 },
  searchInput: { backgroundColor: colors.surface },
  searchMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  cards: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  statHighlight: { backgroundColor: colors.green, borderColor: colors.green },
  statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  discBanner: { marginHorizontal: 14, marginTop: 10, backgroundColor: colors.cream, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.yellow },
  discTxt: { fontSize: 13, fontWeight: '700', color: colors.badgeText },
  voidBanner: { marginHorizontal: 14, marginTop: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FECACA' },
  voidTxt: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },
  bonBanner: { marginHorizontal: 14, marginTop: 8, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FDE68A' },
  bonTxt: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  topCard: { marginHorizontal: 14, marginTop: 10, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  topTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  topRank: { width: 20, fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  topName: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },
  topQty: { fontSize: 13, fontWeight: '800', color: colors.greenDark, minWidth: 36, textAlign: 'right' },
  topSales: { fontSize: 12, color: colors.textMuted, minWidth: 90, textAlign: 'right' },
  listCard: { marginHorizontal: 14, marginTop: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 6, overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  txRowVoid: { opacity: 0.6 },
  txInvoice: { fontSize: 13, fontWeight: '800', color: colors.text },
  txName: { fontSize: 11, fontWeight: '700', color: colors.greenDark, marginTop: 2 },
  txItems: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  txTotal: { fontSize: 15, fontWeight: '800', color: colors.green, minWidth: 100, textAlign: 'right' },
  txVoid: { textDecorationLine: 'line-through', color: colors.textMuted },
  tapHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  inlineVoid: { backgroundColor: '#B91C1C', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  inlineVoidTxt: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  inlineBon: { backgroundColor:'#F59E0B', paddingHorizontal:6, paddingVertical:2, borderRadius:6 },
  inlineBonPaid: { backgroundColor:'#10B981', paddingHorizontal:6, paddingVertical:2, borderRadius:6 },
  inlineBonTxt: { color:'#FFF', fontSize:10, fontWeight:'900' },
  empty: { marginHorizontal: 14, marginTop: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  emptyTxt: { color: colors.textMuted, fontSize: 13 },
  detailModal: { backgroundColor: colors.surface, margin: 16, borderRadius: 20, padding: 18, maxHeight: '88%' },
  detailHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailInvoice: { fontSize: 16, fontWeight: '900', color: colors.text },
  voidBadge: { backgroundColor: '#B91C1C', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  voidBadgeTxt: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  bonBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bonBadgeTxt: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  detailMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  detailName: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 6 },
  detailNameMuted: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  detailBon: { fontSize: 12, fontWeight:'800', color:'#92400E', marginTop:4, backgroundColor:'#FFFBEB', padding:6, borderRadius:8 },
  detailVoidReason: { fontSize: 12, color: '#B91C1C', marginTop: 4, fontStyle: 'italic' },
  detailDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailItemName: { fontSize: 13, fontWeight: '700', color: colors.text },
  detailMods: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  detailUnit: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  detailLineTotal: { fontSize: 13, fontWeight: '800', color: colors.text },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailLabelBold: { fontSize: 14, fontWeight: '800', color: colors.text },
  detailDisc: { fontSize: 13, fontWeight: '700', color: colors.terra },
  detailTotal: { fontSize: 16, fontWeight: '900', color: colors.greenDark },
  detailBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  voidModal: { backgroundColor: colors.surface, margin: 20, borderRadius: 16, padding: 18 },
  voidModalTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  voidModalDesc: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 16 },
})
