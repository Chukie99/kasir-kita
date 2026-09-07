import { getDb } from '../db/database'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'

/** Export daily sales report as a CSV file and open the Android share sheet. */
export async function exportDailyReport(): Promise<'shared' | 'unavailable'> {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  const rows = db.getAllSync<{
    invoice: string; created_at: string; total: number; payment_method: string;
    product_name: string; qty: number; unit_price: number; modifiers_label: string;
  }>(
    `SELECT t.invoice, t.created_at, t.total, t.payment_method,
            ti.product_name, ti.qty, ti.unit_price, ti.modifiers_label
     FROM transactions t JOIN transaction_items ti ON ti.transaction_id = t.id
     WHERE date(t.created_at) = date('now','localtime')
     ORDER BY t.id, ti.id`
  )

  const lines: string[] = ['Invoice,Waktu,Produk,Varian,Qty,Harga Satuan,Total Baris,Metode Bayar']
  for (const r of rows) {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    lines.push([
      r.invoice, r.created_at.slice(11, 16), esc(r.product_name), esc(r.modifiers_label),
      String(r.qty), String(r.unit_price),
      String(r.qty * r.unit_price), r.payment_method === 'cash' ? 'Tunai' : 'QRIS',
    ].join(','))
  }
  const revenue = rows.reduce((s: number, r) => s + r.qty * r.unit_price, 0)
  lines.push('')
  lines.push(`TOTAL OMZET,,,,,,${revenue},`)

  const csv = '\uFEFF' + lines.join('\n')
  const fileName = `laporan-pos-${today}.csv`
  const file = new File(Paths.cache, fileName)
  file.create({ overwrite: true })
  file.write(csv)

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Bagikan Laporan Harian' })
    return 'shared'
  }
  return 'unavailable'
}

/** Share a plain-text receipt via the native Share sheet (user picks WhatsApp). */
export async function shareReceipt(receiptText: string): Promise<'shared' | 'unavailable'> {
  const { Share } = await import('react-native')
  await Share.share({ message: receiptText })
  return 'shared'
}
