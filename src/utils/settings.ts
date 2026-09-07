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
export type PaperSize = '58mm' | '80mm' | 'A4'
export function getPaperSize(): PaperSize {
  const v = getSetting('paperSize', '58mm')
  return (v === '80mm' || v === 'A4' ? v : '58mm') as PaperSize
}
