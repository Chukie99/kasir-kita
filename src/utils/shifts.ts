import { getDb } from '../db/database'

export interface Shift { id: number; opened_at: string; closed_at: string | null; opening_cash: number; closing_cash: number | null; note: string | null; status: 'open'|'closed' }

export function getOpenShift(): Shift | null {
  return getDb().getFirstSync<Shift>("SELECT * FROM shifts WHERE status='open' ORDER BY id DESC LIMIT 1") ?? null
}

export function openShift(openingCash: number, note = ''): number {
  if (getOpenShift()) throw new Error('Shift masih buka — tutup dulu sebelum buka baru')
  const id = Number(getDb().prepareSync('INSERT INTO shifts (opening_cash, note) VALUES (?, ?)').executeSync(openingCash, note).lastInsertRowId)
  return id
}

export function closeShift(closingCash: number, note = ''): Shift {
  const open = getOpenShift()
  if (!open) throw new Error('Tidak ada shift terbuka')
  getDb().prepareSync("UPDATE shifts SET closed_at=datetime('now','localtime'), closing_cash=?, note=COALESCE(?, note), status='closed' WHERE id=?").executeSync(closingCash, note, open.id)
  return getDb().getFirstSync<Shift>('SELECT * FROM shifts WHERE id=?', [open.id]) as Shift
}

export function shiftSummary(shiftId: number): { cash: number; qris: number; voided: number; bonSisa: number } {
  const cash = (getDb().getFirstSync<{ s: number }>("SELECT COALESCE(SUM(total),0) as s FROM transactions WHERE voided=0 AND payment_method='cash' AND is_bon=0 AND created_at >= (SELECT opened_at FROM shifts WHERE id=?)", [shiftId]) as any)?.s ?? 0
  const qris = (getDb().getFirstSync<{ s: number }>("SELECT COALESCE(SUM(total),0) as s FROM transactions WHERE voided=0 AND payment_method='qris' AND created_at >= (SELECT opened_at FROM shifts WHERE id=?)", [shiftId]) as any)?.s ?? 0
  const bonSisa = (getDb().getFirstSync<{ s: number }>("SELECT COALESCE(SUM(total - bon_paid),0) as s FROM transactions WHERE voided=0 AND is_bon=1 AND bon_paid < total", []) as any)?.s ?? 0
  const voided = (getDb().getFirstSync<{ c: number }>("SELECT COUNT(*) as c FROM transactions WHERE voided=1 AND created_at >= (SELECT opened_at FROM shifts WHERE id=?)", [shiftId]) as any)?.c ?? 0
  return { cash, qris, bonSisa, voided }
}

export function listShifts(limit = 20): Shift[] {
  return getDb().getAllSync<Shift>('SELECT * FROM shifts ORDER BY id DESC LIMIT ?', [limit])
}

export function addCashMovement(shiftId: number | null, kind: 'in'|'out', amount: number, note: string): void {
  if (amount <= 0) throw new Error('Nominal harus > 0')
  getDb().prepareSync('INSERT INTO cash_movements (shift_id, kind, amount, note) VALUES (?, ?, ?, ?)').executeSync(shiftId, kind, amount, note)
}
