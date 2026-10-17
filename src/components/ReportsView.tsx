import React, { useState, useMemo } from 'react';
import {
  FileText,
  Video,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Cloud,
  ArrowRight,
  Filter,
  Package,
  Calendar,
  User,
  Barcode,
  RotateCcw,
  Sparkles,
  X,
  Download,
  FileSpreadsheet,
  FileCode,
  Boxes,
  ShieldAlert,
  CheckSquare,
  Square,
  Check,
  ShoppingBag,
  Truck
} from 'lucide-react';
import { ProcessedReturnRow } from '../processor';
import { ResultViewer } from './ResultViewer';
import { ExportFilteredModal } from './ExportFilteredModal';
import { useLanguage } from '../context/LanguageContext';
import { detectMarketplaceAndLogistics, STANDARD_MARKETPLACES, STANDARD_LOGISTICS } from '../utils/awbDetection';

interface ReportsViewProps {
  rows: ProcessedReturnRow[];
  onNavigateToStation: () => void;
  onNavigateToDisputes?: () => void;
  onDeleteOrder?: (orderId: string) => void;
  onDeleteRow?: (orderId: string, skuId: string) => void;
  onDeleteBulkOrders?: (orderIds: string[]) => void;
  onDeleteBulkRows?: (rowKeys: { orderId: string; skuId: string }[]) => void;
}

export interface ConditionOption {
  key: string;
  label: string;
  desc: string;
  titleColor: string;
  descColor: string;
  iconColor: string;
  activeContainerClass: string;
  badgeClass: string;
}

export const STANDARD_CONDITIONS: ConditionOption[] = [
  {
    key: 'Good',
    label: 'Good',
    desc: 'Kondisi Baik / Normal',
    titleColor: 'text-emerald-950',
    descColor: 'text-emerald-700',
    iconColor: 'text-emerald-600',
    activeContainerClass: 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs',
    badgeClass: 'bg-emerald-100 text-emerald-800'
  },
  {
    key: 'Damage Product',
    label: 'Damage Product',
    desc: 'Fisik Produk Rusak',
    titleColor: 'text-rose-950',
    descColor: 'text-rose-700',
    iconColor: 'text-rose-600',
    activeContainerClass: 'bg-rose-50 text-rose-900 border-rose-300 ring-2 ring-rose-500/20 shadow-xs',
    badgeClass: 'bg-rose-100 text-rose-800'
  },
  {
    key: 'Damage Packaging',
    label: 'Damage Packaging',
    desc: 'Kemasan / Dus Rusak',
    titleColor: 'text-amber-950',
    descColor: 'text-amber-700',
    iconColor: 'text-amber-600',
    activeContainerClass: 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-500/20 shadow-xs',
    badgeClass: 'bg-amber-100 text-amber-800'
  },
  {
    key: 'Missing',
    label: 'Missing',
    desc: 'Barang Hilang / Kurang',
    titleColor: 'text-red-950',
    descColor: 'text-red-700',
    iconColor: 'text-red-600',
    activeContainerClass: 'bg-red-50 text-red-950 border-red-300 ring-2 ring-red-500/20 shadow-xs',
    badgeClass: 'bg-red-100 text-red-900'
  },
  {
    key: 'Unexpected',
    label: 'Unexpected',
    desc: 'Barang Salah Kirim',
    titleColor: 'text-purple-950',
    descColor: 'text-purple-700',
    iconColor: 'text-purple-600',
    activeContainerClass: 'bg-purple-50 text-purple-950 border-purple-300 ring-2 ring-purple-500/20 shadow-xs',
    badgeClass: 'bg-purple-100 text-purple-900'
  }
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  rows,
  onNavigateToStation,
  onNavigateToDisputes,
  onDeleteOrder,
  onDeleteRow,
  onDeleteBulkOrders,
  onDeleteBulkRows
}) => {
  const { t, isEn } = useLanguage();
  // =========================================================================
  // STATE FILTER: TANGGAL PROSES (DARI TANGGAL KE TANGGAL), ORDER ID, OPERATOR, SKU ID, KONDISI
  // =========================================================================
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterOrderId, setFilterOrderId] = useState<string>('');
  const [filterOperator, setFilterOperator] = useState<string>('');
  const [filterSkuId, setFilterSkuId] = useState<string>('');
  const [filterMarketplace, setFilterMarketplace] = useState<string>('');
  const [filterLogistics, setFilterLogistics] = useState<string>('');

  // Helper resolusi Marketplace & Logistik baris laporan
  const getRowMarketplace = (r: ProcessedReturnRow) => {
    return r.Marketplace || detectMarketplaceAndLogistics(r.Order_ID).marketplace || 'Lainnya';
  };
  const getRowLogistics = (r: ProcessedReturnRow) => {
    return r.Ekspedisi || detectMarketplaceAndLogistics(r.Order_ID).logistics || 'Lainnya';
  };
  // Extract distinct kondisi yang ada di rows (menggabungkan standar + data riil)
  const allConditionOptions = useMemo(() => {
    const standardKeys = new Set(STANDARD_CONDITIONS.map((c) => c.key));
    const extras: ConditionOption[] = [];
    rows.forEach((r) => {
      if (r.Kondisi && !standardKeys.has(r.Kondisi) && !extras.some((e) => e.key === r.Kondisi)) {
        extras.push({
          key: r.Kondisi,
          label: r.Kondisi,
          desc: 'Kondisi Khusus',
          titleColor: 'text-slate-900',
          descColor: 'text-slate-600',
          iconColor: 'text-slate-600',
          activeContainerClass: 'bg-slate-100 text-slate-900 border-slate-300 ring-2 ring-slate-400/20 shadow-xs',
          badgeClass: 'bg-slate-200 text-slate-800'
        });
      }
    });
    return [...STANDARD_CONDITIONS, ...extras];
  }, [rows]);

  const allConditionKeys = useMemo(() => allConditionOptions.map((c) => c.key), [allConditionOptions]);

  // Checklist multi-seleksi kondisi (default: semua kondisi tercentang aktif)
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(() => {
    return new Set(STANDARD_CONDITIONS.map((c) => c.key));
  });

  const handleToggleCondition = (key: string) => {
    setSelectedConditions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllConditions = () => {
    setSelectedConditions(new Set(allConditionKeys));
  };

  const handleSelectGoodOnly = () => {
    setSelectedConditions(new Set(['Good']));
  };

  const handleSelectIssuesOnly = () => {
    const issues = allConditionKeys.filter((k) => k !== 'Good');
    setSelectedConditions(new Set(issues));
  };

  // Hitung jumlah item per kondisi yang sesuai dengan filter lain (tanggal, order, operator, sku)
  const conditionCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    const extractDate = (dt?: string): string => {
      if (!dt) return '';
      const match = dt.match(/^(\d{4}[-/]\d{2}[-/]\d{2})/);
      if (match) return match[1].replace(/\//g, '-');
      return dt.split(' ')[0] || '';
    };

    for (const r of rows) {
      if (filterStartDate || filterEndDate) {
        const rowDate = extractDate(r.Waktu_Proses) || extractDate(r.Video_Timestamp);
        if (filterStartDate && rowDate && rowDate < filterStartDate) continue;
        if (filterEndDate && rowDate && rowDate > filterEndDate) continue;
      }
      if (filterOrderId.trim() && !r.Order_ID.toLowerCase().includes(filterOrderId.trim().toLowerCase())) continue;
      if (filterOperator.trim() && !r.Operator_ID.toLowerCase().includes(filterOperator.trim().toLowerCase())) continue;
      if (filterSkuId.trim() && !r.SKU_ID.toLowerCase().includes(filterSkuId.trim().toLowerCase())) continue;

      map[r.Kondisi] = (map[r.Kondisi] || 0) + 1;
    }
    return map;
  }, [rows, filterStartDate, filterEndDate, filterOrderId, filterOperator, filterSkuId]);

  // Modal Download dengan Filter Multi-Kriteria
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Extract distinct items untuk autocomplete / datalist suggestions
  const distinctOrderIds = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.Order_ID).filter(Boolean)));
  }, [rows]);

  const distinctOperators = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.Operator_ID).filter(Boolean)));
  }, [rows]);

  const distinctSkus = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.SKU_ID).filter(Boolean)));
  }, [rows]);

  const distinctMarketplaces = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(getRowMarketplace(r)));
    return Array.from(set).filter(Boolean);
  }, [rows]);

  const distinctLogistics = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(getRowLogistics(r)));
    return Array.from(set).filter(Boolean);
  }, [rows]);

  // Hitung jumlah filter yang aktif
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStartDate || filterEndDate) count++;
    if (filterOrderId.trim()) count++;
    if (filterOperator.trim()) count++;
    if (filterSkuId.trim()) count++;
    if (filterMarketplace) count++;
    if (filterLogistics) count++;
    if (selectedConditions.size < allConditionKeys.length) count++;
    return count;
  }, [filterStartDate, filterEndDate, filterOrderId, filterOperator, filterSkuId, filterMarketplace, filterLogistics, selectedConditions, allConditionKeys.length]);

  const handleResetFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterOrderId('');
    setFilterOperator('');
    setFilterSkuId('');
    setFilterMarketplace('');
    setFilterLogistics('');
    setSelectedConditions(new Set(allConditionKeys));
  };

  const handleClearDateRange = () => {
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // Helper date formatter YYYY-MM-DD
  const formatYMD = (d: Date): string => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  };

  const handleSetTodayRange = () => {
    const today = formatYMD(new Date());
    setFilterStartDate(today);
    setFilterEndDate(today);
  };

  const handleSetYesterdayRange = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yest = formatYMD(d);
    setFilterStartDate(yest);
    setFilterEndDate(yest);
  };

  const handleSetLast7DaysRange = () => {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 6);
    setFilterStartDate(formatYMD(past));
    setFilterEndDate(formatYMD(now));
  };

  const handleSetLast30DaysRange = () => {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 29);
    setFilterStartDate(formatYMD(past));
    setFilterEndDate(formatYMD(now));
  };

  const handleSetThisMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setFilterStartDate(formatYMD(start));
    setFilterEndDate(formatYMD(now));
  };

  // =========================================================================
  // PROSES FILTERING DATA LAPORAN
  // =========================================================================
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // 1. Filter Rentang Tanggal Proses (Dari Tanggal ... ke Tanggal ...)
      if (filterStartDate || filterEndDate) {
        // Ekstrak YYYY-MM-DD dari Waktu_Proses atau Video_Timestamp
        const extractDate = (dt?: string): string => {
          if (!dt) return '';
          const match = dt.match(/^(\d{4}[-/]\d{2}[-/]\d{2})/);
          if (match) return match[1].replace(/\//g, '-');
          return dt.split(' ')[0] || '';
        };

        const rowDate = extractDate(r.Waktu_Proses) || extractDate(r.Video_Timestamp);

        if (filterStartDate && rowDate) {
          if (rowDate < filterStartDate) return false;
        }
        if (filterEndDate && rowDate) {
          if (rowDate > filterEndDate) return false;
        }
      }

      // 2. Filter Order ID
      if (filterOrderId.trim()) {
        const q = filterOrderId.trim().toLowerCase();
        if (!r.Order_ID.toLowerCase().includes(q)) return false;
      }

      // 3. Filter Operator
      if (filterOperator.trim()) {
        const q = filterOperator.trim().toLowerCase();
        if (!r.Operator_ID.toLowerCase().includes(q)) return false;
      }

      // 4. Filter SKU ID
      if (filterSkuId.trim()) {
        const q = filterSkuId.trim().toLowerCase();
        if (!r.SKU_ID.toLowerCase().includes(q)) return false;
      }

      // 5. Filter Marketplace (Platform)
      if (filterMarketplace) {
        if (getRowMarketplace(r).toLowerCase() !== filterMarketplace.toLowerCase()) return false;
      }

      // 6. Filter Ekspedisi (Logistik)
      if (filterLogistics) {
        if (getRowLogistics(r).toLowerCase() !== filterLogistics.toLowerCase()) return false;
      }

      // 7. Filter Kondisi (Multi-select Checklist)
      if (selectedConditions.size < allConditionKeys.length) {
        if (!selectedConditions.has(r.Kondisi)) return false;
      }
      if (selectedConditions.size === 0) {
        return false;
      }

      return true;
    });
  }, [rows, filterStartDate, filterEndDate, filterOrderId, filterOperator, filterSkuId, filterMarketplace, filterLogistics, selectedConditions, allConditionKeys.length]);

  // =========================================================================
  // STATS CALCULATION: HITUNG JUMLAH RETURN BERDASARKAN ORDER ID, JUMLAH QTY, DAN VARIASI SKU
  // =========================================================================
  const totalItems = filteredRows.length; // Total Qty / Unit barang

  const distinctFilteredOrderIds = useMemo(() => {
    return Array.from(new Set(filteredRows.map((r) => r.Order_ID).filter(Boolean)));
  }, [filteredRows]);

  const distinctFilteredSkus = useMemo(() => {
    return Array.from(new Set(filteredRows.map((r) => r.SKU_ID).filter(Boolean)));
  }, [filteredRows]);

  const totalReturnOrdersCount = distinctFilteredOrderIds.length; // Jumlah return berdasarkan Order ID
  const totalVariasiSkuCount = distinctFilteredSkus.length; // Jumlah jenis/variasi SKU

  const goodCount = filteredRows.filter((r) => r.Kondisi === 'Good').length;
  const damageProductCount = filteredRows.filter((r) => r.Kondisi === 'Damage Product').length;
  const damagePackagingCount = filteredRows.filter((r) => r.Kondisi === 'Damage Packaging').length;
  const missingCount = filteredRows.filter((r) => r.Kondisi === 'Missing').length;
  const unexpectedCount = filteredRows.filter((r) => r.Kondisi === 'Unexpected').length;
  const driveLinkedCount = filteredRows.filter((r) => r.Link_Video && r.Link_Video.includes('drive.google.com')).length;

  // Unduh cepat Rekapitulasi per Order ID (Total Qty & Variasi SKU dimasukkan ke dalam 1 Order ID)
  const handleDownloadFilteredOrderSummaryCsv = () => {
    if (filteredRows.length === 0) return;
    const map = new Map<string, {
      orderId: string;
      operatorId: string;
      waktuProses: string;
      totalQty: number;
      skuMap: Map<string, number>;
      good: number;
      damageProduct: number;
      damagePackaging: number;
      missingUnexpected: number;
      namaFileVideo: string;
      linkVideo: string;
    }>();

    for (const r of filteredRows) {
      const oid = r.Order_ID || 'UNKNOWN';
      let entry = map.get(oid);
      if (!entry) {
        entry = {
          orderId: oid,
          operatorId: r.Operator_ID || '-',
          waktuProses: r.Waktu_Proses || r.Video_Timestamp || '-',
          totalQty: 0,
          skuMap: new Map(),
          good: 0,
          damageProduct: 0,
          damagePackaging: 0,
          missingUnexpected: 0,
          namaFileVideo: r.Nama_File_Video || '-',
          linkVideo: r.Link_Video || ''
        };
        map.set(oid, entry);
      }
      entry.totalQty += 1;
      entry.skuMap.set(r.SKU_ID, (entry.skuMap.get(r.SKU_ID) || 0) + 1);
      if (r.Kondisi === 'Good') entry.good += 1;
      else if (r.Kondisi === 'Damage Product') entry.damageProduct += 1;
      else if (r.Kondisi === 'Damage Packaging') entry.damagePackaging += 1;
      else entry.missingUnexpected += 1;
    }

    const headers = [
      'Order_ID',
      'Operator_ID',
      'Waktu_Proses',
      'Total_Qty_Return',
      'Jumlah_Variasi_SKU',
      'Rincian_Variasi_SKU',
      'Kondisi_Baik_Good',
      'Kondisi_Damage_Product',
      'Kondisi_Damage_Packaging',
      'Kondisi_Missing_Unexpected',
      'Nama_File_Video',
      'Link_Video_Drive'
    ];

    const summaries = Array.from(map.values());
    const csvContent = [
      headers.join(','),
      ...summaries.map((s) => {
        const skuStr = Array.from(s.skuMap.entries()).map(([sku, q]) => `${sku} (${q}x)`).join('; ');
        return [
          `"${s.orderId.replace(/"/g, '""')}"`,
          `"${s.operatorId.replace(/"/g, '""')}"`,
          `"${s.waktuProses.replace(/"/g, '""')}"`,
          s.totalQty,
          s.skuMap.size,
          `"${skuStr.replace(/"/g, '""')}"`,
          s.good,
          s.damageProduct,
          s.damagePackaging,
          s.missingUnexpected,
          `"${s.namaFileVideo.replace(/"/g, '""')}"`,
          `"${s.linkVideo.replace(/"/g, '""')}"`
        ].join(',');
      })
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    let filename = `REKAP_RETURN_PER_ORDER_ID_${summaries.length}orders`;
    if (filterStartDate && filterEndDate) {
      filename += `_${filterStartDate}_sd_${filterEndDate}`;
    }
    filename += '.csv';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Unduh cepat data yang sedang terfilter ke file Excel (.CSV) dengan UTF-8 BOM (Rincian per baris)
  const handleDownloadCurrentFilteredCsv = () => {
    if (filteredRows.length === 0) return;
    const headers = Object.keys(filteredRows[0]) as (keyof ProcessedReturnRow)[];
    const csvContent = [
      headers.join(','),
      ...filteredRows.map((row) =>
        headers
          .map((header) => {
            const val = String(row[header] || '').replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(',')
      )
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    let filename = 'RMA_OTWOO_LAPORAN_TERFILTER';
    if (filterStartDate && filterEndDate) {
      filename += `_${filterStartDate}_sd_${filterEndDate}`;
    } else if (filterStartDate) {
      filename += `_${filterStartDate}`;
    } else if (filterEndDate) {
      filename += `_sd_${filterEndDate}`;
    }
    if (filterOrderId.trim()) {
      filename += `_${filterOrderId.trim().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    }
    if (filterOperator.trim()) {
      filename += `_${filterOperator.trim().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    }
    if (selectedConditions.size < allConditionKeys.length) {
      const condNames = Array.from(selectedConditions).map((c) => c.replace(/\s+/g, '')).join('-');
      filename += `_kondisi_${condNames || 'none'}`;
    }
    filename += `_${filteredRows.length}baris.csv`;

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ======================================================================= */}
      {/* 1. TOP HEADER & NAVIGATION CALLOUT                                      */}
      {/* ======================================================================= */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0F766E] flex items-center justify-center text-white shadow-sm shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {t('reports_title')}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0F766E] border border-teal-200">
                {rows.length} {isEn ? 'Total Rows' : 'Total Baris'}
              </span>
              {activeFilterCount > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center space-x-1">
                  <span>{activeFilterCount} {isEn ? 'Active Filters' : 'Filter Aktif'} ({filteredRows.length} {isEn ? 'Matches' : 'Cocok'})</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {t('reports_subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center space-x-2 gap-y-2 shrink-0">
          {onNavigateToDisputes && (damageProductCount + damagePackagingCount + missingCount + unexpectedCount) > 0 && (
            <button
              onClick={onNavigateToDisputes}
              className="py-2.5 px-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs sm:text-sm border border-rose-200 shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              title={isEn ? "Open CS Dispute Claims for damaged return items" : "Buka halaman Aju Banding CS untuk klaim barang rusak ke Marketplace/Logistik"}
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>{isEn ? 'Dispute Claims' : 'Aju Banding'} ({damageProductCount + damagePackagingCount + missingCount + unexpectedCount})</span>
            </button>
          )}

          {/* Tombol Download Terfilter */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="py-2.5 px-3.5 rounded-2xl bg-white hover:bg-[#F0FDFA] text-[#0F766E] font-semibold text-xs sm:text-sm border border-slate-200 shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
            title={isEn ? "Download reports with custom filters" : "Download file laporan dengan filter kustom"}
          >
            <Download className="w-4 h-4 text-[#0F766E]" />
            <span>{isEn ? 'Filtered Download' : 'Unduh Terfilter'} ({filteredRows.length})</span>
          </button>

          <button
            onClick={onNavigateToStation}
            className="py-2.5 px-4 rounded-2xl bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center space-x-2 active:scale-95 cursor-pointer shrink-0"
          >
            <Video className="w-4 h-4" />
            <span>{isEn ? '+ Open Unboxing Station' : '+ Buka Stasiun Unboxing'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 2. PANEL FILTER MULTI-PARAMETER (TANGGAL, ORDER ID, OPERATOR, SKU ID)   */}
      {/* ======================================================================= */}
      <div className="glass-card rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3.5">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#0F766E] flex items-center justify-center border border-teal-100">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Filter Data Laporan
              </h2>
              <p className="text-[11px] text-slate-500">
                Saring data laporan berdasarkan parameter spesifik
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadFilteredOrderSummaryCsv}
              disabled={filteredRows.length === 0}
              className="text-xs font-semibold text-[#0F766E] hover:text-[#115E59] bg-[#F0FDFA] hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              title="Unduh rekapitulasi data per Order ID (Total Qty & Variasi SKU) ke file Excel (.CSV)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Rekap Order ID ({totalReturnOrdersCount})</span>
            </button>

            <button
              onClick={handleDownloadCurrentFilteredCsv}
              disabled={filteredRows.length === 0}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              title="Unduh rincian detail seluruh baris ke file Excel (.CSV)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Detail SKU ({filteredRows.length})</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
              title="Buka dialog filter kustom untuk unduhan file"
            >
              <Filter className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Filter & Unduh...</span>
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Semua ({activeFilterCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* ROW 1: PARAMETER PENCARIAN (TANGGAL, ORDER ID, OPERATOR, SKU, MARKETPLACE, LOGISTIK) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* FILTER 1: TANGGAL PROSES (DARI TANGGAL KE TANGGAL) */}
          <div className="md:col-span-2 lg:col-span-1 xl:col-span-2 space-y-1.5 p-3 rounded-2xl bg-teal-50/50 border border-teal-100 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-800 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>1. Tanggal Proses (Dari ... ke ...)</span>
              </label>
              {(filterStartDate || filterEndDate) && (
                <button
                  type="button"
                  onClick={handleClearDateRange}
                  className="text-[10px] text-rose-600 hover:text-rose-700 hover:underline font-semibold flex items-center space-x-0.5 cursor-pointer"
                  title="Kosongkan filter tanggal"
                >
                  <X className="w-2.5 h-2.5" />
                  <span>Reset Tgl</span>
                </button>
              )}
            </div>

            {/* Input Rentang: Dari Tanggal ke Tanggal */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <span className="text-[10px] font-medium text-slate-500 block">Dari Tanggal:</span>
                <div className="relative">
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-[#0F766E] font-mono shadow-2xs"
                    title="Tanggal awal proses"
                  />
                  {filterStartDate && (
                    <button
                      type="button"
                      onClick={() => setFilterStartDate('')}
                      className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-medium text-slate-500 block">Sampai Tanggal:</span>
                <div className="relative">
                  <input
                    type="date"
                    value={filterEndDate}
                    min={filterStartDate || undefined}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-[#0F766E] font-mono shadow-2xs"
                    title="Tanggal akhir proses"
                  />
                  {filterEndDate && (
                    <button
                      type="button"
                      onClick={() => setFilterEndDate('')}
                      className="absolute right-7 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tombol Shortcut Preset Tanggal Cepat */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <button
                type="button"
                onClick={handleSetTodayRange}
                className="px-2 py-0.5 rounded-lg text-[10px] bg-white hover:bg-teal-50 text-[#0F766E] border border-teal-200 font-semibold transition-all shadow-2xs cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={handleSetYesterdayRange}
                className="px-2 py-0.5 rounded-lg text-[10px] bg-white hover:bg-teal-50 text-slate-700 border border-slate-200 font-medium transition-all shadow-2xs cursor-pointer"
              >
                Kemarin
              </button>
              <button
                type="button"
                onClick={handleSetLast7DaysRange}
                className="px-2 py-0.5 rounded-lg text-[10px] bg-white hover:bg-teal-50 text-slate-700 border border-slate-200 font-medium transition-all shadow-2xs cursor-pointer"
              >
                7 Hari
              </button>
              <button
                type="button"
                onClick={handleSetLast30DaysRange}
                className="px-2 py-0.5 rounded-lg text-[10px] bg-white hover:bg-teal-50 text-slate-700 border border-slate-200 font-medium transition-all shadow-2xs cursor-pointer"
              >
                30 Hari
              </button>
              <button
                type="button"
                onClick={handleSetThisMonthRange}
                className="px-2 py-0.5 rounded-lg text-[10px] bg-white hover:bg-teal-50 text-slate-700 border border-slate-200 font-medium transition-all shadow-2xs cursor-pointer"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={handleClearDateRange}
                className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
              >
                Semua
              </button>
            </div>
          </div>

          {/* FILTER 2: ORDER ID */}
          <div className="space-y-1 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1">
                <Barcode className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>2. No. Order ID</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  list="order-ids-list"
                  placeholder="Cari Order ID..."
                  value={filterOrderId}
                  onChange={(e) => setFilterOrderId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-[#0F766E] font-mono"
                />
                {filterOrderId && (
                  <button
                    type="button"
                    onClick={() => setFilterOrderId('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <datalist id="order-ids-list">
                {distinctOrderIds.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              {distinctOrderIds.length} Order terdata
            </p>
          </div>

          {/* FILTER 3: OPERATOR */}
          <div className="space-y-1 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>3. Operator ID</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  list="operators-list"
                  placeholder="Cari Operator ID..."
                  value={filterOperator}
                  onChange={(e) => setFilterOperator(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-[#0F766E] font-mono"
                />
                {filterOperator && (
                  <button
                    type="button"
                    onClick={() => setFilterOperator('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <datalist id="operators-list">
                {distinctOperators.map((op) => (
                  <option key={op} value={op} />
                ))}
              </datalist>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              {distinctOperators.length} Operator terdata
            </p>
          </div>

          {/* FILTER 4: SKU ID */}
          <div className="space-y-1 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1">
                <Package className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>4. Kode SKU ID</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  list="skus-list"
                  placeholder="Ketik SKU ID (sc064)..."
                  value={filterSkuId}
                  onChange={(e) => setFilterSkuId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-[#0F766E] font-mono"
                />
                {filterSkuId && (
                  <button
                    type="button"
                    onClick={() => setFilterSkuId('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <datalist id="skus-list">
                {distinctSkus.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              {distinctSkus.length} SKU terdata
            </p>
          </div>

          {/* FILTER 5: MARKETPLACE / PLATFORM */}
          <div className="space-y-1 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>5. Marketplace</span>
                </label>
                {filterMarketplace && (
                  <button
                    type="button"
                    onClick={() => setFilterMarketplace('')}
                    className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Hapus filter marketplace"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <select
                  value={filterMarketplace}
                  onChange={(e) => setFilterMarketplace(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-[#0F766E] font-medium cursor-pointer"
                >
                  <option value="">Semua Marketplace</option>
                  {distinctMarketplaces.map((mp) => {
                    const count = rows.filter((r) => getRowMarketplace(r).toLowerCase() === mp.toLowerCase()).length;
                    return (
                      <option key={mp} value={mp}>
                        {mp} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              {distinctMarketplaces.length} Platform terdeteksi
            </p>
          </div>

          {/* FILTER 6: EKSPEDISI / LOGISTIK */}
          <div className="space-y-1 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1">
                  <Truck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>6. Logistik</span>
                </label>
                {filterLogistics && (
                  <button
                    type="button"
                    onClick={() => setFilterLogistics('')}
                    className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Hapus filter ekspedisi"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <select
                  value={filterLogistics}
                  onChange={(e) => setFilterLogistics(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-[#0F766E] font-medium cursor-pointer"
                >
                  <option value="">Semua Ekspedisi</option>
                  {distinctLogistics.map((lg) => {
                    const count = rows.filter((r) => getRowLogistics(r).toLowerCase() === lg.toLowerCase()).length;
                    return (
                      <option key={lg} value={lg}>
                        {lg} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              {distinctLogistics.length} Ekspedisi terdeteksi
            </p>
          </div>
        </div>

        {/* ROW 2: FILTER 5 - CHECKLIST STATUS KONDISI RETUR (MULTI-SELECTION CHECKBOXES) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50/90 via-teal-50/20 to-white border border-slate-200/90 shadow-2xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-teal-100/90 text-[#0F766E] flex items-center justify-center shrink-0">
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>5. Status Kondisi Retur (Checklist Multi-Kriteria)</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-[#0F766E] border border-teal-200">
                    {selectedConditions.size} dari {allConditionOptions.length} Kondisi Dipilih
                  </span>
                </label>
                <p className="text-[10px] text-slate-500">
                  Centang satu atau beberapa kondisi untuk menyaring tabel data secara langsung
                </p>
              </div>
            </div>

            {/* Quick Action Buttons Checklist */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={handleSelectAllConditions}
                className={`px-2.5 py-1 rounded-lg border font-semibold transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center space-x-1 ${
                  selectedConditions.size === allConditionOptions.length
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white hover:bg-teal-50 text-[#0F766E] border-teal-200'
                }`}
                title="Pilih semua kondisi barang"
              >
                <CheckSquare className="w-3 h-3" />
                <span>Pilih Semua</span>
              </button>

              <button
                type="button"
                onClick={handleSelectGoodOnly}
                className={`px-2.5 py-1 rounded-lg border font-semibold transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center space-x-1 ${
                  selectedConditions.size === 1 && selectedConditions.has('Good')
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
                title="Hanya tampilkan paket barang kondisi Good"
              >
                <span>Hanya Good</span>
              </button>

              <button
                type="button"
                onClick={handleSelectIssuesOnly}
                className={`px-2.5 py-1 rounded-lg border font-semibold transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center space-x-1 ${
                  selectedConditions.size === allConditionOptions.length - 1 && !selectedConditions.has('Good')
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200'
                }`}
                title="Pilih seluruh kategori retur bermasalah (Damage Product, Packaging, Missing, Unexpected)"
              >
                <ShieldAlert className="w-3 h-3 text-rose-500" />
                <span>Hanya Defect / Masalah</span>
              </button>

              {selectedConditions.size < allConditionOptions.length && (
                <button
                  type="button"
                  onClick={handleSelectAllConditions}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 text-[10px] font-medium cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Checklist Items Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-0.5">
            {allConditionOptions.map((item) => {
              const isSelected = selectedConditions.has(item.key);
              const count = conditionCountMap[item.key] || 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => handleToggleCondition(item.key)}
                  className={`flex items-start justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer group select-none ${
                    isSelected
                      ? item.activeContainerClass
                      : 'bg-white/80 hover:bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <CheckSquare className={`w-4 h-4 ${item.iconColor}`} />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className={`text-xs font-bold leading-tight ${isSelected ? item.titleColor : 'text-slate-600'}`}>
                        {item.label}
                      </div>
                      <div className={`text-[10px] mt-0.5 leading-none ${isSelected ? item.descColor : 'text-slate-400'}`}>
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono shrink-0 ml-1.5 ${
                      isSelected ? item.badgeClass : 'bg-slate-100 text-slate-400'
                    }`}
                    title={`${count} baris data cocok`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary Filter Pill Info */}
        <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-slate-100 gap-2">
          <div className="flex items-center space-x-2 text-slate-600">
            <span>Hasil Filter:</span>
            <strong className="text-[#0F766E] font-bold font-mono text-sm">
              {filteredRows.length}
            </strong>
            <span>dari {rows.length} baris data</span>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {(filterStartDate || filterEndDate) && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200 font-mono font-medium flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-[#0F766E]" />
                  <span>
                    {filterStartDate && filterEndDate
                      ? `Tgl: ${filterStartDate} s/d ${filterEndDate}`
                      : filterStartDate
                      ? `Dari: ${filterStartDate}`
                      : `Sampai: ${filterEndDate}`}
                  </span>
                </span>
              )}
              {filterOrderId && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200 font-mono font-medium">
                  Order: {filterOrderId}
                </span>
              )}
              {filterOperator && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200 font-mono font-medium">
                  Opr: {filterOperator}
                </span>
              )}
              {filterSkuId && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200 font-mono font-medium">
                  SKU: {filterSkuId}
                </span>
              )}
              {filterMarketplace && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200 font-medium flex items-center space-x-1">
                  <ShoppingBag className="w-3 h-3 text-teal-600" />
                  <span>Marketplace: {filterMarketplace}</span>
                  <button
                    type="button"
                    onClick={() => setFilterMarketplace('')}
                    className="p-0.5 hover:text-rose-600 cursor-pointer"
                    title="Hapus filter marketplace"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterLogistics && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium flex items-center space-x-1">
                  <Truck className="w-3 h-3 text-indigo-600" />
                  <span>Logistik: {filterLogistics}</span>
                  <button
                    type="button"
                    onClick={() => setFilterLogistics('')}
                    className="p-0.5 hover:text-rose-600 cursor-pointer"
                    title="Hapus filter logistik"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedConditions.size < allConditionKeys.length && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200 font-medium flex items-center space-x-1">
                  <span>
                    Kondisi ({selectedConditions.size}): {Array.from(selectedConditions).join(', ')}
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllConditions}
                    className="p-0.5 hover:text-rose-600 cursor-pointer"
                    title="Tampilkan semua kondisi"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filteredRows.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadCurrentFilteredCsv}
                  className="sm:ml-auto px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                  title="Unduh seluruh baris yang cocok dengan filter di atas ke file Excel (.CSV)"
                >
                  <Download className="w-3 h-3" />
                  <span>Unduh Hasil Filter Ini ({filteredRows.length} Baris)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. KARTU STATISTIK RINGKASAN TERFILTER (6 KARTU)                        */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Jumlah Return Berdasarkan Order ID */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 text-xs font-semibold">
            <span>Jumlah Return (Order)</span>
            <Package className="w-4 h-4 text-[#0F766E]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            {totalReturnOrdersCount}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
            Total paket Order ID
          </div>
        </div>

        {/* Card 2: Total Qty Return */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-blue-50/60 border border-indigo-200/90 shadow-sm">
          <div className="flex items-center justify-between text-indigo-700 text-xs font-bold">
            <span>Total Qty Return</span>
            <Boxes className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-950 font-mono mt-1">
            {totalItems}
          </div>
          <div className="text-[10px] text-indigo-700 font-medium mt-0.5">
            Total unit/pcs barang
          </div>
        </div>

        {/* Card 3: Variasi SKU */}
        <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/90 shadow-sm">
          <div className="flex items-center justify-between text-[#0F766E] text-xs font-semibold">
            <span>Variasi SKU</span>
            <Barcode className="w-4 h-4 text-[#0F766E]" />
          </div>
          <div className="text-2xl font-bold text-slate-800 font-mono mt-1 tabular-nums">
            {totalVariasiSkuCount}
          </div>
          <div className="text-[10px] text-teal-700 font-medium mt-0.5">
            Jenis SKU berbeda
          </div>
        </div>

        {/* Card 4: Good Condition */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Good (Baik)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-800 font-mono mt-1">
            {goodCount}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
            Siap restock
          </div>
        </div>

        {/* Card 5: Damage & Masalah */}
        <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/90 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
            <span>Damage / Rusak</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-red-800 font-mono mt-1">
            {damageProductCount + damagePackagingCount + unexpectedCount}
          </div>
          <div className="text-[10px] text-red-600 font-medium mt-0.5">
            {damageProductCount} produk, {damagePackagingCount} kemasan
          </div>
        </div>

        {/* Card 6: Drive Evidence */}
        <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 text-xs font-semibold">
            <span>Google Drive</span>
            <Cloud className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            {driveLinkedCount}
          </div>
          <div className="text-[10px] text-slate-600 font-medium mt-0.5">
            Video bukti tertaut
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 4. MAIN RESULT VIEWER TABLE (DENGAN PAGINASI 100 BARIS PER HALAMAN)      */}
      {/* ======================================================================= */}
      {rows.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-[#F0FDFA] text-[#0F766E] flex items-center justify-center mx-auto border border-teal-100">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">
              Belum Ada Laporan Unboxing
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Silakan lakukan sesi unboxing di Stasiun Unboxing. Setelah klik Selesai & Upload ke Drive, laporan akan otomatis tersimpan di sini.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={onNavigateToStation}
              className="py-2.5 px-5 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Mulai Unboxing Sekarang
            </button>
          </div>
        </div>
      ) : selectedConditions.size === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center space-y-3 border border-amber-200 bg-amber-50/40">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Tidak Ada Status Kondisi yang Dipilih
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Semua checklist kondisi di atas dalam keadaan tidak tercentang. Silakan centang minimal satu kondisi (Good, Damage, Missing, atau Unexpected) untuk melihat tabel data.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleSelectAllConditions}
              className="py-2 px-4 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            >
              Pilih Semua Kondisi
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200">
          <ResultViewer
            rows={filteredRows}
            onNavigateToDisputes={onNavigateToDisputes}
            onDeleteOrder={onDeleteOrder}
            onDeleteRow={onDeleteRow}
            onDeleteBulkOrders={onDeleteBulkOrders}
            onDeleteBulkRows={onDeleteBulkRows}
          />
        </div>
      )}

      {/* MODAL EKSPOR / DOWNLOAD TERFILTER MULTI-KRITERIA */}
      <ExportFilteredModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        rows={rows}
        activePageFilter={{
          startDate: filterStartDate,
          endDate: filterEndDate,
          orderId: filterOrderId,
          operator: filterOperator,
          skuId: filterSkuId,
          conditions: Array.from(selectedConditions)
        }}
      />
    </div>
  );
};
