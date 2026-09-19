# MANUAL BOOK — KASIR KITA (Versi Beta 1.1.22)

Aplikasi kasir offline berfitur lengkap untuk UMKM, kedai, dan kafe dengan dukungan printer thermal Bluetooth ESC/POS.

---

## 1. PANDUAN INSTALASI & PERSIAPAN
1. Pastikan Anda mendownload file APK resmi berformat `Kasir-Kita-v1.1.22-beta.apk`.
2. Izinkan instalasi dari sumber tidak dikenal di pengaturan Android Anda.
3. Install aplikasi dan berikan izin yang diminta (terutama **Lokasi/Bluetooth** agar fitur scan printer berjalan lancar).

---

## 2. KONEKSI PRINTER BLUETOOTH (POS58B / Thermal 58mm)
1. Nyalakan printer thermal Bluetooth Anda.
2. Buka **Setelan Bluetooth** di HP Android, cari perangkat printer (misal: `POS58B` atau `RPP02N`), lalu **Pair/Pasangkan** (masukkan PIN **0000** atau **1234** jika diminta).
3. Buka aplikasi **Kasir Kita** → Masuk ke tab **Pengaturan** (paling kanan).
4. Scroll ke bagian **Printer Bluetooth**.
5. Tekan tombol **Scan Bluetooth (12s)**.
6. Pilih nama printer yang muncul di daftar **Paired (tersimpan di HP)** sampai muncul status `✓ aktif`.
7. Tekan tombol **Test Print** untuk memastikan printer mencetak dengan normal.

---

## 3. PENGATURAN LOGO & STRUK
1. Di menu **Pengaturan**, tekan tombol **Pilih Logo dari Galeri**.
2. Pilih logo toko/kafe Anda (format PNG/JPG). Aplikasi akan otomatis melakukan *resizing* (maksimal 250px dengan kompresi optimal) agar pas di buffer printer thermal 58mm dan **tidak menyebabkan error blank/kertas kosong**.
3. Logo akan otomatis tercetak di bagian atas setiap struk transaksi.

---

## 4. MELAKUKAN TRANSAKSI PENJUALAN
1. Masuk ke tab **Kasir**.
2. Pilih produk yang ingin dibeli pelanggan (bisa atur jumlah atau varian).
3. Tekan tombol **Bayar**, masukkan nominal uang yang dibayarkan.
4. Tekan **Cetak Struk** untuk menyelesaikan transaksi dan mencetak nota secara otomatis ke printer thermal.

---

## 5. PEMECAHAN MASALAH (TROUBLESHOOTING)
* **Printer tidak mau mencetak / keluar kertas kosong?**
  * Pastikan printer sudah di-pair di menu Bluetooth HP, bukan hanya di-scan di dalam aplikasi.
  * Pastikan Anda menggunakan printer thermal struk (58mm/80mm), **bukan** printer label resi (seperti Xprinter XP-420B).
  * Pastikan kertas thermal terpasang dengan benar (posisi termal menghadap ke *thermal head*).
* **Logo gagal dimuat?**
  * Gunakan gambar dengan ukuran wajar (di bawah 2MB).
