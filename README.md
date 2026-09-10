# Kasir Kita — Kasir Offline untuk Warung, Kedai & Kafe

**v1.0.8 (build 8)** · **Android** · **Expo 57 + React Native 0.86 + TypeScript strict** · **100% offline** (SQLite di HP, tanpa server/internet)

![Expo](https://img.shields.io/badge/Expo-57-black) ![RN](https://img.shields.io/badge/React_Native-0.86-blue) ![TS](https://img.shields.io/badge/TypeScript-strict-blue) ![Offline](https://img.shields.io/badge/Offline-100%25-success) ![License](https://img.shields.io/badge/License-MIT-green)

**Harga Lynk.id: 49k early-bird → 99–149k lifetime (sekali bayar, tanpa langganan bulanan).**

> **Kenapa beda dari Moka/Olsera/Pawoon (299k/bln/outlet)?** Data di HP sendiri, APK 77M ringan, jalan di Android 10, struk thermal 58/80mm + PDF A4, logo toko PNG, tanpa watermark/batas produk.

---

## ✨ Fitur v1.0.8

### 🛒 Kasir — 1-Tap Jual (ala Kasir Pintar & Loyverse)
- Grid produk **foto 96px** 2-kolom (3-kolom di tablet), nama & harga besar — **tap = +1** tanpa modal
- **Search sticky** di atas (tidak ikut scroll) + **kategori chip swipe horizontal** (Semua/Minuman/Makanan/Snack/Favorit)
- Badge stok: `Habis` merah, `Sisa 2` kuning, `Stok 24` muted — stok habis tidak bisa tap
- **Varian / Topping / Modifier**: Surabi (+Telor +3k), Mie Tek-Tek (Pedas Lv), Teh (Es/Panas)
- **FAB Scan Barcode** (kamera) + **StickyCartBar pill navy** `bottom:84` — total + **Bayar** selalu visible, tidak ketutup
- Checkout: Tunai/QRIS, diskon Rp, hitung kembalian, tombol nominal cepat, cetak/bagikan struk

### 📦 Kelola Produk & Menu
- Tambah/edit produk: nama, harga, stok, **foto galeri (crop 1:1)**, kategori, `is_active`
- Kategori swipe, filter **Stok menipis**, star **Favorit** (pin di Kasir), switch aktif, hapus (soft-hide jika pernah terjual)
- Anti-minus: validasi `stock >= qty` + `WHERE stock>=qty` di transaksi

### 📊 Laporan & Riwayat — Reprint Struk
- Tabs **Hari Ini / Minggu Ini / Bulan Ini**, cards Transaksi/Omzet/Tunai/QRIS, banner diskon, **Top-5 Terlaris**
- Tiap transaksi: invoice, items, jam • metode, total + **2 tombol: Cetak Ulang & Bagikan** (pakai `buildReceiptHtml` 58mm)
- Export laporan **Excel/CSV** + **PDF**

### ⚙️ Pengaturan & Backup
- **Nama toko** (muncul di header & struk) + **Logo struk PNG** (upload galeri → `pos_images/store_logo.png` → tampil di struk thermal/PDF)
- **Ukuran kertas struk** (9 opsi, `pdf-lib` biar PDF pas tidak A4 melar):
  - `LABEL CONTINUOUS WITH CORE`: `57×30`, `80×30`
  - `PAPER THERMAL CORE`: `50×50`, `80×40`, `80×50`, `80×80`
  - `PAPER THERMAL CORELESS`: `57×30`, `57×40`
  - `LAINNYA`: `A4` — pilih di Pengaturan → chip per group, simpan `paperSize`
- **Tema** terang/gelap (pastel #F5EFE6 #AEBDCA #7895B2 #0F2440 + Inter) + **Backup .sql / Restore** + **lastBackupAt** indicator
- Beli/Perpanjang Lisensi (link Lynk.id/WA)

### 🔐 Lisensi Offline Anti-Bajakan
- Tiap HP punya **Device ID** `XXXX-XXXX-XXXX-XXXX` di layar aktivasi
- Kode aktivasi = `HMAC-SHA256(secret, deviceId)` — validasi offline tanpa internet
- Generate: `node keygen.mjs ABCD1234EFGH` atau buka `keygen-helper.html` (paste Device ID → Generate)
- ⚠️ **Wajib ganti `APP_LICENSE_SECRET` di `src/license/license.ts` & `keygen.mjs` sebelum rilis publik!** Secret default `5E175D...` sudah di repo — rotate sebelum scale ads.

### 🎨 UI/UX
- **Pastel ColorHunt** #F5EFE6 (bg) #E8DFCA (chip) #AEBDCA (border) #7895B2 (action) #0F2440 (navy) — lembut di mata kasir seharian
- **Siluet outline thin stroke** bottom nav: `storefront-outline` / `cube-outline` / `chart-bar` / `dots-horizontal` (bukan filled, premium minimalis)
- **Fixed bottom nav** `position: absolute bottom:20` — **tidak ikut scroll**, konten `paddingBottom:110+` biar tidak ketutup (fix v1.4.1)
- **Splash screen** navy #0F2440 + loading `Kasir Kita — Memuat kasir...` via `expo-splash-screen`

---

## 📸 Screenshot

Mockup 5 layar ada di [`KASIR_KITA_Mockup_v1.5.html`](KASIR_KITA_Mockup_v1.5.html) (Kasir 1-tap + Produk Favorit + Laporan Reprint + Lainnya Backup + Scan Barcode) — buka di browser, coba tap/search/kategori/scan.

> Untuk Lynk.id: screenshot dari HP + mockup ini.

---

## 🚀 Menjalankan

```bash
npm install
npx expo start          # scan QR pakai Expo Go (SDK 57)
```

## 📦 Build APK

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview   # → .apk (74M, internal)
eas build -p android --profile production # → .aab (Play Store)
```

`eas.json`:
| Profil | Output | Pakai |
|---|---|---|
| `preview` | `.apk` | Kirim via WA/Lynk.id langsung |
| `production` | `.aab` | Upload Google Play |

APK history: `apk/kasir-kita-v1.0.8.apk` 77M — lihat [Releases](https://github.com/Chukie99/kasir-kita/releases)

## 🔐 Aktivasi — Ed25519 1 license = 1 device (Opsi A via Email)
Buyer checkout di Lynk.id → webhook Supabase isi `licenses` → di APK **Ambil via Email → CARI → AKTIFKAN** (instant, tanpa tunggu email). Token `base64(LICENSE|DEVICE|sig)` verify `tweetnacl` offline. `DEVICE_MISMATCH 403` jika beda HP.

## 🔑 Key Generator (legacy HMAC, untuk penjual)

Pembeli kirim **Device ID** dari layar aktivasi → generate:

```bash
node keygen.mjs A7F3-91K2-Q8M4-X1Y2
# → XXXX-XXXX-XXXX-XXXX (kirim balik via WA)
```

Atau double-click `keygen-helper.html` → paste ID → Generate.

## 🗂️ Struktur

```
src/
├── db/database.ts              # SQLite schema + seed demo + migration barcode/favorite
├── license/license.ts          # deviceId (osInternalBuildId), HMAC, activate/isActivated
├── screens/
│   ├── ActivationGate.tsx      # kunci lisensi + input kode
│   ├── CashierScreen.tsx       # search sticky + kategori swipe + grid + FAB scan + StickyCartBar
│   ├── ManageProductsScreen.tsx# foto galeri + kategori + Favorit + low-stock
│   ├── HistoryScreen.tsx       # H/M/B + Top-5 + Reprint/Bagikan per transaksi
│   └── SettingsScreen.tsx      # nama toko + logo PNG + 9 ukuran 57×30..80×80+A4 (chip group) + backup/restore
├── components/
│   ├── FloatingBottomBar.tsx   # siluet outline 4 tab, fixed bottom:20
│   ├── StickyCartBar.tsx       # pill navy bottom:84
│   ├── ModifierSheet.tsx       # varian/topping
│   └── CheckoutSheet.tsx       # bayar + kembalian
├── theme/theme.ts              # Pastel MD3 + Inter
└── utils/
    ├── pos.ts                  # cartTotals, checkout + void soft, customer_name, filter voided=0
    ├── products.ts             # CRUD produk/kategori, stock, favorite
    ├── receipt.ts              # buildReceiptText/Html 9 ukuran + logo, pdf-lib MediaBox exact per mm, print/share PDF
    ├── backup.ts               # createBackup/restoreFromSql (SDK57 File/Directory/Paths)
    ├── export.ts               # exportDailyReport CSV + PDF
    └── settings.ts             # getSetting + PAPER_OPTIONS 9 ukuran + PaperSize + getPaperDims/normalize
assets/  icon.png, splash-icon.png, android-icon-*.png
keygen.mjs / keygen-helper.html  # owner-only, jangan publish secret baru
```

## 🧾 Struk — Thermal vs PDF

- **58mm** = 48mm content, 11px monospace — printer bluetooth mini (paling umum, 2–3 inch)
- **80mm** = 72mm — thermal lebar lebih lega
- **A4** = 170mm, 12px — PDF/email, header “Struk Penjualan — dicetak dari Kasir Kita” + logo 120px
- Ganti di **Pengaturan → Ukuran Kertas Struk** → `buildReceiptHtml(txId, size)` auto ganti `@page` + `width` + `font` + `logo size`. Ada badge `Pratinjau: 58mm — pilih 58mm untuk thermal`.

Logo: upload PNG transparan 512×512 ideal → tampil `<img max-width 80px thermal / 120px A4>` di atas struk.

## 🔧 Tech Notes

- **SDK 57 breaking**: `expo-file-system` ganti `FileSystem.Paths` → `File/Directory/Paths` + `cacheDirectory/documentDirectory` — sudah di-fix di `backup.ts`/`export.ts`/`ManageProductsScreen.tsx`
- **Stok**: `pos.ts` validasi sebelum `BEGIN` + `UPDATE ... WHERE stock>=qty` biar tidak -50
- **Delete produk**: `SELECT COUNT(*) FROM transaction_items WHERE product_name = ?` (bukan JOIN ngaco) — jika pernah terjual → soft-hide `is_active=0`

## 📋 Changelog

- **v1.0.8 (8)** — 9 ukuran kertas 57×30..80×80+A4 (chip group), PDF `pdf-lib mmToPt` exact per ukuran, GH Actions build (no EAS quota)
- **v1.0.7 (7)** — PDF thermal `pdf-lib` MediaBox 164pt (fix expo-print A4 595)
- **v1.0.6 (6)** — `width/height` expo-print attempt (masih A4, di-fix 1.0.7)
- **v1.0.5 (5)** — `@page 58mm auto` attempt
- **v1.0.4 (4)** — History detail + cetak ulang + void soft + atas nama + search
- **v1.0.3 (3)** — Opsi A via Email (get-license instant)
- **v1.0.2 (2)** — Ed25519 1=1 device
- **v1.0.1 (10)** — Fix ikon kotak-kotak (outline valid), splash loading navy, logo PNG di struk, pilih kertas 58/80/A4
- **v1.4.2 (9)** — Siluet thin stroke 1.6px, fixed bottom nav tidak ikut scroll
- **v1.4.1 (8)** — Anti-overlap: `paddingBottom 110+` semua screen, `StickyCartBar bottom:84`, TSC 0
- **v1.4.0 (7)** — Pastel #7895B2 + Inter, P0 stok/FS/delete/kategori/crash-log
- **v1.3.2** — Force close, image upload, checkout, dark theme, floating nav
- Roadmap v1.5: Reprint di Riwayat (done mockup), scan barcode camera, Favorit pin, piutang + Tagih WA, auto-backup Drive

## 📄 Dokumen

- `PRD_KASIR_KITA_v1.5.md` + `KASIR_KITA_Mockup_v1.5.html` — PRD & mockup easy-use 5 layar
- `Riset_Saingan_KASIR_KITA.xlsx/.pdf` — 14 saingan (CocoPOS, Kasir Pintar, Moka 299k/bln, Olsera dll) + strategi Lynk.id 49k→149k

## 📜 Lisensi

MIT — lihat `LICENSE`
