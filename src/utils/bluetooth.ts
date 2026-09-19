// Bluetooth ESC/POS — Classic SPP (DantSu) + Discovery
// v1.1.11 — bonded + discovery, connect/test, clear errors. BUKAN BLE.
import { Platform, PermissionsAndroid, Linking } from 'react-native'
import { getSetting, setSetting } from './settings'

export type BtDevice = { id: string; name: string | null; bonded?: boolean }
export type BtScanResult = { bonded: BtDevice[]; discovered: BtDevice[]; error?: string }

// ——— PRINT LIFECYCLE ———
let _isPrinting = false
let _printSeq = 0
export function isPrintingNow() { return _isPrinting }
function nextReqId() { _printSeq++; return `R${_printSeq}-${Date.now().toString(36).slice(-5)}` }
function logBt(...a:any[]){ try{ console.log('[BT]', ...a) }catch{} }

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

export async function printViaBluetooth(text: string): Promise<'printed'|'shared'|'no_printer'> {
  const addr = getSavedPrinter()
  if (!addr) return 'no_printer'
  if (_isPrinting) throw new Error('Sedang mencetak — tunggu selesai dulu (PRINT_BUSY)')
  const perm = await requestBtPermissions()
  if (!perm.ok) throw new Error(perm.msg!)
  const { NativeModules } = await import('react-native')
  const mod: any = (NativeModules as any).DantsuPrinter
  if (!mod) throw new Error('Native DantsuPrinter TIDAK TERSEDIA — install APK native v1.1.14+, bukan Expo Go')
  if (!mod.printText && !mod.printTextWithSettings) throw new Error('Native DantsuPrinter.printText tidak tersedia — rebuild APK native')
  let paperSizeArg = '58mm'
  let logoPath: string | null = null
  try {
    const { getPaperSize, getCustomDims, getSetting } = await import('./settings')
    const raw = getPaperSize()
    if (raw === 'custom') { const d = getCustomDims(); paperSizeArg = `custom:${d.wMm}x${d.hMm}` } else paperSizeArg = raw
    logoPath = getSetting('storeLogoUri','') || null
  } catch {}
  const reqId = nextReqId()
  const t0 = Date.now()
  // FIX: Tambah delay kecil agar buffer Bluetooth thermal printer tidak overflow/blank saat transaksi real panjang
  await new Promise(resolve => setTimeout(resolve, 150))
  // diagnostic payload
  const btOn = await ensureBluetoothOn()
  let targetPaired = false
  try { const st = await getNativePrinterStatus(); targetPaired = !!st.savedPaired } catch {}
  logBt(`PRINT_REQUEST id=${reqId} addr=${addr} btOn=${btOn} paired=${targetPaired} paper=${paperSizeArg} logo=${!!logoPath} len=${text.length}`)
  logBt(`PRINT_PAYLOAD id=${reqId} head=${JSON.stringify(text.slice(0,200))}`)
  _isPrinting = true
  let lastErr: any = null
  try {
    // PREFER single strict call with reqId (native logs it)
    const doNative = async (): Promise<string> => {
      if (logoPath && mod.printTextWithSettings) {
        try {
          try {
            const r = await mod.printTextWithSettings(String(addr), String(text), String(paperSizeArg), String(logoPath), String(reqId))
            return String(r)
          } catch (e:any) {
            // fallback 4-arg if 5-arg not found
            if (String(e?.message||'').includes('got 4') || String(e?.message||'').includes('expects 5') || String(e?.code||'').includes('EUNSPECIFIED')) {
              const r2 = await mod.printTextWithSettings(String(addr), String(text), String(paperSizeArg), String(logoPath))
              return String(r2)
            }
            throw e
          }
        } catch (e:any) { throw e }
      }
      if (mod.printTextWithSettings) {
        try {
          const r = await mod.printTextWithSettings(String(addr), String(text), String(paperSizeArg), '', String(reqId))
          return String(r)
        } catch (e:any) {
          if (String(e?.message||'').includes('got 4') || String(e?.message||'').includes('expects')) {
            const r2 = await mod.printTextWithSettings(String(addr), String(text), String(paperSizeArg), '')
            return String(r2)
          }
          throw e
        }
      }
      const r = await mod.printText(String(addr), String(text))
      return String(r)
    }
    const r = await doNative()
    const dt = Date.now()-t0
    if (r === 'printed') {
      logBt(`PRINT_SUCCESS id=${reqId} dt=${dt}ms`)
      return 'printed'
    }
    lastErr = new Error(`Native balikan bukan printed: ${r} (id=${reqId})`)
  } catch (e:any) {
    const dt = Date.now()-t0
    logBt(`PRINT_ERROR id=${reqId} dt=${dt}ms err=${e?.message||String(e)} code=${e?.code||''}`)
    lastErr = e
  } finally {
    _isPrinting = false
  }
  const msg = lastErr?.message || String(lastErr || 'unknown')
  if (lastErr?.code === 'NO_PRINTER' || msg.includes('Tidak ada printer paired') || msg.includes('NO_PRINTER')) throw new Error(msg + ` [id=${reqId}]`)
  if (msg.includes('PRINT_FAIL')) throw new Error(msg + ` [id=${reqId}]`)
  if (msg.includes('CONN') || lastErr?.code==='CONN') throw new Error(`Gagal konek ke printer (${msg}). Cek: printer nyala, kertas ada, jarak <3m [id=${reqId}]`)
  throw new Error(`Gagal mencetak ke printer: ${msg} [id=${reqId}]`)
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
