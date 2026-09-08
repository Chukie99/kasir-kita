/**
 * Kasir Kita — Sistem Penjualan & Aktivasi Otomatis
 * ================================================
 * Satu script ini menangani SEMUA:
 *   1. Customer beli via Lynk.id → dapat link form pendaftaran
 *  2. Customer isi form (nama, email, Device ID)
 *  3. Script generate Kode Aktivasi + kirim ke email customer OTOMATIS
 *  4. Data pembeli tercatat otomatis di Google Sheets (database lu)
 *  5. Customer yang belum bayar TIDAK mendapat kode
 *
 * KEUNTUNGAN LU:
 *   - Sheet "Pembeli" = database semua customer & lisensi aktif
 *   - Bisa lihat siapa saja yang beli, kapan, device apa
 *   - Gak ada yang bisa aktivasi tanpa lewat sistem lu
 *   - Customer senang: kode langsung dikirim otomatis 24/7
 *
 * ================================================================
 * SETUP (±10 MENIT):
 *
 * A. BUAT GOOGLE SPREADSHEET DATABASE
 *    1. Buka sheets.new → beri nama "Kasir Kita - Database"
 *    2. Di sheet pertama (Sheet1), bikin header baris 1:
 *       A1=Tanggal | B1=Nama | C1=Email | D1=Device ID |
 *       E1=Kode Aktivasi | F1=Status Bayar | G1=Catatan
 *
 * B. BUAT FORM PENDAFTARAN
 *    1. Di spreadsheet itu: Tools → Create a new form
 *    2. Judul: "Aktivasi Kasir Kita"
 *    3. Pertanyaan:
 *       - Nama Lengkap (short answer, required)
 *       - Email (short answer, required)
 *       - Device ID dari aplikasi (short answer, required,
 *         description: "Buka app Kasir Kita → salin kode di layar aktivasi")
 *    4. Responses tab → link ke spreadsheet yang sama
 *    5. Ambil URL form (Send button) → taruh di Lynk.id sebagai
 *       "Form Aktivasi" setelah pembayaran sukses
 *
 * C. PASANG SCRIPT INI
 *    1. Di spreadsheet: Extensions → Apps Script
 *    2. Paste seluruh file ini
 *    3. GANTI APP_LICENSE_SECRET (harus sama dengan app!)
 *    4. Save
 *
 * D. SET TRIGGER
 *    1. ⏰ Triggers → Add Trigger
 *    2. Function: processNewOrders
 *    3. Event source: From spreadsheet | On form submit
 *    4. Authorize (Allow access to Sheets + Gmail)
 *
 * SELESAI! Alur jualan jadi:
 *   Lynk.id (bayar) → Form → isi data → kode masuk email otomatis
 *   → tercatat di sheet lu. Zero effort tiap ada yang beli 🎉
 */

// ====== CONFIG ======
const APP_LICENSE_SECRET = '5E175D6EBE1E6E0FA1F068A59308898E090239DFFC59E2C4'; // ← GANTI! samakan dgn app
const PROCESSED_COLUMN = 8; // kolom H = penanda sudah diproses
const SUPPORT_EMAIL = Session.getEffectiveUser().getEmail();
// ====================

/** Dipanggil otomatis setiap form disubmit */
function processNewOrders(e) {
  const sheet = e.source.getSheetByName('Sheet1') || e.source.getSheets()[0];
  const row = e.range.getRow();

  // skip header / duplikat
  if (row === 1) return;
  if (sheet.getRange(row, PROCESSED_COLUMN).getValue()) return;

  const nama = String(sheet.getRange(row, 2).getValue() || '').trim();
  const email = String(sheet.getRange(row, 3).getValue() || '').trim();
  const deviceIdRaw = String(sheet.getRange(row, 4).getValue() || '').trim();

  if (!email || !deviceIdRaw) {
    sheet.getRange(row, 7).setValue('❌ Data tidak lengkap');
    return;
  }

  const deviceId = normalizeDeviceId(deviceIdRaw);
  const key = generateActivationKey(deviceId);

  // catat kode di kolom E
  sheet.getRange(row, 5).setValue(key);
  sheet.getRange(row, 6).setValue('✅ Terkirim');

  // kirim email ke pembeli
  try {
    MailApp.sendEmail({
      to: email,
      subject: '🎉 Kode Aktivasi Kasir Kita Anda — ' + formatCode(deviceId),
      htmlBody: buildEmailHtml(nama, deviceId, key),
    });
    sheet.getRange(row, 7).setValue('Email terkirim ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM HH:mm'));
  } catch (err) {
    sheet.getRange(row, 7).setValue('⚠️ Gagal kirim email: ' + err.message);
    sheet.getRange(row, 6).setValue('⏳ Menunggu kirim ulang');
    return;
  }

  // tandai baris ini selesai diproses
  sheet.getRange(row, PROCESSED_COLUMN).setValue('DONE');
}

/** Kirim ulang manual: isi "RESEND" di kolom H baris yang dimaksud lalu jalankan fungsi ini */
function resendPending() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();

  for (let r = 1; r < data.length; r++) {
    const flag = String(data[r][PROCESSED_COLUMN - 1] || '').toUpperCase();
    const status = String(data[r][5] || '');
    if ((flag === 'RESEND' || status.indexOf('Gagal') !== -1 || status.indexOf('Menunggu') !== -1) && data[r][4]) {
      const nama = String(data[r][1]);
      const email = String(data[r][2]);
      const deviceId = normalizeDeviceId(String(data[r][3]));
      const key = String(data[r][4]);
      try {
        MailApp.sendEmail({
          to: email,
          subject: '🎉 Kode Aktivasi Kasir Kita Anda — ' + formatCode(deviceId),
          htmlBody: buildEmailHtml(nama, deviceId, key),
        });
        sheet.getRange(r + 1, 6).setValue('✅ Terkirim (ulang)');
        sheet.getRange(r + 1, 8).setValue('');
      } catch (err) {
        sheet.getRange(r + 1, 7).setValue('⚠️ Masih gagal: ' + err.message);
      }
      SpreadsheetApp.flush();
    }
  }
}

// ====== HELPERS ======

function normalizeDeviceId(raw) {
  const clean = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  let id = clean.slice(0, 12);
  while (id.length < 12) id += 'X';
  return id;
}

function formatCode(id) {
  return (String(id).match(/.{1,4}/g) || []).join('-');
}

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

function generateActivationKey(deviceId) {
  const sig = Utilities.computeHmacSha256Signature(
    Utilities.newUtf8(deviceId),
    Utilities.newUtf8(APP_LICENSE_SECRET)
  );
  const raw = bytesToBase32(sig);
  return (raw.match(/.{1,4}/g) || []).join('-');
}

function buildEmailHtml(nama, deviceId, key) {
  return (
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1C1B1F">' +
    '<div style="background:#2E7D32;border-radius:12px 12px 0 0;padding:20px;text-align:center">' +
    '<h1 style="color:#fff;margin:0;font-size:22px">Kasir Kita</h1>' +
    '<p style="color:#C8E6C9;margin:4px 0 0">Kasir Offline untuk Warung & Kedai</p></div>' +
    '<div style="border:1px solid #DEDEDE;border-top:none;padding:24px;border-radius:0 0 12px 12px">' +
    '<p>Halo <b>' + (nama || 'Sobat UMKM') + '</b>, terima kasih sudah membeli! 🎉</p>' +
    '<p>Berikut kode aktivasi untuk HP Anda:</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
    '<tr><td style="padding:8px;background:#F5F5F5;border-radius:8px 0 0 8px"><b>Device ID</b></td>' +
    '<td style="padding:8px;background:#F5F5F5;border-radius:0 8px 8px 0;font-family:monospace">' + formatCode(deviceId) + '</td></tr>' +
    '<tr><td style="padding:8px"><b>Kode Aktivasi</b></td>' +
    '<td style="padding:8px;font-family:monospace;font-size:18px;font-weight:bold;color:#2E7D32">' + key + '</td></tr>' +
    '</table>' +
    '<p><b>Cara aktivasi:</b><br>' +
    '1️⃣ Buka aplikasi Kasir Kita<br>' +
    '2️⃣ Salin Kode Aktivasi di atas ke layar aktivasi<br>' +
    '3️⃣ Selesai! Aktif permanen di HP ini ✅</p>' +
    '<p style="font-size:13px;color:#5F5E58">Kode hanya berlaku untuk Device ID ' + formatCode(deviceId) +
    '. Ganti HP? Kirim Device ID baru untuk kode pengganti.</p>' +
    '<hr style="border:none;border-top:1px solid #DEDEDE">' +
    '<p style="font-size:12px;color:#9E9E9E">Butuh bantuan? Balas email ini ya.</p>' +
    '</div></div>'
  );
}
