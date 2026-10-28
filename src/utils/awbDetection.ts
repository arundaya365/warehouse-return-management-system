/**
 * Modul Deteksi Otomatis Marketplace & Logistik Berdasarkan Prefix Nomor Resi (AWB)
 * Diadopsi dari Formula Resmi Excel Warehouse Otwoo:
 * 
 * Formula Excel Marketplace:
 * =IFERROR(IF(LEFT(C,3)="GTL","TikTok Shop",IF(LEFT(C,3)="250","Shopee Indonesia",IF(LEFT(C,3)="TLJ","Tokopedia Indonesia",
 * IF(LEFT(C,2)="00","Shopee Indonesia",IF(LEFT(C,3)="SPX","Shopee Indonesia",IF(LEFT(C,2)="LA","Lazada Indonesia",
 * IF(LEFT(C,2)="JP","Shopee Indonesia",IF(LEFT(C,3)="JNA","Lazada Indonesia",IF(LEFT(C,2)="JX","TikTok Shop",
 * IF(LEFT(C,2)="CM","Shopee Indonesia",IF(LEFT(C,3)="TKP","Tokopedia Indonesia",IF(LEFT(C,2)="JZ","Lazada Indonesia",
 * IF(LEFT(C,3)="NJV","TikTok Shop",IF(LEFT(C,3)="NLI","Lazada Indonesia",IF(LEFT(C,2)="ID","Shopee Indonesia",
 * IF(LEFT(C,2)="TG","TikTok Shop",IF(LEFT(C,2)="SP","Shopee Indonesia",IF(LEFT(C,2)="TK","TikTok Shop",
 * IF(LEFT(C,2)="RT","Lazada Indonesia","")))))))))))))))))))),"")
 * 
 * Formula Excel Logistik:
 * =IFERROR(IF(LEFT(C,2)="LX","Lazada Express",IF(LEFT(C,3)="NJV","Ninja Express",IF(LEFT(C,3)="RTB","JNE",
 * IF(LEFT(C,2)="TG","JNE",IF(LEFT(C,2)="SP","Indomaret",IF(LEFT(C,2)="JZ","J&T",IF(LEFT(C,2)="TK","Indomaret",
 * IF(LEFT(C,3)="TLJ","JNE",IF(LEFT(C,3)="NLI","Lazada Express",IF(LEFT(C,3)="250","Shopee Instan",
 * IF(LEFT(C,2)="00","SiCepat",IF(LEFT(C,3)="SPX","Shopee Express",IF(LEFT(C,2)="JX","J&T",
 * IF(LEFT(C,3)="GTL","Goto Logistik",IF(LEFT(C,3)="JNA","JNE",IF(LEFT(C,2)="JP","J&T",
 * IF(LEFT(C,2)="ID","Shopee Express",IF(LEFT(C,2)="CM","JNE",IF(LEFT(C,3)="TKP","SiCepat",
 * IF(LEFT(C,2)="JZ","J&T",IF(LEFT(C,2)="ID","Shopee Express",""))))))))))))))))))))))),"")
 */

export const STANDARD_MARKETPLACES = [
  'Shopee Indonesia',
  'TikTok Shop',
  'Tokopedia Indonesia',
  'Lazada Indonesia',
  'Blibli',
  'Lainnya'
] as const;

export type StandardMarketplace = typeof STANDARD_MARKETPLACES[number] | string;

export const STANDARD_LOGISTICS = [
  'Shopee Express',
  'J&T',
  'JNE',
  'SiCepat',
  'Lazada Express',
  'Ninja Express',
  'Indomaret',
  'Shopee Instan',
  'Goto Logistik',
  'Anteraja',
  'Lion Parcel',
  'ID Express',
  'POS Indonesia',
  'TIKI',
  'Wahana',
  'Lainnya'
] as const;

export type StandardLogistics = typeof STANDARD_LOGISTICS[number] | string;

// Aturan Baku Marketplace: Prioritas 3 karakter terlebih dahulu, lalu 2 karakter
export const EXCEL_MARKETPLACE_PREFIXES: Record<string, string> = {
  // 3 Karakter
  'GTL': 'TikTok Shop',
  '250': 'Shopee Indonesia',
  'TLJ': 'Tokopedia Indonesia',
  'SPX': 'Shopee Indonesia',
  'JNA': 'Lazada Indonesia',
  'TKP': 'Tokopedia Indonesia',
  'NJV': 'TikTok Shop',
  'NLI': 'Lazada Indonesia',
  // 2 Karakter
  '00': 'Shopee Indonesia',
  'LA': 'Lazada Indonesia',
  'JP': 'Shopee Indonesia',
  'JX': 'TikTok Shop',
  'CM': 'Shopee Indonesia',
  'JZ': 'Lazada Indonesia',
  'ID': 'Shopee Indonesia',
  'TG': 'TikTok Shop',
  'SP': 'Shopee Indonesia',
  'TK': 'TikTok Shop',
  'RT': 'Lazada Indonesia'
};

// Aturan Baku Logistik: Prioritas 3 karakter terlebih dahulu, lalu 2 karakter
export const EXCEL_LOGISTICS_PREFIXES: Record<string, string> = {
  // 3 Karakter
  'NJV': 'Ninja Express',
  'RTB': 'JNE',
  'TLJ': 'JNE',
  'NLI': 'Lazada Express',
  '250': 'Shopee Instan',
  'SPX': 'Shopee Express',
  'GTL': 'Goto Logistik',
  'JNA': 'JNE',
  'TKP': 'SiCepat',
  // 2 Karakter
  'LX': 'Lazada Express',
  'TG': 'JNE',
  'SP': 'Indomaret',
  'JZ': 'J&T',
  'TK': 'Indomaret',
  '00': 'SiCepat',
  'JX': 'J&T',
  'JP': 'J&T',
  'ID': 'Shopee Express',
  'CM': 'JNE'
};

const STORAGE_CUSTOM_PREFIXES_KEY = 'rma_custom_awb_prefixes_v2';

export interface LearnedAwbPrefix {
  prefix: string;
  marketplace: string;
  logistics: string;
  createdAt: string;
}

/**
 * Mengambil kamus prefix kustom/baru yang telah dipelajari dari localStorage
 */
export function getLearnedPrefixes(): Record<string, LearnedAwbPrefix> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_PREFIXES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

/**
 * Menyimpan prefix baru yang ditentukan secara manual oleh operator ke memori sistem
 */
export function saveLearnedAwbPrefix(prefix: string, marketplace: string, logistics: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  const cleanPrefix = (prefix || '').trim().toUpperCase();
  if (!cleanPrefix) return;

  try {
    const current = getLearnedPrefixes();
    current[cleanPrefix] = {
      prefix: cleanPrefix,
      marketplace,
      logistics,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_CUSTOM_PREFIXES_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Gagal menyimpan learned prefix:', err);
  }
}

/**
 * Terapkan kamus prefix dari remote database (Cloud SQL / Firestore)
 */
export function applyRemoteLearnedPrefixes(remotePrefixes: Record<string, LearnedAwbPrefix>): void {
  if (!remotePrefixes || typeof remotePrefixes !== 'object') return;
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const current = getLearnedPrefixes();
    const merged = { ...current, ...remotePrefixes };
    localStorage.setItem(STORAGE_CUSTOM_PREFIXES_KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn('Gagal menerapkan remote learned prefixes:', err);
  }
}


export interface AwbDetectionResult {
  marketplace: string;
  logistics: string;
  matchedPrefix: string | null;
  isAutoDetected: boolean;
  isLearned: boolean;
  prefixCandidate: string; // prefix 2 atau 3 huruf untuk edukasi/tampilan
}

/**
 * Mendeteksi Marketplace dan Logistik secara otomatis dari string No Resi / AWB
 */
export function detectMarketplaceAndLogistics(awb: string): AwbDetectionResult {
  const clean = (awb || '').trim().toUpperCase();
  if (!clean) {
    return {
      marketplace: '',
      logistics: '',
      matchedPrefix: null,
      isAutoDetected: false,
      isLearned: false,
      prefixCandidate: ''
    };
  }

  const p3 = clean.slice(0, 3);
  const p2 = clean.slice(0, 2);

  // 1. Cek dari kamus custom / prefix baru yang sudah pernah dipelajari sebelumnya
  const learned = getLearnedPrefixes();
  if (learned[p3]) {
    return {
      marketplace: learned[p3].marketplace,
      logistics: learned[p3].logistics,
      matchedPrefix: p3,
      isAutoDetected: true,
      isLearned: true,
      prefixCandidate: p3
    };
  }
  if (learned[p2]) {
    return {
      marketplace: learned[p2].marketplace,
      logistics: learned[p2].logistics,
      matchedPrefix: p2,
      isAutoDetected: true,
      isLearned: true,
      prefixCandidate: p2
    };
  }

  // 2. Evaluasi aturan baku formula Excel
  let detectedMarketplace = '';
  let detectedLogistics = '';
  let matchedPrefix: string | null = null;

  // Cek Marketplace (Prioritas 3 karakter lalu 2 karakter)
  if (EXCEL_MARKETPLACE_PREFIXES[p3]) {
    detectedMarketplace = EXCEL_MARKETPLACE_PREFIXES[p3];
    matchedPrefix = p3;
  } else if (EXCEL_MARKETPLACE_PREFIXES[p2]) {
    detectedMarketplace = EXCEL_MARKETPLACE_PREFIXES[p2];
    matchedPrefix = p2;
  }

  // Cek Logistik (Prioritas 3 karakter lalu 2 karakter)
  if (EXCEL_LOGISTICS_PREFIXES[p3]) {
    detectedLogistics = EXCEL_LOGISTICS_PREFIXES[p3];
    matchedPrefix = matchedPrefix || p3;
  } else if (EXCEL_LOGISTICS_PREFIXES[p2]) {
    detectedLogistics = EXCEL_LOGISTICS_PREFIXES[p2];
    matchedPrefix = matchedPrefix || p2;
  }

  const isAutoDetected = Boolean(detectedMarketplace || detectedLogistics);

  return {
    marketplace: detectedMarketplace || 'Lainnya',
    logistics: detectedLogistics || 'Lainnya',
    matchedPrefix,
    isAutoDetected,
    isLearned: false,
    prefixCandidate: clean.length >= 3 ? p3 : p2
  };
}
