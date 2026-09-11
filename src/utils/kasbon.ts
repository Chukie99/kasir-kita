import { getDb } from '../db/database'

export function payBon(transactionId: number, amount: number): void {
  if (amount <= 0) throw new Error('Nominal harus > 0')
  const row = getDb().getFirstSync<{ total: number; bon_paid: number }>(
    'SELECT total, bon_paid FROM transactions WHERE id = ?', [transactionId]
  )
  if (!row) throw new Error('Transaksi tidak ditemukan')
  const sisa = row.total - (row.bon_paid ?? 0)
  if (amount > sisa) throw new Error(`Kelebihan bayar, sisa bon Rp ${sisa.toLocaleString('id-ID')}`)
  getDb().prepareSync('UPDATE transactions SET bon_paid = bon_paid + ? WHERE id = ?').executeSync(amount, transactionId)
}

export function listKasbon(): any[] {
  return getDb().getAllSync<any>(
    `SELECT t.*, COALESCE(SUM(ti.line_total),0) as items_total
     FROM transactions t LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     WHERE t.is_bon = 1 AND t.voided = 0 AND t.bon_paid < t.total
     GROUP BY t.id ORDER BY t.created_at DESC`
  )
}

export function kasbonSummary(): { count: number; sisa: number; total: number; terbayar: number } {
  const r = getDb().getFirstSync<any>(
    `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total, COALESCE(SUM(bon_paid),0) as terbayar
     FROM transactions WHERE is_bon=1 AND voided=0 AND bon_paid < total`
  ) as any
  return { count: r.count ?? 0, total: r.total ?? 0, terbayar: r.terbayar ?? 0, sisa: (r.total ?? 0) - (r.terbayar ?? 0) }
}
