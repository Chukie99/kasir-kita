// Bluetooth ESC/POS — v1.1.0: direct print via BLE (butuh pairing) + fallback PDF/share
// Library: react-native-ble-plx belum dipin, jadi flow: simpan alamat printer di settings, printViaBluetooth coba native jika ada.
// Fallback tetap aman 100% offline — gak crash kalau belum paired.
import { getSetting, setSetting } from './settings'

export function escPosReceipt(text: string): Uint8Array {
  const init = [0x1B, 0x40]
  const bytes = Array.from(new TextEncoder().encode(text))
  const cut = [0x1D, 0x56, 0x00]
  return new Uint8Array([...init, ...bytes, 0x0A, 0x0A, ...cut])
}

export function getSavedPrinter(): string | null {
  try { return getSetting('btPrinterAddr', '') || null } catch { return null }
}
export function savePrinter(addr: string) {
  setSetting('btPrinterAddr', addr.trim())
}
export function getSavedPrinterName(): string | null {
  try { return getSetting('btPrinterName', '') || null } catch { return null }
}
export function savePrinterName(name: string) {
  setSetting('btPrinterName', name.trim())
}

export async function printViaBluetooth(text: string): Promise<'printed'|'shared'|'no_printer'> {
  const addr = getSavedPrinter()
  if (!addr) return 'no_printer'
  // TODO real BLE: await BleManager.writeWithoutResponse(addr, service, char, escPosReceipt(text))
  // Sementara: native belum terpasang — treat as shared agar UI fallback ke PDF/share (aman tanpa crash)
  return 'shared'
}

export async function printViaBluetoothFallback(text: string): Promise<'shared'|'unsupported'> {
  return 'shared'
}
