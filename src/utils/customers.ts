import { getDb } from '../db/database'

export interface CustomerAgg { name: string; phone: string; count: number; total: number; paid: number; sisa: number; last_at: string }

export function upsertCustomer(name: string, phone = ''): number | null {
  const n = name.trim()
  if (!n) return null
  const existing = getDb().getFirstSync<{ id: number }>('SELECT id FROM customers WHERE name = ? COLLATE NOCASE', [n])
  if (existing) {
    if (phone.trim()) getDb().prepareSync('UPDATE customers SET phone=? WHERE id=?').executeSync(phone.trim(), existing.id)
    return existing.id
  }
  return Number(getDb().prepareSync('INSERT INTO customers (name, phone) VALUES (?, ?)').executeSync(n, phone.trim()).lastInsertRowId)
}

export function listCustomerAgg(): CustomerAgg[] {
  return getDb().getAllSync<CustomerAgg>(`
    SELECT COALESCE(t.customer_name,'') as name,
           COALESCE(c.phone,'') as phone,
           COUNT(*) as count,
           SUM(t.total) as total,
           SUM(COALESCE(t.bon_paid,0)) as paid,
           SUM(t.total - COALESCE(t.bon_paid,0)) as sisa,
           MAX(t.created_at) as last_at
    FROM transactions t LEFT JOIN customers c ON c.name = t.customer_name COLLATE NOCASE
    WHERE t.is_bon=1 AND COALESCE(t.voided,0)=0 AND t.bon_paid < t.total AND COALESCE(t.customer_name,'') <> ''
    GROUP BY t.customer_name COLLATE NOCASE
    ORDER BY sisa DESC
  `)
}

export function customerBons(name: string): any[] {
  return getDb().getAllSync<any>(
    `SELECT t.*, GROUP_CONCAT(ti.qty || 'x ' || ti.product_name, ', ') AS items
     FROM transactions t LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     WHERE t.customer_name = ? COLLATE NOCASE AND t.is_bon=1 AND COALESCE(t.voided,0)=0 AND t.bon_paid < t.total
     GROUP BY t.id ORDER BY t.created_at DESC`,
    [name.trim()]
  )
}

export function waTextForCustomer(name: string, rows: any[]): string {
  const totalSisa = rows.reduce((s: number, r: any) => s + (r.total - (r.bon_paid ?? 0)), 0)
  const lines = rows.map((r: any) => `• ${r.invoice} sisa Rp ${(r.total - (r.bon_paid ?? 0)).toLocaleString('id-ID')} (${r.created_at.slice(0,10)}${r.bon_due_date ? ` tempo ${r.bon_due_date}` : ''})`).join('\n')
  return `Halo ${name} — tagihan kasbon di Kasir Kita total sisa Rp ${totalSisa.toLocaleString('id-ID')}:\n${lines}\nMohon dilunasi ya 🙏`
}
