// Generate PDF panduan penggunaan Kasir Kita v1.2.0 (Bahasa Indonesia)
// Run: node make-guide.mjs
import PDFDocument from 'pdfkit'
import fs from 'node:fs'

const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 55, right: 55 } })
doc.pipe(fs.createWriteStream('Panduan-POS-UMKM.pdf'))

const TEAL = '#249D8F', DARK = '#2A2721', MUTED = '#6E6A5E', TERRA = '#E76F51', YELLOW = '#B98A1F'

const h1 = (t) => { doc.moveDown(0.6).font('Helvetica-Bold').fontSize(20).fillColor(TEAL).text(t); doc.moveDown(0.3) }
const h2 = (t) => { doc.moveDown(0.7).font('Helvetica-Bold').fontSize(13).fillColor(DARK).text(t); doc.moveDown(0.15) }
const p = (t) => doc.font('Helvetica').fontSize(10.5).fillColor(DARK).text(t, { lineGap: 3 })
const li = (t) => doc.font('Helvetica').fontSize(10.5).fillColor(DARK).text('•  ' + t, { lineGap: 3 })
const step = (n, title) => doc.font('Helvetica-Bold').fontSize(11).fillColor(TEAL).text(`${n}. ${title}`, { lineGap: 4 })

// ===== COVER =====
doc.rect(0, 0, 612, 240).fill(TEAL)
doc.font('Helvetica-Bold').fontSize(34).fillColor('#FFFFFF').text('Kasir Kita', 55, 90)
doc.fontSize(14).fillColor('#DFF3F0').text('Panduan Penggunaan Lengkap — v1.2.0', 55, 135)
doc.fontSize(10).fillColor('#DFF3F0').text('Kasir Offline untuk Warung & Kedai', 55, 158)
doc.moveDown(14)
h1('Selamat Datang!')
p('Kasir Kita adalah aplikasi kasir yang bekerja 100% offline di HP Android Anda. Tidak perlu internet untuk melayani pembeli — cukup buka aplikasinya dan mulai berjualan.')
p('Panduan ini menjelaskan semua fitur: aktivasi, kelola produk & stok, transaksi kasir, laporan penjualan, hingga cetak struk.')

doc.addPage()

// ===== 1. AKTIVASI =====
h1('1. Aktivasi Aplikasi')
p('Saat pertama dibuka, aplikasi terkunci dan menampilkan Kode Perangkat (Device ID). Aktivasi dilakukan sekali saja per HP.')
step(1, 'Buka aplikasi Kasir Kita')
p('   Catat Kode Perangkat yang tampil di layar (contoh: QKQ1-AB2C-D3EF).')
step(2, 'Klik tombol hijau "MINTA KODE VIA WHATSAPP"')
p('   WhatsApp akan terbuka dengan pesan otomatis berisi kode perangkat Anda. Tekan kirim ke penjual.')
step(3, 'Terima Kode Aktivasi dari penjual')
p('   Format kode: XXXX-XXXX-XXXX-XXXX (16 karakter).')
step(4, 'Masukkan kode pada kolom "Kode Aktivasi" lalu tekan AKTIVASI')
p('   Selesai! Aplikasi terbuka dan siap dipakai selamanya di HP tersebut.')
doc.moveDown(0.5).font('Helvetica-Oblique').fontSize(9.5).fillColor(TERRA)
   .text('Catatan: satu kode aktivasi hanya berlaku untuk satu HP. Jika ganti HP baru, minta kode baru ke penjual.')

// ===== 2. KELOLA PRODUK =====
h1('2. Kelola Produk & Stok')
p('Buka menu Kelola Produk untuk menambah atau mengubah daftar jualan Anda.')
h2('Menambah Produk Baru')
li('Tekan tombol "Tambah Produk Baru"')
li('Isi Nama Produk (wajib), misal: Kopi Susu Gula Aren')
li('Isi Harga dalam rupiah (wajib)')
li('Isi Stok — OPSIONAL. Kosongkan jika produk tidak perlu dilacak stoknya (misal: masakan yang dibuat terus tiap hari). Isi angka jika ingin stok otomatis tercatat.')
li('Pilih kategori (opsional): Makanan, Minuman, Snack, dll. Bisa tambah kategori sendiri.')
li('Tekan Simpan Produk')
h2('Stok Otomatis')
p('Jika stok diisi, setiap transaksi kasir akan otomatis mengurangi stok produk. Saat stok tinggal 5 atau kurang, tulisannya berubah warna oranye sebagai peringatan. Untuk mengisi ulang, buka produk lalu ubah angka stoknya.')
h2('Mengedit / Menonaktifkan Produk')
li('Ketuk nama produk untuk mengedit nama, harga, stok, atau kategori')
li('Gunakan saklar (switch) untuk menyembunyikan produk dari layar kasir tanpa menghapus riwayat')
li('Tombol 🗑 menghapus produk — hanya bisa jika belum pernah terjual')

doc.addPage()

// ===== 3. TRANSAKSI =====
h1('3. Transaksi Kasir')
p('Layar Kasir adalah halaman utama aplikasi. Semua produk aktif tampil sebagai kartu.')
step(1, 'Ketuk produk yang dibeli customer')
p('   Produk masuk ke keranjang. Ketuk beberapa kali / beberapa produk untuk pesanan lebih dari satu.')
p('   Jika produk punya varian (ukuran, level pedas, topping), pilih dulu varian yang diminta lalu tekan Tambah Polos/Tambah.')
step(2, 'Atur jumlah bila perlu')
p('   Di bar keranjang bagian bawah, gunakan +/– untuk mengubah jumlah item.')
step(3, 'Tekan keranjang → layar Pembayaran terbuka')

h2('Diskon (opsional)')
li('Tanpa — tidak ada diskon')
li('Rp — diskon nominal, contoh isi 5000 untuk potongan Rp 5.000')
li('% — diskon persen, contoh isi 10 untuk potongan 10%')
p('Total tagihan langsung menyesuaikan setelah diskon dipilih.')

h2('Metode Pembayaran')
li('Tunai — masukkan uang yang dibayarkan customer (ada tombol cepat: Pas / 20rb / 50rb / 100rb). Kembalian dihitung otomatis.')
li('QRIS — total dibayar penuh via scan QRIS merchant Anda. Konfirmasi setelah dana masuk.')
step(4, 'Tekan "Konfirmasi & Selesai"')
p('Transaksi tersimpan dan struk siap dikirim/dicetak dari notifikasi yang muncul.')

// ===== 4. STRUK =====
h1('4. Kirim & Cetak Struk')
p('Setiap transaksi selesai akan muncul notifikasi dengan dua pilihan:')
li('📤 Kirim Struk — kirim struk berupa teks via WhatsApp/SMS ke customer. Cocok untuk pesanan antar (online).')
li('🖨️ Cetak — membuka dialog print Android. Pilih printer thermal Anda (yang mendukung layanan cetak Android) dan struk tercetak format 58mm.')
p('Riwayat struk juga bisa diakses kapan saja lewat menu Riwayat.')

doc.addPage()

// ===== 5. LAPORAN =====
h1('5. Laporan Penjualan')
p('Menu Riwayat menampilkan performa penjualan dengan 3 periode:')
li('Hari Ini — transaksi sejak jam 00:00 pagi ini')
li('Minggu Ini — transaksi 7 hari terakhir')
li('Bulan Ini — transaksi bulan berjalan (tanggal 1 s/d sekarang)')
h2('Yang ditampilkan:')
li('Jumlah transaksi dan omzet periode terpilih')
li('Perincian uang tunai vs QRIS')
li('Total diskon yang telah diberikan')
li('🏆 Produk Terlaris — 5 produk paling laku beserta jumlah terjual dan omzetnya')
li('Daftar lengkap setiap transaksi: nomor invoice, item yang dibeli, jam, metode bayar, dan total')
h2('Export Laporan Harian (Excel/CSV)')
p('Dari menu Pengaturan, gunakan Export untuk membuat file laporan harian format CSV yang bisa dibuka di Excel dan dibagikan via WhatsApp/email.')

// ===== 6. BACKUP =====
h1('6. Backup & Pindah HP')
p('Semua data tersimpan di dalam HP (offline). Lakukan backup rutin agar data aman:')
step(1, 'Buka menu Pengaturan → Backup Database')
p('   File backup akan dibuat — simpan ke Google Drive, WhatsApp sendiri, atau penyimpanan lain.')
step(2, 'Untuk pindah HP baru:')
p('   Install aplikasi di HP baru → buka file backup → data produk & riwayat ikut pindah. (Aktivasi tetap perlu kode baru untuk HP baru.)')

// ===== PENUTUP =====
doc.moveDown(1)
doc.rect(55, doc.y, 500, 70).fill('#FDF0D5')
doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('Butuh bantuan?', 70, doc.y - 55)
doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text('Hubungi kami via WhatsApp: 0822-6140-7123\nSenang membantu! Terima kasih sudah memakai Kasir Kita. 🙏', 70, doc.y + 2)

doc.end()
console.log('PDF dibuat: Panduan-POS-UMKM.pdf')
