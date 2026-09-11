import React, { useMemo, useState } from 'react'
import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native'
import { Text, Surface, Modal, Button } from 'react-native-paper'
import { colors } from '../theme/theme'
import { listProducts, cartTotals, checkout, type Product, type CartLine } from '../utils/pos'
import { listCategories } from '../utils/products'
import StickyCartBar, { rupiah } from '../components/StickyCartBar'
import CheckoutSheet from '../components/CheckoutSheet'
import { buildReceiptText, printReceipt } from '../utils/receipt'
import { printViaBluetoothFallback } from '../utils/bluetooth'
import { shareReceipt } from '../utils/export'

export default function CashierScreen({ onSold }: { onSold: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const products = useMemo(() => listProducts(), [refreshKey])
  const categories = useMemo(() => listCategories(), [refreshKey])
  const [activeCat, setActiveCat] = useState<number | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [success, setSuccess] = useState<{ invoice: string; change: number; method: string; txId: number | null } | null>(null)

  const filtered = activeCat === null ? products : products.filter(p => p.category_id === activeCat)
  const { total, itemCount } = cartTotals(cart)

  const addProduct = (p: Product) => {
    const key = String(p.id)
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
      }
      return [
        ...prev,
        {
          key,
          productId: p.id,
          productName: p.name,
          basePrice: p.price,
          qty: 1,
          modifiers: [],
          unitPrice: p.price,
        },
      ]
    })
  }

  const bumpQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    )
  }

  const doCheckout = (method: 'cash' | 'qris', paid: number, discount: number, customerName = '', opts?: { isBon?: boolean; bonDueDate?: string; bonPaid?: number }) => {
    const res = checkout(cart, method, paid, discount, customerName, opts)
    setCart([])
    setShowCheckout(false)
    onSold()
    setRefreshKey(k => k + 1)
    const db = require('../db/database').getDb()
    const row = db.getFirstSync('SELECT id FROM transactions ORDER BY id DESC LIMIT 1') as { id: number } | undefined
    setSuccess({ invoice: res.invoice, change: res.change, method, txId: row?.id ?? null })
  }

  return (
    <View style={styles.root}>
      {/* Kategori chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow} style={styles.catScroll}>
        <Pressable onPress={() => setActiveCat(null)} style={[styles.catChip, activeCat === null && styles.catChipActive]}>
          <Text style={[styles.catTxt, activeCat === null && styles.catTxtActive]}>Semua</Text>
        </Pressable>
        {categories.map(c => (
          <Pressable key={c.id} onPress={() => setActiveCat(c.id)} style={[styles.catChip, activeCat === c.id && styles.catChipActive]}>
            <Text style={[styles.catTxt, activeCat === c.id && styles.catTxtActive]}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Product grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyTxt}>{products.length === 0 ? 'Belum ada produk. Tambah dulu di menu Kelola Produk.' : 'Tidak ada produk di kategori ini.'}</Text>
        ) : null}
        {filtered.map((p) => {
          const inCart = cart.find((l) => l.key === String(p.id))
          return (
            <Pressable key={p.id} style={[styles.card, inCart && styles.cardActive]} android_ripple={{ color: colors.chipBg }} onPress={() => addProduct(p)}>
              {inCart ? (
                <View style={styles.cardBadge}>
                  <Text style={styles.cardBadgeTxt}>{inCart.qty}</Text>
                </View>
              ) : null}
              {p.stock !== null && p.stock <= 5 ? (
                <View style={styles.stockTag}>
                  <Text style={styles.stockTagTxt}>{p.stock <= 0 ? 'Habis' : `${p.stock} sisa`}</Text>
                </View>
              ) : null}
              {p.image_uri ? (
                <Image source={{ uri: p.image_uri }} style={styles.cardImg} />
              ) : null}
              <Text numberOfLines={2} style={styles.cardName}>{p.name}</Text>
              <Text style={styles.cardPrice}>{rupiah(p.price)}</Text>
              {p.category_name ? <Text style={styles.cardCat}>{p.category_name}</Text> : null}
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Cart items panel */}
      {cart.length > 0 && !showCheckout && !success ? (
        <Surface style={styles.cartPanel} elevation={0}>
          <View style={styles.cartHead}>
            <Text style={styles.cartTitle}>Pesanan ({itemCount})</Text>
            <Pressable onPress={() => setCart([])} hitSlop={8}>
              <Text style={styles.cartClear}>Kosongkan</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 210 }}>
            {cart.map((l) => (
              <View key={l.key} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartName} numberOfLines={1}>{l.productName}</Text>
                  {l.modifiers.length > 0 ? (
                    <Text style={styles.cartMods} numberOfLines={1}>{l.modifiers.map((m) => m.label).join(', ')}</Text>
                  ) : null}
                  <Text style={styles.cartPrice}>{rupiah(l.unitPrice * l.qty)}</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable onPress={() => bumpQty(l.key, -1)} style={styles.stepBtn} android_ripple={{ color: colors.chipBg, borderless: true }}>
                    <Text style={styles.stepTxt}>−</Text>
                  </Pressable>
                  <Text style={styles.stepQty}>{l.qty}</Text>
                  <Pressable onPress={() => bumpQty(l.key, +1)} style={styles.stepBtn} android_ripple={{ color: colors.chipBg, borderless: true }}>
                    <Text style={styles.stepTxt}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </Surface>
      ) : null}

      <StickyCartBar visible={cart.length > 0 && !success} cart={cart} total={total} onCheckout={() => setShowCheckout(true)} />

      <CheckoutSheet
        visible={showCheckout}
        cart={cart}
        onClose={() => setShowCheckout(false)}
        onConfirm={doCheckout}
      />

      {/* Success modal — gede jelas, gak ketutup */}
      <Modal visible={!!success} onDismiss={() => setSuccess(null)} contentContainerStyle={styles.successModal}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Pembayaran Berhasil</Text>
        <Text style={styles.successInvoice}>{success?.invoice}</Text>
        {success?.method === 'cash' ? (
          <View style={styles.successChangeBox}>
            <Text style={styles.successChangeLabel}>Kembalian</Text>
            <Text style={styles.successChangeValue}>{rupiah(success?.change ?? 0)}</Text>
          </View>
        ) : (
          <View style={styles.successChangeBox}>
            <Text style={styles.successChangeLabel}>Metode</Text>
            <Text style={styles.successChangeValue}>QRIS Lunas ✓</Text>
          </View>
        )}
        <View style={styles.successBtnRow}>
          <Button mode="outlined" icon="bluetooth" onPress={async () => { if (success?.txId) { try { const r = await printViaBluetoothFallback(buildReceiptText(success.txId)); if (r==='shared') await printReceipt(success.txId); } catch{} } }} style={{ flex: 1 }}>
            Bluetooth
          </Button>
          <Button mode="outlined" icon="printer" onPress={async () => { if (success?.txId) try { await printReceipt(success.txId) } catch {} }} style={{ flex: 1 }}>
            Cetak
          </Button>
          <Button mode="contained" icon="whatsapp" onPress={async () => { if (success?.txId) try { await shareReceipt(buildReceiptText(success.txId)) } catch {} }} style={{ flex: 1 }}>
            Kirim WA
          </Button>
        </View>
        <Button mode="text" onPress={() => setSuccess(null)} textColor={colors.textMuted} style={{ marginTop: 8 }}>
          Tutup — Lanjut Jualan
        </Button>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  catScroll: { flexGrow: 0, maxHeight: 52, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  catRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  catChip: { height: 34, minWidth: 64, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14 },
  catChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  catTxt: { fontSize: 12.5, fontWeight: '800', color: colors.text, letterSpacing: 0.2, textAlign: 'center', includeFontPadding: false as any },
  catTxtActive: { color: '#FFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14, paddingBottom: 180 },
  card: {
    width: '31.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    paddingHorizontal: 12,
    minHeight: 108,
    justifyContent: 'space-between',
  },
  cardName: { fontSize: 17, fontWeight: '800', color: colors.text, lineHeight: 22 },
  cardPrice: { fontSize: 15, fontWeight: '700', color: colors.greenDark, marginTop: 6 },
  cardCat: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  cardImg: { width: '100%', height: 64, borderRadius: 10, marginBottom: 8, backgroundColor: colors.chipBg },
  emptyTxt: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40, width: '100%' },
  cardActive: { borderColor: colors.green, borderWidth: 2, backgroundColor: colors.chipBg },
  cardBadge: {
    position: 'absolute', top: -8, right: -8,
    minWidth: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 7, zIndex: 2,
  },
  cardBadgeTxt: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  stockTag: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: colors.terra, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, zIndex: 1,
  },
  stockTagTxt: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  cartPanel: {
    position: 'absolute', left: 12, right: 12, bottom: 150,
    backgroundColor: colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, paddingHorizontal: 16,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  cartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cartTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  cartClear: { fontSize: 12, color: colors.terra, fontWeight: '700' },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  cartName: { fontSize: 14, fontWeight: '700', color: colors.text },
  cartMods: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  cartPrice: { fontSize: 12.5, fontWeight: '800', color: colors.greenDark, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.chipBg, borderRadius: 999, overflow: 'hidden' },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 20, fontWeight: '900', color: colors.greenDark, lineHeight: 24 },
  stepQty: { minWidth: 30, textAlign: 'center', fontSize: 15, fontWeight: '900', color: colors.text },
  successModal: { backgroundColor: colors.surface, margin: 24, borderRadius: 20, padding: 24, alignItems: 'center' },
  successIcon: { fontSize: 48, color: colors.green, marginBottom: 8 },
  successTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  successInvoice: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  successChangeBox: { backgroundColor: colors.chipBg, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: colors.green, width: '100%' },
  successChangeLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  successChangeValue: { fontSize: 26, fontWeight: '900', color: colors.greenDark, marginTop: 4 },
  successBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%' },
})
