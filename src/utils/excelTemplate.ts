import * as XLSX from 'xlsx';

export interface MasterSKUItem {
  BARCODE: string;
  SKU_ID: string;
  SKU_NAME: string;
  HARGA?: number; // Harga Barang (Rupiah / IDR)
}

// Alias for backwards compatibility across existing imports
export type MasterOrderSKU = MasterSKUItem;

/**
 * Helper untuk parsing format harga dari teks atau angka
 */
export function parseNumericPrice(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  const str = String(val).trim();
  const clean = str.replace(/[^0-9]/g, '');
  if (!clean) return undefined;
  const num = parseInt(clean, 10);
  return isNaN(num) ? undefined : num;
}

/**
 * Format angka ke mata uang Rupiah
 */
export function formatRupiah(num?: number): string {
  if (num === undefined || num === null || isNaN(num)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num);
}

export const DEFAULT_MASTER_DATABASE: MasterSKUItem[] = [
  {
    BARCODE: '899100100201',
    SKU_ID: 'SKU-SKINCARE-01',
    SKU_NAME: 'Glow Radiance Vitamin C Serum 30ml',
    HARGA: 149000
  },
  {
    BARCODE: '899100100202',
    SKU_ID: 'SKU-JACKET-02',
    SKU_NAME: 'Techwear Waterproof Windbreaker Navy - L',
    HARGA: 389000
  },
  {
    BARCODE: '899100100203',
    SKU_ID: 'SKU-SHOES-03',
    SKU_NAME: 'Air Cushion Running Shoes Black - 42',
    HARGA: 450000
  },
  {
    BARCODE: '899100100204',
    SKU_ID: 'SKU-HEADSET-04',
    SKU_NAME: 'Razer BlackShark V2 Gaming Headset',
    HARGA: 899000
  },
  {
    BARCODE: '899100100205',
    SKU_ID: 'SKU-PHONE-X9',
    SKU_NAME: 'Smartphone Pro Max 256GB Midnight Black',
    HARGA: 12999000
  },
  {
    BARCODE: '899100100206',
    SKU_ID: 'SKU-APPR-202',
    SKU_NAME: 'Kaos Polos Cotton Combed 30s Hitam L',
    HARGA: 75000
  },
  {
    BARCODE: '899100100207',
    SKU_ID: 'SKU-ELEC-001',
    SKU_NAME: 'Headset Gaming 7.1 Surround RGB',
    HARGA: 320000
  },
  {
    BARCODE: '899100100208',
    SKU_ID: 'SKU-ELEC-003',
    SKU_NAME: 'Mouse Wireless Ergonomic Silent Click',
    HARGA: 175000
  },
  {
    BARCODE: '899100100209',
    SKU_ID: 'SKU-WATCH-001',
    SKU_NAME: 'Smartwatch AMOLED Bluetooth Call',
    HARGA: 650000
  },
  {
    BARCODE: '899100100210',
    SKU_ID: 'SKU-ACC-002',
    SKU_NAME: 'Adaptor Charger Magnetic Original',
    HARGA: 125000
  }
];

const LOCAL_STORAGE_KEY = 'WAREHOUSE_MASTER_SKU_SIMPLE_DB';

export function loadMasterDatabase(): MasterSKUItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          BARCODE: String(item.BARCODE || item.barcode || item.No_AWB_Order || '').trim(),
          SKU_ID: String(item.SKU_ID || item.sku_id || item.SKU || '').trim(),
          SKU_NAME: String(item.SKU_NAME || item.sku_name || item.Nama_Barang || item.nama_barang || '').trim(),
          HARGA: parseNumericPrice(item.HARGA ?? item.harga ?? item.HARGA_BARANG ?? item.harga_barang ?? item.Price ?? item.price)
        })).filter((item: MasterSKUItem) => Boolean(item.SKU_ID || item.BARCODE));
      }
    }
  } catch (err) {
    console.warn('Gagal membaca master SKU dari localStorage:', err);
  }
  return DEFAULT_MASTER_DATABASE;
}

export function saveMasterDatabase(data: MasterSKUItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Gagal menyimpan master SKU ke localStorage:', err);
  }
}

export interface MergeSkuResult {
  merged: MasterSKUItem[];
  addedCount: number;
  updatedCount: number;
  totalCount: number;
}

/**
 * Gabung dan perbarui SKU yang sama (Merge & Update):
 * - Jika SKU_ID atau BARCODE sudah ada, perbarui nama, barcode, dan harga barang
 * - Jika SKU baru, tambahkan ke dalam database
 */
export function mergeMasterSkus(existing: MasterSKUItem[], incoming: MasterSKUItem[]): MergeSkuResult {
  const result: MasterSKUItem[] = [];
  const indexByKey = new Map<string, number>();

  let updatedCount = 0;
  let addedCount = 0;

  // Petakan data yang sudah ada
  (existing || []).forEach((item) => {
    const itemCopy = { ...item };
    result.push(itemCopy);
    const pos = result.length - 1;
    if (itemCopy.SKU_ID) {
      indexByKey.set(`sku:${itemCopy.SKU_ID.trim().toUpperCase()}`, pos);
    }
    if (itemCopy.BARCODE) {
      indexByKey.set(`bc:${itemCopy.BARCODE.trim().toUpperCase()}`, pos);
    }
  });

  // Gabungkan dan perbarui data baru
  (incoming || []).forEach((newItem) => {
    if (!newItem.SKU_ID && !newItem.BARCODE) return;

    const skuKey = newItem.SKU_ID ? `sku:${newItem.SKU_ID.trim().toUpperCase()}` : null;
    const barcodeKey = newItem.BARCODE ? `bc:${newItem.BARCODE.trim().toUpperCase()}` : null;

    let targetIndex: number | undefined;
    if (skuKey && indexByKey.has(skuKey)) {
      targetIndex = indexByKey.get(skuKey);
    } else if (barcodeKey && indexByKey.has(barcodeKey)) {
      targetIndex = indexByKey.get(barcodeKey);
    }

    if (targetIndex !== undefined) {
      // Perbarui SKU yang sudah ada
      const current = result[targetIndex];
      const updated: MasterSKUItem = {
        BARCODE: (newItem.BARCODE || current.BARCODE || '').trim(),
        SKU_ID: (newItem.SKU_ID || current.SKU_ID || '').trim(),
        SKU_NAME: (newItem.SKU_NAME || current.SKU_NAME || '').trim(),
        HARGA: newItem.HARGA !== undefined && newItem.HARGA !== null && Number(newItem.HARGA) > 0 ? Number(newItem.HARGA) : (current.HARGA || 0)
      };
      result[targetIndex] = updated;
      updatedCount++;

      if (updated.SKU_ID) indexByKey.set(`sku:${updated.SKU_ID.trim().toUpperCase()}`, targetIndex);
      if (updated.BARCODE) indexByKey.set(`bc:${updated.BARCODE.trim().toUpperCase()}`, targetIndex);
    } else {
      // Tambah SKU baru ke daftar teratas
      const cleanItem: MasterSKUItem = {
        BARCODE: (newItem.BARCODE || newItem.SKU_ID || '').trim(),
        SKU_ID: (newItem.SKU_ID || newItem.BARCODE || '').trim(),
        SKU_NAME: (newItem.SKU_NAME || '').trim(),
        HARGA: Number(newItem.HARGA) || 0
      };
      result.unshift(cleanItem);
      addedCount++;

      // Re-index ulang
      indexByKey.clear();
      result.forEach((it, idx) => {
        if (it.SKU_ID) indexByKey.set(`sku:${it.SKU_ID.trim().toUpperCase()}`, idx);
        if (it.BARCODE) indexByKey.set(`bc:${it.BARCODE.trim().toUpperCase()}`, idx);
      });
    }
  });

  return {
    merged: result,
    addedCount,
    updatedCount,
    totalCount: result.length
  };
}

/**
 * Unduh Template Excel (.xlsx) 4 Kolom:
 * Kolom A: BARCODE
 * Kolom B: SKU ID
 * Kolom C: SKU NAME
 * Kolom D: HARGA BARANG
 */
export function downloadExcelTemplate(): void {
  const sampleData = [
    {
      BARCODE: '899100100201',
      'SKU ID': 'SKU-SKINCARE-01',
      'SKU NAME': 'Glow Radiance Vitamin C Serum 30ml',
      'HARGA BARANG': 149000
    },
    {
      BARCODE: '899100100202',
      'SKU ID': 'SKU-JACKET-02',
      'SKU NAME': 'Techwear Waterproof Windbreaker Navy - L',
      'HARGA BARANG': 389000
    },
    {
      BARCODE: '899100100203',
      'SKU ID': 'SKU-SHOES-03',
      'SKU NAME': 'Air Cushion Running Shoes Black - 42',
      'HARGA BARANG': 450000
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  // Auto-fit kolom A, B, C, D
  worksheet['!cols'] = [
    { wch: 20 }, // A: BARCODE
    { wch: 22 }, // B: SKU ID
    { wch: 45 }, // C: SKU NAME
    { wch: 18 }  // D: HARGA BARANG
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master_SKU');
  XLSX.writeFile(workbook, 'Template_Import_SKU_dan_Harga.xlsx');
}

/**
 * Unduh Template CSV (.csv) 4 Kolom:
 * A: BARCODE, B: SKU ID, C: SKU NAME, D: HARGA BARANG
 */
export function downloadCsvTemplate(): void {
  const csvContent = [
    'BARCODE,SKU ID,SKU NAME,HARGA BARANG',
    '899100100201,SKU-SKINCARE-01,"Glow Radiance Vitamin C Serum 30ml",149000',
    '899100100202,SKU-JACKET-02,"Techwear Waterproof Windbreaker Navy - L",389000',
    '899100100203,SKU-SHOES-03,"Air Cushion Running Shoes Black - 42",450000'
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_Import_SKU_dan_Harga.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse File Excel (.xlsx, .xls) atau .csv yang diunggah operator
 * Menerima format 4 kolom:
 * A: BARCODE
 * B: SKU ID
 * C: SKU NAME
 * D: HARGA BARANG
 */
export async function parseExcelOrCsvFile(file: File): Promise<MasterSKUItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 1. Baca sebagai array of rows (2D array) untuk fallback positional A, B, C, D
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        // 2. Baca sebagai object (berdasarkan nama header)
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        const result: MasterSKUItem[] = [];

        // Coba parsing dari rawJson (header-based)
        if (rawJson && rawJson.length > 0) {
          for (const row of rawJson) {
            let barcode = '';
            let skuId = '';
            let skuName = '';
            let hargaVal: unknown = undefined;

            // Cari kolom Barcode, SKU, Name, Harga
            for (const key of Object.keys(row)) {
              const cleanKey = key.trim().toLowerCase();
              const val = row[key];
              const strVal = String(val ?? '').trim();
              if (strVal === '') continue;

              if (cleanKey.includes('barcode') || cleanKey === 'a') {
                barcode = strVal;
              } else if (cleanKey.includes('sku') && !cleanKey.includes('name')) {
                skuId = strVal;
              } else if (
                cleanKey.includes('name') ||
                cleanKey.includes('nama') ||
                cleanKey.includes('barang') && !cleanKey.includes('harga') ||
                cleanKey.includes('product') ||
                cleanKey === 'c'
              ) {
                skuName = strVal;
              } else if (
                cleanKey.includes('harga') ||
                cleanKey.includes('price') ||
                cleanKey.includes('tarif') ||
                cleanKey.includes('nilai') ||
                cleanKey === 'd'
              ) {
                hargaVal = val;
              }
            }

            // Fallback jika belum ketemu
            if (!barcode && row['BARCODE']) barcode = String(row['BARCODE']).trim();
            if (!skuId && (row['SKU ID'] || row['SKU_ID'] || row['SKU'])) {
              skuId = String(row['SKU ID'] || row['SKU_ID'] || row['SKU']).trim();
            }
            if (!skuName && (row['SKU NAME'] || row['SKU_NAME'] || row['Nama_Barang'])) {
              skuName = String(row['SKU NAME'] || row['SKU_NAME'] || row['Nama_Barang']).trim();
            }
            if (hargaVal === undefined) {
              hargaVal = row['HARGA BARANG'] ?? row['HARGA'] ?? row['Harga'] ?? row['PRICE'] ?? row['Price'];
            }

            if (barcode || skuId) {
              result.push({
                BARCODE: barcode || skuId,
                SKU_ID: skuId || barcode,
                SKU_NAME: skuName || `Produk ${skuId || barcode}`,
                HARGA: parseNumericPrice(hargaVal)
              });
            }
          }
        }

        // Jika header-based kosong, parse baris demi baris via positional 2D array
        if (result.length === 0 && rawRows && rawRows.length > 1) {
          // Lewati header baris 0
          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!Array.isArray(row) || row.length === 0) continue;

            const colA = String(row[0] ?? '').trim(); // A: BARCODE
            const colB = String(row[1] ?? '').trim(); // B: SKU ID
            const colC = String(row[2] ?? '').trim(); // C: SKU NAME
            const colD = row[3];                      // D: HARGA BARANG

            if (colA || colB) {
              result.push({
                BARCODE: colA || colB,
                SKU_ID: colB || colA,
                SKU_NAME: colC || `Produk ${colB || colA}`,
                HARGA: parseNumericPrice(colD)
              });
            }
          }
        }

        if (result.length === 0) {
          reject(
            new Error(
              'Tidak ditemukan baris data valid. Pastikan file berisi kolom A: BARCODE, B: SKU ID, C: SKU NAME, D: HARGA BARANG.'
            )
          );
        } else {
          resolve(result);
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
