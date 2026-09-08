import { getDb } from '../db/database'

export interface ProductRow {
  id: number
  name: string
  price: number
  category_name: string | null
  category_id: number | null
  is_active: number
  stock: number | null
  image_uri: string | null
}

export function listAllProducts(): ProductRow[] {
  return getDb().getAllSync<ProductRow>(
    `SELECT p.id, p.name, p.price, p.category_id, c.name AS category_name, p.is_active, p.stock, p.image_uri
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     ORDER BY p.is_active DESC, p.name`
  )
}

export function listCategories(): { id: number; name: string }[] {
  return getDb().getAllSync('SELECT id, name FROM categories ORDER BY name')
}

export function addProduct(name: string, price: number, categoryId: number | null, stock: number | null = null, imageUri: string | null = null): void {
  if (!name.trim()) throw new Error('Nama produk wajib diisi')
  if (!(price > 0)) throw new Error('Harga harus lebih dari 0')
  getDb().runSync(
    'INSERT INTO products (name, price, category_id, stock, image_uri) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), Math.round(price), categoryId, stock, imageUri]
  )
}

export function updateProduct(id: number, name: string, price: number, categoryId: number | null, stock: number | null = null, imageUri: string | null = null): void {
  if (!name.trim()) throw new Error('Nama produk wajib diisi')
  if (!(price > 0)) throw new Error('Harga harus lebih dari 0')
  getDb().runSync(
    'UPDATE products SET name = ?, price = ?, category_id = ?, stock = ?, image_uri = ? WHERE id = ?',
    [name.trim(), Math.round(price), categoryId, stock, imageUri, id]
  )
}

export function toggleProductActive(id: number, active: boolean): void {
  getDb().runSync('UPDATE products SET is_active = ? WHERE id = ?', [active ? 1 : 0, id])
}

export function deleteProduct(id: number): void {
  // Hard delete — riwayat tetap aman karena transaction_items simpan product_name (string), bukan FK
  getDb().runSync('DELETE FROM products WHERE id = ?', [id])
}

export function addCategory(name: string): number {
  const clean = name.trim()
  if (!clean) throw new Error('Nama kategori wajib diisi')
  const existing = getDb().getFirstSync<{ id: number }>('SELECT id FROM categories WHERE name = ?', [clean])
  if (existing) return existing.id
  const res = getDb().runSync('INSERT INTO categories (name) VALUES (?)', [clean])
  return Number(res.lastInsertRowId)
}
