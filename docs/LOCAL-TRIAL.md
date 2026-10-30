# Menjalankan versi lokal

Memerlukan Node.js24 dan Windows untuk launcher opsional. Jalankan dari folder repository:

```powershell
npm.cmd ci
Copy-Item .env.example .env
# Ganti LOCAL_STOP_TOKEN dalam .env dengan nilai acak sebelum memakai backup/stop.
npm.cmd run build
npm.cmd start
```

Buka http://localhost:3001/ . Jangan menjalankan dua server pada database lokal yang sama. Aplikasi lokal memakai PGlite (PostgreSQL embedded), bukan layanan PostgreSQL Windows. Database di runtime/database dan backup runtime/backups tidak boleh dikomit. Instalasi laptop lama dapat memakai PGLITE_DATA_DIR yang berbeda; jangan mengganti nilai .env yang sudah dipakai agar tidak membuka database kosong.

Pratinjau dashboard tanpa menulis data: http://localhost:3001/?dashboard-demo=1 . Tambahkan dashboard-state=loading/updating/empty/error/offline untuk pratinjau state. Mode contoh diberi label Data demo. Navbar menampilkan semua modul yang diizinkan pada desktop; tablet/ponsel memakai Menu dengan label lengkap.

## Launcher Windows

```powershell
powershell -ExecutionPolicy Bypass -File tools/local-launcher/build.ps1
```

Jalankan launcher-build/Unboxin.exe. Launcher memakai Node.js dan folder repository yang sama, memeriksa server sebelum membuka browser, serta membuat backup sebelum menghentikan server. Tutup launcher tidak menghentikan server. EXE ini bukan installer mandiri; jangan memindahkannya sendirian. Kode sumber launcher disertakan, hasil EXE tidak dikomit.

## Pemeriksaan

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run test:launcher
npm.cmd run test:backend
npm.cmd run build
```

Tes integrasi backend memakai database uji terpisah dalam folder qa-backend-* di sebelah repository. tests/backend-http.integration.mjs menggunakan server uji port3128 dan database terpisah. Jangan menjalankan skrip pembersihan atau restart terhadap database operasional tanpa backup.

## Perubahan utama

Dashboard periode7/30/kustom, perbandingan yang tidak menganggap kenaikan kerusakan positif, ekspor CSV terfilter, state sinkronisasi dan akses keyboard. Klaim CS memisahkan persetujuan dan pembayaran; hanya sisa gagal diserahkan ke RMA untuk pemeriksaan kelayakan sebelum banding logistik. Operasi penggantian retur dan klaim memakai transaksi. API tidak lagi mengaku sukses dari cache ketika database gagal; inisialisasi tidak menghidupkan kembali contoh setelah tabel sengaja dikosongkan.

Nilai barang memakai harga Master SKU saat ini. Dana klaim mengikuti tanggal retur, bukan tanggal pembayaran. Google Drive memerlukan login/token valid; menyimpan email tidak memberikan akses. Tambahkan localhost pada Firebase Authorized domains.

Ini masih trial lokal. Otorisasi API berbasis sesi, isolasi tenant SaaS dan tanggal pembayaran terstruktur memerlukan pekerjaan lanjutan sebelum hosting internet. Pengujian visual/browser dan audit aksesibilitas aplikasi penuh belum selesai; lihat DESIGN.md dan UX-CONTRACT.md.
