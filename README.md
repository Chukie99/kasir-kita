# Kasir Kita — Kasir Offline untuk Warung, Kedai & Kafe

**v1.1.15 (build 25)** · **Android** · **Expo 57 + React Native 0.86 + TypeScript strict** · **100% offline** (SQLite di HP, tanpa server/internet)

![Expo](https://img.shields.io/badge/Expo-57-black) ![RN](https://img.shields.io/badge/React_Native-0.86-blue) ![TS](https://img.shields.io/badge/TypeScript-strict-blue) ![Offline](https://img.shields.io/badge/Offline-100%25-success) ![License](https://img.shields.io/badge/License-MIT-green)

**Harga Lynk.id: 49k early-bird → 99–149k lifetime (sekali bayar, tanpa langganan bulanan).**

> **Kenapa beda dari Moka/Olsera/Pawoon (299k/bln/outlet)?** Data di HP sendiri, APK 78M ringan, jalan di Android 10, Bluetooth Classic SPP thermal 58/80mm + 9 ukuran kertas + Kasbon + Shift, logo PNG, tanpa watermark/batas produk.

---

## ✨ Fitur v1.1.15

### 🛒 Kasir — 1-Tap Jual (ala Kasir Pintar & Loyverse)
- Grid produk **foto 96px** 2-kolom (3-kolom di tablet), nama & harga besar — **tap = +1** tanpa modal
- **Search sticky** di atas (tidak ikut scroll) + **kategori chip swipe horizontal** (Semua/Minuman/Makanan/Snack/Favorit)
- Badge stok: `Habis` merah, `Sisa 2` kuning, `Stok 24` muted — stok habis tidak bisa tap
- **Varian / Topping / Modifier**: Surabi (+Telor +3k), Mie Tek-Tek (Pedas Lv), Teh (Es/Panas)
- **FAB Scan Barcode** (kamera) + **StickyCartBar pill navy** `bottom:84` — total + **Bayar** selalu visible
- Checkout: Tunai/QRIS/BON, diskon Rp/% , hitung kembalian, tombol nominal cepat, Atas Nama, Bon (DP + jatuh tempo), **Cetak Struk Bluetooth** / PDF / Share

### 🖨️ Cetak Bluetooth — Classic SPP (DantSu ESC/POS)
- **Native `DantsuPrinter` (DantSu 3.3.0 JitPack)** — Bluetooth Classic SPP, bukan BLE
- **Connection lifecycle aman**: `PRINT_LOCK` + `isPrinting` flag + `reqId [Rxxx]` — anti 2 koneksi simultan, `250ms flush` sebelum `disconnectPrinter()`, bisa **print berulang tanpa restart** (Test Print → Transaksi → Transaksi lagi → Test lagi sukses)
- **Diagnosa** di Pengaturan: `Module ADA/TIDAK`, `Bluetooth ON/OFF`, `Printer tersimpan 66:xx`, `pairedCount`
- **Scan 12s**: list **Paired (tersimpan)** + **Nearby (belum paired)** via `BroadcastReceiver ACTION_FOUND` + `BLUETOOTH_SCAN neverForLocation`
- **Test Print** struk real (`TEST PRINT — KASIR KITA`) sebelum jualan — bukti MAC + ESC/POS + kertas bekerja
- **Cetak Struk transaksi**: `printTextWithSettings(addr, text, paperSize, logoPath, reqId)` — logo PNG via `BitmapFactory` → `bitmapToHexadecimalString`
- **Error jujur tanpa fallback PDF otomatis**: `CONN` / `PRINT_FAIL` / `BUSY [id=Rxxx]` tampil di banner + tombol `Coba Lagi` / `Cetak PDF` manual
- **Log unik per print**: `DantsuPrinter[Rxxx]: PRINT_REQUEST → CONNECT_START → CONNECT_SUCCESS → PRINT_START → PRINT_SUCCESS → DISCONNECT_SUCCESS`

### 📦 Kelola Produk & Menu
- Tambah/edit produk: nama, harga, stok, **foto galeri (crop 1:1)**, kategori, `is_active`
- Kategori swipe, filter **Stok menipis**, star **Favorit** (pin di Kasir), switch aktif, hapus (soft-hide jika pernah terjual)
- Anti-minus: validasi `stock >= qty` + `WHERE stock>=qty` di transaksi

### 📊 Laporan & Riwayat — Reprint Struk
- Tabs **Hari Ini / Minggu Ini / Bulan Ini**, cards Transaksi/Omzet/Tunai/QRIS, banner diskon, **Top-5 Terlaris**
- Tiap transaksi: invoice, items, jam • metode, total + BON badge `sisa Rp` + **Cetak Ulang Bluetooth / PDF / Share WA / Bayar Bon / Tagih WA** + Void
- **Export CSV periode** (v1.1.1+): chip Hari ini/7 Hari/Bulan ini/Custom + kalender tap 📅 (JS, anti-FC) + input Dari–Sampai → CSV (buka langsung di Excel)

### 💳 Kasbon / Bon Pelanggan — Warung Banget
- Di Kasir centang **Bon / Kasbon** (Atas Nama wajib + DP + Jatuh Tempo opsional) — bisa `paid < total`, sisa = `total - bon_paid`
- Tab **Kasbon**: list bon belum lunas, **Bayar** (parsial/lunas) + **Tagih WA** (pesan otomatis + struk)
- Di Riwayat: badge `BON sisa Rp` + detail `BON — Dibayar / Sisa / Tempo` + tombol Bayar/Tagih, struk BON (`BON Sisa` di teks/HTML/pdf-lib)
- Banner `bon aktif • Sisa Rp` di Laporan biar gak lupa nagih

### 🕐 Shift & Tutup Kasir — Audit Kas
- **Buka Shift** (modal awal) → jualan → **Tutup Shift** (kas fisik) — tahu selisih laci
- **Kas Masuk / Keluar** per shift (setoran, belanja)
- Ringkasan shift: `Tunai (non-bon) / QRIS / VOID / Bon sisa global` + riwayat 10 shift

### ⚙️ Pengaturan — Bluetooth + Laporan & Ekspor + Backup
- **Printer Bluetooth**: Scan 12s → Paired/Nearby → Simpan → **Test Print** → Hapus Printer + Diagnosa Module
- **Laporan & Ekspor CSV**: chip Hari ini/7 Hari/Bulan ini/Custom + kalender JS 📅 → **Export CSV Periode** → share WA/Drive
- **Nama toko** + **Logo struk PNG** (upload galeri → tampil di struk thermal/PDF)
- **Ukuran kertas struk** (58mm/80mm thermal + A6/custom via `PaperPickerModal` + `settings.ts getPaperDims()`)
- **Tema** terang/gelap (pastel #F5EFE6 #AEBDCA #7895B2 #0F2440 + Inter) + **Backup .sql / Restore** (14 tabel)

### 🔐 Lisensi Offline Anti-Bajakan
- Tiap HP punya **Device ID** `XXXX-XXXX-XXXX-XXXX` di layar aktivasi
- Token `base64(LICENSE|DEVICE|sig)` verify **Ed25519 `tweetnacl`** offline — anti decompile resell
- Buyer checkout Lynk.id → webhook Supabase isi `licenses` → di APK **Ambil via Email → CARI → AKTIFKAN** instant (1 license = 1 device, `DEVICE_MISMATCH 403` jika beda HP)
- SOP ganti HP: WA Device ID baru — **1× reset gratis**

### 🎨 UI/UX
- **Pastel ColorHunt** #F5EFE6 (bg) #E8DFCA (chip) #AEBDCA (border) #7895B2 (action) #0F2440 (navy) + Inter
- **Siluet outline thin stroke** bottom nav + **Fixed bottom nav** `bottom:20` — konten `paddingBottom:110+`
- **Splash screen** navy #0F2440 + loading `Kasir Kita — Memuat kasir...`

---

## 📸 Screenshot

Mockup 5 layar ada di [`KASIR_KITA_Mockup_v1.5.html`](KASIR_KITA_Mockup_v1.5.html) + Panduan lengkap `docs/Panduan-Kasir-Kita-v1.1.10-Lengkap.pdf` (11 Bab)

---

## 🚀 Menjalankan

```bash
npm install
npx expo start          # scan QR pakai Expo Go (SDK 57)
```

## 📦 Build APK

```bash
# GitHub Actions (utama — tanpa EAS quota, PC kentang aman)
git push origin fix/bluetooth-v1.1.10-2
git tag v1.1.15 && git push origin v1.1.15
# → Actions `build-apk.yml` → BUILD SUCCESSFUL → Releases `kasir-kita-v1.1.15.apk` (78-80M)

# Lokal (opsional, butuh Android SDK)
npm install -g eas-cli
eas build -p android --profile preview   # → .apk
```

| Profil | Output | Pakai |
|---|---|---|
| `GH Actions` | `.apk` 78M | Kirim via WA/Lynk.id langsung |
| `preview` (EAS) | `.apk` | Alternatif |
| `production` (EAS) | `.aab` | Upload Google Play |

APK history: `apk/kasir-kita-v1.1.15.apk` 80.9M — lihat [Releases](https://github.com/Chukie99/kasir-kita/releases)

## 🔐 Aktivasi — Ed25519 1 license = 1 device (Opsi A via Email)
Buyer checkout di Lynk.id → webhook Supabase isi `licenses` → di APK **Ambil via Email → CARI → AKTIFKAN** (instant, tanpa tunggu email). Token `base64(LICENSE|DEVICE|sig)` verify `tweetnacl` offline.

## 🗂️ Struktur

```
src/
├── db/database.ts              # SQLite schema + seed + migration (14 tabel)
├── license/license.ts          # deviceId, Ed25519 verify, activate
├── screens/
│   ├── ActivationGate.tsx      # kunci lisensi + input kode
│   ├── CashierScreen.tsx       # grid + search + FAB scan + CheckoutSheet + Cetak Bluetooth
│   ├── ManageProductsScreen.tsx
│   ├── HistoryScreen.tsx       # H/M/B + Top-5 + Reprint Bluetooth/Bagikan + BON
│   ├── KasbonScreen.tsx
│   ├── ShiftScreen.tsx
│   └── SettingsScreen.tsx      # Scan 12s + Paired/Nearby + Test Print + Diagnosa + CSV
├── components/
│   ├── FloatingBottomBar.tsx
│   ├── StickyCartBar.tsx
│   ├── PaperPickerModal.tsx    # 58/80/A6/custom
│   ├── DatePickerModal.tsx
│   └── CheckoutSheet.tsx
├── theme/theme.ts              # Pastel MD3 + Inter + getPaperTheme()
└── utils/
    ├── pos.ts
    ├── products.ts
    ├── receipt.ts              # buildReceiptText/Html 9 ukuran + logo, pdf-lib exact per mm
    ├── kasbon.ts
    ├── shifts.ts
    ├── bluetooth.ts            # discoverPrinters + printViaBluetooth (DantSu) + getNativePrinterStatus
    ├── backup.ts               # 14 tabel
    └── settings.ts             # PAPER_OPTIONS + PaperSize + getPaperDims
expo-plugins/with-dantsu.js    # withAndroidManifest + MainApplication.kt add(DantsuPrinterPackage()) + DantsuPrinterModule.java
scripts/validate-dantsu.js     # GREEN check sebelum push
assets/  icon.png, splash-icon.png
```

## 🧾 Struk — Thermal vs PDF

- **58mm** = 48mm content, 11px monospace — printer bluetooth mini (paling umum)
- **80mm** = 72mm — thermal lebar
- **A4** = 170mm, 12px — PDF/email, header “Struk Penjualan — dicetak dari Kasir Kita” + logo 120px
- Ganti di **Pengaturan → Ukuran Kertas Struk** → `buildReceiptHtml(txId, size)` auto ganti `@page` + `width` + `font`
- **Bluetooth**: `printTextWithSettings` kirim ESC/POS via SPP + `cutPaper` via `printFormattedTextAndCut`

## 🔧 Tech Notes

- **SDK 57 breaking**: `expo-file-system` ganti `File/Directory/Paths` — sudah fix di `backup.ts`/`export.ts`
- **Stok**: `pos.ts` validasi sebelum `BEGIN` + `UPDATE ... WHERE stock>=qty`
- **Bluetooth**: `expo-plugins/with-dantsu.js` inject `android/app/src/main/java/com/chukie99/posumkm/DantsuPrinterModule.java` (JitPack `com.github.dantsu:escpos-thermalprinter-android:3.3.0`) — **wajib `validate-dantsu GREEN` + `tsc 0` sebelum push**. `BLUETOOTH_SCAN neverForLocation` + `BLUETOOTH_CONNECT` di manifest.
- **Lifecycle**: `PRINT_LOCK synchronized` + `Thread.sleep(250)` drain + `reqId` log — jangan hapus, ini yang bikin print berulang tanpa restart bisa

## 📋 Changelog

- **v1.1.15 (25)** — **CONNECTION LIFECYCLE fix**: `PRINT_LOCK` + `isPrinting` anti double connect, `reqId [Rxxx]` log `CONNECT/PRINT/DISCONNECT`, `250ms flush` sebelum disconnect, `_isPrinting` guard di JS, error jujur `CONN/PRINT_FAIL/BUSY` + `Coba Lagi/Cetak PDF` manual — **Test Print → Transaksi → Transaksi lagi → Test lagi tanpa restart sukses** (fix `EscPosConnectionException` dead catch yang bikin build fail)
- **v1.1.14 (24)** — **NATIVE REGISTRATION fix**: `MainApplication.kt` Kotlin `add(DantsuPrinterPackage())` — `NativeModules.DantsuPrinter` jadi ADA, **Test Print pertama kali BERHASIL keluar kertas** (proof SPP + MAC + ESC/POS)
- **v1.1.13 (23)** — **PRINT_EXECUTION strict**: no swallow, reject on fail, Diagnosa Module + Test Print real
- **v1.1.12 (22)** — Bluetooth Classic SPP discovery 12s + paired/nearby + `BLUETOOTH_SCAN neverForLocation`
- **v1.1.11 (21)** — Fix modal bayar gak ilang (remount `key=kasir-refreshKey-themeTick`)
- **v1.1.10 (20)** — Fix `refreshKey` + `paperTheme` + backup 14 tabel + `COLLATE NOCASE`
- **v1.1.9 (19)** — Fix print fallback + dark mode + void stok + tab Hari Ini putih
- **v1.1.8 (18)** — ActivationGate filter `ACTIVE/READY`
- **v1.1.7 (17)** — PaperPicker A6/custom 58x200/80x200
- **v1.1.1 (11)** — Export CSV periode + kalender JS
- **v1.1.0 (10)** — Baseline stabil
- **v1.0.9 (9)** — Kasbon/BON + Shift + Cetak Bluetooth stub

## 📄 Dokumen

- `docs/Panduan-Kasir-Kita-v1.1.10-Lengkap.pdf` — 11 Bab A4 navy/teal
- `docs/Lynk-Listing-v1.1.10.txt` + `Lynk-Cover-1080.jpg` — listing Lynk.id
- `PRD_KASIR_KITA_v1.5.md` + `KASIR_KITA_Mockup_v1.5.html`
- `Riset_Saingan_KASIR_KITA.xlsx` — 14 saingan + strategi 49k→149k

## 📜 Lisensi

MIT — lihat `LICENSE`
