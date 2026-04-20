***

# 📦 Sistem Inventaris Kampus Berbasis LAN (QR & OCR)

![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![Python](https://img.shields.io/badge/Python-3.x-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)
![Tesseract OCR](https://img.shields.io/badge/OCR-Tesseract-orange)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

Sistem Informasi Manajemen Inventaris Kampus yang dirancang khusus untuk beroperasi 100% secara lokal (LAN) tanpa ketergantungan pada vendor pihak ketiga (*Vendor-Agnostic*). Menggabungkan kecepatan Node.js untuk I/O jaringan, ketangguhan Python untuk *Computer Vision*, dan kepraktisan Spreadsheet (Excel) sebagai basis data.

---

## ✨ Fitur Utama

*   📱 **WebRTC QR Scanner:** Membaca QR Code langsung dari browser HP tanpa perlu instalasi aplikasi APK/iOS.
*   🧠 **Computer Vision (OCR):** Ekstraksi Nomor Seri barang (S/N) secara otomatis dari foto menggunakan Tesseract OCR dan OpenCV, terintegrasi langsung ke dalam *form* web.
*   📊 **Spreadsheet as a Database:** Menggunakan file `database.xlsx` sebagai *Single Source of Truth*. Data yang discan dari HP langsung tertulis ke file Excel PC secara *real-time*.
*   🤖 **Smart Auto-Detect Behavior:** 
    *   Kolom yang mengandung kata `id` otomatis melakukan incremental (+1).
    *   Kolom yang mengandung kata `seri` otomatis menjadi mode Unik (Kamera mati & *field* ter-reset setelah data masuk).
    *   Dukungan *Bulk/Mass Write* untuk penulisan data massal.
*   ⏱️ **Auto Timestamping:** Menyuntikkan waktu pembaruan data secara otomatis tanpa campur tangan *user*.
*   🛠️ **Dynamic Schema Management:** Menambahkan kolom baru ke *spreadsheet* langsung melalui antarmuka *mobile phone* pekerja gudang.
*   🐳 **Fully Dockerized:** Siap dijalankan di OS manapun (Windows/Mac/Linux) dalam 1 perintah, tanpa perlu menginstal Python, Node, atau Tesseract secara manual.

---

## 🏗️ Arsitektur & Keputusan Teknis (The "Why")

Sistem ini dibangun dengan beberapa pertimbangan infrastruktur yang spesifik untuk lingkungan kampus:

1.  **Mengapa HTTPs Lokal (Self-Signed SSL)?**
    Browser modern (Chrome/Safari) menerapkan kebijakan keamanan WebRTC yang ketat: akses kamera di jaringan LAN (`192.168.x.x`) akan diblokir pada protokol HTTP. Kami menggunakan sertifikat `mkcert` lokal agar fitur kamera HP dapat terbuka secara *native*.
2.  **Mengapa File Excel (`.xlsx`) bukan SQL Database?**
    Fokus utama pada iterasi ini adalah **Auditability & Kemudahan Staf**. Menggunakan Excel memungkinkan staf non-teknis untuk mengecek, mengedit, atau membackup data hanya dengan melakukan "klik ganda", tanpa perlu *query* SQL atau *interface* admin tambahan.
3.  **Mengapa Python + Node.js (Micro-architecture)?**
    Node.js sangat cepat menangani *request* HTTP dan I/O *web-socket/API*. Namun, ekosistem pemrosesan gambar terbaik ada pada Python (OpenCV & Tesseract). Kami memisahkan peran: Node.js sebagai Web Server & Manajer Data, lalu ia memanggil *script* Python secara *headless* (via JSON *stdout*) khusus saat dibutuhkan ekstraksi OCR.
4.  **Mengapa Docker dengan Volume Mapping?**
    *   *No "Works on my machine" excuses:* Mencegah *error* karena perbedaan versi *environment* Windows vs Linux.
    *   *Live Database:* Dengan melakukan *mounting* volume direktori lokal (`./:/app`), file `database.xlsx` di komputer Host akan langsung diperbarui oleh Container Docker dari dalam, sehingga pengguna tetap bisa mengakses *spreadsheet* secara fisik dari OS Windows-nya.

---

## 📂 Struktur Direktori

```text
kampus-qr/
 ├── public/
 │    ├── index.html            # Antarmuka SPA (Single Page App) PC & Mobile
 │    └── html5-qrcode.min.js   # Library WebRTC Offline (No-CDN)
 ├── cert.pem                   # Sertifikat SSL Publik
 ├── key.pem                    # Kunci Privat SSL
 ├── database.xlsx              # Master Data & Single Source of Truth
 ├── server.js                  # Backend Node.js
 ├── cv_extractor.py            # Python OCR Engine
 ├── package.json               # Dependensi Node.js
 ├── Dockerfile                 # Resep Dapur Docker (Instalasi Linux, Py, Node)
 └── docker-compose.yml         # Konfigurasi Layanan & Volume Mounting
```

---

## 🚀 Panduan Instalasi (Untuk Divisi IT)

Sistem ini menggunakan Docker, sehingga komputer *Server* tidak perlu dipenuhi oleh instalasi bahasa pemrograman.

### Prasyarat
*   Pastikan **Docker Desktop** sudah terinstal dan menyala di komputer Server/PC Anda.
*   Pastikan Anda berada dalam satu jaringan WiFi / Kabel LAN yang sama dengan *Mobile Phone* yang akan digunakan.

### Langkah Menjalankan

1. Ekstrak folder *project* ini di komputer Anda.
2. Buka **Command Prompt (CMD) / PowerShell** atau Terminal bawaan *Operating System*, lalu arahkan ke dalam folder *project* tersebut.
3. Jalankan perintah ajaib ini:
   ```bash
   sudo docker compose up -d --build
   ```
4. Tunggu beberapa saat (Docker akan membangun lingkungan sistem Anda secara otomatis).
5. Setelah selesai, buka *browser* di PC Anda dan akses: `https://localhost:3000`.

---

## 📖 Cara Penggunaan (Workflow)

### Tahap 1: Command Center (PC)
1. Setelah server berjalan, buka `https://localhost:3000` di PC/Laptop Server.
2. Anda akan melihat **QR Portal Masuk** dan info kolom dari Excel.
3. Biarkan tab PC ini terbuka sebagai *Dashboard*.

### Tahap 2: Staf Lapangan (HP)
1. Buka aplikasi Kamera di HP Anda, **Scan QR Portal** yang ada di layar PC.
2. HP akan diarahkan ke *link* IP lokal secara otomatis (Cth: `https://192.168.1.10:3000`).
   * *Catatan: Jika muncul "Not Secure / Sambungan Tidak Aman", klik Advanced/Lanjutan -> Proceed/Lanjutkan.*
3. Di layar HP, masuk ke **Tab Tulis**.
4. **Mulai Pendataan:**
   * Isi kolom "Nama Barang" dsb.
   * Untuk Nomor Seri, klik tombol **📷 Auto-Extract Teks (Difoto)** lalu foto tulisan S/N pada barang. Teks akan terisi otomatis.
   * Klik **Buka Kamera Scanner**, arahkan ke QR Code barang.
   * Data akan langsung tersimpan ke `database.xlsx` di PC.

---

## ⚠️ Aturan Master Data (Excel)
Agar sistem berjalan lancar, file `database.xlsx` memiliki beberapa aturan dasar:
1. Header Baris Pertama **WAJIB** memiliki kolom bernama `QR_ID`.
2. Semua QR Code yang di-scan **harus sudah terdaftar** di dalam kolom `QR_ID` Excel tersebut. Jika QR Code ilegal di-scan, sistem akan menolaknya.
3. Kolom `Terakhir_Update` akan diinjeksi dan diisi otomatis oleh Server, tidak perlu dibuat secara manual.

---
*Dibuat untuk sistem infrastruktur kampus mandiri yang bebas langganan vendor.* 🎓

## ⚠️ Peringatan
1. Tutup Excel jika terbuka sebelum melakukan input data melalui HP. Bisa mengecek isi excel jika tidak sedang aktif mencatat data baru di HP.