import * as Device from 'expo-device'
import { getDb } from '../db/database'
import nacl from 'tweetnacl'

export const VENDOR_WA = '6282261407123'

// Ed25519 public key (32 bytes base64) — private cuma di Supabase Edge Functions
export const LICENSE_PUBLIC_KEY_B64 = 'iBRbEboEKXtjRgSV9bmYF/Mntc4mkQXewfMjO3SC0yg='
export const SUPABASE_ACTIVATE_URL = 'https://cdgnqhdmsnrlzylgoecz.supabase.co/functions/v1/activate'
export const SUPABASE_GET_LICENSE_URL = 'https://cdgnqhdmsnrlzylgoecz.supabase.co/functions/v1/get-license'

function b64ToBytes(b64: string): Uint8Array {
  // atob available in RN Hermes
  const bin = globalThis.atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function b64FromBytes(bytes: Uint8Array): string {
  let s = ''
  bytes.forEach(b => s += String.fromCharCode(b))
  return globalThis.btoa(s)
}

export function getDeviceId(): string {
  const raw = (Device as any).osInternalBuildId || Device.deviceName || 'UNKNOWN-DEVICE'
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).padEnd(12, 'X')
}

export function formatDeviceCode(id: string): string {
  return (id.match(/.{1,4}/g) || []).join('-')
}

export function normalizeLicense(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-')
}

// Verify token offline: token = base64("LICENSE|DEVICE|sigB64"), sig = Ed25519(msg="LICENSE|DEVICE")
export function verifyToken(token: string): { ok: boolean; license?: string; deviceId?: string; error?: string } {
  try {
    const raw = globalThis.atob(token)
    const parts = raw.split('|')
    if (parts.length !== 3) return { ok: false, error: 'Format token salah' }
    const [lic, dev, sigB64] = parts
    if (!lic || !dev || !sigB64) return { ok: false, error: 'Token tidak lengkap' }
    // device must match this phone (prevent copy token to other device)
    const myDevice = getDeviceId()
    if (dev !== myDevice) return { ok: false, error: `Token untuk device ${dev}, HP ini ${myDevice}` }
    const msg = new TextEncoder().encode(`${lic}|${dev}`)
    const sig = b64ToBytes(sigB64)
    const pub = b64ToBytes(LICENSE_PUBLIC_KEY_B64)
    const ok = nacl.sign.detached.verify(msg, sig, pub)
    if (!ok) return { ok: false, error: 'Signature tidak valid' }
    return { ok: true, license: lic, deviceId: dev }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Gagal verifikasi' }
  }
}

export function isActivated(): boolean {
  try {
    const row = getDb().getFirstSync<{ activation_key: string }>('SELECT activation_key FROM license WHERE id = 1') as any
    if (!row?.activation_key) return false
    // try new Ed25519 token first
    const v = verifyToken(row.activation_key)
    if (v.ok) return true
    // fallback: old HMAC offline (during migration, allow already-activated old users to stay active)
    // old DB keeps token as HMAC key; if it's 19 chars XXXX-XXXX-XXXX-XXXX and not base64 with |, treat as legacy valid
    if (row.activation_key.includes('|')) return false
    // legacy: if key looks like old format, keep active (don't lock migrated users)
    if (/^[A-Z0-9-]{19}$/.test(row.activation_key)) return true
    return false
  } catch {
    return false
  }
}

export function getStoredToken(): string | null {
  try {
    const row = getDb().getFirstSync<{ activation_key: string }>('SELECT activation_key FROM license WHERE id = 1') as any
    return row?.activation_key || null
  } catch { return null }
}

export function storeToken(token: string, deviceId: string): void {
  getDb().runSync(
    "INSERT INTO license (id, device_id, activation_key, activated_at) VALUES (1, ?, ?, datetime('now','localtime')) " +
    'ON CONFLICT(id) DO UPDATE SET device_id=excluded.device_id, activation_key=excluded.activation_key, activated_at=excluded.activated_at',
    [deviceId, token]
  )
}

// Online activation: license_code + deviceId -> Supabase -> token
export async function activateOnline(licenseCode: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  const deviceId = getDeviceId()
  const lic = normalizeLicense(licenseCode)
  if (!lic) return { ok: false, error: 'Masukkan kode lisensi' }
  try {
    const res = await fetch(SUPABASE_ACTIVATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: lic, deviceId }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: j.error || j.message || `Gagal aktivasi (${res.status})` }
    }
    const token = j.token as string
    if (!token) return { ok: false, error: 'Server tidak mengembalikan token' }
    const v = verifyToken(token)
    if (!v.ok) return { ok: false, error: 'Token server tidak valid: ' + v.error }
    storeToken(token, deviceId)
    return { ok: true, token }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Gagal koneksi server' }
  }
}

export async function fetchLicenseByEmail(email: string): Promise<{ ok: boolean; licenses?: {code:string,status:string,created_at:string}[]; error?: string }> {
  const e = email.trim().toLowerCase()
  if (!e || !e.includes("@")) return { ok: false, error: "Email tidak valid" }
  try {
    const res = await fetch(SUPABASE_GET_LICENSE_URL + "?email=" + encodeURIComponent(e), { method: "GET" })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) return { ok: false, error: j.error || `Gagal ambil lisensi (${res.status})` }
    if (!j.found || !j.licenses?.length) return { ok: false, error: "Belum ada lisensi untuk email ini. Cek email benar / tunggu 1 menit setelah bayar." }
    return { ok: true, licenses: j.licenses }
  } catch (err:any) { return { ok: false, error: err?.message || "Gagal koneksi" } }
}

// Legacy HMAC helpers kept for reference but not used for new licenses
export const APP_LICENSE_SECRET = '5E175D6EBE1E6E0FA1F068A59308898E090239DFFC59E2C4'
