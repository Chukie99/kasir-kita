/**
 * Kasir Kita — Auto-Reply Lisensi via Email (Google Apps Script)
 * ============================================================
 * Cara kerja:
 *  1. Customer kirim email ke alamat Gmail lu dengan subject/body
 *     berisi Device ID mereka (contoh: ABCD-1234-EFGH).
 *  2. Script ini mendeteksi email baru, ambil Device ID-nya,
 *     generate Kode Aktivasi (algoritma sama persis dengan app),
 *     lalu BALAS OTOMATIS dengan kodenya.
 *
 * SETUP SEKALI SAJA (±5 menit):
 *  1. Buka https://script.google.com → New Project
 *  2. Hapus isi code.gs, paste seluruh file ini
 *  3. Ganti APP_LICENSE_SECRET di bawah — HARUS SAMA persis dengan
 *     yang ada di src/license/license.ts dan keygen.mjs
 *  4. Save (ikon disket) → beri nama "Kasir Kita License Bot"
 *
 * AKTIFKAN:
 *  - Klik ⏰ Triggers (ikon jam) → Add Trigger
 *  - Function: checkInbox | Event source: Time-driven | Minute timer: Every minute
 *  - Authorize saat diminta (Allow full access to Gmail)
 *
 * SELESAI — sekarang tiap email masuk berisi Device ID akan dibalas otomatis.
 */

// ====== CONFIG ======
const APP_LICENSE_SECRET = '5E175D6EBE1E6E0FA1F068A59308898E090239DFFC59E2C4'; // ← GANTI & samakan dengan app!
const SEARCH_QUERY = 'is:inbox -label:license-done newer_than:2d'; // label penanda sudah diproses
const PROCESSED_LABEL = 'license-done';
// ====================

function checkInbox() {
  const threads = GmailApp.search(SEARCH_QUERY);
  const label = getOrCreateLabel();

  for (const thread of threads) {
    const messages = thread.getMessages();
    const last = messages[messages.length - 1];

    // hanya proses email terbaru yang BELUM dibalas oleh kita
    if (last.getFrom().indexOf(Session.getEffectiveUser().getEmail()) !== -1) continue;

    const deviceId = extractDeviceId(last.getPlainBody() + '\n' + last.getSubject());
    if (!deviceId) continue; // bukan email device id, skip

    const key = generateActivationKey(deviceId);

    last.reply(
      'Kode Aktivasi Kasir Kita Anda',
      'Halo!\n\n' +
      'Terima kasih telah membeli Kasir Kita 🎉\n\n' +
      'Device ID Anda : ' + formatCode(deviceId) + '\n' +
      'Kode Aktivasi  : ' + key + '\n\n' +
      'Cara aktivasi:\n' +
      '1. Buka aplikasi Kasir Kita\n' +
      '2. Masukkan Kode Aktivasi di atas pada layar aktivasi\n' +
      '3. Aplikasi langsung terbuka — aktif permanen di HP ini\n\n' +
      'Catatan: Kode hanya berlaku untuk Device ID ' + formatCode(deviceId) + '.\n' +
      'Ganti HP? Kirim Device ID baru untuk kode baru.\n\n' +
      'Salam,\nTim Kasir Kita'
    );

    thread.addLabel(label);
  }
}

function getOrCreateLabel() {
  let label = GmailApp.getUserLabelByName(PROCESSED_LABEL);
  if (!label) label = GmailApp.createLabel(PROCESSED_LABEL);
  return label;
}

/** Ambil pola Device ID dari teks: XXXX-XXXX-XXXX atau XXXXXXXX-XXXX dsb */
function extractDeviceId(text) {
  if (!text) return null;
  // cari 8–12 karakter alfanumerik yang mungkin device id, terformat atau tidak
  const formatted = text.match(/\b[0-9A-Z]{4}-[0-9A-Z]{4}(?:-[0-9A-Z]{4})?\b/);
  if (formatted) return formatted[0].replace(/-/g, '');
  // fallback: "Device ID" diikuti kode apa pun
  const loose = text.match(/device\s*id[:\s=]*([0-9A-Za-z\- ]{8,20})/i);
  if (loose) {
    const clean = loose[1].toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (clean.length >= 8) return clean.slice(0, 12);
  }
  return null;
}

function formatCode(id) {
  return (String(id).match(/.{1,4}/g) || []).join('-');
}

// ====== Kriptografi (sama dengan app: HMAC-SHA256 → Base32) ======

const BASE32_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function bytesToBase32(bytes) {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = ((value << 8) | bytes[i]) >>> 0;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out.slice(0, 16);
}

function generateActivationKey(deviceIdRaw) {
  const normalized = String(deviceIdRaw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  while (normalized.length < 12) normalized += 'X';

  const sig = Utilities.computeHmacSha256Signature(
    Utilities.newUtf8(normalized),
    Utilities.newUtf8(APP_LICENSE_SECRET)
  );
  const raw = bytesToBase32(sig);
  return (raw.match(/.{1,4}/g) || []).join('-');
}
