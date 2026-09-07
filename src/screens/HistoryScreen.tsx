import React from 'react'
import { View, StyleSheet, ScrollView, Pressable } from 'react-native'
import { Text as RNText } from 'react-native'
import { Text, Surface } from 'react-native-paper'
import { colors } from '../theme/theme'
import { getDb } from '../db/database'

type Period = 'today' | 'week' | 'month'

interface Row { invoice: string; total: number; discount: number; payment_method: string; created_at: string; items: string }

const PERIOD_LABEL: Record<Period, string> = {
  today: 'Hari Ini',
  week: 'Minggu Ini',
  month: 'Bulan Ini',
}

function whereClause(period: Period): string {
  if (period === 'today') return "date(t.created_at) = date('now','localtime')"
  if (period === 'week') return "date(t.created_at) >= date('now','localtime','-6 days')"
  return "strftime('%Y-%m', t.created_at) = strftime('%Y-%m','now','localtime')"
}

export default function HistoryScreen() {
  const [period, setPeriod] = React.useState<Period>('today')

  const rows = React.useMemo<Row[]>(() => {
    try {
      return getDb().getAllSync<Row>(
        `SELECT t.invoice, t.total, COALESCE(t.discount, 0) AS discount, t.payment_method, t.created_at,
              GROUP_CONCAT(ti.qty || 'x ' || ti.product_name, char(10)) AS items
       FROM transactions t JOIN transaction_items ti ON ti.transaction_id = t.id
       WHERE ${whereClause(period)}
       GROUP BY t.id ORDER BY t.id DESC`
      )
    } catch { return [] }
  }, [period])

  const revenue = rows.reduce((s, r) => s + r.total, 0)
  const discounts = rows.reduce((s, r) => s + (r.discount || 0), 0)
  const cash = rows.filter((r) => r.payment_method === 'cash').reduce((s, r) => s + r.total, 0)
  const qris = rows.filter((r) => r.payment_method === 'qris').reduce((s, r) => s + r.total, 0)

  const topProducts = React.useMemo(() => {
    try {
      return getDb().getAllSync<{ name: string; qty: number; sales: number }>(
        `SELECT ti.product_name AS name, SUM(ti.qty) AS qty, SUM(ti.line_total) AS sales
       FROM transaction_items ti JOIN transactions t ON t.id = ti.transaction_id
       WHERE ${whereClause(period)}
       GROUP BY ti.product_name ORDER BY qty DESC LIMIT 5`
      )
    } catch { return [] }
  }, [period])

  return (
    <View style={styles.root}>
      {/* Period switcher — pill-shaped */}
      <View style={styles.tabs}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p: Period) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[styles.tab, period === p && styles.tabActive]}
            android_ripple={{ color: colors.chipBg, borderless: true }}
          >
            <RNText style={[styles.tabTxt, period === p && styles.tabTxtActive]}>{PERIOD_LABEL[p]}</RNText>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={styles.cards}>
          <StatCard label="Transaksi" value={String(rows.length)} />
          <StatCard label={`Omzet ${PERIOD_LABEL[period]}`} value={'Rp ' + revenue.toLocaleString('id-ID')} highlight />
        </View>
        <View style={styles.cards}>
          <StatCard label="Tunai" value={'Rp ' + cash.toLocaleString('id-ID')} />
          <StatCard label="QRIS" value={'Rp ' + qris.toLocaleString('id-ID')} />
        </View>
        {discounts > 0 ? (
          <Surface style={styles.discBanner} elevation={0}>
            <Text style={styles.discTxt}>Total diskon diberikan: Rp {discounts.toLocaleString('id-ID')}</Text>
          </Surface>
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

        <TransactionList rows={rows} />
      </ScrollView>
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

function TransactionList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <Surface style={styles.empty} elevation={0}>
        <Text style={styles.emptyTxt}>Belum ada transaksi pada periode ini.</Text>
      </Surface>
    )
  }
  return (
    <Surface style={styles.listCard} elevation={0}>
      {rows.map((r) => (
        <View key={r.invoice} style={styles.txRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.txInvoice}>{r.invoice}</Text>
            <Text style={styles.txItems}>{r.items}</Text>
            <Text style={styles.txTime}>{r.created_at.slice(10, 16)} • {r.payment_method === 'cash' ? 'Tunai' : 'QRIS'}</Text>
          </View>
          <Text style={styles.txTotal}>{'Rp ' + r.total.toLocaleString('id-ID')}</Text>
        </View>
      ))}
    </Surface>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', gap: 6, padding: 14, paddingBottom: 4 },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.green, borderColor: colors.green },
  tabTxt: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTxtActive: { color: '#FFF' },
  cards: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  statHighlight: { backgroundColor: colors.green, borderColor: colors.green },
  statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text, flexShrink: 1 },
  discBanner: { marginHorizontal: 14, marginTop: 10, backgroundColor: colors.cream, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.yellow },
  discTxt: { fontSize: 13, fontWeight: '700', color: colors.badgeText },
  topCard: { marginHorizontal: 14, marginTop: 10, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  topTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  topRank: { width: 20, fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  topName: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },
  topQty: { fontSize: 13, fontWeight: '800', color: colors.greenDark, minWidth: 36, textAlign: 'right' },
  topSales: { fontSize: 12, color: colors.textMuted, minWidth: 90, textAlign: 'right' },
  listCard: { marginHorizontal: 14, marginTop: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 6 },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  txInvoice: { fontSize: 13, fontWeight: '800', color: colors.text },
  txItems: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  txTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  txTotal: { fontSize: 15, fontWeight: '800', color: colors.green, minWidth: 100, textAlign: 'right' },
  empty: { marginHorizontal: 14, marginTop: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center' },
  emptyTxt: { color: colors.textMuted, fontSize: 13 },
})
