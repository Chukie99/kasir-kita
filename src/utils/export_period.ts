import { getDb } from '../db/database'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'

export type ExportRange = { from: string; to: string } // YYYY-MM-DD inclusive

export function rangeToday(): ExportRange {
  const d = new Date().toISOString().slice(0,10)
  return { from: d, to: d }
}
export function range7Days(): ExportRange {
  const to = new Date(); const from = new Date(); from.setDate(to.getDate()-6)
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }
}
export function rangeThisMonth(): ExportRange {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10)
  const to = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
  return { from, to }
}

export async function exportPeriodCsv(range: ExportRange): Promise<'shared'|'unavailable'> {
  const db = getDb()
  // Detail rows
  const rows = db.getAllSync<{
    invoice: string; created_at: string; total: number; payment_method: string;
    customer_name: string; product_name: string; qty: number; unit_price: number; modifiers_label: string;
  }>(
    `SELECT t.invoice, t.created_at, t.total, t.payment_method, t.customer_name,
            ti.product_name, ti.qty, ti.unit_price, ti.modifiers_label
     FROM transactions t JOIN transaction_items ti ON ti.transaction_id = t.id
     WHERE date(t.created_at) BETWEEN date(?) AND date(?)
       AND COALESCE(t.voided,0)=0
     ORDER BY t.id, ti.id`,
    [range.from, range.to]
  )

  // Summary
  const sumRow = db.getAllSync<{ cnt: number; omzet: number }>(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as omzet FROM transactions WHERE date(created_at) BETWEEN date(?) AND date(?) AND COALESCE(voided,0)=0`,
    [range.from, range.to]
  )[0] || { cnt: 0, omzet: 0 }

  const sumCash = db.getAllSync<{ v:number }>(`SELECT COALESCE(SUM(total),0) as v FROM transactions WHERE date(created_at) BETWEEN date(?) AND date(?) AND payment_method='cash' AND COALESCE(voided,0)=0`, [range.from, range.to])[0]?.v || 0
  const sumQris = db.getAllSync<{ v:number }>(`SELECT COALESCE(SUM(total),0) as v FROM transactions WHERE date(created_at) BETWEEN date(?) AND date(?) AND payment_method='qris' AND COALESCE(voided,0)=0`, [range.from, range.to])[0]?.v || 0
  const sumBon = db.getAllSync<{ v:number }>(`SELECT COALESCE(SUM(total - COALESCE(bon_paid,0)),0) as v FROM transactions WHERE date(created_at) BETWEEN date(?) AND date(?) AND COALESCE(is_bon,0)=1 AND COALESCE(voided,0)=0`, [range.from, range.to])[0]?.v || 0

  const esc = (s: string) => `"${String(s||'').replace(/"/g, '""')}"`
  const lines: string[] = []
  lines.push(`Kasir Kita — Laporan Periode ${range.from} s/d ${range.to}`)
  lines.push(`Ringkasan,Transaksi,${sumRow.cnt},Omzet,${sumRow.omzet},Tunai,${sumCash},QRIS,${sumQris},Piutang BON,${sumBon}`)
  lines.push('')
  lines.push('Invoice,Waktu,Pelanggan,Produk,Varian,Qty,Harga Satuan,Total Baris,Metode')
  for (const r of rows) {
    lines.push([
      r.invoice, r.created_at.slice(0,16), esc(r.customer_name||''), esc(r.product_name), esc(r.modifiers_label||''),
      String(r.qty), String(r.unit_price), String(r.qty*r.unit_price), r.payment_method==='cash'?'Tunai': r.payment_method==='qris'?'QRIS':'BON'
    ].join(','))
  }
  if (rows.length===0) lines.push('TIDAK ADA TRANSAKSI PADA PERIODE INI,,,,,,,,')

  const csv = '\uFEFF' + lines.join('\n')
  const fileName = `laporan-kasir-kita-${range.from}-${range.to}.csv`
  const file = new File(Paths.cache, fileName)
  file.create({ overwrite: true })
  file.write(csv)

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Bagikan Laporan CSV' })
    return 'shared'
  }
  return 'unavailable'
}
