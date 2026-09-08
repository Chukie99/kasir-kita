# Sistem Penjualan & Aktivasi Otomatis — Kasir Kita

Dua file di folder ini adalah sistem penjualan & aktivasi otomatis untuk Kasir Kita.

## Pilih salah satu (atau pakai dua-duanya):

### 1. `LicenseSystem.gs` — RECOMMENDED (Google Sheets + Form)
Sistem lengkap: form pendaftaran → kode otomatis via email → tercatat di spreadsheet.

Alur:
```
Customer bayar di Lynk.id
   → dapat link Google Form
   → isi nama, email, Device ID
   → KODE AKTIVASI otomatis masuk email mereka (dalam ±1 menit)
   → data pembeli tercatat rapi di Google Sheets lu
```

Keuntungan:
- Lu bisa lihat semua pembeli: siapa, kapan, device apa, status kirim
- Customer gak nunggu — bot yang balas 24/7
- Ada tombol kirim-ulang kalau email gagal
- Gratis selamanya (Gmail biasa cukup untuk <100 email/hari)

Setup lengkap ada di komentar atas file `LicenseSystem.gs`.

### 2. `AppsScript.gs` — Simple auto-reply Gmail
Versi minimalis: customer email Device ID ke lu → script baca → balas otomatis.
Tanpa form, tanpa sheet. Tapi gak ada catatan pembeli yang rapi.

---

## ⚠️ WAJIB sebelum dipakai jualan:
Ganti `APP_LICENSE_SECRET` di SEMUA tempat ini dengan nilai yang SAMA:
1. `src/license/license.ts` (dalam app)
2. `keygen.mjs`
3. Script Apps Script yang lu pasang

Kalau beda satu huruf pun, kode gak akan valid!
