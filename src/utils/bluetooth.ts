// Bluetooth ESC/POS — v1.1.4 DantSu Classic SPP (BluetoothPrintersConnections)
// Flow: Pair dulu di Settings HP (PIN 0000/1234) -> DantSu getList() paired -> print via EscPosPrinter
import { Platform, PermissionsAndroid, Linking } from 'react-native'
import { getSetting, setSetting } from './settings'

export type BtDevice = { id: string; name: string | null; rssi?: number | null }

export function escPosReceipt(text: string): Uint8Array {
  const init = [0x1B, 0x40]
  const bytes = Array.from(new TextEncoder().encode(text))
  const cut = [0x1D, 0x56, 0x00]
  return new Uint8Array([...init, ...bytes, 0x0A, 0x0A, ...cut])
}

export function getSavedPrinter(): string | null {
  try { return getSetting('btPrinterAddr', '') || null } catch { return null }
}
export function savePrinter(addr: string) { setSetting('btPrinterAddr', addr.trim()) }
export function getSavedPrinterName(): string | null {
  try { return getSetting('btPrinterName', '') || null } catch { return null }
}
export function savePrinterName(name: string) { setSetting('btPrinterName', name.trim()) }

export async function requestBtPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    if (Platform.Version >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as any,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as any,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as any,
      ])
      const okScan = res['android.permission.BLUETOOTH_SCAN'] === 'granted'
      const okConn = res['android.permission.BLUETOOTH_CONNECT'] === 'granted'
      return okScan && okConn
    }
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as any)
    return r === 'granted'
  } catch { return false }
}

export async function listPairedPrinters(): Promise<BtDevice[]> {
  try {
    await requestBtPermissions()
    const { NativeModules } = await import('react-native')
    const mod: any = (NativeModules as any).DantsuPrinter
    if (!mod || !mod.listPairedPrinters) return []
    const arr: any[] = await mod.listPairedPrinters()
    return (arr || []).map((x: any) => ({ id: String(x.address || x.id || ''), name: x.name || null })).filter((d: BtDevice) => !!d.id)
  } catch { return [] }
}

export async function printViaBluetooth(text: string): Promise<'printed'|'shared'|'no_printer'> {
  const addr = getSavedPrinter()
  if (!addr) return 'no_printer'
  try {
    await requestBtPermissions()
    const { NativeModules } = await import('react-native')
    const mod: any = (NativeModules as any).DantsuPrinter
    if (!mod || !mod.printText) return 'shared'
    let paperSizeArg = '58mm'
    let logoPath: string | null = null
    try {
      const { getPaperSize, getCustomDims, getSetting } = await import('./settings')
      const raw = getPaperSize()
      if (raw === 'custom') {
        const d = getCustomDims()
        paperSizeArg = `custom:${d.wMm}x${d.hMm}`
      } else {
        paperSizeArg = raw
      }
      logoPath = getSetting('storeLogoUri','') || null
    } catch {}
    // v1.1.4+: 4-arg printTextWithSettings(addr,text,paperSize,logoPath) — fallback ke 3/2 arg buat APK lama
    if (logoPath) {
      try { if (mod.printTextWithSettings) { const r = await mod.printTextWithSettings(String(addr), String(text), String(paperSizeArg), String(logoPath)); return r === 'printed' ? 'printed' : 'shared' } } catch {}
    }
    try { if (mod.printTextWithSettings) { const r = await mod.printTextWithSettings(String(addr), String(text), String(paperSizeArg), ''); return r === 'printed' ? 'printed' : 'shared' } } catch {}
    try { const r = await mod.printText(String(addr), String(text), String(paperSizeArg)); return r === 'printed' ? 'printed' : 'shared' } catch {}
    const r = await mod.printText(String(addr), String(text))
    return r === 'printed' ? 'printed' : 'shared'
  } catch { return 'shared' }
}

export async function printViaBluetoothFallback(text: string): Promise<'shared'|'unsupported'> {
  const r = await printViaBluetooth(text)
  return r === 'no_printer' ? ('unsupported' as any) : 'shared'
}

export const connectAndPrint = printViaBluetooth

export async function openSystemBluetoothSettings() {
  try {
    const anyLinking: any = Linking as any
    if (anyLinking.sendIntent) {
      await anyLinking.sendIntent('android.settings.BLUETOOTH_SETTINGS')
    } else {
      await Linking.openSettings()
    }
  } catch {
    try { await Linking.openSettings() } catch {}
  }
}
