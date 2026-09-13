import { getDb } from '../db/database'

/** Simple key-value app settings (store name, buy link, theme, etc). */
export function getSetting(key: string, fallback = ''): string {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? fallback
}

export function setSetting(key: string, value: string): void {
  getDb().runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  )
}

export type ThemePref = 'light' | 'dark'

export function getTheme(): ThemePref {
  return getSetting('theme', 'light') === 'dark' ? 'dark' : 'light'
}

// Thermal/struk + label sizes
export type PaperSize =
  | '58mm'
  | '80mm'
  | '57x30'
  | '80x30'
  | '50x50'
  | '80x40'
  | '80x50'
  | '80x80'
  | '57x40'
  | 'A4'

export const PAPER_OPTIONS: { value: PaperSize; label: string; group: string; wMm: number; hMm: number }[] = [
  { value: '58mm', label: '58 mm — Struk Thermal', group: 'STRUK THERMAL', wMm: 58, hMm: 200 },
  { value: '80mm', label: '80 mm — Struk Thermal', group: 'STRUK THERMAL', wMm: 80, hMm: 200 },
  { value: '57x30', label: '57 × 30 mm', group: 'LABEL CONTINUOUS WITH CORE', wMm: 57, hMm: 30 },
  { value: '80x30', label: '80 × 30 mm', group: 'LABEL CONTINUOUS WITH CORE', wMm: 80, hMm: 30 },
  { value: '50x50', label: '50 × 50 mm', group: 'PAPER THERMAL CORE', wMm: 50, hMm: 50 },
  { value: '80x40', label: '80 × 40 mm', group: 'PAPER THERMAL CORE', wMm: 80, hMm: 40 },
  { value: '80x50', label: '80 × 50 mm', group: 'PAPER THERMAL CORE', wMm: 80, hMm: 50 },
  { value: '80x80', label: '80 × 80 mm', group: 'PAPER THERMAL CORE', wMm: 80, hMm: 80 },
  { value: '57x40', label: '57 × 40 mm', group: 'PAPER THERMAL CORELESS', wMm: 57, hMm: 40 },
]

export function normalizePaperSize(v: string): PaperSize {
  if (v === '58mm') return '58mm'
  if (v === '80mm') return '80mm'
  const found = PAPER_OPTIONS.find((o) => o.value === v)
  if (found) return found.value
  return '58mm'
}

export function getPaperSize(): PaperSize {
  const raw = getSetting('paperSize', '58mm')
  return normalizePaperSize(raw)
}

export function getPaperDims(size: PaperSize): { wMm: number; hMm: number } {
  const opt = PAPER_OPTIONS.find((o) => o.value === size)
  if (opt) return { wMm: opt.wMm, hMm: opt.hMm }
  if (size === 'A4') return { wMm: 210, hMm: 297 }
  return { wMm: 58, hMm: 200 }
}
