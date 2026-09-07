import { getDb } from '../db/database'

export interface Product {
  id: number
  name: string
  price: number
  stock: number | null
  image_uri: string | null
  category_name: string | null
}

export interface CartLine {
  key: string
  productId: number
  productName: string
  basePrice: number
  qty: number
  modifiers: { label: string; extraPrice: number }[]
  unitPrice: number
}

export function listProducts(): Product[] {
  return getDb()
    .getAllSync<Product>(
      `SELECT p.id, p.name, p.price, p.stock, p.image_uri, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1 ORDER BY p.name`
    )
}

export function cartTotals(cart: CartLine[], discount = 0) {
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0)
  const total = Math.max(0, subtotal - discount)
  const itemCount = cart.reduce((s, l) => s + l.qty, 0)
  return { subtotal, total, itemCount }
}

function nextInvoice(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const row = getDb().getFirstSync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM transactions WHERE invoice LIKE ?",
    [`INV-${datePart}-%`]
  )
  const seq = String((row?.c ?? 0) + 1).padStart(4, '0')
  return `INV-${datePart}-${seq}`
}

export function checkout(
  cart: CartLine[],
  paymentMethod: 'cash' | 'qris',
  paid: number,
  discount = 0
): { invoice: string; total: number; change: number } {
  if (cart.length === 0) throw new Error('Keranjang masih kosong')
  const { total } = cartTotals(cart, discount)
  if (paymentMethod === 'cash' && paid < total) throw new Error('Uang bayar kurang dari total')
  const effectivePaid = paymentMethod === 'qris' ? total : paid
  const change = effectivePaid - total

  // Validasi stok sebelum transaksi — jangan sampai minus
  for (const line of cart) {
    if (line.productId > 0) {
      const prod = getDb().getFirstSync<{ stock: number | null }>('SELECT stock FROM products WHERE id = ?', [line.productId])
      const stock = prod?.stock
      if (stock !== null && stock !== undefined && stock < line.qty) {
        throw new Error(`Stok ${line.productName} tidak cukup (sisa ${stock})`)
      }
    }
  }

  const db = getDb()
  const invoice = nextInvoice()
  db.execSync('BEGIN')
  try {
    const txId = Number(
      db
        .prepareSync(
          'INSERT INTO transactions (invoice, total, paid, change, payment_method, discount) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .executeSync(invoice, total, effectivePaid, change, paymentMethod, discount).lastInsertRowId
    )
    const insItem = db.prepareSync(
      'INSERT INTO transaction_items (transaction_id, product_name, unit_price, qty, modifiers_label, line_total) VALUES (?, ?, ?, ?, ?, ?)'
    )
    const decStock = db.prepareSync('UPDATE products SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL AND stock >= ?')
    for (const line of cart) {
      const modLabel = line.modifiers.map((m) => m.label).join(', ')
      insItem.executeSync(txId, line.productName, line.unitPrice, line.qty, modLabel, line.unitPrice * line.qty)
      if (line.productId > 0) decStock.executeSync(line.qty, line.productId, line.qty)
    }
    db.execSync('COMMIT')
  } catch (e) {
    try { db.execSync('ROLLBACK') } catch {}
    throw e
  }
  return { invoice, total, change }
}

/** Produk dengan stok menipis (<= threshold), hanya yang dilacak. */
export function lowStockProducts(threshold = 5): Product[] {
  return getDb()
    .getAllSync<Product>(
      `SELECT p.id, p.name, p.price, p.stock, p.image_uri, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1 AND p.stock IS NOT NULL AND p.stock <= ?
       ORDER BY p.stock ASC`,
      [threshold]
    )
}
