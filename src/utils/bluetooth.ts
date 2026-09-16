// Bluetooth ESC/POS — Classic SPP (DantSu) + Discovery
// v1.1.11 — bonded + discovery, connect/test, clear errors. BUKAN BLE.
import { Platform, PermissionsAndroid, Linking } from 'react-native'
import { getSetting, setSetting } from './settings'

export type BtDevice = { id: string; name: string | null; bonded?: boolean }
export type BtScanResult = { bonded: BtDevice[]; discovered: BtDevice[]; error?: string }

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

export async function requestBtPermissions(): Promise<{ ok: boolean; msg?: string }> {
  if (Platform.OS !== 'android') return { ok: true }
  try {
    if (Platform.Version >= 31) {
      const toRequest: any[] = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as any,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as any,
      ]
      // BLUETOOTH_SCAN neverForLocation -> tidak perlu lokasi di API31+, tapi beberapa device tetap butuh fallback
      const res = await PermissionsAndroid.requestMultiple(toRequest)
      const okScan = res['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED
      const okConn = res['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
      if (!okScan || !okConn) {
        return { ok: false, msg: `Izin Bluetooth ditolak. Scan=${String(res['android.permission.BLUETOOTH_SCAN'])} Connect=${String(res['android.permission.BLUETOOTH_CONNECT'])}. Buka Pengaturan > Aplikasi > Kasir Kita > Izin > aktifkan Bluetooth Nearby devices.` }
      }
      return { ok: true }
    }
    // API <31 classic need location
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as any)
    if (r !== PermissionsAndroid.RESULTS.GRANTED) return { ok: false, msg: 'Izin Lokasi ditolak. Di Android 10-11 scan Classic butuh Lokasi.' }
    return { ok: true }
  } catch (e: any) { return { ok: false, msg: e?.message || String(e) } }
}

export async function listPairedPrinters(): Promise<BtDevice[]> {
  const perm = await requestBtPermissions()
  if (!perm.ok) throw new Error(perm.msg || 'Izin Bluetooth ditolak')
  const { NativeModules } = await import('react-native')
  const mod: any = (NativeModules as any).DantsuPrinter
  if (!mod) throw new Error('Native module DantsuPrinter tidak tersedia. Build APK native (bukan Expo Go).')
  if (!mod.listPairedPrinters) throw new Error('DantsuPrinter.listPairedPrinters tidak ada — rebuild APK.')
  try {
    const arr: any[] = await mod.listPairedPrinters()
    return (arr || []).map((x: any) => ({ id: String(x.address || x.id || ''), name: x.name || null, bonded: true })).filter((d: BtDevice) => !!d.id)
  } catch (e: any) { throw new Error(e?.message || 'Gagal ambil paired: ' + String(e)) }
}

// Discovery bonded+nearby (12 detik). Pakai NativeModule.startDiscovery bila ada, fallback ke bonded only.
export async function discoverPrinters(timeoutMs = 12000): Promise<BtScanResult> {
  const perm = await requestBtPermissions()
  if (!perm.ok) throw new Error(perm.msg!)
  const { NativeModules } = await import('react-native')
  const mod: any = (NativeModules as any).DantsuPrinter
  if (!mod) throw new Error('Native module tidak tersedia — build APK native.')
  // bonded always
  let bonded: BtDevice[] = []
  try { bonded = await listPairedPrinters() } catch (e) { /* perm sudah cek */ }
  // jika native punya discovery
  if (mod.startDiscovery) {
    try {
      const arr: any[] = await mod.startDiscovery()
      // native sudah filter bonded+discovered, kita pisahkan
      const discovered: BtDevice[] = (arr || []).map((x: any) => ({ id: String(x.address||x.id||''), name: x.name||null, bonded: !!x.bonded })).filter((d:BtDevice)=> !!d.id)
      // bonded dari param native lebih akurat; merge
      const bondedFromNative = discovered.filter(d=> d.bonded)
      const nearby = discovered.filter(d=> !d.bonded)
      // merge dengan bonded listPaired bila native kosong
      const finalBonded = bondedFromNative.length ? bondedFromNative : bonded
      return { bonded: finalBonded, discovered: nearby }
    } catch (e: any) {
      // discovery gagal (BT off?) -> balikin bonded saja + error
      return { bonded, discovered: [], error: e?.message || String(e) }
    }
  }
  // no discovery support -> bonded only
  return { bonded, discovered: [], error: 'Discovery belum tersedia di build ini — Pair dulu di Bluetooth HP lalu tap Cari Paired.' }
}

export async function connectPrinter(address: string): Promise<void> {
  const perm = await requestBtPermissions()
  if (!perm.ok) throw new Error(perm.msg!)
  const { NativeModules } = await import('react-native')
  const mod: any = (NativeModules as any).DantsuPrinter
  if (!mod) throw new Error('Native module tidak tersedia.')
  // pakai connectTest native bila ada
  if (mod.testConnect) {
    try { await mod.testConnect(String(address)); return } catch (e: any) { throw new Error(e?.message || 'Gagal connect ke ' + address) }
  }
  // fallback: coba printText dummy via native
  throw new Error('testConnect belum tersedia di build ini — rebuild v1.1.11+')
}

function genReqId(): string { return 'R' + Math.random().toString(16).slice(2,6).toUpperCase().padStart(4,'0') }

export async function printViaBluetooth(text: string, opts?: { skipLogo?: boolean }): Promise<'printed'|'shared'|'no_printer'> {
  const reqId = genReqId()
  const addr = getSavedPrinter()
  console.log(`[BT] [${reqId}] PRINT_REQUEST len=${text.length} addr=${addr || 'null'} skipLogo=${!!opts?.skipLogo}`)
  if (!addr) {
    console.log(`[BT] [${reqId}] RESULT no_printer`)
    return 'no_printer'
  }
  const perm = await requestBtPermissions()
  if (!perm.ok) throw new Error(perm.msg!)
  const { NativeModules } = await import('react-native')
  const mod: any = (NativeModules as any).DantsuPrinter
  if (!mod) throw new Error('Native DantsuPrinter TIDAK TERSEDIA — install APK native v1.1.13+, bukan Expo Go')
  if (!mod.printText && !mod.printTextWithSettings) throw new Error('Native DantsuPrinter.printText tidak tersedia — rebuild APK native')
  let paperSizeArg = '58mm'
  let logoPath: string | null = null
  try {
    const { getPaperSize, getCustomDims, getSetting } = await import('./settings')
    const raw = getPaperSize()
    if (raw === 'custom') { const d = getCustomDims(); paperSizeArg = `custom:${d.wMm}x${d.hMm}` } else paperSizeArg = raw
    logoPath = opts?.skipLogo ? null : (getSetting('storeLogoUri','') || null)
  } catch {}
  console.log(`[BT] [${reqId}] ADDRESS ${addr}`)
  console.log(`[BT] [${reqId}] PAPER_SIZE ${paperSizeArg}`)
  console.log(`[BT] [${reqId}] PAYLOAD_LENGTH ${text.length}`)
  console.log(`[BT] [${reqId}] LOGO_PATH ${logoPath ? logoPath.slice(0,60) : 'null (skipLogo='+(!!opts?.skipLogo)+')'}`)
  let lastErr: any = null
  // 1) with logo + settings
  if (logoPath && mod.printTextWithSettings) {
    console.log(`[BT] [${reqId}] ATTEMPT_1 printTextWithSettings WITH_LOGO paper=${paperSizeArg}`)
    try {
      const r = await mod.printTextWithSettings(String(addr), String(text), String(paperSizeArg), String(logoPath))
      console.log(`[BT] [${reqId}] ATTEMPT_1 RESULT ${String(r)}`)
      if (r === 'printed') { console.log(`[BT] [${reqId}] RESULT printed via ATTEMPT_1`); return 'printed' }
      lastErr = new Error('Native printTextWithSettings(logo) balikan bukan printed: '+String(r))
      console.log(`[BT] [${reqId}] ATTEMPT_1 ERROR ${lastErr.message}`)
    } catch (e:any) {
      lastErr = e
      console.log(`[BT] [${reqId}] ATTEMPT_1 ERROR code=${e?.code || '-'} msg=${e?.message || String(e)}`)
    }
  } else if (logoPath && !mod.printTextWithSettings) {
    console.log(`[BT] [${reqId}] ATTEMPT_1 SKIP no native printTextWithSettings`)
  } else {
    console.log(`[BT] [${reqId}] ATTEMPT_1 SKIP no logo`)
  }
  // 2) settings tanpa logo
  if (mod.printTextWithSettings) {
    console.log(`[BT] [${reqId}] ATTEMPT_2 printTextWithSettings NO_LOGO paper=${paperSizeArg}`)
    try {
      const r = await mod.printTextWithSettings(String(addr), String(text), String(paperSizeArg), '')
      console.log(`[BT] [${reqId}] ATTEMPT_2 RESULT ${String(r)}`)
      if (r === 'printed') { console.log(`[BT] [${reqId}] RESULT printed via ATTEMPT_2`); return 'printed' }
      lastErr = new Error('Native printTextWithSettings balikan bukan printed: '+String(r))
      console.log(`[BT] [${reqId}] ATTEMPT_2 ERROR ${lastErr.message}`)
    } catch (e:any) {
      lastErr = e
      console.log(`[BT] [${reqId}] ATTEMPT_2 ERROR code=${e?.code || '-'} msg=${e?.message || String(e)} stack=${(e?.message||'').slice(0,300)}`)
    }
  }
  // 3) legacy printText
  if (mod.printText) {
    console.log(`[BT] [${reqId}] ATTEMPT_3 legacy printText`)
    try {
      const r = await mod.printText(String(addr), String(text))
      console.log(`[BT] [${reqId}] ATTEMPT_3 RESULT ${String(r)}`)
      if (r === 'printed') { console.log(`[BT] [${reqId}] RESULT printed via ATTEMPT_3`); return 'printed' }
      lastErr = new Error('Native printText balikan bukan printed: '+String(r))
      console.log(`[BT] [${reqId}] ATTEMPT_3 ERROR ${lastErr.message}`)
    } catch (e:any) {
      lastErr = e
      console.log(`[BT] [${reqId}] ATTEMPT_3 ERROR code=${e?.code || '-'} msg=${e?.message || String(e)}`)
    }
  }
  const msg = lastErr?.message || String(lastErr || 'unknown')
  console.log(`[BT] [${reqId}] RESULT FAIL all attempts exhausted lastErr=${lastErr?.code || '-'} msg=${msg.slice(0,500)}`)
  if (lastErr?.code === 'NO_PRINTER' || msg.includes('Tidak ada printer paired') || msg.includes('NO_PRINTER')) throw new Error(`[${reqId}] ${msg}`)
  if (msg.includes('PRINT_FAIL')) throw new Error(`[${reqId}] ${msg} — RAW: ${msg}`)
  if (msg.includes('CONN') || lastErr?.code==='CONN') throw new Error(`[${reqId}] Gagal konek ke printer (${msg}). Cek: printer nyala, kertas ada, jarak <3m, tidak dipakai app lain, masih Paired.`)
  throw new Error(`[${reqId}] Gagal mencetak ke printer: ${msg}`)
}

export async function printViaBluetoothNoLogo(text: string): Promise<'printed'|'shared'|'no_printer'> {
  return printViaBluetooth(text, { skipLogo: true })
}

export type NativePrinterStatus = {
  hasModule: boolean
  bluetoothOn: boolean
  savedAddr: string
  pairedCount: number
  savedPaired: boolean
  targetFound: boolean
  targetName: string
}

export async function getNativePrinterStatus(): Promise<NativePrinterStatus> {
  const { NativeModules } = await import('react-native')
  const mod: any = (NativeModules as any).DantsuPrinter
  const saved = getSavedPrinter() || ''
  if (!mod || !mod.getNativePrinterStatus) {
    // fallback: best effort
    const on = await ensureBluetoothOn()
    return { hasModule: !!mod, bluetoothOn: on, savedAddr: saved, pairedCount: -1, savedPaired: false, targetFound: false, targetName: '' }
  }
  try {
    const m: any = await mod.getNativePrinterStatus(String(saved))
    return {
      hasModule: !!m.hasModule,
      bluetoothOn: !!m.bluetoothOn,
      savedAddr: String(m.savedAddr||saved),
      pairedCount: Number(m.pairedCount??-1),
      savedPaired: !!m.savedPaired,
      targetFound: !!m.targetFound,
      targetName: String(m.targetName||''),
    }
  } catch (e:any) { throw new Error(e?.message||String(e)) }
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

export async function ensureBluetoothOn(): Promise<boolean> {
  try {
    const { NativeModules } = await import('react-native')
    const mod: any = (NativeModules as any).DantsuPrinter
    if (mod?.isBluetoothEnabled) {
      const on: boolean = await mod.isBluetoothEnabled()
      return !!on
    }
  } catch {}
  return true
}
