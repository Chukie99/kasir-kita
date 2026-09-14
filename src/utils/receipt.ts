import { getDb } from '../db/database'
import * as Print from 'expo-print'
import { getSetting, getPaperSize, getPaperDims } from './settings'
import type { PaperSize } from './settings'

/** Plain text untuk Bluetooth ESC/POS — tambah Atas Nama & Kasir kalau ada */
export function buildReceiptText(txId: number): string {
  const db = getDb()
  const tx = db.getFirstSync<{
    invoice: string; created_at: string; total: number; paid: number;
    change: number; payment_method: string; discount: number; customer_name?: string; voided?: number; void_reason?: string; is_bon?: number; bon_paid?: number; bon_due_date?: string | null;
  }>('SELECT * FROM transactions WHERE id = ?', [txId])
  if (!tx) return 'Struk tidak ditemukan'
  const items = db.getAllSync<{ product_name: string; qty: number; unit_price: number; modifiers_label: string }>(
    'SELECT product_name, qty, unit_price, modifiers_label FROM transaction_items WHERE transaction_id = ?',
    [txId]
  )
  const storeName = getSetting('storeName', 'Kasir Kita')
  const kasirName = getSetting('kasirName', '').trim()
  let paperW = '58mm'
  try { paperW = getPaperSize() } catch {}
  const is80 = paperW.includes('80')
  const is50 = paperW.includes('50')
  const chars = is80 ? 48 : is50 ? 28 : 32
  const line = '-'.repeat(chars)
  const voidHead = tx.voided ? '*** TRANSAKSI VOID ***' : null
  const customerLine = tx.customer_name ? `Atas Nama: ${tx.customer_name}` : null
  const bonLine = tx.is_bon ? `BON — Sisa: Rp ${((tx.total) - (tx.bon_paid ?? 0)).toLocaleString('id-ID')}${tx.bon_due_date ? ' (Jatuh tempo '+tx.bon_due_date+')' : ''}` : null
  const bonPaidLine = tx.is_bon ? `Dibayar: Rp ${(tx.bon_paid ?? 0).toLocaleString('id-ID')}` : null
  const rows = items.map((i) => {
    const mods = i.modifiers_label ? `\n  + ${i.modifiers_label}` : ''
    return `${i.qty}x ${i.product_name}${mods}\n  ${('Rp ' + (i.unit_price * i.qty).toLocaleString('id-ID')).padStart(chars - 2)}`
  }).join('\n')
  const pad = (label: string, val: string) => `${label}${val.padStart(chars - label.length)}`
  const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
  return [
    `*${storeName.toUpperCase()}*`,
    ...(voidHead ? [voidHead, line] : []),
    ...(kasirName ? [`Kasir: ${kasirName}`] : []),
    line,
    `No: ${tx.invoice}`,
    ...(customerLine ? [customerLine] : []),
    ...(bonLine ? [bonLine] : []),
    ...(bonPaidLine ? [bonPaidLine] : []),
    `Tgl: ${tx.created_at.slice(0, 16)}`,
    line,
    rows,
    line,
    ...(tx.discount > 0 ? [pad('Diskon', '-' + rp(tx.discount))] : []),
    pad('TOTAL', rp(tx.total)),
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

async function getLogoDataUri(): Promise<string | null> {
  const uri = getSetting('storeLogoUri','')
  if(!uri) return null
  try {
    const { File } = await import('expo-file-system')
    const f: any = new (File as any)(uri)
    if (f.arrayBuffer) {
      const buf: ArrayBuffer = await f.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let bin=''; for(let i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i])
      const b64 = typeof btoa!=='undefined' ? btoa(bin) : (globalThis as any).btoa(bin)
      const ext = uri.split('.').pop()?.toLowerCase() || 'png'
      const mime = ext==='jpg'||ext==='jpeg' ? 'image/jpeg' : 'image/png'
      return `data:${mime};base64,${b64}`
    }
  } catch {}
  try {
    const FS: any = await import('expo-file-system/legacy')
    if (FS.readAsStringAsync) {
      const b64 = await FS.readAsStringAsync(uri, { encoding: (FS as any).EncodingType ? (FS as any).EncodingType.Base64 : 'base64' })
      const mime = uri.endsWith('.jpg')||uri.endsWith('.jpeg') ? 'image/jpeg':'image/png'
      return `data:${mime};base64,${b64}`
    }
  } catch {}
  return null
}

export async function buildReceiptHtmlAsync(txId: number, paperSize?: PaperSize): Promise<string> {
  const dataUri = await getLogoDataUri()
  const html = buildReceiptHtml(txId, paperSize)
  if (!dataUri) return html
  const uri = getSetting('storeLogoUri','')
  if (uri && html.includes(uri)) return html.replaceAll(uri, dataUri)
  if (html.includes('<img')) return html
  const size: PaperSize = paperSize ?? getPaperSize()
  const dims = getPaperDims(size)
  const maxW = dims.wMm >= 70 ? '110px' : '84px'
  const maxH = dims.wMm >= 70 ? '70px' : '56px'
  return html.replace('<h2>', `<div style="text-align:center;margin-bottom:6px"><img src="${dataUri}" style="max-width:${maxW};max-height:${maxH};object-fit:contain"/></div><h2>`)
}

/** FIX CLEAN — table 100% mekar + margin 1.5mm + logo + thank you 2 baris + tanpa badge + auto-cut */
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
  const kasirName = getSetting('kasirName', '').trim()
  const logoUri = getSetting('storeLogoUri', '')
  const size: PaperSize = paperSize ?? getPaperSize()
  const dims = getPaperDims(size)
  const isA4 = size === 'A4'
  const isWide = dims.wMm >= 70
  // FIX: thermal auto height, bukan 200mm fix
  const pageSize = isA4 ? 'A4 portrait' : `${dims.wMm}mm auto`
  const pageMargin = isA4 ? '10mm' : '0mm'
  const logoMaxW = isA4 ? '120px' : isWide ? '110px' : '84px'
  const logoMaxH = isA4 ? '80px' : isWide ? '70px' : '56px'
  const logoHtml = logoUri
    ? `<div style="text-align:center;margin-bottom:4px"><img src="${logoUri}" style="max-width:${logoMaxW};max-height:${logoMaxH};object-fit:contain"/></div>`
    : ''
  const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
  // FIX: table 100% bukan flex — biar gak jadi |---|
  const rows = items.map((i) => {
    const mods = i.modifiers_label ? `<div style="color:#333;padding-left:4px;font-size:8px">+ ${esc(i.modifiers_label)}</div>` : ''
    return `<tr><td style="padding:1.5px 0;font-size:${isWide ? '11px' : '10.5px'}">${i.qty}x ${esc(i.product_name)}${mods}</td><td style="padding:1.5px 0;font-size:${isWide ? '11px' : '10.5px'};text-align:right;font-weight:700;white-space:nowrap">${rp(i.unit_price * i.qty)}</td></tr>`
  }).join('')
  // meta: No + Tgl + Atas Nama & Kasir conditional
  const metaLines = [
    `No: ${esc(tx.invoice)}`,
    tx.customer_name ? `Atas Nama: ${esc(tx.customer_name)}` : null,
    `Tgl: ${tx.created_at.slice(0, 16)}`,
    kasirName ? `Kasir: ${esc(kasirName)}` : null,
    tx.voided && tx.void_reason ? `Void: ${esc(tx.void_reason)}` : null,
  ].filter(Boolean).join('<br/>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  *{box-sizing:border-box} html,body{margin:0;padding:0;width:100%}
  @page{size:${pageSize};margin:${pageMargin}}
  body{font-family:monospace;width:100%;margin:0 auto;font-size:${isWide ? '11px' : '10.5px'};color:#000;padding:${isA4 ? '0' : '1.5mm 1.5mm 2mm'};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h2{text-align:center;margin:1px 0 1px;font-size:${isA4 ? '18px' : isWide ? '16px' : '14px'};font-weight:900;letter-spacing:0.5px}
  .meta{font-size:${isA4 ? '10px' : '8.5px'};text-align:center;color:#444;line-height:1.4}
  .line{border-top:1px dashed #000;margin:4px 0}
  table{width:100%;border-collapse:collapse}
  .tot td{font-weight:900;font-size:${isA4 ? '14px' : isWide ? '13px' : '12px'};padding:1.5px 0}
  .center{text-align:center;font-size:9px;line-height:1.45;margin-top:6px}
  .void{text-align:center;font-weight:900;color:#B91C1C;border:1.5px solid #B91C1C;padding:3px 0;margin:4px 0}
</style></head><body>
${tx.voided ? '<div class="void">TRANSAKSI VOID — TIDAK DITAGIH</div>' : ''}${(tx as any).is_bon ? `<div style="text-align:center;font-weight:900;color:#B45309;border:1px dashed #F59E0B;padding:3px 0;margin:4px 0;">BON — Sisa Rp ${((tx as any).total - ((tx as any).bon_paid ?? 0)).toLocaleString('id-ID')}${(tx as any).bon_due_date ? ' • Tgl '+(tx as any).bon_due_date : ''}</div>` : ''}
${logoHtml}
<h2>${esc(storeName.toUpperCase())}</h2>
<div class="meta">${metaLines}</div>
<div class="line"></div>
<table>${rows}</table>
<div class="line"></div>
<table class="tot">
${tx.discount > 0 ? `<tr><td style="font-weight:normal;font-size:10px">Diskon</td><td style="font-weight:normal;font-size:10px;text-align:right">-${rp(tx.discount)}</td></tr>` : ''}
<tr><td>TOTAL</td><td style="text-align:right">${rp(tx.total)}</td></tr>
<tr><td style="font-weight:normal;font-size:10px">${tx.payment_method === 'cash' ? 'Tunai' : 'QRIS'}</td><td style="font-weight:normal;font-size:10px;text-align:right">${rp(tx.paid)}</td></tr>
${tx.payment_method === 'cash' ? `<tr><td style="font-weight:normal;font-size:10px">Kembalian</td><td style="font-weight:normal;font-size:10px;text-align:right">${rp(tx.change)}</td></tr>` : ''}
</table>
<div class="line"></div>
<div class="center">Terima kasih!<br/>Semoga puas dengan layanan kami</div>
</body></html>`
}

export function buildReceiptPreviewHtml(txId: number, paperSize?: PaperSize): string {
  return buildReceiptHtml(txId, paperSize)
}

function mmToPt(mm: number): number { return mm * 2.83464567 }
function paperPx(size: PaperSize): { w: number; h: number } {
  const d = getPaperDims(size)
  if (size === 'A4') return { w: 595, h: 842 }
  // FIX: tinggi auto bukan 200mm fix — biar gak kepanjangan, cutter pas di thank you
  return { w: Math.round(mmToPt(d.wMm)), h: Math.round(mmToPt(100)) }
}

export async function printReceipt(txId: number, paperSize?: PaperSize): Promise<void> {
  const size = paperSize ?? getPaperSize()
  const { w } = paperPx(size)
  let html = buildReceiptHtml(txId, size)
  try { html = await buildReceiptHtmlAsync(txId, size) } catch {}
  // FIX: height auto — biar kertas continuous gak kepanjangan & thank you gak kepotong
  await Print.printAsync({ html, width: w, orientation: size === 'A4' ? ('portrait' as any) : undefined })
}

export async function shareReceiptPdf(txId: number, paperSize?: PaperSize): Promise<void> {
  const size = paperSize ?? getPaperSize()
  if (size === 'A4') {
    const { w, h } = paperPx(size)
    let html = buildReceiptHtml(txId, size)
    try { html = await buildReceiptHtmlAsync(txId, size) } catch {}
    const { uri } = await Print.printToFileAsync({ html, width: w, height: h })
    const Sharing = await import('expo-sharing')
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Bagikan struk PDF' })
    return
  }
  await shareReceiptPdfLib(txId, size)
}

async function shareReceiptPdfLib(txId: number, size: PaperSize): Promise<void> {
  const db = getDb()
  const tx = db.getFirstSync<{
    invoice: string; created_at: string; total: number; paid: number; change: number; payment_method: string; discount: number; customer_name?: string; voided?: number; void_reason?: string; is_bon?: number; bon_paid?: number; bon_due_date?: string | null;
  }>('SELECT * FROM transactions WHERE id = ?', [txId])
  if (!tx) return
  const items = db.getAllSync<{ product_name: string; qty: number; unit_price: number; modifiers_label: string; line_total: number }>(
    'SELECT product_name, qty, unit_price, modifiers_label, line_total FROM transaction_items WHERE transaction_id = ?',
    [txId]
  )
  const storeName = getSetting('storeName', 'Kasir Kita')
  const kasirName = getSetting('kasirName', '').trim()
  const dims = getPaperDims(size)
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Courier)
  const fontBold = await pdf.embedFont(StandardFonts.CourierBold)
  let logoImg: any = null; let logoDims: { w:number; h:number } | null = null
  try {
    const uri = getSetting('storeLogoUri','')
    if (uri) {
      let bytes: Uint8Array | null = null
      try { const { File } = await import('expo-file-system'); const f:any=new (File as any)(uri); const buf:ArrayBuffer=await f.arrayBuffer(); bytes=new Uint8Array(buf) } catch {}
      if (!bytes) { try { const FS:any=await import('expo-file-system/legacy'); const b64=await FS.readAsStringAsync(uri,{encoding:'base64' as any}); const bin=typeof atob!=='undefined'?atob(b64):(globalThis as any).atob(b64); bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i) } catch {}}
      if (bytes) {
        try { logoImg = await pdf.embedPng(bytes) } catch { try { logoImg = await pdf.embedJpg(bytes) } catch {} }
        if (logoImg) {
          const maxW = mmToPt(dims.wMm * 0.5)
          const iw=logoImg.width, ih=logoImg.height
          const scale=Math.min(1, maxW/iw, mmToPt(14)/ih)
          logoDims={ w: iw*scale, h: ih*scale }
        }
      }
    }
  } catch {}
  const pageWidth = mmToPt(dims.wMm)
  const margin = mmToPt(1.5)
  const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
  type Line = { text: string; bold?: boolean; size: number; align?: 'left' | 'center' | 'right'; gap?: number }
  const lines: Line[] = []
  if (tx.voided) { lines.push({ text: '*** TRANSAKSI VOID ***', bold: true, size: 8, align: 'center' }); lines.push({ text: '-'.repeat(28), size: 6, align: 'center' }) }
  if ((tx as any).is_bon) { const sisa = (tx as any).total - ((tx as any).bon_paid ?? 0); lines.push({ text: `BON — Sisa Rp ${sisa.toLocaleString('id-ID')}${(tx as any).bon_due_date ? ' Tgl '+(tx as any).bon_due_date : ''}`, bold: true, size: 7, align: 'center' }) }
  lines.push({ text: storeName.toUpperCase().slice(0, 32), bold: true, size: dims.wMm <= 50 ? 9 : 11, align: 'center' })
  lines.push({ text: `-`.repeat(28), size: 6, align: 'center' })
  lines.push({ text: `No: ${tx.invoice}`, size: 7, align: 'center' })
  if (tx.customer_name) lines.push({ text: `Atas Nama: ${tx.customer_name}`.slice(0, 36), size: 7, align: 'center' })
  if (kasirName) lines.push({ text: `Kasir: ${kasirName}`.slice(0, 36), size: 6, align: 'center' })
  lines.push({ text: `Tgl: ${tx.created_at.slice(0, 16)}`, size: 6, align: 'center' })
  lines.push({ text: '-'.repeat(28), size: 6, align: 'center' })
  const maxChars = dims.wMm <= 50 ? 22 : dims.wMm <= 57 ? 28 : 36
  for (const it of items) {
    const mods = it.modifiers_label ? ` +${it.modifiers_label}` : ''
    let name = `${it.qty}x ${it.product_name}${mods}`
    while (name.length > maxChars) { lines.push({ text: name.slice(0, maxChars), size: 7 }); name = name.slice(maxChars) }
    lines.push({ text: name, size: 7 })
    lines.push({ text: rp(it.line_total), bold: true, size: 7, align: 'right', gap: 0 })
  }
  lines.push({ text: '-'.repeat(28), size: 6, align: 'center' })
  if (tx.discount > 0) lines.push({ text: `Diskon -${rp(tx.discount)}`, size: 7, align: 'right' })
  lines.push({ text: `TOTAL ${rp(tx.total)}`, bold: true, size: 9, align: 'right' })
  lines.push({ text: `${tx.payment_method === 'cash' ? 'Tunai' : 'QRIS'} ${rp(tx.paid)}`, size: 7, align: 'right' })
  if (tx.payment_method === 'cash') lines.push({ text: `Kembalian ${rp(tx.change)}`, size: 7, align: 'right' })
  lines.push({ text: '-'.repeat(28), size: 6, align: 'center' })
  // FIX: 2 baris biar gak kepotong samping di 58mm
  lines.push({ text: 'Terima kasih!', size: 7, align: 'center' })
  lines.push({ text: 'Semoga puas dengan layanan kami', size: 6, align: 'center' })

  // FIX: height AUTO pas isi — bukan 200mm fix, cutter pas di thank you
  const estH = lines.reduce((h, l) => h + (l.gap === 0 ? 7 : l.size + 3), 12) + (logoDims ? logoDims.h + 6 : 0) + 10
  const useH = estH + 8
  const page = pdf.addPage([pageWidth, useH])
  let curY = useH - 6
  if (logoImg && logoDims) {
    const lx = (pageWidth - logoDims.w)/2
    page.drawImage(logoImg, { x: lx, y: curY - logoDims.h, width: logoDims.w, height: logoDims.h })
    curY -= (logoDims.h + 4)
  }
  const drawLine = (l: Line) => {
    const f = l.bold ? fontBold : font
    const textWidth = f.widthOfTextAtSize(l.text, l.size)
    let x = margin
    if (l.align === 'center') x = (pageWidth - textWidth) / 2
    else if (l.align === 'right') x = pageWidth - margin - textWidth
    page.drawText(l.text, { x, y: curY, size: l.size, font: f, color: rgb(0, 0, 0) })
    curY -= (l.gap === 0 ? 7 : l.size + 3)
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
