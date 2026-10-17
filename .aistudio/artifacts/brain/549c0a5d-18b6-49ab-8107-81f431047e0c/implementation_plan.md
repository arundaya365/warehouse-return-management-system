# Rencana Implementasi: Automasi Deteksi Marketplace & Logistik Berdasarkan Prefix Resi (AWB)

Mengotomatisasi identifikasi **Marketplace** dan **Ekspedisi Logistik** dari hasil pemindaian nomor resi / AWB menggunakan aturan sintaks Excel yang diberikan, menyediakan 2 dropdown untuk pemilihan/penyesuaian manual jika ada prefix baru, menyimpan prefix baru ke memori sistem, serta menampilkan informasinya di Stasiun Unboxing, Laporan Hasil Unboxing, dan Klaim CS.

---

## 1. Kamus Aturan Deteksi Prefix Resi (Formula Excel)

Sistem akan mengevaluasi prefix 3 karakter terlebih dahulu (prioritas tinggi), kemudian prefix 2 karakter:

### A. Kriteria Marketplace
| Prefix (Awalan) | Hasil Marketplace |
|---|---|
| `GTL` | TikTok Shop |
| `250` | Shopee Indonesia |
| `TLJ` | Tokopedia Indonesia |
| `00` | Shopee Indonesia |
| `SPX` | Shopee Indonesia |
| `LA` | Lazada Indonesia |
| `JP` | Shopee Indonesia |
| `JNA` | Lazada Indonesia |
| `JX` | TikTok Shop |
| `CM` | Shopee Indonesia |
| `TKP` | Tokopedia Indonesia |
| `JZ` | Lazada Indonesia |
| `NJV` | TikTok Shop |
| `NLI` | Lazada Indonesia |
| `ID` | Shopee Indonesia |
| `TG` | TikTok Shop |
| `SP` | Shopee Indonesia |
| `TK` | TikTok Shop |
| `RT` | Lazada Indonesia |

### B. Kriteria Logistik / Ekspedisi
| Prefix (Awalan) | Hasil Ekspedisi Logistik |
|---|---|
| `LX` | Lazada Express |
| `NJV` | Ninja Express |
| `RTB` | JNE |
| `TG` | JNE |
| `SP` | Indomaret |
| `JZ` | J&T |
| `TK` | Indomaret |
| `TLJ` | JNE |
| `NLI` | Lazada Express |
| `250` | Shopee Instan |
| `00` | SiCepat |
| `SPX` | Shopee Express |
| `JX` | J&T |
| `GTL` | Goto Logistik |
| `JNA` | JNE |
| `JP` | J&T |
| `ID` | Shopee Express |
| `CM` | JNE |
| `TKP` | SiCepat |

---

## 2. Modul & Penyimpanan Memori Prefix Baru (`awbDetection.ts`)

* **Engine Deteksi Deterministik**:
  * Fungsi `detectMarketplaceAndLogistics(awb: string)` yang mengevaluasi prefix 3 digit dan 2 digit sesuai rumus di atas.
  * Mendukung fallback ke kamus kustom lokal (`localStorage` key `rma_custom_awb_prefixes_v1`).
* **Fitur Pembelajaran Prefix Baru (Dynamic Learning)**:
  * Jika scanner membaca awalan resi baru yang belum ada di rumus, operator memilih nilai dari 2 dropdown.
  * Sistem menyediakan fungsi `saveLearnedAwbPrefix(prefix, marketplace, logistics)` yang otomatis mencatat prefix baru ke memori sistem agar scan berikutnya langsung terisi otomatis.

---

## 3. Integrasi pada Stasiun Unboxing (`UnboxingStation.tsx`)

* **Deteksi Real-Time di Modal Scan AWB**:
  * Saat nomor resi discan/diinput, sistem langsung mendeteksi Marketplace & Logistik secara instan.
  * Menampilkan 2 Dropdown interaktif berdampingan:
    1. **Dropdown Marketplace**: Pilihan terisi otomatis (Shopee Indonesia, TikTok Shop, Tokopedia Indonesia, Lazada Indonesia, Blibli, Lainnya) dan tetap dapat diganti operator.
    2. **Dropdown Logistik**: Pilihan terisi otomatis (Shopee Express, J&T, JNE, SiCepat, Lazada Express, Ninja Express, Indomaret, Shopee Instan, Goto Logistik, Lainnya) dan tetap dapat diganti operator.
* **Badge Indikator Status Prefix**:
  * Menampilkan badge hijau `✓ Terdeteksi Otomatis` jika prefix cocok dengan rumus Excel.
  * Menampilkan badge kuning `🔍 Prefix Baru Terdeteksi` jika prefix baru, memberi tahu operator bahwa pilihan dropdown akan otomatis disimpan ke memori sistem.
* **Penyimpanan ke Sesi Unboxing**:
  * Nilai `Marketplace` dan `Ekspedisi` disimpan ke dalam payload sesi unboxing dan diteruskan ke baris hasil laporan.

---

## 4. Integrasi pada Laporan Unboxing (`ReportsView.tsx`) & Data Model (`processor.ts`)

* **Ekspansi Data Model `ProcessedReturnRow`**:
  * Menambahkan field opsional `Marketplace?: string; Ekspedisi?: string;` ke interface `ProcessedReturnRow`.
* **Tampilan Tabel Laporan**:
  * Menampilkan kolom / badge **Marketplace** dan **Ekspedisi** pada tabel laporan dan subpanel rincian order.
  * Filter pencarian laporan dapat memfilter berdasarkan Marketplace atau Ekspedisi.
  * Ekspor Excel/CSV laporan menyertakan kolom Marketplace dan Ekspedisi.

---

## 5. Integrasi pada Aju Banding & Klaim CS (`DisputeClaimsView.tsx`)

* Menggunakan `Marketplace` dan `Ekspedisi` hasil deteksi untuk:
  * Menentukan default channel klaim secara akurat (Shopee, TikTok Shop, Tokopedia, Lazada, dll.).
  * Mengisi template surat komplain resmi dengan nama ekspedisi dan marketplace yang sesuai secara otomatis.

---

## 6. Verifikasi & Pengujian

* Uji coba input contoh nomor resi dari setiap kriteria:
  * `SPX...` -> Shopee Indonesia & Shopee Express
  * `GTL...` -> TikTok Shop & Goto Logistik
  * `TLJ...` -> Tokopedia Indonesia & JNE
  * `JZ...` -> Lazada Indonesia & J&T
  * `250...` -> Shopee Indonesia & Shopee Instan
  * `00...` -> Shopee Indonesia & SiCepat
* Uji coba input resi dengan awalan baru (misal `XYZ123`), ubah 2 dropdown, pastikan prefix tersimpan dan scan kedua otomatis mendeteksi.
* Jalankan `compile_applet` dan `lint_applet` untuk memastikan tidak ada error kompilasi.
