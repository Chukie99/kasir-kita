import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('posumkm.db')
  }
  return db
}

export function initDatabase(): void {
  const d = getDb()
  d.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      device_id TEXT NOT NULL,
      activation_key TEXT NOT NULL,
      activated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER REFERENCES categories(id),
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- Migration v1.2: stok (NULL = tidak dilacak) & diskon transaksi
    -- (ALTER guarded di bawah karena SQLite tidak punya IF NOT EXISTS untuk ADD COLUMN)

    -- Modifier groups: "Varian", "Topping", "Level Pedas", "Suhu" etc.
    CREATE TABLE IF NOT EXISTS modifier_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      min_select INTEGER NOT NULL DEFAULT 0,
      max_select INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      extra_price INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice TEXT NOT NULL UNIQUE,
      total INTEGER NOT NULL,
      paid INTEGER NOT NULL,
      change INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'qris')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      modifiers_label TEXT NOT NULL DEFAULT '',
      line_total INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_items_tx ON transaction_items(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_mod_groups_product ON modifier_groups(product_id);
  `)

  // Guarded column migrations
  const productCols = d.getAllSync<{ name: string }>("PRAGMA table_info(products)").map((c) => c.name)
  if (!productCols.includes('stock')) {
    d.execSync('ALTER TABLE products ADD COLUMN stock INTEGER')
  }
  if (!productCols.includes('image_uri')) {
    d.execSync('ALTER TABLE products ADD COLUMN image_uri TEXT')
  }
  d.execSync(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`)
  const txCols = d.getAllSync<{ name: string }>("PRAGMA table_info(transactions)").map((c) => c.name)
  if (!txCols.includes('discount')) {
    d.execSync('ALTER TABLE transactions ADD COLUMN discount INTEGER NOT NULL DEFAULT 0')
  }
  if (!txCols.includes('customer_name')) {
    d.execSync("ALTER TABLE transactions ADD COLUMN customer_name TEXT NOT NULL DEFAULT ''")
  }
  if (!txCols.includes('voided')) {
    d.execSync('ALTER TABLE transactions ADD COLUMN voided INTEGER NOT NULL DEFAULT 0')
  }
  if (!txCols.includes('voided_at')) {
    d.execSync('ALTER TABLE transactions ADD COLUMN voided_at TEXT')
  }
  if (!txCols.includes('void_reason')) {
    d.execSync('ALTER TABLE transactions ADD COLUMN void_reason TEXT')
  }
}

export function seedDemoData(): void {
  const d = getDb()
  const count = d.getFirstSync<{ c: number }>('SELECT COUNT(*) AS c FROM products')
  if ((count?.c ?? 0) > 0) return

  const insCat = d.prepareSync('INSERT INTO categories (name) VALUES (?)')
  const insProd = d.prepareSync('INSERT INTO products (name, price, category_id) VALUES (?, ?, ?)')
  const insGroup = d.prepareSync('INSERT INTO modifier_groups (product_id, name, min_select, max_select) VALUES (?, ?, ?, ?)')
  const insMod = d.prepareSync('INSERT INTO modifiers (group_id, label, extra_price) VALUES (?, ?, ?)')

  d.execSync('BEGIN')
  try {
    const makanan = Number(insCat.executeSync('Makanan').lastInsertRowId)
    const minuman = Number(insCat.executeSync('Minuman').lastInsertRowId)

    // Surabi — varian + topping
    const surabi = Number(insProd.executeSync('Surabi', 8000, makanan).lastInsertRowId)
    const gSurabiVarian = Number(insGroup.executeSync(surabi, 'Rasa', 1, 1).lastInsertRowId)
    insMod.executeSync(gSurabiVarian, 'Polos', 0)
    insMod.executeSync(gSurabiVarian, 'Keju', 3000)
    insMod.executeSync(gSurabiVarian, 'Coklat', 2500)
    const gSurabiTopping = Number(insGroup.executeSync(surabi, 'Topping', 0, 2).lastInsertRowId)
    insMod.executeSync(gSurabiTopping, '+Telor', 3000)
    insMod.executeSync(gSurabiTopping, '+Oncom', 2000)
    insMod.executeSync(gSurabiTopping, '+Sosis', 4000)

    // Mie Tek-tek — level pedas + topping
    const mie = Number(insProd.executeSync('Mie Tek-Tek', 12000, makanan).lastInsertRowId)
    const gMiePedas = Number(insGroup.executeSync(mie, 'Level Pedas', 1, 1).lastInsertRowId)
    for (const lvl of [1, 2, 3, 4, 5]) insMod.executeSync(gMiePedas, `Pedas Lv ${lvl}`, lvl >= 4 ? 1000 : 0)
    const gMieTopping = Number(insGroup.executeSync(mie, 'Topping', 0, 3).lastInsertRowId)
    insMod.executeSync(gMieTopping, '+Bakso', 4000)
    insMod.executeSync(gMieTopping, '+Telor', 3000)

    // Nasi Goreng
    const nasgor = Number(insProd.executeSync('Nasi Goreng', 13000, makanan).lastInsertRowId)
    const gNasgor = Number(insGroup.executeSync(nasgor, 'Topping', 0, 2).lastInsertRowId)
    insMod.executeSync(gNasgor, '+Telor', 3000)
    insMod.executeSync(gNasgor, '+Ayam', 5000)

    // Teh Manis — es/panas
    const teh = Number(insProd.executeSync('Teh Manis', 5000, minuman).lastInsertRowId)
    const gTeh = Number(insGroup.executeSync(teh, 'Suhu', 1, 1).lastInsertRowId)
    insMod.executeSync(gTeh, 'Es', 0)
    insMod.executeSync(gTeh, 'Panas', 0)

    // Kopi Susu
    const kopi = Number(insProd.executeSync('Kopi Susu', 15000, minuman).lastInsertRowId)
    const gKopi = Number(insGroup.executeSync(kopi, 'Suhu', 1, 1).lastInsertRowId)
    insMod.executeSync(gKopi, 'Es', 0)
    insMod.executeSync(gKopi, 'Panas', 0)
    const gKopiExtra = Number(insGroup.executeSync(kopi, 'Extra', 0, 2).lastInsertRowId)
    insMod.executeSync(gKopiExtra, '+Shot Espresso', 5000)
    insMod.executeSync(gKopiExtra, 'Less Sugar', 0)

    d.execSync('COMMIT')
  } catch (e) {
    d.execSync('ROLLBACK')
    throw e
  }
}
