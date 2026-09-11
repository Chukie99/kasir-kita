// Stub bluetooth ESC/POS — fase 1: generate bytes + share via system, fase 2: direct BT via expo-bluetooth (butuh pairing manual)
// Untuk layak jual 99k: tombol "Cetak Bluetooth" -> coba direct, fallback ke PDF/share kalau belum paired.
export function escPosReceipt(text: string): Uint8Array {
  // ESC @ init + text + cut
  const init = [0x1B, 0x40]
  const bytes = Array.from(new TextEncoder().encode(text))
  const cut = [0x1D, 0x56, 0x00]
  return new Uint8Array([...init, ...bytes, 0x0A, 0x0A, ...cut])
}

export async function printViaBluetoothFallback(text: string): Promise<'shared'|'unsupported'> {
  // Sementara: belum ada lib BLE terpasang — arahkan ke share/pdf. Next sprint: react-native-ble-plx + esc-pos
  // Return shared agar UI bisa fallback ke shareReceiptPdf
  return 'shared'
}
