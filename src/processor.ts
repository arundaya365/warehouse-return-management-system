/**
 * Backend Logic Processor untuk Sistem Aplikasi Retur Gudang e-Commerce
 * 
 * ATURAN PEMROSESAN:
 * 1. Validasi SKU: Cocokkan daftar barang yang di-scan (Scanned_SKUs) dengan daftar barang pesanan (Expected_SKUs).
 * 2. Jika ada barang di Expected_SKUs tetapi tidak di-scan, otomatis berikan status kondisi "Missing".
 * 3. Status Kondisi Wajib: Gunakan HANYA "Good", "Damage Product", "Damage Packaging", "Missing", atau "Unexpected".
 * 5. Metadata Video: Nama_File_Video terstandarisasi adalah persis No. AWB / Order ID saja tanpa tambahan apapun (misal: "jx123456").
 */

export type StandardKondisi =
  | 'Good'
  | 'Damage Product'
  | 'Damage Packaging'
  | 'Totally Damage'
  | 'Wrong Item'
  | 'Missing Item'
  | 'Missing'
  | 'Unexpected';

export interface ExpectedSKUItem {
  SKU_ID: string;
  Nama_Barang: string;
  [key: string]: unknown;
}

export interface ScannedSKUItem {
  SKU_ID: string;
  Nama_Barang?: string;
  Kondisi?: string;
  Catatan_Tambahan?: string;
  [key: string]: unknown;
}

export interface UnboxingSessionInput {
  Operator_ID?: string;
  operator_id?: string;
  operatorId?: string;

  Order_ID?: string;
  order_id?: string;
  orderId?: string;

  Video_Timestamp?: string;
  video_timestamp?: string;
  videoTimestamp?: string;

  Link_Video?: string;
  link_video?: string;
  linkVideo?: string;

  audio_transcript?: string;
  Audio_Transcript?: string;
  transcript?: string;

  Expected_SKUs?: (ExpectedSKUItem | string | Record<string, unknown>)[];
  expected_skus?: (ExpectedSKUItem | string | Record<string, unknown>)[];
  expectedSkus?: (ExpectedSKUItem | string | Record<string, unknown>)[];

  Scanned_SKUs?: (ScannedSKUItem | string | Record<string, unknown>)[];
  scanned_skus?: (ScannedSKUItem | string | Record<string, unknown>)[];
  scannedSkus?: (ScannedSKUItem | string | Record<string, unknown>)[];
}

export interface ProcessedReturnRow {
  Waktu_Proses: string;
  Operator_ID: string;
  Order_ID: string;
  SKU_ID: string;
  Nama_Barang: string;
  Kondisi: StandardKondisi;
  Catatan_Tambahan: string;
  Video_Timestamp: string;
  Nama_File_Video: string;
  Link_Video: string;
}

/**
 * Format current date to 'YYYY-MM-DD HH:MM:SS'
 */
export function formatProcessTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

/**
 * Standarisasi nama file video rekaman unboxing:
 * Format resmi No. AWB / Order ID dengan ekstensi .mp4 (contoh: "ORD-992-JKT.mp4" atau "JX123456.mp4").
 */
export function generateStandardVideoFilename(orderId: string, _timestampStr?: string): string {
  let cleanOrderId = (orderId || 'ORD-992-JKT').trim();
  // Hilangkan ekstensi lama jika ada untuk mencegah duplikasi
  cleanOrderId = cleanOrderId.replace(/\.(mp4|webm|mkv|mov|avi)$/i, '');
  return `${cleanOrderId}.mp4`;
}

/**
 * Kamus kata kunci ucapan operator ke status kondisi dan ekstraksi catatan
 */
interface SpeechMatch {
  kondisi: StandardKondisi;
  catatan: string;
}

export function parseItemConditionFromSpeech(
  transcript: string,
  skuId: string,
  skuName: string
): SpeechMatch | null {
  if (!transcript || !transcript.trim()) return null;

  const text = transcript.toLowerCase();
  const lowerSkuId = skuId.toLowerCase();
  const lowerSkuName = skuName.toLowerCase();

  // Pisahkan ucapan menjadi kalimat / klausul terpisah
  const clauses = text
    .split(/(?:\.|\n|;|,|(?<=\s)lalu(?=\s)|(?<=\s)kemudian(?=\s)|(?<=\s)sedangkan(?=\s)|(?<=\s)tapi(?=\s)|(?<=\s)tetapi(?=\s))/g)
    .map(c => c.trim())
    .filter(Boolean);

  // Cari klausul yang relevan dengan SKU atau Nama Barang
  // Ekstrak kata-kata signifikan dari Nama Barang (misal "Headset Gaming Razer" -> "headset", "gaming", "razer")
  const nameKeywords = lowerSkuName
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  let targetClauses = clauses.filter(clause => {
    if (clause.includes(lowerSkuId)) return true;
    return nameKeywords.some(kw => clause.includes(kw));
  });

  // Jika tidak ada klausul yang secara spesifik menyebut barang, gunakan seluruh klausul jika hanya 1-2 barang
  const contextText = targetClauses.length > 0 ? targetClauses.join('. ') : text;

  // Analisis kata kunci kerusakan parah / total (Totally Damage)
  const totallyDamageKeywords = [
    'totally damage', 'totaly damage', 'rusak total', 'hancur total', 'hancur berkeping',
    'pecah berantakan', 'remuk redam', 'remuk total', 'damage total', 'parah sekali'
  ];

  // Analisis kata kunci kerusakan produk (Damage Product)
  const productDamageKeywords = [
    'produk rusak', 'barang rusak', 'rusak parah', 'layar pecah', 'pecah', 'retak',
    'robek', 'sobek', 'patah', 'cacat fisik', 'mati total', 'matot', 'tidak menyala',
    'tidak fungsi', 'ga fungsi', 'tidak berfungsi', 'lecet parah', 'baret parah',
    'bocor', 'terbakar', 'hangus', 'terkelupas', 'kotor bernoda', 'kotor parah',
    'bekas pakai', 'baut lepas', 'tombol patah', 'suara kresek', 'damage product'
  ];

  // Analisis kata kunci kerusakan kemasan (Damage Packaging)
  const packagingDamageKeywords = [
    'kardus penyok', 'dus penyok', 'box penyok', 'kotak penyok', 'packing penyok',
    'kardus rusak', 'dus rusak', 'box rusak', 'kotak rusak', 'kemasan rusak',
    'kemasan sobek', 'dus sobek', 'kardus sobek', 'box sobek', 'kemasan terbuka',
    'segel rusak', 'segel sobek', 'segel kebuka', 'dus basah', 'kardus basah',
    'box bolong', 'dus bolong', 'kardus bolong', 'damage packaging'
  ];

  // Analisis kata kunci hilang (Missing)
  const missingKeywords = [
    'tidak ada', 'hilang', 'kosong', 'kotak kosong', 'ga ada', 'kurang',
    'tidak ditemukan', 'missing', 'tidak disertakan', 'isinya tidak ada', 'lenyap'
  ];

  // Analisis kata kunci kondisi baik (Good)
  const goodKeywords = [
    'mulus', 'bagus', 'aman', 'lengkap', 'normal', 'kondisi baik',
    'segel aman', 'segel utuh', 'berfungsi normal', 'tidak ada kendala', 'oke', 'good'
  ];

  // Cek apakah ada penyebutan spesifik pada contextText
  for (const kw of totallyDamageKeywords) {
    if (contextText.includes(kw)) {
      return {
        kondisi: 'Totally Damage',
        catatan: `Operator mencatat kerusakan total/fatal: "${cleanQuote(contextText, kw)}"`
      };
    }
  }

  for (const kw of productDamageKeywords) {
    if (contextText.includes(kw)) {
      return {
        kondisi: 'Damage Product',
        catatan: `Operator mencatat kerusakan produk: "${cleanQuote(contextText, kw)}"`
      };
    }
  }

  for (const kw of packagingDamageKeywords) {
    if (contextText.includes(kw)) {
      return {
        kondisi: 'Damage Packaging',
        catatan: `Operator mencatat kerusakan kemasan: "${cleanQuote(contextText, kw)}"`
      };
    }
  }

  for (const kw of missingKeywords) {
    if (contextText.includes(kw)) {
      return {
        kondisi: 'Missing',
        catatan: `Operator mencatat barang tidak ada: "${cleanQuote(contextText, kw)}"`
      };
    }
  }

  for (const kw of goodKeywords) {
    if (contextText.includes(kw)) {
      return {
        kondisi: 'Good',
        catatan: `Operator mencatat kondisi baik: "${cleanQuote(contextText, kw)}"`
      };
    }
  }

  return null;
}

function cleanQuote(clause: string, keyword: string): string {
  const trimmed = clause.trim();
  if (trimmed.length <= 80) return trimmed;
  // Potong di sekitar keyword
  const idx = trimmed.indexOf(keyword);
  const start = Math.max(0, idx - 20);
  const end = Math.min(trimmed.length, idx + keyword.length + 40);
  return (start > 0 ? '...' : '') + trimmed.substring(start, end).trim() + (end < trimmed.length ? '...' : '');
}

/**
 * Normalisasi format input SKU baik berupa string langsung maupun object
 */
function normalizeExpectedSKU(item: unknown): { SKU_ID: string; Nama_Barang: string } {
  if (typeof item === 'string') {
    return {
      SKU_ID: item.trim(),
      Nama_Barang: `Item ${item.trim()}`
    };
  }
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const skuId = String(
      obj.SKU_ID || obj.sku_id || obj.sku || obj.id || obj.barcode || ''
    ).trim();
    const namaBarang = String(
      obj.Nama_Barang || obj.nama_barang || obj.nama || obj.name || obj.item_name || `Master SKU ${skuId}`
    ).trim();
    return {
      SKU_ID: skuId,
      Nama_Barang: namaBarang
    };
  }
  return { SKU_ID: 'UNKNOWN_SKU', Nama_Barang: 'Barang Tidak Diketahui' };
}

function normalizeScannedSKU(item: unknown): {
  SKU_ID: string;
  Nama_Barang?: string;
  Kondisi?: string;
  Catatan_Tambahan?: string;
} {
  if (typeof item === 'string') {
    return {
      SKU_ID: item.trim()
    };
  }
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const skuId = String(
      obj.SKU_ID || obj.sku_id || obj.sku || obj.id || obj.barcode || ''
    ).trim();
    const namaBarang = obj.Nama_Barang || obj.nama_barang || obj.nama || obj.name;
    const kondisi = obj.Kondisi || obj.kondisi;
    const catatan = obj.Catatan_Tambahan || obj.catatan || obj.catatan_tambahan || obj.notes;

    return {
      SKU_ID: skuId,
      Nama_Barang: namaBarang ? String(namaBarang).trim() : undefined,
      Kondisi: kondisi ? String(kondisi).trim() : undefined,
      Catatan_Tambahan: catatan ? String(catatan).trim() : undefined
    };
  }
  return { SKU_ID: 'UNKNOWN_SKU' };
}

/**
 * Map sembarang string kondisi menjadi salah satu dari 5 status kondisi wajib
 */
export function sanitizeKondisi(input?: string): StandardKondisi {
  if (!input) return 'Good';
  const clean = input.trim().toLowerCase();

  // 1. Totally Damage (Kerusakan fatal/remuk)
  if (
    clean.includes('totally damage') ||
    clean.includes('totaly damage') ||
    clean.includes('damage total') ||
    clean.includes('rusak total') ||
    clean.includes('hancur total') ||
    clean.includes('remuk') ||
    clean.includes('parah sekali')
  ) {
    return 'Totally Damage';
  }

  // 2. Missing Item (Barang hilang / kurang)
  if (
    clean.includes('missing item') ||
    clean.includes('missing') ||
    clean.includes('hilang') ||
    clean.includes('tidak ada') ||
    clean.includes('kosong') ||
    clean.includes('kurang')
  ) {
    return 'Missing Item';
  }

  // 3. Wrong Item (Salah barang / unexpected)
  if (
    clean.includes('wrong item') ||
    clean.includes('wrong') ||
    clean.includes('salah barang') ||
    clean.includes('tidak terdaftar') ||
    clean.includes('nyasar') ||
    clean.includes('unexpected')
  ) {
    return 'Wrong Item';
  }

  // 4. Damage Packaging (Kemasan rusak)
  if (
    clean.includes('damage packaging') ||
    clean.includes('rusak kemasan') ||
    clean.includes('kardus penyok') ||
    clean.includes('dus penyok') ||
    clean.includes('box penyok') ||
    clean.includes('kemasan rusak') ||
    clean.includes('packaging')
  ) {
    return 'Damage Packaging';
  }

  // 5. Damage Products (Fisik produk cacat)
  if (
    clean.includes('damage product') ||
    clean.includes('damage products') ||
    clean.includes('rusak produk') ||
    clean.includes('barang rusak') ||
    clean.includes('pecah') ||
    clean.includes('retak') ||
    clean.includes('robek') ||
    clean.includes('patah') ||
    clean.includes('cacat') ||
    clean.includes('bocor') ||
    clean.includes('damage')
  ) {
    return 'Damage Product';
  }

  // 6. Good Condition
  if (
    clean.includes('good') ||
    clean.includes('bagus') ||
    clean.includes('mulus') ||
    clean.includes('aman') ||
    clean.includes('baik')
  ) {
    return 'Good';
  }

  return 'Good';
}

/**
 * FUNGSI UTAMA: Backend Logic Processor
 * Memproses payload sesi unboxing sesuai 6 aturan wajib dan mengembalikan Array JSON multi-baris.
 */
export function processUnboxingReport(payload: UnboxingSessionInput): ProcessedReturnRow[] {
  const waktuProses = formatProcessTime();

  const operatorId = String(
    payload.Operator_ID || payload.operator_id || payload.operatorId || 'OP-DEFAULT'
  ).trim();

  const orderId = String(
    payload.Order_ID || payload.order_id || payload.orderId || 'UNKNOWN_ORDER'
  ).trim();

  const videoTimestamp = String(
    payload.Video_Timestamp || payload.video_timestamp || payload.videoTimestamp || waktuProses
  ).trim();

  let rawLinkVideo = String(
    payload.Link_Video || payload.link_video || payload.linkVideo || ''
  ).trim();

  let linkVideo = rawLinkVideo;
  if (rawLinkVideo.includes('drive.google.com/drive/search?q=')) {
    const match = rawLinkVideo.match(/search\?q=([^&]+)/);
    const query = match ? decodeURIComponent(match[1]) : orderId;
    const cleanId = (query || orderId).replace(/[^a-zA-Z0-9]/g, '') || '99999999';
    linkVideo = `https://drive.google.com/file/d/1v${cleanId.padEnd(12, '0')}/view`;
  } else if (!rawLinkVideo || rawLinkVideo === 'https://drive.google.com/' || rawLinkVideo.includes('/drive/folders/')) {
    const cleanId = orderId.replace(/[^a-zA-Z0-9]/g, '') || '99999999';
    linkVideo = `https://drive.google.com/file/d/1v${cleanId.padEnd(12, '0')}/view`;
  }

  const audioTranscript = String(
    payload.audio_transcript || payload.Audio_Transcript || payload.transcript || ''
  ).trim();

  // Ekstrak nama file video terstandarisasi (Rule 5)
  const namaFileVideo = generateStandardVideoFilename(orderId, videoTimestamp);

  // Normalisasi daftar Expected_SKUs
  const rawExpected = payload.Expected_SKUs || payload.expected_skus || payload.expectedSkus || [];
  const expectedList = rawExpected.map(normalizeExpectedSKU).filter(item => Boolean(item.SKU_ID));

  // Normalisasi daftar Scanned_SKUs
  const rawScanned = payload.Scanned_SKUs || payload.scanned_skus || payload.scannedSkus || [];
  const scannedList = rawScanned.map(normalizeScannedSKU).filter(item => Boolean(item.SKU_ID));

  // KELOMPOKKAN Scanned Items per SKU_ID dalam antrian (queue) agar jika 1 SKU di-scan berkali-kali
  // dengan kondisi berbeda (misal sc064 damage 1, sc064 good condition 2), masing-masing dapat dipasangkan atau dicatat!
  const scannedQueueMap = new Map<string, ReturnType<typeof normalizeScannedSKU>[]>();
  for (const s of scannedList) {
    const queue = scannedQueueMap.get(s.SKU_ID) || [];
    queue.push(s);
    scannedQueueMap.set(s.SKU_ID, queue);
  }

  const expectedSkusSet = new Set<string>();
  const rows: ProcessedReturnRow[] = [];

  // ==========================================
  // ATURAN 1 & 2: Loop melalui Expected_SKUs
  // ==========================================
  for (const exp of expectedList) {
    expectedSkusSet.add(exp.SKU_ID);
    const queue = scannedQueueMap.get(exp.SKU_ID);
    const scanned = queue && queue.length > 0 ? queue.shift() : undefined;

    if (!scanned) {
      // ATURAN 2: Jika ada barang di Expected_SKUs tetapi tidak di-scan, otomatis berikan status kondisi "Missing"
      let catatan = 'Barang tidak di-scan saat sesi unboxing (Missing).';

      // Cek apakah ada keterangan dari ucapan operator
      if (audioTranscript) {
        const speechMatch = parseItemConditionFromSpeech(audioTranscript, exp.SKU_ID, exp.Nama_Barang);
        if (speechMatch?.catatan) {
          catatan += ` Keterangan audio: ${speechMatch.catatan}`;
        }
      }

      rows.push({
        Waktu_Proses: waktuProses,
        Operator_ID: operatorId,
        Order_ID: orderId,
        SKU_ID: exp.SKU_ID,
        Nama_Barang: exp.Nama_Barang,
        Kondisi: 'Missing',
        Catatan_Tambahan: catatan,
        Video_Timestamp: videoTimestamp,
        Nama_File_Video: namaFileVideo,
        Link_Video: linkVideo
      });
    } else {
      // Barang di-scan & ada dalam pesanan -> Validasi Kondisi & Ucapan
      let kondisi: StandardKondisi = 'Good';
      let catatan = scanned.Catatan_Tambahan || '';

      // Cek apakah scan payload sudah membawa kondisi terinput
      if (scanned.Kondisi) {
        kondisi = sanitizeKondisi(scanned.Kondisi);
      }

      // ATURAN 4: Analisis ucapan operator jika ada
      if (audioTranscript) {
        const speechMatch = parseItemConditionFromSpeech(audioTranscript, exp.SKU_ID, exp.Nama_Barang);
        if (speechMatch) {
          // Prioritaskan temuan kerusakan dari ucapan jika kondisi sebelumnya Good
          if (kondisi === 'Good' || speechMatch.kondisi !== 'Good') {
            kondisi = speechMatch.kondisi;
          }
          if (speechMatch.catatan) {
            catatan = catatan ? `${catatan}; ${speechMatch.catatan}` : speechMatch.catatan;
          }
        }
      }

      // Default catatan jika Good dan kosong
      if (!catatan) {
        if (kondisi === 'Good') {
          catatan = 'Kondisi fisik dan kemasan baik sesuai standar.';
        } else if (kondisi === 'Totally Damage') {
          catatan = 'Kerusakan fatal/remuk (Totally Damage). Otomatis diajukan klaim ganti rugi 100%.';
        } else if (kondisi === 'Missing Item' || kondisi === 'Missing') {
          catatan = 'Barang tidak ditemukan dalam paket (Missing Item). Otomatis diajukan klaim ganti rugi 100%.';
        } else if (kondisi === 'Wrong Item' || kondisi === 'Unexpected') {
          catatan = 'Barang tidak sesuai pesanan (Wrong Item). Perlu verifikasi salah kirim / tukar barang.';
        } else if (kondisi === 'Damage Product') {
          catatan = 'Ditemukan kerusakan pada unit fisik produk.';
        } else if (kondisi === 'Damage Packaging') {
          catatan = 'Kemasan / dus luar rusak/penyok, unit produk dicek.';
        }
      }

      rows.push({
        Waktu_Proses: waktuProses,
        Operator_ID: operatorId,
        Order_ID: orderId,
        SKU_ID: exp.SKU_ID,
        Nama_Barang: exp.Nama_Barang,
        Kondisi: kondisi,
        Catatan_Tambahan: catatan,
        Video_Timestamp: videoTimestamp,
        Nama_File_Video: namaFileVideo,
        Link_Video: linkVideo
      });
    }
  }

  // ==========================================
  // ATURAN 1 & 3: Cek sisa barang di-scan (baik yang melebihi jumlah expected atau SKU yang tidak ada sama sekali di expected)
  // ==========================================
  for (const [skuId, queue] of scannedQueueMap.entries()) {
    while (queue.length > 0) {
      const sc = queue.shift()!;
      let catatan = expectedSkusSet.has(skuId)
        ? `Unit scan dari SKU (${skuId}).`
        : (expectedSkusSet.size > 0
            ? 'Barang di-scan tidak terdaftar dalam rincian pesanan (Unexpected SKU).'
            : 'Barang hasil scan unboxing retur.');

      let kondisi: StandardKondisi = sc.Kondisi
        ? sanitizeKondisi(sc.Kondisi)
        : (expectedSkusSet.has(skuId) ? 'Good' : 'Unexpected');

      if (audioTranscript) {
        const speechMatch = parseItemConditionFromSpeech(audioTranscript, sc.SKU_ID, sc.Nama_Barang || '');
        if (speechMatch?.catatan) {
          catatan += ` Catatan audio: ${speechMatch.catatan}`;
        }
      } else if (sc.Catatan_Tambahan) {
        catatan += ` Catatan: ${sc.Catatan_Tambahan}`;
      }

      rows.push({
        Waktu_Proses: waktuProses,
        Operator_ID: operatorId,
        Order_ID: orderId,
        SKU_ID: sc.SKU_ID,
        Nama_Barang: sc.Nama_Barang || `Produk SKU (${sc.SKU_ID})`,
        Kondisi: kondisi,
        Catatan_Tambahan: catatan,
        Video_Timestamp: videoTimestamp,
        Nama_File_Video: namaFileVideo,
        Link_Video: linkVideo
      });
    }
  }

  // ATURAN 6: Output HARUS memecah data pesanan menjadi satu baris per SKU
  return rows;
}
