from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

pdf_path = "F:/hermes/Kasir-kita/Manual_Book_Kasir_Kita_Beta.pdf"
doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)

styles = getSampleStyleSheet()
title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=20, textColor=colors.HexColor('#1E3A8A'), spaceAfter=12)
h2_style = ParagraphStyle('H2Style', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#2563EB'), spaceBefore=12, spaceAfter=6)
body_style = ParagraphStyle('BodyStyle', parent=styles['Normal'], fontSize=10, leading=14, textColor=colors.HexColor('#374151'), spaceAfter=8)

story = []
story.append(Paragraph("MANUAL BOOK — KASIR KITA (Versi Beta 1.1.22)", title_style))
story.append(Paragraph("Aplikasi kasir offline berfitur lengkap untuk UMKM, kedai, dan kafe dengan dukungan printer thermal Bluetooth ESC/POS.", body_style))
story.append(Spacer(1, 10))

sections = [
    ("1. PANDUAN INSTALASI & PERSIAPAN", 
     "Pastikan Anda mendownload file APK resmi berformat Kasir-Kita-v1.1.22-beta.apk. Izinkan instalasi dari sumber tidak dikenal di pengaturan Android Anda. Install aplikasi dan berikan izin yang diminta (terutama Lokasi/Bluetooth agar fitur scan printer berjalan lancar)."),
    ("2. KONEKSI PRINTER BLUETOOTH (POS58B / Thermal 58mm)", 
     "Nyalakan printer thermal Bluetooth Anda. Buka Setelan Bluetooth di HP Android, cari perangkat printer (misal: POS58B atau RPP02N), lalu Pair/Pasangkan (masukkan PIN 0000 atau 1234 jika diminta). Buka aplikasi Kasir Kita -> Masuk ke tab Pengaturan. Scroll ke bagian Printer Bluetooth. Tekan tombol Scan Bluetooth (12s). Pilih nama printer yang muncul di daftar Paired sampai status aktif. Tekan Test Print."),
    ("3. PENGATURAN LOGO & STRUK", 
     "Di menu Pengaturan, tekan tombol Pilih Logo dari Galeri. Pilih logo toko/kafe Anda (format PNG/JPG). Aplikasi akan otomatis melakukan resizing (maksimal 250px dengan kompresi optimal) agar pas di buffer printer thermal 58mm dan tidak menyebabkan error blank/kertas kosong. Logo otomatis tercetak di struk."),
    ("4. MELAKUKAN TRANSAKSI PENJUALAN", 
     "Masuk ke tab Kasir. Pilih produk yang ingin dibeli pelanggan. Tekan tombol Bayar, masukkan nominal uang. Tekan Cetak Struk untuk menyelesaikan transaksi dan mencetak nota secara otomatis ke printer thermal."),
    ("5. PEMECAHAN MASALAH (TROUBLESHOOTING)", 
     "Printer tidak mencetak/kertas kosong: Pastikan printer sudah di-pair di menu Bluetooth HP. Pastikan menggunakan printer thermal struk 58mm/80mm, bukan printer label resi. Pastikan kertas thermal terpasang dengan benar.")
]

for title, text in sections:
    story.append(Paragraph(title, h2_style))
    story.append(Paragraph(text, body_style))

doc.build(story)
print("PDF built successfully")
