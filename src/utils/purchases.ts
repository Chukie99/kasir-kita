import { getDb } from '../db/database'

export function addPurchase(supplierName: string, items: { name: string; qty: number; cost: number }[], paid = 0, note = ''): number {
  const name = supplierName.trim() || 'Umum'
  const total = items.reduce((s, i) => s + i.qty * i.cost, 0)
  if (items.length === 0) throw new Error('Item kulakan kosong')
  if (paid < 0 || paid > total) throw new Error('Paid salah')
  // ensure supplier exists
  getDb().prepareSync('INSERT OR IGNORE INTO suppliers (name) VALUES (?)').executeSync(name)
  const sup = getDb().getFirstSync<{ id: number }>('SELECT id FROM suppliers WHERE name=? COLLATE NOCASE', [name]) as any
  const db = getDb()
  db.execSync('BEGIN')
  try {
    const pid = Number(db.prepareSync('INSERT INTO purchases (supplier_id, supplier_name, total, paid, note) VALUES (?, ?, ?, ?, ?)').executeSync(sup?.id ?? null, name, total, paid, note.trim()).lastInsertRowId)
    const ins = db.prepareSync('INSERT INTO purchase_items (purchase_id, name, qty, cost, line_total) VALUES (?, ?, ?, ?, ?)')
    for (const it of items) ins.executeSync(pid, it.name.trim(), it.qty, it.cost, it.qty * it.cost)
    db.execSync('COMMIT')
    return pid
  } catch (e) { try { db.execSync('ROLLBACK') } catch {}; throw e }
}

export function payPurchase(purchaseId: number, amount: number): void {
  if (amount <= 0) throw new Error('Nominal harus > 0')
  const r = getDb().getFirstSync<{ total: number; paid: number }>('SELECT total, paid FROM purchases WHERE id=?', [purchaseId]) as any
  if (!r) throw new Error('Kulakan tidak ditemukan')
  const sisa = r.total - r.paid
  if (amount > sisa) throw new Error(`Kelebihan, sisa hutang Rp ${sisa.toLocaleString('id-ID')}`)
  getDb().prepareSync('UPDATE purchases SET paid = paid + ? WHERE id=?').executeSync(amount, purchaseId)
}

export function purchaseSummary(): { total: number; paid: number; sisa: number; count: number } {
  const r = getDb().getFirstSync<any>('SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total, COALESCE(SUM(paid),0) as paid FROM purchases') as any
  return { count: r.count ?? 0, total: r.total ?? 0, paid: r.paid ?? 0, sisa: (r.total ?? 0) - (r.paid ?? 0) }
}

export function labaRugi(period: 'today'|'week'|'month'): { omzet: number; hpp: number; laba: number; kulakan: number } {
  const wc = period === 'today' ? "date(t.created_at)=date('now','localtime')" : period === 'week' ? "date(t.created_at)>=date('now','-6 days')" : "strftime('%Y-%m', t.created_at)=strftime('%Y-%m','now','localtime')"
  const omzet = (getDb().getFirstSync<{ s: number }>(`SELECT COALESCE(SUM(total),0) as s FROM transactions t WHERE COALESCE(voided,0)=0 AND ${wc}`) as any)?.s ?? 0
  // HPP: sum qty * cost (fallback 0 if cost null)
  const hpp = (getDb().getFirstSync<{ s: number }>(`SELECT COALESCE(SUM(ti.qty * COALESCE(p.cost,0)),0) as s FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id LEFT JOIN products p ON p.name=ti.product_name COLLATE NOCASE WHERE COALESCE(t.voided,0)=0 AND ${wc}`) as any)?.s ?? 0
  const kulakan = (getDb().getFirstSync<{ s: number }>(`SELECT COALESCE(SUM(total),0) as s FROM purchases WHERE ${wc.replace(/t\.created_at/g,'created_at')}`) as any)?.s ?? 0
  return { omzet, hpp, laba: omzet - hpp, kulakan }
}
