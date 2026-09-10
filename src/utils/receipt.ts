import { getDb } from '../db/database'
import * as Print from 'expo-print'
import { getSetting, getPaperSize, getPaperDims } from './settings'
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

/** Build receipt HTML — supports all thermal sizes + A4 */
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
  const dims = getPaperDims(size)
  const isA4 = size === 'A4'
  const width = isA4 ? '170mm' : `${Math.max(46, dims.wMm - 4)}mm`
  const fontSize = isA4 ? '12px' : dims.wMm <= 50 ? '9px' : '10px'
  const pageSize = isA4 ? 'A4 portrait' : `${dims.wMm}mm ${dims.hMm}mm`
  const pageMargin = isA4 ? '12mm' : '2mm'
  const logoHtml = logoUri
    ? `<div style="text-align:center;margin-bottom:6px"><img src="${logoUri}" style="max-width:${isA4 ? '120px' : '72px'};max-height:${isA4 ? '80px' : '48px'};object-fit:contain"/></div>`
    : ''
  const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
  const rows = items.map((i) => {
    const mods = i.modifiers_label ? `<div class="mod">+ ${esc(i.modifiers_label)}</div>` : ''
    return `<div class="item"><div>${i.qty}x ${esc(i.product_name)}${mods}</div><b>${rp(i.unit_price * i.qty)}</b></div>`
  }).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  @page { size: ${pageSize}; margin: ${pageMargin}; }
  body { font-family: monospace; width: ${width}; margin: 0 auto; font-size: ${fontSize}; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2 { text-align: center; margin: 4px 0 2px; letter-spacing: 1px; font-size: ${isA4 ? '16px' : dims.wMm <= 50 ? '11px' : '13px'}; }
  .store-sub { text-align: center; font-size: 9px; color: #555; margin-bottom: 6px; }
  .void { text-align:center; font-weight:900; color:#B91C1C; border:2px solid #B91C1C; padding:4px 0; margin:6px 0; letter-spacing:1px; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .meta { font-size: ${isA4 ? '10px' : '8px'}; word-break: break-word; }
  .item { display: flex; justify-content: space-between; gap: 6px; margin: 3px 0; }
  .mod { color: #444; padding-left: 8px; font-size: 9px; }
  .tot { display: flex; justify-content: space-between; margin: 2px 0; font-weight: bold; }
  .center { text-align: center; font-size: 9px; }
  .badge-size { text-align: center; font-size: 7px; color: #888; margin-top: 8px; }
</style></head><body>
${tx.voided ? '<div class="void">TRANSAKSI VOID — TIDAK DITAGIH</div>' : ''}
${logoHtml}
<h2>${esc(storeName.toUpperCase())}</h2>
${isA4 ? '<div class="store-sub">Struk Penjualan — dicetak dari Kasir Kita</div>' : ''}
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
<div class="badge-size">Kertas: ${size} (${dims.wMm}×${dims.hMm} mm)</div>
</body></html>`
}

export function buildReceiptPreviewHtml(txId: number, paperSize?: PaperSize): string {
  return buildReceiptHtml(txId, paperSize)
}

function mmToPt(mm: number): number { return mm * 2.83464567 }
function paperPx(size: PaperSize): { w: number; h: number } {
  const d = getPaperDims(size)
  if (size === 'A4') return { w: 595, h: 842 }
  return { w: Math.round(mmToPt(d.wMm)), h: Math.round(mmToPt(d.hMm)) }
}

export async function printReceipt(txId: number, paperSize?: PaperSize): Promise<void> {
  const size = paperSize ?? getPaperSize()
  const { w, h } = paperPx(size)
  // continuous: use tall height so thermal roll not cut; label sizes use exact h
  const isLabel = size !== 'A4'
  await Print.printAsync({ html: buildReceiptHtml(txId, size), width: w, height: isLabel ? Math.max(h, 600) : h })
}

export async function shareReceiptPdf(txId: number, paperSize?: PaperSize): Promise<void> {
  const size = paperSize ?? getPaperSize()
  if (size === 'A4') {
    const { w, h } = paperPx(size)
    const { uri } = await Print.printToFileAsync({ html: buildReceiptHtml(txId, size), width: w, height: h })
    const Sharing = await import('expo-sharing')
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Bagikan struk PDF' })
    return
  }
  await shareReceiptPdfLib(txId, size)
}

async function shareReceiptPdfLib(txId: number, size: PaperSize): Promise<void> {
  const db = getDb()
  const tx = db.getFirstSync<{
    invoice: string; created_at: string; total: number; paid: number; change: number; payment_method: string; discount: number; customer_name?: string; voided?: number; void_reason?: string;
  }>('SELECT * FROM transactions WHERE id = ?', [txId])
  if (!tx) return
  const items = db.getAllSync<{ product_name: string; qty: number; unit_price: number; modifiers_label: string; line_total: number }>(
    'SELECT product_name, qty, unit_price, modifiers_label, line_total FROM transaction_items WHERE transaction_id = ?',
    [txId]
  )
  const storeName = getSetting('storeName', 'Kasir Kita')
  const dims = getPaperDims(size)
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Courier)
  const fontBold = await pdf.embedFont(StandardFonts.CourierBold)
  const pageWidth = mmToPt(dims.wMm)
  const pageHeight = mmToPt(dims.hMm)
  const margin = mmToPt(2)
  const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
  type Line = { text: string; bold?: boolean; size: number; align?: 'left' | 'center' | 'right'; gap?: number }
  const lines: Line[] = []
  if (tx.voided) { lines.push({ text: '*** TRANSAKSI VOID ***', bold: true, size: 7, align: 'center' }); lines.push({ text: '-'.repeat(24), size: 5, align: 'center' }) }
  lines.push({ text: storeName.toUpperCase().slice(0, 32), bold: true, size: dims.wMm <= 50 ? 8 : 9, align: 'center' })
  lines.push({ text: '-'.repeat(24), size: 5, align: 'center' })
  lines.push({ text: `No: ${tx.invoice}`, size: 6, align: 'left' })
  if (tx.customer_name) lines.push({ text: `Atas Nama: ${tx.customer_name}`.slice(0, 36), size: 6, align: 'left' })
  lines.push({ text: `Tgl: ${tx.created_at.slice(0, 16)}  ${size}`, size: 5, align: 'left' })
  lines.push({ text: '-'.repeat(24), size: 5, align: 'center' })
  const maxChars = dims.wMm <= 50 ? 20 : dims.wMm <= 57 ? 24 : 32
  for (const it of items) {
    const mods = it.modifiers_label ? ` +${it.modifiers_label}` : ''
    let name = `${it.qty}x ${it.product_name}${mods}`
    while (name.length > maxChars) { lines.push({ text: name.slice(0, maxChars), size: 6 }); name = name.slice(maxChars) }
    lines.push({ text: name, size: 6 })
    lines.push({ text: rp(it.line_total), size: 6, align: 'right', gap: 0 })
  }
  lines.push({ text: '-'.repeat(24), size: 5, align: 'center' })
  if (tx.discount > 0) lines.push({ text: `Diskon -${rp(tx.discount)}`, size: 6, align: 'right' })
  lines.push({ text: `Total ${rp(tx.total)}`, bold: true, size: 7, align: 'right' })
  lines.push({ text: `${tx.payment_method === 'cash' ? 'Tunai' : 'QRIS'} ${rp(tx.paid)}`, size: 6, align: 'right' })
  if (tx.payment_method === 'cash') lines.push({ text: `Kembalian ${rp(tx.change)}`, size: 6, align: 'right' })
  lines.push({ text: '-'.repeat(24), size: 5, align: 'center' })
  lines.push({ text: 'Terima kasih!', size: 6, align: 'center' })

  // Estimate needed height; if taller than label height, use continuous tall page
  const estH = lines.reduce((h, l) => h + (l.gap === 0 ? 6 : l.size + 2.5), 10) + 8
  const useH = Math.max(pageHeight, estH + margin * 2)
  const page = pdf.addPage([pageWidth, useH])
  let curY = useH - 7
  const drawLine = (l: Line) => {
    const f = l.bold ? fontBold : font
    const textWidth = f.widthOfTextAtSize(l.text, l.size)
    let x = margin
    if (l.align === 'center') x = (pageWidth - textWidth) / 2
    else if (l.align === 'right') x = pageWidth - margin - textWidth
    page.drawText(l.text, { x, y: curY, size: l.size, font: f, color: rgb(0, 0, 0) })
    curY -= (l.gap === 0 ? 6 : l.size + 2.5)
  }
  for (const l of lines) drawLine(l)
  const bytes = await pdf.save()
  const { File, Paths } = await import('expo-file-system')
  const out = new File(Paths.cache, `struk-${tx.invoice}-${size}.pdf`)
  if (out.exists) out.delete()
  out.create({ overwrite: true } as any)
  const b64 = (() => { let bin=''; for(let i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]); return typeof btoa!=='undefined'?btoa(bin):(globalThis as any).btoa(bin) })()
  out.write(b64, { encoding: 'base64' } as any)
  const Sharing = await import('expo-sharing')
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(out.uri, { mimeType: 'application/pdf', dialogTitle: `Struk ${tx.invoice} (${size})` })
}
