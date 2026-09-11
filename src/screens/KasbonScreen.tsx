import React from 'react'
import { View, StyleSheet, ScrollView, Pressable, Alert, Linking } from 'react-native'
import { Text as RNText } from 'react-native'
import { Text, Surface, Button, TextInput, Modal } from 'react-native-paper'
import { colors } from '../theme/theme'
import { getDb } from '../db/database'
import { payBon } from '../utils/kasbon'
import { buildReceiptText } from '../utils/receipt'

export default function KasbonScreen({ onChanged }: { onChanged?: () => void }) {
  const [refresh, setRefresh] = React.useState(0)
  const [payFor, setPayFor] = React.useState<any | null>(null)
  const [amount, setAmount] = React.useState('')

  const rows = React.useMemo(() => {
    try {
      return getDb().getAllSync<any>(
        `SELECT t.*, GROUP_CONCAT(ti.qty || 'x ' || ti.product_name, ', ') AS items
         FROM transactions t LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
         WHERE t.is_bon=1 AND COALESCE(t.voided,0)=0 AND t.bon_paid < t.total
         GROUP BY t.id ORDER BY t.created_at DESC`
      )
    } catch { return [] }
  }, [refresh])

  const summary = React.useMemo(() => {
    try {
      const r = getDb().getFirstSync<any>(`SELECT COUNT(*) as c, COALESCE(SUM(total),0) as tot, COALESCE(SUM(bon_paid),0) as paid FROM transactions WHERE is_bon=1 AND COALESCE(voided,0)=0 AND bon_paid < total`) as any
      return { count: r.c ?? 0, sisa: (r.tot ?? 0) - (r.paid ?? 0), tot: r.tot ?? 0, paid: r.paid ?? 0 }
    } catch { return { count: 0, sisa: 0, tot: 0, paid: 0 } }
  }, [refresh, rows])

  const doPay = () => {
    if (!payFor) return
    const val = parseInt(amount.replace(/\D/g, '') || '0', 10)
    if (val <= 0) { Alert.alert('Nominal salah', 'Masukkan nominal > 0'); return }
    try {
      payBon(payFor.id, val)
      setPayFor(null); setAmount(''); setRefresh(k => k + 1); onChanged?.()
    } catch (e: any) { Alert.alert('Gagal', String(e?.message || e)) }
  }

  const tagihWA = (r: any) => {
    const sisa = r.total - (r.bon_paid ?? 0)
    const msg = `Halo ${r.customer_name || 'Kak'} — tagihan bon ${r.invoice} sebesar Rp ${sisa.toLocaleString('id-ID')} (total Rp ${r.total.toLocaleString('id-ID')}, sudah bayar Rp ${(r.bon_paid ?? 0).toLocaleString('id-ID')})${r.bon_due_date ? ` jatuh tempo ${r.bon_due_date}` : ''}. Mohon dilunasi ya 🙏\n\n` + buildReceiptText(r.id)
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
    Linking.openURL(url).catch(() => {})
  }

  if (rows.length === 0) {
    return (
      <View style={styles.root}>
        <Surface style={styles.sumCard} elevation={0}>
          <Text style={styles.sumLabel}>Kasbon Aktif</Text>
          <Text style={styles.sumValue}>Rp 0 — tidak ada bon</Text>
        </Surface>
        <Surface style={styles.empty} elevation={0}><Text style={styles.emptyTxt}>Belum ada kasbon. Centang Bon di Kasir saat checkout.</Text></Surface>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <Surface style={styles.sumCard} elevation={0}>
        <Text style={styles.sumLabel}>{summary.count} bon • Sisa tagihan</Text>
        <Text style={styles.sumValue}>Rp {summary.sisa.toLocaleString('id-ID')}</Text>
        <RNText style={styles.sumSub}>Total bon Rp {summary.tot.toLocaleString('id-ID')} • Terbayar Rp {summary.paid.toLocaleString('id-ID')}</RNText>
      </Surface>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110, gap: 10 }}>
        {rows.map((r: any) => {
          const sisa = r.total - (r.bon_paid ?? 0)
          return (
            <Surface key={r.id} style={styles.card} elevation={0}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.inv}>{r.invoice}</Text>
                <View style={styles.badge}><RNText style={styles.badgeTxt}>BON</RNText></View>
              </View>
              <RNText style={styles.name}>{r.customer_name ? `Atas Nama: ${r.customer_name}` : 'Atas Nama: —'}</RNText>
              <RNText style={styles.items} numberOfLines={2}>{r.items || ''}</RNText>
              <View style={styles.row}>
                <RNText style={styles.meta}>{r.created_at.slice(0, 16)}{r.bon_due_date ? ` • Tempo ${r.bon_due_date}` : ''}</RNText>
              </View>
              <View style={styles.moneyRow}>
                <View><RNText style={styles.moneyLabel}>Total</RNText><RNText style={styles.money}>Rp {r.total.toLocaleString('id-ID')}</RNText></View>
                <View><RNText style={styles.moneyLabel}>Dibayar</RNText><RNText style={styles.moneyMuted}>Rp {(r.bon_paid ?? 0).toLocaleString('id-ID')}</RNText></View>
                <View><RNText style={styles.moneyLabel}>Sisa</RNText><RNText style={styles.moneySisa}>Rp {sisa.toLocaleString('id-ID')}</RNText></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Button mode="contained" icon="cash" onPress={() => { setPayFor(r); setAmount(String(sisa)) }} style={{ flex: 1 }}>Bayar</Button>
                <Button mode="outlined" icon="whatsapp" onPress={() => tagihWA(r)} style={{ flex: 1 }}>Tagih WA</Button>
              </View>
            </Surface>
          )
        })}
      </ScrollView>
      <Modal visible={!!payFor} onDismiss={() => setPayFor(null)} contentContainerStyle={styles.modal}>
        <Text style={styles.modalTitle}>Bayar Bon {payFor?.invoice}</Text>
        <RNText style={styles.modalSub}>Sisa: Rp {payFor ? (payFor.total - (payFor.bon_paid ?? 0)).toLocaleString('id-ID') : '0'}</RNText>
        <TextInput value={amount} onChangeText={v => setAmount(v.replace(/\D/g, ''))} keyboardType="number-pad" dense style={{ backgroundColor: colors.surface, marginTop: 12 }} placeholder="Nominal" left={<TextInput.Affix text="Rp " />} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Button mode="outlined" onPress={() => setPayFor(null)} style={{ flex: 1 }}>Batal</Button>
          <Button mode="contained" onPress={doPay} style={{ flex: 1 }}>Konfirmasi</Button>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sumCard: { margin: 14, backgroundColor: '#FFFBEB', borderRadius: 14, borderWidth: 1, borderColor: '#FDE68A', padding: 14 },
  sumLabel: { fontSize: 12, color: '#92400E', fontWeight: '700' },
  sumValue: { fontSize: 20, fontWeight: '900', color: '#92400E', marginTop: 4 },
  sumSub: { fontSize: 11, color: '#A16207', marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  inv: { fontSize: 13, fontWeight: '900', color: colors.text },
  badge: { backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeTxt: { color: '#FFF', fontWeight: '900', fontSize: 11 },
  name: { fontSize: 13, fontWeight: '800', color: colors.text, marginTop: 6 },
  items: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  row: { flexDirection: 'row' },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  moneyLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  money: { fontSize: 13, fontWeight: '900', color: colors.text },
  moneyMuted: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  moneySisa: { fontSize: 13, fontWeight: '900', color: '#B91C1C' },
  empty: { margin: 14, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  emptyTxt: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  modal: { backgroundColor: colors.surface, margin: 20, borderRadius: 16, padding: 18 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  modalSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
})
