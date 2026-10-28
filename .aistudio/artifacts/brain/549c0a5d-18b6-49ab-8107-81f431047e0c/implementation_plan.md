# Penghapusan Tombol Aksi Cepat Setujui/Tolak Klaim CS & Penguatan Verifikasi Realisasi Logistik

Menghapus tombol jalan pintas centang `[ ✓ ]` dan silang `[ ✕ ]` pada baris tabel barang rusak serta tombol `[ Setujui Semua ]` dan `[ Tolak Semua ]` pada header kartu order di halaman **Aju Banding & Klaim CS**. Hal ini mencegah CS menandai klaim sebagai berhasil secara instan tanpa memverifikasi nominal pencairan ganti rugi aktual dari ekspedisi/marketplace (misalnya kebijakan ganti rugi logistik yang mencapai 10x harga barang atau nominal khusus lainnya).

## User Review & Critical Decisions

> [!IMPORTANT]
> Ringkasan keputusan yang telah dikonfirmasi pengguna pada tahap klarifikasi:
> - **Cakupan Tombol yang Dihapus**:
>   1. Tombol centang `[ ✓ ]` dan silang `[ ✕ ]` cepat pada baris tabel produk rusak (kolom *Aksi CS*).
>   2. Tombol `[ Setujui Semua ]` dan `[ Tolak Semua ]` cepat pada header kartu order.
> - **Alur Penyelesaian Klaim CS**: CS wajib memproses klaim dan memasukkan nilai pencairan aktual secara presisi melalui **Modal Klaim** (`[ 🛡 Klaim ]`) atau inline editor pada kolom **Realisasi Ekspedisi (Manual)**.

---

## 1. Overview & Core Concept

- **Masalah yang Diselesaikan**: Tombol aksi cepat sebelumnya secara otomatis menetapkan status klaim disetujui dengan nominal sama dengan harga pokok barang atau 0. Pada praktiknya, ekspedisi memiliki kebijakan penggantian berbeda (contoh: penggantian 10x ongkir/harga barang, limit klaim, atau potongan administrasi logistik). Akibatnya, selisih rugi dan laporan finansial menjadi tidak akurat jika CS menandai "berhasil" tanpa menginput nominal realisasi sebenarnya.
- **Solusi**: Menghilangkan shortcut approval instan tersebut. Tim CS diarahkan untuk selalu menggunakan tombol `[ 🛡 Klaim ]` atau input `Realisasi Ekspedisi` sehingga nominal uang ganti rugi yang cair dari kurir tercatat dengan benar ke database.

---

## 2. User Experience & Visual Design

- **Tampilan Header Kartu Order**:
  - Tombol yang tersedia di header pesanan kini tersusun bersih:
    - `[ Forward ke RMA Logistik ]` (untuk eskalasi kasus berat ke tim RMA).
    - `[ Salin Surat Order ]` (menyalin draf banding untuk seluruh order).
    - `[ Video Drive ]` (membuka bukti rekaman unboxing di Google Drive).
  - Tidak ada lagi tombol `[ Setujui Semua ]` dan `[ Tolak Semua ]`.
- **Tampilan Kolom Aksi CS di Tabel Barang**:
  - Setiap baris barang rusak hanya memiliki:
    - Tombol utama: `[ 🛡 Klaim ]` (membuka modal kelola klaim order, checklist barang, nomor tiket, dan input total nominal realisasi).
    - Tombol utilitas: `[ ❐ Salin Template ]` (menyalin format teks klaim untuk SKU tersebut).
  - Tombol lingkaran centang hijau `(✓)` dan silang merah `(✕)` dihilangkan sepenuhnya dari kolom *Aksi CS*.
- **Input Realisasi yang Diperjelas**:
  - Kolom **Realisasi Ekspedisi [MANUAL]** tetap dapat diklik untuk memasukkan angka ganti rugi aktual secara langsung dengan feedback instan.

---

## 3. Key Product Decisions & Trade-Offs

- **Keputusan 1: Penghapusan Total Shortcut Approval Instan**
  - *Pendekatan*: Menghapus elemen JSX tombol `handleQuickApproveItem`, `handleQuickRejectItem`, `handleQuickApproveAllOrder`, dan `handleQuickRejectAllOrder`.
  - *Alasan*: Menghilangkan risiko human error di mana operator CS secara tidak sengaja mengklik centang dan mengunci nominal default padahal pihak logistik mencairkan nominal berbeda.
- **Keputusan 2: Mempertahankan Fungsi Modal Klaim Terpusat**
  - *Pendekatan*: Modal `handleOpenOrderClaimModal` tetap menjadi pintu utama bagi CS untuk menetapkan status (APPROVED, REJECTED, SUBMITTED), menginput no. tiket resmi, dan nominal realisasi ganti rugi aktual.
  - *Alasan*: Modal menyediakan transparansi penuh, rincian perbandingan antara nilai tuntutan vs realisasi cair kurir, serta kalkulasi selisih rugi beban toko secara transparan.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────┐
│               Halaman Aju Banding & Klaim CS                   │
├────────────────────────────────────────────────────────────────┤
│ Header Order:                                                  │
│   [Forward ke RMA]  [Salin Surat Order]  [Video Drive]         │
│   (❌ Tombol Setujui Semua & Tolak Semua Ditiadakan)           │
├────────────────────────────────────────────────────────────────┤
│ Tabel Barang Rusak:                                            │
│   SKU | Bukti | Channel | Status | Realisasi (Manual) | Aksi CS│
│                                                       │        │
│                                           [ 🛡 Klaim ] [ ❐ ]   │
│                   (❌ Tombol [✓] & [✕] Cepat Ditiadakan)       │
└───────────────────────────────┬────────────────────────────────┘
                                │ Klik [ 🛡 Klaim ]
                                ▼
┌────────────────────────────────────────────────────────────────┐
│               Modal Detail Aju Banding Order                   │
│  - Input Status Resmi (Diajukan / Disetujui / Ditolak)         │
│  - Input Nomor Tiket Sengketa Ekspedisi                        │
│  - Input Nominal Realisasi Ganti Rugi Aktual dari Kurir        │
│    (Mendukung nominal fleksibel, misal 10x harga barang)       │
│  - Simpan & Perbarui Realtime State di Database Cloud          │
└────────────────────────────────────────────────────────────────┘
```

- **File yang Dimodifikasi**:
  - `src/components/DisputeClaimsView.tsx`:
    1. Menghapus rendering tombol `Setujui Semua` dan `Tolak Semua` di baris header order (sekitar baris 2411–2433).
    2. Menghapus rendering tombol centang `[ ✓ ]` dan silang `[ ✕ ]` di kolom *Aksi CS* (sekitar baris 2700–2724).
    3. Merapikan dan membersihkan fungsi handler aksi cepat yang tidak lagi digunakan.
