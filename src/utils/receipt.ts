import { getDb } from '../db/database'
import * as Print from 'expo-print'
import { getSetting, getPaperSize } from './settings'
import type { PaperSize } from './settings'

/** Build a plain-text receipt for a transaction. */
export function buildReceiptText(txId: number): string {
  const db = getDb()
  const tx = db.getFirstSync<{
    invoice: string; created_at: string; total: number; paid: number;
    change: number; payment_method: string; discount: number; customer_name?: string; voided?: number; void_reason?: string;
  }>('SELECT * FROM transactions WHERE id = ?', [txId])
  if (!tx) return 'Struk tidak ditemukan'

  const items = db.getAllSync<{ product_name: string; qty: number; unit_price: number; modifiers_label: string }>(
    'SELECT product_name, qty, unit_price, modifiers_label FROM transaction_items WHERE transaction_id = ?',
    [txId]
  )

  const storeName = getSetting('storeName', 'Kasir Kita')
  const line = '-'.repeat(32)
  const voidHead = tx.voided ? '*** TRANSAKSI VOID ***' : null
  const customerLine = tx.customer_name ? `Atas Nama: ${tx.customer_name}` : null
  const rows = items.map((i) => {
    const mods = i.modifiers_label ? `\n  + ${i.modifiers_label}` : ''
    return `${i.qty}x ${i.product_name}${mods}\n  ${('Rp ' + (i.unit_price * i.qty).toLocaleString('id-ID')).padStart(30)}`
  }).join('\n')

  const pad = (label: string, val: string) => `${label}${val.padStart(32 - label.length)}`
  const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

  return [
    `*${storeName.toUpperCase()}*`,
    ...(voidHead ? [voidHead, line] : []),
    line,
    `No: ${tx.invoice}`,
    ...(customerLine ? [customerLine] : []),
    `Tgl: ${tx.created_at.slice(0, 16)}`,
    line,
    rows,
    line,
    ...(tx.discount > 0 ? [pad('Diskon', '-' + rp(tx.discount))] : []),
    pad('Total', rp(tx.total)),
    pad(tx.payment_method === 'cash' ? 'Tunai' : 'QRIS', rp(tx.paid)),
    ...(tx.payment_method === 'cash' ? [pad('Kembalian', rp(tx.change))] : []),
    line,
    'Terima kasih!',
    'Semoga puas dengan layanan kami',
  ].join('\n')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Build receipt HTML — supports 58mm / 80mm thermal and A4 PDF. Logo from settings. */
export function buildReceiptHtml(txId: number, paperSize?: PaperSize): string {
  const db = getDb()
  const tx = db.getFirstSync<{
    invoice: string; created_at: string; total: number; paid: number;
    change: number; payment_method: string; discount: number; customer_name?: string; voided?: number; void_reason?: string;
  }>('SELECT * FROM transactions WHERE id = ?', [txId])
  if (!tx) return '<p>Struk tidak ditemukan</p>'

  const items = db.getAllSync<{ product_name: string; qty: number; unit_price: number; modifiers_label: string }>(
    'SELECT product_name, qty, unit_price, modifiers_label FROM transaction_items WHERE transaction_id = ?',
    [txId]
  )
  const storeName = getSetting('storeName', 'Kasir Kita')
  const logoUri = getSetting('storeLogoUri', '')
  const size: PaperSize = paperSize ?? getPaperSize()
  const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
  const rows = items.map((i) => {
    const mods = i.modifiers_label ? `<div class="mod">+ ${esc(i.modifiers_label)}</div>` : ''
    return `<div class="item"><div>${i.qty}x ${esc(i.product_name)}${mods}</div><b>${rp(i.unit_price * i.qty)}</b></div>`
  }).join('')

  // Content widths: thermal 58mm ~ 54mm usable (2mm margin), 80mm ~ 74mm, A4 170mm
  const width = size === '80mm' ? '74mm' : size === 'A4' ? '170mm' : '54mm'
  const fontSize = size === 'A4' ? '12px' : '11px'
  const pageSize = size === 'A4' ? 'A4 portrait' : size === '80mm' ? '80mm auto' : '58mm auto'
  const pageMargin = size === 'A4' ? '12mm' : '2mm'
  const logoHtml = logoUri
    ? `<div style="text-align:center;margin-bottom:6px"><img src="${logoUri}" style="max-width:${size === 'A4' ? '120px' : '80px'};max-height:${size === 'A4' ? '80px' : '56px'};object-fit:contain"/></div>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  @page { size: ${pageSize}; margin: ${pageMargin}; }
  body { font-family: monospace; width: ${width}; margin: 0 auto; font-size: ${fontSize}; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2 { text-align: center; margin: 4px 0 2px; letter-spacing: 1px; font-size: ${size === 'A4' ? '16px' : '13px'}; }
  .store-sub { text-align: center; font-size: 9px; color: #555; margin-bottom: 6px; }
  .void { text-align:center; font-weight:900; color:#B91C1C; border:2px solid #B91C1C; padding:4px 0; margin:6px 0; letter-spacing:1px; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .meta { font-size: 10px; word-break: break-word; }
  .item { display: flex; justify-content: space-between; gap: 6px; margin: 3px 0; }
  .mod { color: #444; padding-left: 8px; font-size: 10px; }
  .tot { display: flex; justify-content: space-between; margin: 2px 0; font-weight: bold; }
  .center { text-align: center; font-size: 10px; }
  .badge-size { text-align: center; font-size: 8px; color: #888; margin-top: 8px; }
</style></head><body>
${tx.voided ? '<div class="void">TRANSAKSI VOID — TIDAK DITAGIH</div>' : ''}
${logoHtml}
<h2>${esc(storeName.toUpperCase())}</h2>
${size === 'A4' ? '<div class="store-sub">Struk Penjualan — dicetak dari Kasir Kita</div>' : ''}
<div class="meta">No: ${tx.invoice}<br/>${tx.customer_name ? `Atas Nama: ${esc(tx.customer_name)}<br/>` : ''}Tgl: ${tx.created_at.slice(0, 16)} &bull; Kertas: ${size}${tx.voided && tx.void_reason ? `<br/>Void: ${esc(tx.void_reason)}` : ''}</div>
<div class="line"></div>
${rows}
<div class="line"></div>
${tx.discount > 0 ? `<div class="tot"><span>Diskon</span><span>-${rp(tx.discount)}</span></div>` : ''}
<div class="tot"><span>Total</span><span>${rp(tx.total)}</span></div>
<div class="tot"><span>${tx.payment_method === 'cash' ? 'Tunai' : 'QRIS'}</span><span>${rp(tx.paid)}</span></div>
${tx.payment_method === 'cash' ? `<div class="tot"><span>Kembalian</span><span>${rp(tx.change)}</span></div>` : ''}
<div class="line"></div>
<p class="center">Terima kasih! Semoga puas<br/>dengan layanan kami</p>
<div class="badge-size">Pratinjau: ${size} — pilih 58mm untuk thermal kecil, A4 untuk PDF/email</div>
</body></html>`
}

/** Preview HTML for on-screen WebView/preview before print — same as print but with preview wrapper. */
export function buildReceiptPreviewHtml(txId: number, paperSize?: PaperSize): string {
  return buildReceiptHtml(txId, paperSize)
}

function paperWidthPx(size: PaperSize): number {
  if (size === 'A4') return 595 // A4 @72ppi
  if (size === '80mm') return 227 // 80mm @72ppi
  return 165 // 58mm @72ppi — thermal mini
}
function paperHeightPx(size: PaperSize): number {
  return size === 'A4' ? 842 : 1200 // thermal tinggi biar 1 halaman panjang gak kepotong
}

/** Open the Android print dialog with a formatted receipt. Uses store paperSize setting. */
export async function printReceipt(txId: number, paperSize?: PaperSize): Promise<void> {
  const size = paperSize ?? getPaperSize()
  await Print.printAsync({
    html: buildReceiptHtml(txId, size),
    width: paperWidthPx(size),
    height: paperHeightPx(size),
    margins: { top: 4, right: 4, bottom: 4, left: 4 },
  })
}

/** Export receipt as PDF file and share (for A4 / email). */
export async function shareReceiptPdf(txId: number, paperSize?: PaperSize): Promise<void> {
  const size = paperSize ?? getPaperSize()
  const { uri } = await Print.printToFileAsync({
    html: buildReceiptHtml(txId, size),
    width: paperWidthPx(size),
    height: paperHeightPx(size),
    margins: { top: 4, right: 4, bottom: 4, left: 4 },
  })
  const Sharing = await import('expo-sharing')
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Bagikan struk PDF' })
  }
}
