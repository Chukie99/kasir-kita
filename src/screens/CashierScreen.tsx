import React, { useMemo, useState } from 'react'
import { View, StyleSheet, ScrollView, Pressable, Image } from 'react-native'
import { Text, Surface } from 'react-native-paper'
import { colors } from '../theme/theme'
import { listProducts, cartTotals, checkout, type Product, type CartLine } from '../utils/pos'
import StickyCartBar, { rupiah } from '../components/StickyCartBar'
import CheckoutSheet from '../components/CheckoutSheet'
import { buildReceiptText, printReceipt } from '../utils/receipt'
import { shareReceipt } from '../utils/export'

export default function CashierScreen({ onSold }: { onSold: () => void }) {
  const products = useMemo(() => listProducts(), [])
  const [cart, setCart] = useState<CartLine[]>([])
  const [showCheckout, setShowCheckout] = useState(false)
  const [lastSale, setLastSale] = useState<string | null>(null)
  const [lastTxId, setLastTxId] = useState<number | null>(null)

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

  const doCheckout = (method: 'cash' | 'qris', paid: number, discount: number) => {
    const res = checkout(cart, method, paid, discount)
    setCart([])
    setShowCheckout(false)
    setLastSale(`${res.invoice} • Kembalian ${method === 'cash' ? rupiah(res.change) : '—'}`)
    onSold()
    setTimeout(() => setLastSale(null), 5000)
    const db = require('../db/database').getDb()
    const row = db.getFirstSync('SELECT id FROM transactions ORDER BY id DESC LIMIT 1') as { id: number } | undefined
    if (row) setLastTxId(row.id)
  }

  return (
    <View style={styles.root}>
      {/* Product grid */}
      <ScrollView contentContainerStyle={styles.grid}>
        {products.length === 0 ? (
          <Text style={styles.emptyTxt}>Belum ada produk. Tambah dulu di menu Kelola Produk.</Text>
        ) : null}
        {products.map((p) => {
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
      {cart.length > 0 && !showCheckout ? (
        <Surface style={styles.cartPanel} elevation={0}>
          <View style={styles.cartHead}>
            <Text style={styles.cartTitle}>Pesanan</Text>
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

      <StickyCartBar visible cart={cart} total={total} onCheckout={() => setShowCheckout(true)} />

      <CheckoutSheet
        visible={showCheckout}
        cart={cart}
        onClose={() => setShowCheckout(false)}
        onConfirm={doCheckout}
      />

      {lastSale ? (
        <Surface style={styles.toast} elevation={0}>
          <Text style={styles.toastText}>Terjual — {lastSale}</Text>
          {lastTxId ? (
            <Pressable
              onPress={async () => {
                try { await shareReceipt(buildReceiptText(lastTxId)) } catch {}
              }}
              android_ripple={{ color: colors.chipBg }}
              style={styles.shareBtn}
            >
              <Text style={styles.shareTxt}>Kirim Struk</Text>
            </Pressable>
          ) : null}
          {lastTxId ? (
            <Pressable
              onPress={async () => {
                try { await printReceipt(lastTxId) } catch {}
              }}
              android_ripple={{ color: colors.chipBg }}
              style={styles.printBtn}
            >
              <Text style={styles.shareTxt}>Cetak</Text>
            </Pressable>
          ) : null}
        </Surface>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
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
  emptyTxt: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 },
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
  toast: {
    position: 'absolute', top: 14, alignSelf: 'center',
    backgroundColor: colors.chipBg, borderRadius: 999,
    borderWidth: 1, borderColor: colors.green,
    paddingHorizontal: 18, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  shareBtn: { backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  printBtn: { backgroundColor: colors.cream, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.yellow },
  shareTxt: { color: colors.greenDark, fontWeight: '700', fontSize: 12 },
  toastText: { color: colors.greenDark, fontWeight: '700', fontSize: 13 },
})
