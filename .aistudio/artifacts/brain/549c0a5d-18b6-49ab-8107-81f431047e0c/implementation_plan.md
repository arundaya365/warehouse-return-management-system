# Rencana Implementasi: Filter Status Kondisi Model Checklist Multi-Kriteria — [SELESAI]

Menanggapi permintaan: *"yang dimerahin buat seperti checklist"*, filter **Status Kondisi** pada halaman Laporan (*ReportsView*) yang sebelumnya berupa menu *dropdown* tunggal telah ditingkatkan menjadi **panel checklist multi-seleksi interaktif** yang modern, informatif, dan responsif.

---

## 1. Perubahan Desain & Fungsionalitas

### A. Transformasi Dropdown Menjadi Checklist Interaktif
- **Sebelumnya**: Menggunakan elemen `<select>` tunggal yang sempit dan hanya mengizinkan pemilihan 1 kondisi sekaligus ("Semua Kondisi" atau salah satu dari 5 kondisi).
- **Sesudah**: Menggunakan panel baris khusus (*Row 2*) dengan kartu *checklist* interaktif untuk setiap kondisi:
  1. **Good** (Baik / Normal) — Bernuansa Emerald Green dengan indikator *ring* aktif.
  2. **Damage Product** (Fisik Produk Rusak) — Bernuansa Rose Red.
  3. **Damage Packaging** (Kemasan / Dus Rusak) — Bernuansa Amber Orange.
  4. **Missing** (Barang Hilang / Kurang) — Bernuansa Crimson Red.
  5. **Unexpected** (Barang Salah Kirim) — Bernuansa Purple / Indigo.

### B. Fitur Unggulan Panel Checklist
1. **Multi-Selection Checkbox**:
   - Pengguna dapat mencentang satu, beberapa, atau seluruh status kondisi secara bersamaan (misalnya hanya mencentang *Damage Product* + *Damage Packaging* untuk menganalisis retur rusak).
2. **Tombol Shortcut Cepat**:
   - **Pilih Semua**: Mencentang kelima kondisi secara instan.
   - **Hanya Good**: Memilih hanya kondisi barang layak restock.
   - **Hanya Defect / Masalah**: Langsung memilih seluruh kategori cacat (*Damage Product*, *Damage Packaging*, *Missing*, dan *Unexpected*).
   - **Reset**: Mengembalikan status ke seluruh kondisi aktif.
3. **Badge Penghitung Real-time (*Live Data Count*)**:
   - Setiap kartu checklist menampilkan jumlah baris data yang cocok dengan parameter filter lainnya (rentang tanggal, Order ID, Operator, SKU ID).
4. **Sinkronisasi Filter & Ekspor**:
   - Ringkasan filter (*filter pills*) menampilkan jumlah kondisi yang aktif beserta tombol pintas hapus.
   - Ekspor file CSV dan Modal Unduh Terfilter (*ExportFilteredModal*) secara otomatis membawa daftar kondisi yang tercentang.
5. **Penanganan State Kosong (*Empty State*)**:
   - Jika pengguna mematikan seluruh centang, sistem menampilkan kotak panduan ramah dengan tombol "Pilih Semua Kondisi".

---

## 2. File yang Diperbarui
- `src/components/ReportsView.tsx`: Mengonversi state `filterCondition` menjadi `selectedConditions: Set<string>`, menambahkan `STANDARD_CONDITIONS`, logika *checklist*, serta panel visual interaktif.
- `src/components/ExportFilteredModal.tsx`: Memperluas interface `ExportFilterCriteria` untuk mendukung array `conditions?: string[]` multi-kriteria.

---

## 3. Hasil Verifikasi
- **Build**: `npm run build` sukses 100%.
- **Lint**: `tsc --noEmit` sukses tanpa ada error tipe data.
