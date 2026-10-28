import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'id' | 'en';

export interface Translations {
  // Navigation
  nav_dashboard: string;
  nav_station: string;
  nav_reports: string;
  nav_disputes: string;
  nav_rma: string;
  nav_database: string;
  nav_accounts: string;
  nav_subtitle: string;
  nav_operator: string;
  nav_google_connected: string;
  nav_language: string;

  // Dashboard Analytics
  dash_title: string;
  dash_subtitle: string;
  dash_kpi_total_orders: string;
  dash_kpi_total_items: string;
  dash_kpi_damage_rate: string;
  dash_kpi_est_value: string;
  dash_kpi_recovery_rate: string;
  dash_trend_title: string;
  dash_trend_daily: string;
  dash_trend_monthly: string;
  dash_trend_last7: string;
  dash_trend_last14: string;
  dash_trend_last30: string;
  dash_trend_all: string;
  dash_cond_distribution: string;
  dash_top_skus: string;
  dash_courier_breakdown: string;
  dash_action_new_unboxing: string;
  dash_action_view_reports: string;
  dash_action_disputes: string;
  dash_recent_activity: string;

  // Common actions & badges
  btn_save: string;
  btn_cancel: string;
  btn_close: string;
  btn_reset: string;
  btn_delete: string;
  btn_search: string;
  btn_filter: string;
  btn_download: string;
  btn_export_excel: string;
  btn_export_csv: string;
  btn_copy: string;
  btn_copied: string;
  btn_edit: string;
  btn_detail: string;
  btn_add: string;
  badge_all: string;
  badge_total: string;
  badge_loading: string;

  // Station
  station_title: string;
  station_subtitle: string;
  station_step1_title: string;
  station_step1_desc: string;
  station_step2_title: string;
  station_step2_desc: string;
  station_step3_title: string;
  station_step3_desc: string;
  station_awb_label: string;
  station_awb_placeholder: string;
  station_order_label: string;
  station_order_placeholder: string;
  station_channel_label: string;
  station_courier_label: string;
  station_webcam_standby: string;
  station_webcam_live: string;
  station_start_record: string;
  station_stop_record: string;
  station_recording_active: string;
  station_scan_sku_label: string;
  station_scan_sku_placeholder: string;
  station_btn_add_product: string;
  station_cond_good: string;
  station_cond_damage_pkg: string;
  station_cond_damage_prod: string;
  station_cond_missing: string;
  station_cond_unexpected: string;
  station_btn_finish: string;
  station_btn_reset_session: string;
  station_scanned_items: string;
  station_expected_items: string;

  // Reports
  reports_title: string;
  reports_subtitle: string;
  reports_filter_date: string;
  reports_filter_today: string;
  reports_filter_order: string;
  reports_filter_operator: string;
  reports_filter_sku: string;
  reports_filter_condition: string;
  reports_reset_filter: string;
  reports_export_modal_btn: string;
  reports_quick_export: string;
  reports_empty: string;
  reports_empty_desc: string;
  reports_back_to_station: string;
  reports_go_to_disputes: string;

  // Disputes & CS Claims
  disputes_title: string;
  disputes_subtitle: string;
  disputes_stat_total_damage: string;
  disputes_stat_submitted: string;
  disputes_stat_approved: string;
  disputes_stat_claim_value: string;
  disputes_stat_settlement_value: string;
  disputes_col_order: string;
  disputes_col_product: string;
  disputes_col_damage: string;
  disputes_col_channel: string;
  disputes_col_status: string;
  disputes_col_ticket: string;
  disputes_col_claim_amount: string;
  disputes_col_settlement: string;
  disputes_col_actions: string;
  disputes_modal_title: string;
  disputes_modal_subtitle: string;
  disputes_modal_ticket_label: string;
  disputes_modal_channel_label: string;
  disputes_modal_status_label: string;
  disputes_modal_claim_amt_label: string;
  disputes_modal_claim_amt_help: string;
  disputes_modal_settle_amt_label: string;
  disputes_modal_settle_amt_help: string;
  disputes_modal_settle_note_label: string;
  disputes_modal_settle_note_placeholder: string;
  disputes_modal_cs_note_label: string;
  disputes_modal_cs_note_placeholder: string;
  disputes_modal_save_btn: string;
  disputes_tab_form: string;
  disputes_tab_template: string;
  disputes_tab_evidence: string;
  disputes_copy_template_btn: string;
  disputes_empty_title: string;
  disputes_empty_desc: string;

  // Master Database
  master_title: string;
  master_subtitle: string;
  master_col_barcode: string;
  master_col_skuid: string;
  master_col_skuname: string;
  master_col_price: string;
  master_download_xlsx: string;
  master_download_csv: string;
  master_import_file: string;
  master_add_manual: string;
  master_search_placeholder: string;
  master_reset_default: string;
  master_empty_title: string;
  master_price_guide: string;

  // Footer
  footer_title: string;
  footer_desc: string;
  footer_operator: string;
  footer_drive_ready: string;
}

const translations: Record<Language, Translations> = {
  id: {
    // Navigation
    nav_dashboard: 'Dashboard',
    nav_station: 'Unboxing',
    nav_reports: 'Laporan',
    nav_disputes: 'Klaim CS',
    nav_rma: 'RMA Claim',
    nav_database: 'Database',
    nav_accounts: 'Akun',
    nav_subtitle: 'Sistem Inspeksi & Retur Gudang e-Commerce',
    nav_operator: 'Operator Gudang',
    nav_google_connected: 'Google Drive Terhubung',
    nav_language: 'Bahasa',

    // Dashboard Analytics
    dash_title: 'Dashboard Analisis Retur Gudang',
    dash_subtitle: 'Ringkasan komprehensif performa retur paket, rasio kerusakan, tren volume harian & bulanan, dan evaluasi klaim CS.',
    dash_kpi_total_orders: 'Total Pesanan Retur',
    dash_kpi_total_items: 'Total Unit Barang (Pcs)',
    dash_kpi_damage_rate: 'Rasio Kerusakan & Hilang',
    dash_kpi_est_value: 'Estimasi Nilai Barang Retur',
    dash_kpi_recovery_rate: 'Realisasi Pencairan Klaim',
    dash_trend_title: 'Tren Volume Retur Paket',
    dash_trend_daily: 'Tren Harian',
    dash_trend_monthly: 'Tren Bulanan',
    dash_trend_last7: '7 Hari Terakhir',
    dash_trend_last14: '14 Hari Terakhir',
    dash_trend_last30: '30 Hari Terakhir',
    dash_trend_all: 'Semua Periode',
    dash_cond_distribution: 'Distribusi Kondisi Barang',
    dash_top_skus: 'Top 5 SKU Paling Sering Retur',
    dash_courier_breakdown: 'Distribusi Ekspedisi & Marketplace',
    dash_action_new_unboxing: '+ Buka Stasiun Unboxing',
    dash_action_view_reports: 'Lihat Semua Laporan',
    dash_action_disputes: 'Kelola Aju Banding CS',
    dash_recent_activity: 'Aktivitas Retur Terbaru',

    // Common
    btn_save: 'Simpan',
    btn_cancel: 'Batal',
    btn_close: 'Tutup',
    btn_reset: 'Reset',
    btn_delete: 'Hapus',
    btn_search: 'Cari',
    btn_filter: 'Filter',
    btn_download: 'Unduh',
    btn_export_excel: 'Ekspor Excel (.xlsx)',
    btn_export_csv: 'Ekspor CSV (.csv)',
    btn_copy: 'Salin',
    btn_copied: 'Tersalin!',
    btn_edit: 'Kelola',
    btn_detail: 'Detail',
    btn_add: 'Tambah',
    badge_all: 'Semua',
    badge_total: 'Total',
    badge_loading: 'Memproses...',

    // Station
    station_title: 'Stasiun Kerja Unboxing Retur',
    station_subtitle: 'Scan resi, rekam video bukti unboxing secara langsung, dan verifikasi kondisi SKU.',
    station_step1_title: '1. Identifikasi Paket & No Resi',
    station_step1_desc: 'Scan barcode resi atau ketik No Resi / AWB',
    station_step2_title: '2. Rekaman Video Bukti Unboxing',
    station_step2_desc: 'Kamera webcam langsung dengan overlay tanggal & nama gudang',
    station_step3_title: '3. Verifikasi & Scan SKU Produk',
    station_step3_desc: 'Scan barcode produk fisik dan tentukan kondisi barang',
    station_awb_label: 'No. Resi / AWB',
    station_awb_placeholder: 'Contoh: SPXID04829103, JP982312...',
    station_order_label: 'Order ID / No. Pesanan',
    station_order_placeholder: 'Contoh: ORD-992-JKT...',
    station_channel_label: 'Marketplace / Platform',
    station_courier_label: 'Ekspedisi / Logistik',
    station_webcam_standby: 'Kamera Standby',
    station_webcam_live: 'LIVE MEREKAM',
    station_start_record: 'Mulai Rekam Video Unboxing',
    station_stop_record: 'Selesai Rekam (Stop Video)',
    station_recording_active: 'Sedang merekam video unboxing...',
    station_scan_sku_label: 'Scan Barcode / Ketik SKU ID',
    station_scan_sku_placeholder: 'Scan barcode fisik produk...',
    station_btn_add_product: '+ Tambah Barang',
    station_cond_good: 'Baik (Good)',
    station_cond_damage_pkg: 'Rusak Kemasan (Damage Packaging)',
    station_cond_damage_prod: 'Rusak Produk (Damage Product)',
    station_cond_missing: 'Barang Hilang (Missing)',
    station_cond_unexpected: 'Salah Kirim (Unexpected)',
    station_btn_finish: 'Selesai & Simpan Laporan Unboxing',
    station_btn_reset_session: 'Reset Sesi Baru',
    station_scanned_items: 'Produk Fisik Ter-scan',
    station_expected_items: 'Ekspektasi Barang Sesuai Resi',

    // Reports
    reports_title: 'Halaman Laporan Hasil Unboxing',
    reports_subtitle: 'Daftar audit rekaman unboxing paket retur dengan video bukti & status kondisi SKU.',
    reports_filter_date: 'Rentang Tanggal',
    reports_filter_today: 'Hari Ini',
    reports_filter_order: 'Order ID / No Resi',
    reports_filter_operator: 'Operator ID',
    reports_filter_sku: 'SKU ID',
    reports_filter_condition: 'Kondisi SKU',
    reports_reset_filter: 'Reset Filter',
    reports_export_modal_btn: 'Download Laporan (Filter)',
    reports_quick_export: 'Ekspor Cepat Excel',
    reports_empty: 'Belum Ada Laporan Unboxing',
    reports_empty_desc: 'Mulai sesi unboxing baru untuk merekam dan mencatat laporan paket retur.',
    reports_back_to_station: 'Buka Stasiun Unboxing',
    reports_go_to_disputes: 'Buka Aju Banding (Damage)',

    // Disputes
    disputes_title: 'Pusat Klaim & Aju Banding CS (Damage)',
    disputes_subtitle: 'Kelola paket rusak/hilang untuk proses klaim ganti rugi ke Marketplace atau Ekspedisi Logistik.',
    disputes_stat_total_damage: 'Total Kasus Kerusakan',
    disputes_stat_submitted: 'Klaim Diajukan',
    disputes_stat_approved: 'Disetujui / Selesai',
    disputes_stat_claim_value: 'Total Nilai Tuntutan Klaim',
    disputes_stat_settlement_value: 'Total Penggantian Riil Disetujui',
    disputes_col_order: 'No Resi / Order ID',
    disputes_col_product: 'Produk & SKU ID',
    disputes_col_damage: 'Kondisi & Bukti Video',
    disputes_col_channel: 'Kanal Tujuan',
    disputes_col_status: 'Status Klaim',
    disputes_col_ticket: 'No. Tiket / Laporan',
    disputes_col_claim_amount: 'Nilai Klaim CS',
    disputes_col_settlement: 'Nominal Riil Disetujui',
    disputes_col_actions: 'Kelola Klaim',
    disputes_modal_title: 'Kelola Aju Banding CS',
    disputes_modal_subtitle: 'Atur nominal tuntutan, catat penggantian riil yang disetujui, dan nomor tiket klaim.',
    disputes_modal_ticket_label: 'Nomor Tiket / Kasus CS',
    disputes_modal_channel_label: 'Pihak Dituju (Marketplace / Logistik)',
    disputes_modal_status_label: 'Status Tindak Lanjut',
    disputes_modal_claim_amt_label: 'Nilai Tuntutan Klaim (Input Manual)',
    disputes_modal_claim_amt_help: 'Nominal ganti rugi yang diajukan CS berdasarkan harga barang & kerugian.',
    disputes_modal_settle_amt_label: 'Nominal Penggantian Riil yang Disetujui (Approved Settlement)',
    disputes_modal_settle_amt_help: 'Hasil pencairan riil dari ekspedisi/marketplace (bisa berbeda atau sebagian dari harga barang).',
    disputes_modal_settle_note_label: 'Catatan Selisih / Alasan Penggantian Riil',
    disputes_modal_settle_note_placeholder: 'Contoh: Diganti maksimal plafon asuransi ekspedisi 50%, atau dipotong ongkir...',
    disputes_modal_cs_note_label: 'Catatan Internal CS',
    disputes_modal_cs_note_placeholder: 'Catatan progres tim Customer Service...',
    disputes_modal_save_btn: 'Simpan Data Aju Banding',
    disputes_tab_form: 'Formulir Status & Angka',
    disputes_tab_template: 'Template Pesan Banding',
    disputes_tab_evidence: 'Bukti Video Unboxing',
    disputes_copy_template_btn: 'Salin Teks Format Banding',
    disputes_empty_title: 'Tidak Ada Paket Berstatus Kerusakan',
    disputes_empty_desc: 'Semua paket yang di-unboxing berada dalam kondisi baik (Good).',

    // Master Database
    master_title: 'Master SKU & Database Harga Barang',
    master_subtitle: 'Kelola referensi barcode, SKU ID, nama produk, dan harga satuan barang untuk perhitungan otomatis klaim CS.',
    master_col_barcode: 'Barcode',
    master_col_skuid: 'SKU ID',
    master_col_skuname: 'Nama Produk (SKU Name)',
    master_col_price: 'Harga Satuan Barang (IDR)',
    master_download_xlsx: 'Unduh Template Excel (.xlsx)',
    master_download_csv: 'Unduh Template CSV (.csv)',
    master_import_file: 'Import Excel / CSV Master',
    master_add_manual: '+ Tambah SKU Manual',
    master_search_placeholder: 'Cari Barcode, SKU ID, Nama, atau Harga...',
    master_reset_default: 'Reset ke Data Bawaan',
    master_empty_title: 'Database Master Kosong',
    master_price_guide: 'Kolom 4 (HARGA BARANG) digunakan untuk kalkulasi otomatis klaim ganti rugi CS.',

    // Footer
    footer_title: 'unboxin.id',
    footer_desc: 'Sistem Stasiun Inspeksi Retur & Rekaman Video Bukti',
    footer_operator: 'Copyright by Yaya Sanjaya',
    footer_drive_ready: 'Google Drive Sync Active'
  },
  en: {
    // Navigation
    nav_dashboard: 'Dashboard',
    nav_station: 'Unboxing',
    nav_reports: 'Reports',
    nav_disputes: 'CS Claims',
    nav_rma: 'RMA Claim',
    nav_database: 'Database',
    nav_accounts: 'Accounts',
    nav_subtitle: 'Warehouse Returns & Inspection System',
    nav_operator: 'Warehouse Operator',
    nav_google_connected: 'Google Drive Connected',
    nav_language: 'Language',

    // Dashboard Analytics
    dash_title: 'Warehouse Returns Analytics Dashboard',
    dash_subtitle: 'Comprehensive overview of return parcel performance, defect rates, daily & monthly volume trends, and CS dispute recovery.',
    dash_kpi_total_orders: 'Total Return Orders',
    dash_kpi_total_items: 'Total Units Returned',
    dash_kpi_damage_rate: 'Defect & Loss Rate',
    dash_kpi_est_value: 'Est. Total Return Value',
    dash_kpi_recovery_rate: 'Claim Recovery Rate',
    dash_trend_title: 'Return Parcel Volume Trends',
    dash_trend_daily: 'Daily Trend',
    dash_trend_monthly: 'Monthly Trend',
    dash_trend_last7: 'Last 7 Days',
    dash_trend_last14: 'Last 14 Days',
    dash_trend_last30: 'Last 30 Days',
    dash_trend_all: 'All Periods',
    dash_cond_distribution: 'Item Condition Breakdown',
    dash_top_skus: 'Top 5 Most Returned SKUs',
    dash_courier_breakdown: 'Couriers & Marketplaces',
    dash_action_new_unboxing: '+ Open Unboxing Station',
    dash_action_view_reports: 'View All Reports',
    dash_action_disputes: 'Manage CS Dispute Claims',
    dash_recent_activity: 'Recent Return Unboxing Events',

    // Common
    btn_save: 'Save',
    btn_cancel: 'Cancel',
    btn_close: 'Close',
    btn_reset: 'Reset',
    btn_delete: 'Delete',
    btn_search: 'Search',
    btn_filter: 'Filter',
    btn_download: 'Download',
    btn_export_excel: 'Export Excel (.xlsx)',
    btn_export_csv: 'Export CSV (.csv)',
    btn_copy: 'Copy',
    btn_copied: 'Copied!',
    btn_edit: 'Manage',
    btn_detail: 'Details',
    btn_add: 'Add',
    badge_all: 'All',
    badge_total: 'Total',
    badge_loading: 'Processing...',

    // Station
    station_title: 'Return Unboxing Workstation',
    station_subtitle: 'Scan tracking numbers, record live unboxing evidence video, and inspect SKU conditions.',
    station_step1_title: '1. Package & Tracking ID',
    station_step1_desc: 'Scan tracking barcode or type Tracking / AWB number',
    station_step2_title: '2. Live Video Evidence Recording',
    station_step2_desc: 'Direct webcam stream with timestamp & warehouse watermark',
    station_step3_title: '3. Inspect & Scan Product SKUs',
    station_step3_desc: 'Scan physical barcodes and determine item condition',
    station_awb_label: 'Tracking / AWB Number',
    station_awb_placeholder: 'E.g., SPXID04829103, JP982312...',
    station_order_label: 'Order ID / Reference',
    station_order_placeholder: 'E.g., ORD-992-JKT...',
    station_channel_label: 'Marketplace / Platform',
    station_courier_label: 'Courier / Logistics',
    station_webcam_standby: 'Camera Standby',
    station_webcam_live: 'LIVE RECORDING',
    station_start_record: 'Start Recording Unboxing Video',
    station_stop_record: 'Stop Recording (Finish Video)',
    station_recording_active: 'Currently recording unboxing video...',
    station_scan_sku_label: 'Scan Barcode / Type SKU ID',
    station_scan_sku_placeholder: 'Scan physical product barcode...',
    station_btn_add_product: '+ Add Item',
    station_cond_good: 'Good Condition',
    station_cond_damage_pkg: 'Damaged Packaging',
    station_cond_damage_prod: 'Damaged Product',
    station_cond_missing: 'Missing Item',
    station_cond_unexpected: 'Wrong / Unexpected Item',
    station_btn_finish: 'Finish & Save Unboxing Report',
    station_btn_reset_session: 'Reset New Session',
    station_scanned_items: 'Physically Scanned Items',
    station_expected_items: 'Expected Manifest Items',

    // Reports
    reports_title: 'Unboxing Reports & Audit Log',
    reports_subtitle: 'Audit log of unboxed return parcels with evidence videos & SKU condition statuses.',
    reports_filter_date: 'Date Range',
    reports_filter_today: 'Today',
    reports_filter_order: 'Order ID / Tracking No',
    reports_filter_operator: 'Operator ID',
    reports_filter_sku: 'SKU ID',
    reports_filter_condition: 'SKU Condition',
    reports_reset_filter: 'Reset Filters',
    reports_export_modal_btn: 'Download Reports (Filtered)',
    reports_quick_export: 'Quick Export Excel',
    reports_empty: 'No Unboxing Reports Yet',
    reports_empty_desc: 'Start a new unboxing session to inspect parcels and log evidence videos.',
    reports_back_to_station: 'Open Unboxing Station',
    reports_go_to_disputes: 'Open Dispute Claims',

    // Disputes
    disputes_title: 'CS Dispute Claims Center (Damage & Loss)',
    disputes_subtitle: 'Manage damaged or lost items to dispute and claim reimbursement from Marketplaces or Couriers.',
    disputes_stat_total_damage: 'Total Damaged Cases',
    disputes_stat_submitted: 'Claims Submitted',
    disputes_stat_approved: 'Approved / Resolved',
    disputes_stat_claim_value: 'Total Claim Amount Demanded',
    disputes_stat_settlement_value: 'Total Actual Reimbursement Approved',
    disputes_col_order: 'Tracking / Order ID',
    disputes_col_product: 'Product & SKU ID',
    disputes_col_damage: 'Condition & Video Evidence',
    disputes_col_channel: 'Claim Target',
    disputes_col_status: 'Claim Status',
    disputes_col_ticket: 'Ticket / Case #',
    disputes_col_claim_amount: 'Claim Amount (CS)',
    disputes_col_settlement: 'Approved Reimbursement',
    disputes_col_actions: 'Manage Claim',
    disputes_modal_title: 'Manage Dispute Claim',
    disputes_modal_subtitle: 'Adjust demanded amount, log approved settlement reimbursement, and dispute ticket number.',
    disputes_modal_ticket_label: 'Ticket / Case Number',
    disputes_modal_channel_label: 'Target Party (Marketplace / Courier)',
    disputes_modal_status_label: 'Follow-up Status',
    disputes_modal_claim_amt_label: 'Demanded Claim Amount (Manual Input)',
    disputes_modal_claim_amt_help: 'Compensation amount demanded by CS based on item price & physical damage.',
    disputes_modal_settle_amt_label: 'Actual Approved Compensation (Settlement)',
    disputes_modal_settle_amt_help: 'Actual reimbursed amount from courier/marketplace (may be partial or capped by shipping insurance).',
    disputes_modal_settle_note_label: 'Variance / Reimbursement Note',
    disputes_modal_settle_note_placeholder: 'E.g., Capped at 50% courier insurance limit, shipping fee deducted...',
    disputes_modal_cs_note_label: 'Internal CS Notes',
    disputes_modal_cs_note_placeholder: 'Notes on dispute progress and resolution...',
    disputes_modal_save_btn: 'Save Dispute Details',
    disputes_tab_form: 'Status & Amounts Form',
    disputes_tab_template: 'Dispute Text Template',
    disputes_tab_evidence: 'Unboxing Video Evidence',
    disputes_copy_template_btn: 'Copy Dispute Appeal Template',
    disputes_empty_title: 'No Damaged Parcels Found',
    disputes_empty_desc: 'All unboxed parcels are currently in Good condition.',

    // Master Database
    master_title: 'Master SKU & Item Price Database',
    master_subtitle: 'Manage barcode, SKU ID, product names, and unit prices for automated CS dispute calculations.',
    master_col_barcode: 'Barcode',
    master_col_skuid: 'SKU ID',
    master_col_skuname: 'Product Name (SKU Name)',
    master_col_price: 'Unit Price (IDR)',
    master_download_xlsx: 'Download Excel Template (.xlsx)',
    master_download_csv: 'Download CSV Template (.csv)',
    master_import_file: 'Import Master Excel / CSV',
    master_add_manual: '+ Add SKU Manually',
    master_search_placeholder: 'Search Barcode, SKU ID, Name, or Price...',
    master_reset_default: 'Reset to Default Data',
    master_empty_title: 'Master Database is Empty',
    master_price_guide: 'Column 4 (ITEM PRICE) is used for automatic compensation calculations in CS disputes.',

    // Footer
    footer_title: 'unboxin.id',
    footer_desc: 'Return Inspection Station & Video Evidence Recorder',
    footer_operator: 'Copyright by Yaya Sanjaya',
    footer_drive_ready: 'Google Drive Sync Active'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof Translations) => string;
  isId: boolean;
  isEn: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('unboxdesk_language') as Language;
      if (saved === 'id' || saved === 'en') return saved;
    } catch {}
    return 'id'; // Default to Indonesian
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('unboxdesk_language', lang);
    } catch {}
  };

  const toggleLanguage = () => {
    const nextLang = language === 'id' ? 'en' : 'id';
    setLanguage(nextLang);
  };

  const t = (key: keyof Translations): string => {
    return translations[language][key] || translations['id'][key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        isId: language === 'id',
        isEn: language === 'en'
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
