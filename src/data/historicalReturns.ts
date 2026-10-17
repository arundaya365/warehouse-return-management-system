import type { ProcessedReturnRow } from '../processor.ts';



/**
 * Historical Return Dataset for Analytics & Trend Monitoring
 * Provides rich multi-month and multi-day returns data for realistic Daily and Monthly trend graphs.
 */
export const HISTORICAL_RETURN_ROWS: ProcessedReturnRow[] = [
  // ==========================================
  // OCTOBER 2026 (DAILY TREND SAMPLES)
  // ==========================================
  // 2026-10-09 (Today)
  {
    Order_ID: 'SHP-9948201',
    Waktu_Proses: '2026-10-09 10:15:22',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-SKINCARE-01',
    Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Segel utuh, pembeli salah pesan varian',
    Nama_File_Video: 'SHP-9948201',
    Link_Video: 'https://drive.google.com/file/d/evidence-shp-9948201/view',
    Video_Timestamp: '2026-10-09 10:15:22'
  },
  {
    Order_ID: 'SHP-9948201',
    Waktu_Proses: '2026-10-09 10:15:22',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-BEAUTY-002',
    Nama_Barang: 'Hydrating Rose Water Toner 150ml',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Mulus sesuai pesanan',
    Nama_File_Video: 'SHP-9948201',
    Link_Video: 'https://drive.google.com/file/d/evidence-shp-9948201/view',
    Video_Timestamp: '2026-10-09 10:15:22'
  },
  {
    Order_ID: 'TKP-8819204',
    Waktu_Proses: '2026-10-09 11:40:10',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-ELEC-001',
    Nama_Barang: 'Headset Gaming 7.1 Surround RGB',
    Kondisi: 'Damage Product',
    Catatan_Tambahan: 'Mikrofon patah dan earcup sobek',
    Nama_File_Video: 'TKP-8819204',
    Link_Video: 'https://drive.google.com/file/d/evidence-tkp-8819204/view',
    Video_Timestamp: '2026-10-09 11:40:10'
  },
  {
    Order_ID: 'TTK-7749210',
    Waktu_Proses: '2026-10-09 13:22:45',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-JACKET-02',
    Nama_Barang: 'Techwear Waterproof Windbreaker Navy - L',
    Kondisi: 'Damage Packaging',
    Catatan_Tambahan: 'Kardus luar sobek remuk tertimpa logistik J&T',
    Nama_File_Video: 'TTK-7749210',
    Link_Video: 'https://drive.google.com/file/d/evidence-ttk-7749210/view',
    Video_Timestamp: '2026-10-09 13:22:45'
  },

  // 2026-10-08 (Yesterday)
  {
    Order_ID: 'SHP-9823441',
    Waktu_Proses: '2026-10-08 14:20:15',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-ELEC-001',
    Nama_Barang: 'Headset Gaming 7.1 Surround RGB',
    Kondisi: 'Damage Packaging',
    Catatan_Tambahan: 'Kardus penyok hancur tertindih ekspedisi saat transit',
    Nama_File_Video: 'SHP-9823441',
    Link_Video: 'https://drive.google.com/file/d/evidence-video-shopee-9823441/view',
    Video_Timestamp: '2026-10-08 14:20:15'
  },
  {
    Order_ID: 'SHP-9823441',
    Waktu_Proses: '2026-10-08 14:20:15',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-ELEC-003',
    Nama_Barang: 'Mouse Wireless Ergonomic Silent Click',
    Kondisi: 'Damage Product',
    Catatan_Tambahan: 'Tombol klik retak & sensor mati',
    Nama_File_Video: 'SHP-9823441',
    Link_Video: 'https://drive.google.com/file/d/evidence-video-shopee-9823441/view',
    Video_Timestamp: '2026-10-08 14:20:15'
  },
  {
    Order_ID: 'ORD-992-JKT',
    Waktu_Proses: '2026-10-08 15:30:10',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-SKINCARE-01',
    Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Barang mulus, segel utuh',
    Nama_File_Video: 'ORD-992-JKT',
    Link_Video: 'https://drive.google.com/file/d/evidence-ord-992/view',
    Video_Timestamp: '2026-10-08 15:30:10'
  },
  {
    Order_ID: 'ORD-992-JKT',
    Waktu_Proses: '2026-10-08 15:30:10',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-JACKET-02',
    Nama_Barang: 'Techwear Waterproof Windbreaker Navy - L',
    Kondisi: 'Damage Packaging',
    Catatan_Tambahan: 'Plastik sobek terkena lakban SiCepat',
    Nama_File_Video: 'ORD-992-JKT',
    Link_Video: 'https://drive.google.com/file/d/evidence-ord-992/view',
    Video_Timestamp: '2026-10-08 15:30:10'
  },

  // 2026-10-07
  {
    Order_ID: 'TKP-88492019',
    Waktu_Proses: '2026-10-07 09:12:44',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-WATCH-001',
    Nama_Barang: 'Smartwatch AMOLED Bluetooth Call',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Produk jam tangan normal mulus',
    Nama_File_Video: 'TKP-88492019',
    Link_Video: 'https://drive.google.com/file/d/evidence-video-tkp-88492019/view',
    Video_Timestamp: '2026-10-07 09:12:44'
  },
  {
    Order_ID: 'TKP-88492019',
    Waktu_Proses: '2026-10-07 09:12:44',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-ACC-002',
    Nama_Barang: 'Adaptor Charger Magnetic Original',
    Kondisi: 'Missing',
    Catatan_Tambahan: 'Charger tidak ada di dalam kotak saat di-unboxing',
    Nama_File_Video: 'TKP-88492019',
    Link_Video: 'https://drive.google.com/file/d/evidence-video-tkp-88492019/view',
    Video_Timestamp: '2026-10-07 09:12:44'
  },
  {
    Order_ID: 'LZD-4418290',
    Waktu_Proses: '2026-10-07 16:05:12',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-SHOES-001',
    Nama_Barang: 'Sneakers Sport Running Ultralight White - 42',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Salah ukuran pembeli retur',
    Nama_File_Video: 'LZD-4418290',
    Link_Video: 'https://drive.google.com/file/d/evidence-lzd-4418290/view',
    Video_Timestamp: '2026-10-07 16:05:12'
  },

  // 2026-10-06
  {
    Order_ID: 'SHP-9771024',
    Waktu_Proses: '2026-10-06 11:20:30',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-BAG-001',
    Nama_Barang: 'Canvas Urban Backpack Waterproof Grey',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Barang normal',
    Nama_File_Video: 'SHP-9771024',
    Link_Video: 'https://drive.google.com/file/d/evidence-shp-9771024/view',
    Video_Timestamp: '2026-10-06 11:20:30'
  },
  {
    Order_ID: 'TTK-7651092',
    Waktu_Proses: '2026-10-06 14:45:00',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-ELEC-003',
    Nama_Barang: 'Mouse Wireless Ergonomic Silent Click',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Mulus lengkap receiver dongle',
    Nama_File_Video: 'TTK-7651092',
    Link_Video: 'https://drive.google.com/file/d/evidence-ttk-7651092/view',
    Video_Timestamp: '2026-10-06 14:45:00'
  },
  {
    Order_ID: 'TTK-7651092',
    Waktu_Proses: '2026-10-06 14:45:00',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-SKINCARE-01',
    Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml',
    Kondisi: 'Damage Packaging',
    Catatan_Tambahan: 'Kotak serum basah tertekan barang lain',
    Nama_File_Video: 'TTK-7651092',
    Link_Video: 'https://drive.google.com/file/d/evidence-ttk-7651092/view',
    Video_Timestamp: '2026-10-06 14:45:00'
  },

  // 2026-10-05
  {
    Order_ID: 'BLI-2294104',
    Waktu_Proses: '2026-10-05 10:10:15',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-WATCH-001',
    Nama_Barang: 'Smartwatch AMOLED Bluetooth Call',
    Kondisi: 'Damage Product',
    Catatan_Tambahan: 'Kaca layar retak parah saat tiba di gudang',
    Nama_File_Video: 'BLI-2294104',
    Link_Video: 'https://drive.google.com/file/d/evidence-bli-2294104/view',
    Video_Timestamp: '2026-10-05 10:10:15'
  },
  {
    Order_ID: 'TKP-8761029',
    Waktu_Proses: '2026-10-05 13:50:20',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-JACKET-02',
    Nama_Barang: 'Techwear Waterproof Windbreaker Navy - L',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Pembeli minta tukar ukuran XL',
    Nama_File_Video: 'TKP-8761029',
    Link_Video: 'https://drive.google.com/file/d/evidence-tkp-8761029/view',
    Video_Timestamp: '2026-10-05 13:50:20'
  },

  // 2026-10-04
  {
    Order_ID: 'SHP-9661840',
    Waktu_Proses: '2026-10-04 09:30:00',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-BEAUTY-002',
    Nama_Barang: 'Hydrating Rose Water Toner 150ml',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Mulus aman',
    Nama_File_Video: 'SHP-9661840',
    Link_Video: 'https://drive.google.com/file/d/evidence-shp-9661840/view',
    Video_Timestamp: '2026-10-04 09:30:00'
  },
  {
    Order_ID: 'SHP-9661840',
    Waktu_Proses: '2026-10-04 09:30:00',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-ELEC-001',
    Nama_Barang: 'Headset Gaming 7.1 Surround RGB',
    Kondisi: 'Unexpected',
    Catatan_Tambahan: 'Diterima barang tidak sesuai daftar manifest retur',
    Nama_File_Video: 'SHP-9661840',
    Link_Video: 'https://drive.google.com/file/d/evidence-shp-9661840/view',
    Video_Timestamp: '2026-10-04 09:30:00'
  },

  // 2026-10-03
  {
    Order_ID: 'TTK-7554910',
    Waktu_Proses: '2026-10-03 15:10:40',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-BAG-001',
    Nama_Barang: 'Canvas Urban Backpack Waterproof Grey',
    Kondisi: 'Damage Packaging',
    Catatan_Tambahan: 'Kemasan plastik packing koyak',
    Nama_File_Video: 'TTK-7554910',
    Link_Video: 'https://drive.google.com/file/d/evidence-ttk-7554910/view',
    Video_Timestamp: '2026-10-03 15:10:40'
  },

  // ==========================================
  // SEPTEMBER 2026 (HISTORICAL MONTHLY SAMPLES)
  // ==========================================
  {
    Order_ID: 'SHP-9554019',
    Waktu_Proses: '2026-09-28 11:15:00',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-SKINCARE-01',
    Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Retur pembeli',
    Nama_File_Video: 'SHP-9554019',
    Link_Video: 'https://drive.google.com/file/d/evidence-sep-1/view',
    Video_Timestamp: '2026-09-28 11:15:00'
  },
  {
    Order_ID: 'TKP-8664018',
    Waktu_Proses: '2026-09-22 14:00:22',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-ELEC-001',
    Nama_Barang: 'Headset Gaming 7.1 Surround RGB',
    Kondisi: 'Damage Product',
    Catatan_Tambahan: 'Kabel terkelupas putus',
    Nama_File_Video: 'TKP-8664018',
    Link_Video: 'https://drive.google.com/file/d/evidence-sep-2/view',
    Video_Timestamp: '2026-09-22 14:00:22'
  },
  {
    Order_ID: 'TTK-7443029',
    Waktu_Proses: '2026-09-18 09:45:10',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-WATCH-001',
    Nama_Barang: 'Smartwatch AMOLED Bluetooth Call',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Sesuai pesanan',
    Nama_File_Video: 'TTK-7443029',
    Link_Video: 'https://drive.google.com/file/d/evidence-sep-3/view',
    Video_Timestamp: '2026-09-18 09:45:10'
  },
  {
    Order_ID: 'LZD-4332019',
    Waktu_Proses: '2026-09-12 16:30:45',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-JACKET-02',
    Nama_Barang: 'Techwear Waterproof Windbreaker Navy - L',
    Kondisi: 'Damage Packaging',
    Catatan_Tambahan: 'Kardus penyok',
    Nama_File_Video: 'LZD-4332019',
    Link_Video: 'https://drive.google.com/file/d/evidence-sep-4/view',
    Video_Timestamp: '2026-09-12 16:30:45'
  },
  {
    Order_ID: 'SHP-9442010',
    Waktu_Proses: '2026-09-05 10:20:00',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-SHOES-001',
    Nama_Barang: 'Sneakers Sport Running Ultralight White - 42',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Kondisi bagus',
    Nama_File_Video: 'SHP-9442010',
    Link_Video: 'https://drive.google.com/file/d/evidence-sep-5/view',
    Video_Timestamp: '2026-09-05 10:20:00'
  },

  // ==========================================
  // AUGUST 2026
  // ==========================================
  {
    Order_ID: 'SHP-9331019',
    Waktu_Proses: '2026-08-27 13:10:00',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-SKINCARE-01',
    Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Retur mulus',
    Nama_File_Video: 'SHP-9331019',
    Link_Video: 'https://drive.google.com/file/d/evidence-aug-1/view',
    Video_Timestamp: '2026-08-27 13:10:00'
  },
  {
    Order_ID: 'TKP-8552019',
    Waktu_Proses: '2026-08-20 15:40:00',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-ELEC-003',
    Nama_Barang: 'Mouse Wireless Ergonomic Silent Click',
    Kondisi: 'Damage Product',
    Catatan_Tambahan: 'Sensor scroll macet',
    Nama_File_Video: 'TKP-8552019',
    Link_Video: 'https://drive.google.com/file/d/evidence-aug-2/view',
    Video_Timestamp: '2026-08-20 15:40:00'
  },
  {
    Order_ID: 'TTK-7331902',
    Waktu_Proses: '2026-08-11 11:00:20',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-BAG-001',
    Nama_Barang: 'Canvas Urban Backpack Waterproof Grey',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Kondisi prima',
    Nama_File_Video: 'TTK-7331902',
    Link_Video: 'https://drive.google.com/file/d/evidence-aug-3/view',
    Video_Timestamp: '2026-08-11 11:00:20'
  },
  {
    Order_ID: 'BLI-2113094',
    Waktu_Proses: '2026-08-04 09:15:30',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-ACC-002',
    Nama_Barang: 'Adaptor Charger Magnetic Original',
    Kondisi: 'Missing',
    Catatan_Tambahan: 'Kotak kosong',
    Nama_File_Video: 'BLI-2113094',
    Link_Video: 'https://drive.google.com/file/d/evidence-aug-4/view',
    Video_Timestamp: '2026-08-04 09:15:30'
  },

  // ==========================================
  // JULY 2026
  // ==========================================
  {
    Order_ID: 'SHP-9220194',
    Waktu_Proses: '2026-07-29 14:50:00',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-ELEC-001',
    Nama_Barang: 'Headset Gaming 7.1 Surround RGB',
    Kondisi: 'Damage Packaging',
    Catatan_Tambahan: 'Kardus pecah tertindih ekspedisi',
    Nama_File_Video: 'SHP-9220194',
    Link_Video: 'https://drive.google.com/file/d/evidence-jul-1/view',
    Video_Timestamp: '2026-07-29 14:50:00'
  },
  {
    Order_ID: 'TKP-8441029',
    Waktu_Proses: '2026-07-16 10:30:15',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-JACKET-02',
    Nama_Barang: 'Techwear Waterproof Windbreaker Navy - L',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Barang aman',
    Nama_File_Video: 'TKP-8441029',
    Link_Video: 'https://drive.google.com/file/d/evidence-jul-2/view',
    Video_Timestamp: '2026-07-16 10:30:15'
  },
  {
    Order_ID: 'LZD-4221092',
    Waktu_Proses: '2026-07-08 16:10:00',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-SKINCARE-01',
    Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Retur normal',
    Nama_File_Video: 'LZD-4221092',
    Link_Video: 'https://drive.google.com/file/d/evidence-jul-3/view',
    Video_Timestamp: '2026-07-08 16:10:00'
  },

  // ==========================================
  // JUNE 2026
  // ==========================================
  {
    Order_ID: 'SHP-9119204',
    Waktu_Proses: '2026-06-25 11:20:00',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-WATCH-001',
    Nama_Barang: 'Smartwatch AMOLED Bluetooth Call',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Retur komplit',
    Nama_File_Video: 'SHP-9119204',
    Link_Video: 'https://drive.google.com/file/d/evidence-jun-1/view',
    Video_Timestamp: '2026-06-25 11:20:00'
  },
  {
    Order_ID: 'TTK-7221092',
    Waktu_Proses: '2026-06-14 15:00:00',
    Operator_ID: 'OPR-101',
    SKU_ID: 'SKU-SHOES-001',
    Nama_Barang: 'Sneakers Sport Running Ultralight White - 42',
    Kondisi: 'Damage Product',
    Catatan_Tambahan: 'Sol sepatu lepas',
    Nama_File_Video: 'TTK-7221092',
    Link_Video: 'https://drive.google.com/file/d/evidence-jun-2/view',
    Video_Timestamp: '2026-06-14 15:00:00'
  },

  // ==========================================
  // MAY 2026
  // ==========================================
  {
    Order_ID: 'TKP-8331902',
    Waktu_Proses: '2026-05-20 13:30:00',
    Operator_ID: 'OPR-042',
    SKU_ID: 'SKU-SKINCARE-01',
    Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml',
    Kondisi: 'Good',
    Catatan_Tambahan: 'Mulus sesuai pesanan',
    Nama_File_Video: 'TKP-8331902',
    Link_Video: 'https://drive.google.com/file/d/evidence-may-1/view',
    Video_Timestamp: '2026-05-20 13:30:00'
  },
  {
    Order_ID: 'SHP-9008192',
    Waktu_Proses: '2026-05-10 10:15:00',
    Operator_ID: 'OPR-992',
    SKU_ID: 'SKU-ELEC-001',
    Nama_Barang: 'Headset Gaming 7.1 Surround RGB',
    Kondisi: 'Damage Packaging',
    Catatan_Tambahan: 'Kardus rusak transit',
    Nama_File_Video: 'SHP-9008192',
    Link_Video: 'https://drive.google.com/file/d/evidence-may-2/view',
    Video_Timestamp: '2026-05-10 10:15:00'
  }
];
