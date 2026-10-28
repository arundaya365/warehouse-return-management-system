import React, { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  FileCode,
  Table as TableIcon,
  Search,
  ExternalLink,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  Filter,
  ChevronDown,
  ChevronUp,
  Package,
  Boxes,
  Eye,
  EyeOff,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Trash2,
  ShoppingBag,
  Truck,
  Video
} from 'lucide-react';
import { ProcessedReturnRow, StandardKondisi } from '../processor';
import { ExportFilteredModal } from './ExportFilteredModal';
import { useAccount, ROLE_DEFINITIONS } from '../context/AccountContext';
import { detectMarketplaceAndLogistics } from '../utils/awbDetection';

export const getDirectVideoUrl = (url: string, orderId?: string): string => {
  if (!url) return '';
  if (url.includes('drive.google.com/drive/search?q=')) {
    const match = url.match(/search\?q=([^&]+)/);
    const query = match ? decodeURIComponent(match[1]) : orderId || '';
    const cleanId = (query || orderId || '99999999').replace(/[^a-zA-Z0-9]/g, '') || '99999999';
    return `https://drive.google.com/file/d/1v${cleanId.padEnd(12, '0')}/view`;
  }
  return url;
};

export interface OrderReturnSummary {
  Order_ID: string;
  Operator_ID: string;
  Marketplace?: string;
  Ekspedisi?: string;
  Waktu_Proses: string;
  Video_Timestamp: string;
  Nama_File_Video: string;
  Link_Video: string;
  totalQty: number; // Jumlah Qty return dalam order ini
  skuVariationsCount: number; // Jumlah variasi SKU berbeda dalam order ini
  skuList: {
    skuId: string;
    namaBarang: string;
    qty: number;
    kondisiBreakdown: Record<string, number>;
  }[];
  conditionBreakdown: {
    good: number;
    damageProduct: number;
    damagePackaging: number;
    totallyDamage: number;
    missing: number;
    unexpected: number;
  };
  rows: ProcessedReturnRow[];
}

export interface DeleteTarget {
  type: 'single_order' | 'single_row' | 'bulk_orders' | 'bulk_rows';
  title: string;
  orderId?: string;
  skuId?: string;
  skuName?: string;
  orderIds?: string[];
  rowKeys?: { orderId: string; skuId: string }[];
  count?: number;
}

interface ResultViewerProps {
  rows: ProcessedReturnRow[];
  onNavigateToDisputes?: () => void;
  onDeleteOrder?: (orderId: string) => void;
  onDeleteRow?: (orderId: string, skuId: string) => void;
  onDeleteBulkOrders?: (orderIds: string[]) => void;
  onDeleteBulkRows?: (rowKeys: { orderId: string; skuId: string }[]) => void;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({
  rows,
  onNavigateToDisputes,
  onDeleteOrder,
  onDeleteRow,
  onDeleteBulkOrders,
  onDeleteBulkRows
}) => {
  const { currentUser, hasPermission } = useAccount();
  const canDelete = currentUser.role === 'SUPER_ADMIN' || hasPermission('canDeleteReports');

  // Mode tampilan: 'order_summary' (Agregasi 1 Order ID: Qty & Variasi SKU) | 'sku_detail' (Detail per baris SKU) | 'json'
  const [viewMode, setViewMode] = useState<'order_summary' | 'sku_detail' | 'json'>('order_summary');
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Set Order ID yang sedang di-expand di tabel ringkasan
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Seleksi data untuk aksi massal Super Admin
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  // Modal konfirmasi hapus in-app
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (actionSuccessNotice) {
      const timer = setTimeout(() => setActionSuccessNotice(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [actionSuccessNotice]);

  // Eksekusi hapus setelah dikonfirmasi via modal in-app
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'single_order' && deleteTarget.orderId) {
      if (onDeleteOrder) onDeleteOrder(deleteTarget.orderId);
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.orderId!);
        return next;
      });
      setActionSuccessNotice(`Data Order ID "${deleteTarget.orderId}" berhasil dihapus.`);
    } else if (deleteTarget.type === 'single_row' && deleteTarget.orderId && deleteTarget.skuId) {
      if (onDeleteRow) onDeleteRow(deleteTarget.orderId, deleteTarget.skuId);
      const key = `${deleteTarget.orderId}__${deleteTarget.skuId}`;
      setSelectedRowKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setActionSuccessNotice(`Baris SKU "${deleteTarget.skuId}" berhasil dihapus.`);
    } else if (deleteTarget.type === 'bulk_orders' && deleteTarget.orderIds) {
      if (onDeleteBulkOrders) {
        onDeleteBulkOrders(deleteTarget.orderIds);
      } else if (onDeleteOrder) {
        deleteTarget.orderIds.forEach((id) => onDeleteOrder(id));
      }
      setSelectedOrderIds(new Set());
      setActionSuccessNotice(`${deleteTarget.orderIds.length} Order ID terpilih berhasil dihapus.`);
    } else if (deleteTarget.type === 'bulk_rows' && deleteTarget.rowKeys) {
      if (onDeleteBulkRows) {
        onDeleteBulkRows(deleteTarget.rowKeys);
      } else if (onDeleteRow) {
        deleteTarget.rowKeys.forEach((k) => onDeleteRow(k.orderId, k.skuId));
      }
      setSelectedRowKeys(new Set());
      setActionSuccessNotice(`${deleteTarget.rowKeys.length} Baris SKU terpilih berhasil dihapus.`);
    }

    setDeleteTarget(null);
  };

  // Paginasi: Maksimal 100 baris per halaman
  const ROWS_PER_PAGE = 100;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filter internal tabel jika pengguna mengetik di search bar cepat tabel
  const displayRows = useMemo(() => {
    if (!searchTableQuery.trim()) return rows;
    const q = searchTableQuery.trim().toLowerCase();
    return rows.filter((r) => {
      return (
        r.SKU_ID.toLowerCase().includes(q) ||
        r.Nama_Barang.toLowerCase().includes(q) ||
        r.Order_ID.toLowerCase().includes(q) ||
        r.Operator_ID.toLowerCase().includes(q) ||
        r.Catatan_Tambahan.toLowerCase().includes(q) ||
        r.Nama_File_Video.toLowerCase().includes(q)
      );
    });
  }, [rows, searchTableQuery]);

  // =========================================================================
  // AGREGASI DATA RETURN BERDASARKAN ORDER ID
  // Menghitung Jumlah Qty & Variasi SKU dimasukkan ke dalam 1 Order ID
  // =========================================================================
  const orderSummaries: OrderReturnSummary[] = useMemo(() => {
    const map = new Map<string, OrderReturnSummary>();

    for (const r of displayRows) {
      const orderId = r.Order_ID || 'UNKNOWN_ORDER';
      let summary = map.get(orderId);

      if (!summary) {
        const detected = detectMarketplaceAndLogistics(orderId);
        summary = {
          Order_ID: orderId,
          Operator_ID: r.Operator_ID || '-',
          Marketplace: r.Marketplace || detected.marketplace || 'Lainnya',
          Ekspedisi: r.Ekspedisi || detected.logistics || 'Lainnya',
          Waktu_Proses: r.Waktu_Proses || r.Video_Timestamp || '-',
          Video_Timestamp: r.Video_Timestamp || '-',
          Nama_File_Video: r.Nama_File_Video || '-',
          Link_Video: getDirectVideoUrl(r.Link_Video || '', orderId),
          totalQty: 0,
          skuVariationsCount: 0,
          skuList: [],
          conditionBreakdown: {
            good: 0,
            damageProduct: 0,
            damagePackaging: 0,
            totallyDamage: 0,
            missing: 0,
            unexpected: 0
          },
          rows: []
        };
        map.set(orderId, summary);
      }

      // Hitung total Qty dan simpan row
      summary.totalQty += 1;
      summary.rows.push(r);

      // Hitung rincian kondisi (Mencakup 6 variasi kondisi lengkap)
      const k = (r.Kondisi || '').trim();
      if (k === 'Good' || k === 'Good Condition' || k === 'Baik') {
        summary.conditionBreakdown.good += 1;
      } else if (k === 'Damage Packaging' || k === 'Dus' || k === 'Kemasan Rusak') {
        summary.conditionBreakdown.damagePackaging += 1;
      } else if (k === 'Totally Damage' || k === 'Damage Total' || k === 'Total Rusak') {
        summary.conditionBreakdown.totallyDamage += 1;
      } else if (k === 'Wrong Item' || k === 'Unexpected' || k === 'Salah Barang') {
        summary.conditionBreakdown.unexpected += 1;
      } else if (k === 'Missing Item' || k === 'Missing' || k === 'Barang Hilang') {
        summary.conditionBreakdown.missing += 1;
      } else {
        // Damage Product / Damage Products / Rusak
        summary.conditionBreakdown.damageProduct += 1;
      }

      // Hitung variasi SKU dalam order ini
      const skuId = r.SKU_ID || '-';
      let skuEntry = summary.skuList.find((s) => s.skuId === skuId);
      if (!skuEntry) {
        skuEntry = {
          skuId,
          namaBarang: r.Nama_Barang || '-',
          qty: 0,
          kondisiBreakdown: {}
        };
        summary.skuList.push(skuEntry);
      }
      skuEntry.qty += 1;
      skuEntry.kondisiBreakdown[r.Kondisi] = (skuEntry.kondisiBreakdown[r.Kondisi] || 0) + 1;
    }

    // Update jumlah variasi SKU per order
    for (const summary of map.values()) {
      summary.skuVariationsCount = summary.skuList.length;
    }

    return Array.from(map.values());
  }, [displayRows]);

  // Total data yang dipaginasi tergantung mode tampilan
  const totalItemCount = viewMode === 'order_summary' ? orderSummaries.length : displayRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItemCount / ROWS_PER_PAGE));

  // Reset ke halaman 1 jika filter berubah atau mode berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [rows.length, searchTableQuery, viewMode]);

  // Pastikan currentPage tidak melebihi totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Slice baris: maksimal 100 baris per halaman
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, totalItemCount);

  const paginatedOrders = useMemo(() => {
    return orderSummaries.slice(startIndex, endIndex);
  }, [orderSummaries, startIndex, endIndex]);

  const paginatedRows = useMemo(() => {
    return displayRows.slice(startIndex, endIndex);
  }, [displayRows, startIndex, endIndex]);

  const jsonString = useMemo(() => {
    return JSON.stringify(displayRows, null, 2);
  }, [displayRows]);

  // Toggle expand / collapse accordion baris Order ID
  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const all = new Set(paginatedOrders.map((o) => o.Order_ID));
    setExpandedOrderIds(all);
  };

  const handleCollapseAll = () => {
    setExpandedOrderIds(new Set());
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const orderId = displayRows[0]?.Order_ID || 'UNBOX_REPORT';
    a.href = url;
    a.download = `UNBOX_REPORT_${orderId}_${displayRows.length}items.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Unduh CSV Rekapitulasi per Order ID (Total Qty & Variasi SKU dalam 1 Order ID)
  const handleDownloadOrderSummaryCsv = () => {
    if (orderSummaries.length === 0) return;
    const headers = [
      'Order_ID',
      'Operator_ID',
      'Marketplace',
      'Ekspedisi',
      'Waktu_Proses',
      'Total_Qty_Return',
      'Jumlah_Variasi_SKU',
      'Rincian_Variasi_SKU',
      'Kondisi_Baik_Good',
      'Kondisi_Damage_Packaging_Dus',
      'Kondisi_Damage_Product_Dmg',
      'Kondisi_Totally_Damage',
      'Kondisi_Wrong_Item',
      'Kondisi_Missing_Item',
      'Nama_File_Video',
      'Link_Video_Drive'
    ];

    const csvContent = [
      headers.join(','),
      ...orderSummaries.map((s) => {
        const skuDetailStr = s.skuList.map((sku) => `${sku.skuId} (${sku.qty}x)`).join('; ');
        const rowValues = [
          `"${s.Order_ID.replace(/"/g, '""')}"`,
          `"${s.Operator_ID.replace(/"/g, '""')}"`,
          `"${(s.Marketplace || '').replace(/"/g, '""')}"`,
          `"${(s.Ekspedisi || '').replace(/"/g, '""')}"`,
          `"${s.Waktu_Proses.replace(/"/g, '""')}"`,
          s.totalQty,
          s.skuVariationsCount,
          `"${skuDetailStr.replace(/"/g, '""')}"`,
          s.conditionBreakdown.good,
          s.conditionBreakdown.damagePackaging,
          s.conditionBreakdown.damageProduct,
          s.conditionBreakdown.totallyDamage,
          s.conditionBreakdown.unexpected,
          s.conditionBreakdown.missing,
          `"${s.Nama_File_Video.replace(/"/g, '""')}"`,
          `"${s.Link_Video.replace(/"/g, '""')}"`
        ];
        return rowValues.join(',');
      })
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REKAP_RETURN_PER_ORDER_ID_${orderSummaries.length}orders.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Unduh CSV Detail per Baris SKU
  const handleDownloadSkuDetailCsv = () => {
    if (displayRows.length === 0) return;
    const standardKeys: (keyof ProcessedReturnRow)[] = [
      'Waktu_Proses',
      'Operator_ID',
      'Order_ID',
      'Marketplace',
      'Ekspedisi',
      'SKU_ID',
      'Nama_Barang',
      'Kondisi',
      'Catatan_Tambahan',
      'Video_Timestamp',
      'Nama_File_Video',
      'Link_Video'
    ];
    const csvContent = [
      standardKeys.join(','),
      ...displayRows.map((row) => {
        const detected = detectMarketplaceAndLogistics(row.Order_ID);
        return standardKeys
          .map((header) => {
            let val = row[header];
            if (header === 'Marketplace' && !val) val = detected.marketplace || 'Lainnya';
            if (header === 'Ekspedisi' && !val) val = detected.logistics || 'Lainnya';
            const cleanVal = String(val || '').replace(/"/g, '""');
            return `"${cleanVal}"`;
          })
          .join(',');
      })
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const orderId = displayRows[0]?.Order_ID || 'UNBOX_REPORT';
    a.href = url;
    a.download = `DETAIL_RETURN_PER_SKU_${orderId}_${displayRows.length}items.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getConditionBadge = (kondisi: StandardKondisi) => {
    switch (kondisi) {
      case 'Good':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Good
          </span>
        );
      case 'Totally Damage':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            Totally Damage
          </span>
        );
      case 'Damage Product':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Damage Products
          </span>
        );
      case 'Damage Packaging':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Damage Packaging
          </span>
        );
      case 'Missing Item':
      case 'Missing':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300">
            Missing Item
          </span>
        );
      case 'Wrong Item':
      case 'Unexpected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Wrong Item
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {kondisi}
          </span>
        );
    }
  };

  // Helper untuk generate deretan nomor halaman
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const problemItems = displayRows.filter((r) => r.Kondisi !== 'Good');

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Tabel Rekapitulasi Data Laporan
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-teal-200 font-mono font-bold">
              {orderSummaries.length} Order ID
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold">
              {displayRows.length} Total Qty
            </span>
            {totalItemCount > 100 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium flex items-center space-x-1">
                <Layers className="w-3 h-3 text-slate-500" />
                <span>Paginasi 100 / Halaman</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hitung jumlah return per Order ID, jumlah Qty & variasi SKU dikelompokkan ke dalam masing-masing Order ID. Maksimal 100 baris per halaman.
          </p>
        </div>

        {/* View Switcher & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle View Mode: Ringkasan Order ID vs Detail SKU vs JSON */}
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center shadow-xs">
            <button
              onClick={() => setViewMode('order_summary')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'order_summary'
                  ? 'bg-white text-[#0F766E] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ringkasan 1 Order ID: Total Return Qty & Variasi SKU dimasukkan ke dalam 1 Order ID"
            >
              <Package className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>Rekap Order ID ({orderSummaries.length})</span>
            </button>
            <button
              onClick={() => setViewMode('sku_detail')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'sku_detail'
                  ? 'bg-white text-[#0F766E] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Rincian per item/baris SKU"
            >
              <TableIcon className="w-3.5 h-3.5 text-slate-600" />
              <span>Detail per SKU ({displayRows.length})</span>
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'json'
                  ? 'bg-white text-[#0F766E] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="JSON Array"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-500" />
              <span>JSON</span>
            </button>
          </div>

          {/* Unduh Rekap Order ID CSV */}
          <button
            onClick={handleDownloadOrderSummaryCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
            title="Unduh rekapitulasi data grouped by Order ID (Qty & Variasi SKU) ke file Excel (.CSV)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh Rekap Order (.CSV)</span>
          </button>

          {/* Filter & Unduh Kustom */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Download file dengan filter kustom (Tanggal proses, Order ID, Operator, SKU, Kondisi, format Excel/JSON/HTML)"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filter & Unduh...</span>
          </button>

          {/* Unduh Detail Baris SKU CSV */}
          <button
            onClick={handleDownloadSkuDetailCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            title="Unduh seluruh baris detail SKU ke file Excel (.CSV)"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Detail SKU (.CSV)</span>
          </button>
        </div>
      </div>

      {/* Main View */}
      {displayRows.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white/60 rounded-2xl border border-slate-200">
          <AlertCircle className="w-10 h-10 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-700">Tidak ada baris data yang cocok</p>
          <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau bersihkan filter di atas.</p>
        </div>
      ) : viewMode === 'order_summary' ? (
        /* ========================================================================= */
        /* MODE 1: RINGKASAN PER ORDER ID (QTY & VARIASI SKU DALAM 1 ORDER ID)       */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Sub-toolbar Order Summary */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari Order ID, SKU, atau operator..."
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[#0F766E]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={expandedOrderIds.size === paginatedOrders.length ? handleCollapseAll : handleExpandAll}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                {expandedOrderIds.size === paginatedOrders.length ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                    <span>Tutup Semua Rincian</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Buka Semua Rincian</span>
                  </>
                )}
              </button>

              {/* Pagination Quick Status Badge */}
              <div className="text-xs text-slate-600 font-medium flex items-center space-x-2">
                <span className="text-slate-500">
                  Menampilkan <strong className="text-slate-900 font-mono">{startIndex + 1}</strong>–<strong className="text-slate-900 font-mono">{endIndex}</strong> dari <strong className="text-[#0F766E] font-mono">{orderSummaries.length}</strong> Order ID
                </span>
                {totalPages > 1 && (
                  <span className="px-2 py-0.5 rounded-md bg-[#F0FDFA] text-[#0F766E] font-bold text-[11px] border border-teal-200">
                    Hal {currentPage} / {totalPages}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card-based Order List with Thick Borders, Visual Spacing & Sequence Badges */}
          {canDelete && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 mb-3 text-xs">
              <label className="flex items-center space-x-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedOrderIds.has(o.Order_ID))}
                  onChange={(e) => {
                    const next = new Set(selectedOrderIds);
                    if (e.target.checked) {
                      paginatedOrders.forEach((o) => next.add(o.Order_ID));
                    } else {
                      paginatedOrders.forEach((o) => next.delete(o.Order_ID));
                    }
                    setSelectedOrderIds(next);
                  }}
                  className="rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E] h-4 w-4 cursor-pointer"
                />
                <span>Pilih Semua ({paginatedOrders.length} Order ID) di Halaman Ini</span>
              </label>
              {selectedOrderIds.size > 0 && (
                <span className="text-teal-800 font-bold bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200 text-[11px]">
                  {selectedOrderIds.size} Order ID Dipilih
                </span>
              )}
            </div>
          )}

          <div className="space-y-4">
            {paginatedOrders.map((order, idx) => {
              const absoluteIndex = startIndex + idx + 1;
              const isExpanded = expandedOrderIds.has(order.Order_ID);

              return (
                <div
                  key={order.Order_ID}
                  className={`rounded-2xl border-2 transition-all duration-200 bg-white shadow-xs hover:shadow-md overflow-hidden ${
                    isExpanded
                      ? 'border-teal-500 ring-2 ring-teal-500/15 shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header: Clickable to expand/collapse */}
                  <div
                    className={`p-4 sm:p-4.5 cursor-pointer transition-colors ${
                      isExpanded
                        ? 'bg-gradient-to-r from-teal-50/60 via-slate-50/50 to-white'
                        : 'hover:bg-slate-50/60'
                    }`}
                    onClick={() => toggleOrderExpand(order.Order_ID)}
                  >
                    {/* ROW 1: PRIMARY IDENTITY */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
                        {canDelete && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.has(order.Order_ID)}
                              onChange={(e) => {
                                const next = new Set(selectedOrderIds);
                                if (e.target.checked) next.add(order.Order_ID);
                                else next.delete(order.Order_ID);
                                setSelectedOrderIds(next);
                              }}
                              className="rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E] h-4 w-4 cursor-pointer"
                              title={`Pilih Order ID ${order.Order_ID}`}
                            />
                          </div>
                        )}

                        {/* Nomor Urut Kontras */}
                        <div className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-slate-900 text-white font-mono font-black text-xs tracking-wider shadow-xs border border-slate-800 shrink-0">
                          <span>ORDER</span>
                          <span className="text-teal-400">#{String(absoluteIndex).padStart(2, '0')}</span>
                        </div>

                        {/* Order ID */}
                        <div className="flex items-center space-x-1.5 bg-slate-100/90 px-2.5 py-1 rounded-xl border border-slate-200 shrink-0">
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm select-all">
                            {order.Order_ID}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(order.Order_ID);
                              setCopiedOrderId(order.Order_ID);
                              setTimeout(() => setCopiedOrderId(null), 1500);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-white transition-colors cursor-pointer"
                            title="Salin No Resi / Order ID"
                          >
                            {copiedOrderId === order.Order_ID ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Marketplace Chip */}
                        {order.Marketplace && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold shrink-0">
                            <ShoppingBag className="w-3 h-3 text-teal-600" />
                            <span>{order.Marketplace}</span>
                          </span>
                        )}

                        {/* Ekspedisi Chip */}
                        {order.Ekspedisi && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold shrink-0">
                            <Truck className="w-3 h-3 text-indigo-600" />
                            <span>{order.Ekspedisi}</span>
                          </span>
                        )}

                        {/* Operator */}
                        <span className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
                          <span>Opr:</span>
                          <strong className="font-mono text-slate-700">{order.Operator_ID}</strong>
                        </span>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center space-x-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleOrderExpand(order.Order_ID)}
                          className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                            isExpanded
                              ? 'bg-[#0F766E] text-white'
                              : 'bg-white hover:bg-teal-50 text-slate-700 hover:text-[#0F766E] border border-slate-300'
                          }`}
                          title="Buka / tutup rincian barang order ini"
                        >
                          <span>{isExpanded ? 'Tutup Rincian' : 'Buka Rincian'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                          )}
                        </button>

                        {canDelete && onDeleteOrder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                type: 'single_order',
                                title: 'Hapus Seluruh Data Order ID',
                                orderId: order.Order_ID,
                                count: order.totalQty
                              });
                            }}
                            className="p-1.5 rounded-xl text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 transition-colors cursor-pointer"
                            title="Hapus Data Return Order ID (Khusus Super Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ROW 2: DETAILED METRICS STRIP */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 text-xs">
                      {/* Metric 1: Total Qty */}
                      <div className="flex items-center space-x-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Qty Unit</div>
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                            {order.totalQty} Unit
                          </span>
                        </div>
                      </div>

                      {/* Metric 2: Variasi SKU */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1 flex items-center space-x-1">
                          <Boxes className="w-3 h-3 text-[#0F766E]" />
                          <span>Variasi SKU ({order.skuVariationsCount})</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-12 overflow-y-auto no-scrollbar">
                          {order.skuList.map((sku) => (
                            <span
                              key={sku.skuId}
                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-white text-slate-700 text-[10px] font-mono border border-slate-200"
                              title={`${sku.namaBarang} (Total: ${sku.qty})`}
                            >
                              <span className="font-bold text-[#0F766E]">{sku.skuId}</span>
                              <span className="text-slate-400 font-sans">×</span>
                              <span className="font-extrabold text-slate-900">{sku.qty}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Metric 3: Kondisi Fisik */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Kondisi Fisik</div>
                        <div className="flex flex-wrap gap-1">
                          {order.conditionBreakdown.good > 0 && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200" title="Good Condition (Kondisi Baik)">
                              <span>Good:</span>
                              <span>{order.conditionBreakdown.good}</span>
                            </span>
                          )}
                          {order.conditionBreakdown.damagePackaging > 0 && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200" title="Damage Packaging (Kemasan / Dus Rusak)">
                              <span>Dus:</span>
                              <span>{order.conditionBreakdown.damagePackaging}</span>
                            </span>
                          )}
                          {order.conditionBreakdown.damageProduct > 0 && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200" title="Damage Product (Produk Rusak / Cacat)">
                              <span>Dmg:</span>
                              <span>{order.conditionBreakdown.damageProduct}</span>
                            </span>
                          )}
                          {order.conditionBreakdown.totallyDamage > 0 && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 text-[10px] font-bold border border-purple-200" title="Totally Damage (Kerusakan Total / Hancur)">
                              <span>Tot Dmg:</span>
                              <span>{order.conditionBreakdown.totallyDamage}</span>
                            </span>
                          )}
                          {order.conditionBreakdown.unexpected > 0 && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200" title="Wrong Item / Salah Barang">
                              <span>Wrong:</span>
                              <span>{order.conditionBreakdown.unexpected}</span>
                            </span>
                          )}
                          {order.conditionBreakdown.missing > 0 && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-300" title="Missing Item (Barang Hilang / Kurang)">
                              <span>Hilang:</span>
                              <span>{order.conditionBreakdown.missing}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Metric 4: Video Bukti & Waktu */}
                      <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80" onClick={(e) => e.stopPropagation()}>
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Video & Waktu</div>
                          <div className="text-[11px] font-mono text-slate-800 font-semibold truncate max-w-[140px]" title={order.Nama_File_Video}>
                            {order.Nama_File_Video || '-'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {order.Waktu_Proses}
                          </div>
                        </div>
                        {order.Link_Video && (
                          <a
                            href={getDirectVideoUrl(order.Link_Video, order.Order_ID)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-[#F0FDFA] hover:bg-teal-100 text-[#0F766E] border border-teal-200 text-xs font-semibold flex items-center space-x-1 shrink-0 transition-colors"
                            title="Buka bukti video unboxing di Google Drive"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Drive</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SUB-TABLE: RINCIAN SEMUA SKU DI DALAM 1 ORDER ID (Panel berlatar kontras) */}
                  {isExpanded && (
                    <div className="bg-slate-50/95 border-t-2 border-teal-500 p-4 sm:p-5 space-y-3 shadow-inner">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center space-x-2 font-bold text-slate-800">
                                  <Package className="w-4 h-4 text-[#0F766E]" />
                                  <span>
                                    Rincian Barang dalam Order ID: <strong className="font-mono text-[#0F766E]">{order.Order_ID}</strong>
                                  </span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-600 font-normal">
                                    Total <strong>{order.totalQty} Unit</strong> ({order.skuVariationsCount} Variasi SKU)
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Operator: {order.Operator_ID}
                                </span>
                              </div>

                              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-[11px] font-bold">
                                      <th className="py-2.5 px-3 w-12 text-center">Item</th>
                                      <th className="py-2.5 px-3">SKU ID</th>
                                      <th className="py-2.5 px-3">Nama Produk / Barang</th>
                                      <th className="py-2.5 px-3">Kondisi Fisik</th>
                                      <th className="py-2.5 px-3">Catatan Tambahan</th>
                                      <th className="py-2.5 px-3">Waktu Scan</th>
                                      {canDelete && onDeleteRow && (
                                        <th className="py-2.5 px-3 w-16 text-center">Aksi</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {order.rows.map((rowItem, itemIdx) => (
                                       <tr key={`${rowItem.SKU_ID}-${itemIdx}`} className="hover:bg-slate-50">
                                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                                          {itemIdx + 1}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-[#0F766E]">
                                          {rowItem.SKU_ID}
                                        </td>
                                        <td className="py-2.5 px-3 font-medium text-slate-900">
                                          {rowItem.Nama_Barang}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                          {getConditionBadge(rowItem.Kondisi)}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-600">
                                          {rowItem.Catatan_Tambahan || <span className="text-slate-400 italic">-</span>}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                          {rowItem.Waktu_Proses || rowItem.Video_Timestamp}
                                        </td>
                                        {canDelete && onDeleteRow && (
                                          <td className="py-2.5 px-3 text-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setDeleteTarget({
                                                  type: 'single_row',
                                                  title: 'Hapus Baris SKU dari Order',
                                                  orderId: rowItem.Order_ID,
                                                  skuId: rowItem.SKU_ID,
                                                  skuName: rowItem.Nama_Barang
                                                });
                                              }}
                                              className="p-1 rounded-md text-rose-500 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                                              title={`Hapus baris SKU ${rowItem.SKU_ID} ini`}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* BILAH AKSI MASSAL (BULK ACTION BAR) KHUSUS SUPER ADMIN - ORDER SUMMARY */}
          {canDelete && selectedOrderIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-mono font-bold text-xs border border-teal-500/30">
                  {selectedOrderIds.size}
                </span>
                <span>Order ID dipilih</span>
              </div>
              <div className="h-4 w-px bg-slate-700 hidden sm:block" />
              <button
                type="button"
                onClick={() => {
                  const next = new Set(selectedOrderIds);
                  paginatedOrders.forEach((o) => next.add(o.Order_ID));
                  setSelectedOrderIds(next);
                }}
                className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
              >
                Pilih semua di halaman ini
              </button>
              <button
                type="button"
                onClick={() => setSelectedOrderIds(new Set())}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Batal Pilihan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget({
                    type: 'bulk_orders',
                    title: 'Hapus Massal Order ID Terpilih',
                    orderIds: Array.from(selectedOrderIds),
                    count: selectedOrderIds.size
                  });
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih ({selectedOrderIds.size})</span>
              </button>
            </div>
          )}

          {/* Pagination bar untuk Order Summary */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs">
            <div className="text-xs text-slate-600">
              Menampilkan <strong className="text-slate-900 font-mono">{startIndex + 1}</strong> – <strong className="text-slate-900 font-mono">{endIndex}</strong> dari <strong className="text-slate-900 font-mono">{orderSummaries.length}</strong> Order ID
              <span className="text-slate-400 ml-2 font-mono">
                (Batas 100 Order/halaman)
              </span>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Halaman Pertama"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1 cursor-pointer"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>

                <div className="flex items-center space-x-1">
                  {getPageNumbers().map((page, i) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${i}`} className="px-2 py-1 text-slate-400 text-xs">
                          ...
                        </span>
                      );
                    }
                    const pageNum = page as number;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={`page-${pageNum}`}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#0F766E] text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-[#F0FDFA] hover:text-[#0F766E] border border-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1 cursor-pointer"
                  title="Halaman Berikutnya"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Halaman Terakhir"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                ✓ Seluruh Order ID tertampung dalam 1 halaman
              </div>
            )}
          </div>
        </div>
      ) : viewMode === 'sku_detail' ? (
        /* ========================================================================= */
        /* MODE 2: DETAIL PER BARIS SKU (RAW INDIVIDUAL ITEMS TABLE)                 */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Quick Table Sub-search & Status bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari cepat di tabel (SKU, nama, order)..."
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
              />
            </div>

            {/* Pagination Quick Status Badge */}
            <div className="text-xs text-slate-600 font-medium flex items-center space-x-2">
              <span className="text-slate-500">
                Menampilkan <strong className="text-slate-900 font-mono">{startIndex + 1}</strong>–<strong className="text-slate-900 font-mono">{endIndex}</strong> dari <strong className="text-[#0F766E] font-mono">{displayRows.length}</strong> baris SKU
              </span>
              {totalPages > 1 && (
                <span className="px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200 font-bold text-[11px]">
                  Hal {currentPage} / {totalPages}
                </span>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  {canDelete && (
                    <th className="py-2.5 px-2.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={paginatedRows.length > 0 && paginatedRows.every((r) => selectedRowKeys.has(`${r.Order_ID}__${r.SKU_ID}`))}
                        onChange={(e) => {
                          const next = new Set(selectedRowKeys);
                          if (e.target.checked) {
                            paginatedRows.forEach((r) => next.add(`${r.Order_ID}__${r.SKU_ID}`));
                          } else {
                            paginatedRows.forEach((r) => next.delete(`${r.Order_ID}__${r.SKU_ID}`));
                          }
                          setSelectedRowKeys(next);
                        }}
                        className="rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E] h-4 w-4 cursor-pointer"
                        title="Pilih semua baris di halaman ini"
                      />
                    </th>
                  )}
                  <th className="py-2.5 px-2.5 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-32">Waktu Proses</th>
                  <th className="py-2.5 px-3 w-36">Order ID & Operator</th>
                  <th className="py-2.5 px-3 min-w-[150px]">SKU ID & Nama Barang</th>
                  <th className="py-2.5 px-3 w-32">Kondisi</th>
                  <th className="py-2.5 px-3">Catatan Tambahan</th>
                  <th className="py-2.5 px-3 w-36">Video & Drive</th>
                  {canDelete && <th className="py-2.5 px-2 w-14 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((row, idx) => {
                  const absoluteIndex = startIndex + idx + 1;
                  const rowKey = `${row.Order_ID}__${row.SKU_ID}`;
                  return (
                    <tr
                      key={`${row.Order_ID}-${row.SKU_ID}-${absoluteIndex}`}
                      className="hover:bg-[#F0FDFA]/60 transition-colors"
                    >
                      {/* Checkbox Seleksi Super Admin */}
                      {canDelete && (
                        <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedRowKeys.has(rowKey)}
                            onChange={(e) => {
                              const next = new Set(selectedRowKeys);
                              if (e.target.checked) next.add(rowKey);
                              else next.delete(rowKey);
                              setSelectedRowKeys(next);
                            }}
                            className="rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E] h-4 w-4 cursor-pointer"
                            title={`Pilih baris ${row.SKU_ID}`}
                          />
                        </td>
                      )}
                      <td className="py-2.5 px-2 text-center text-slate-500 font-mono font-bold">
                        {absoluteIndex}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums">
                        <div className="text-slate-800 font-semibold text-[11px]">{row.Waktu_Proses}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-extrabold text-slate-900 text-xs">{row.Order_ID}</div>
                        {(() => {
                          const detected = detectMarketplaceAndLogistics(row.Order_ID);
                          const mp = row.Marketplace || detected.marketplace;
                          const lg = row.Ekspedisi || detected.logistics;
                          return (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {mp && mp !== 'Lainnya' && (
                                <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[9px] font-bold">
                                  <ShoppingBag className="w-2 h-2 text-teal-600" />
                                  <span>{mp}</span>
                                </span>
                              )}
                              {lg && lg !== 'Lainnya' && (
                                <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[9px] font-bold">
                                  <Truck className="w-2 h-2 text-indigo-600" />
                                  <span>{lg}</span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Opr: {row.Operator_ID}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[#0F766E] font-bold text-xs">{row.SKU_ID}</div>
                        <div className="text-slate-800 text-xs mt-0.5 font-medium">{row.Nama_Barang}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {getConditionBadge(row.Kondisi)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs break-words text-[11px]">
                        {row.Catatan_Tambahan || <span className="text-slate-400 italic">-</span>}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        <div className="text-[#0F766E] bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 inline-block font-semibold truncate max-w-[130px]">
                          {row.Nama_File_Video}
                        </div>
                        <div className="text-slate-500 text-[10px] mt-0.5 flex items-center space-x-1.5">
                          {row.Link_Video && (
                            <a
                              href={getDirectVideoUrl(row.Link_Video, row.Order_ID)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0F766E] hover:text-[#115E59] hover:underline font-semibold inline-flex items-center space-x-0.5"
                            >
                              <span>Drive Video</span>
                              <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      {canDelete && (
                        <td className="py-2.5 px-2 text-center">
                          {onDeleteRow && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget({
                                  type: 'single_row',
                                  title: 'Hapus Baris SKU',
                                  orderId: row.Order_ID,
                                  skuId: row.SKU_ID,
                                  skuName: row.Nama_Barang
                                });
                              }}
                              className="p-1 rounded-lg text-rose-500 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                              title="Hapus Baris SKU (Khusus Super Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BILAH AKSI MASSAL (BULK ACTION BAR) KHUSUS SUPER ADMIN - SKU DETAIL */}
          {canDelete && selectedRowKeys.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-mono font-bold text-xs border border-teal-500/30">
                  {selectedRowKeys.size}
                </span>
                <span>Baris SKU dipilih</span>
              </div>
              <div className="h-4 w-px bg-slate-700 hidden sm:block" />
              <button
                type="button"
                onClick={() => {
                  const next = new Set(selectedRowKeys);
                  paginatedRows.forEach((r) => next.add(`${r.Order_ID}__${r.SKU_ID}`));
                  setSelectedRowKeys(next);
                }}
                className="text-xs text-slate-300 hover:text-white underline cursor-pointer"
              >
                Pilih semua di halaman ini
              </button>
              <button
                type="button"
                onClick={() => setSelectedRowKeys(new Set())}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Batal Pilihan
              </button>
              <button
                type="button"
                onClick={() => {
                  const rowKeys = Array.from(selectedRowKeys).map((k) => {
                    const [orderId, skuId] = k.split('__');
                    return { orderId, skuId };
                  });
                  setDeleteTarget({
                    type: 'bulk_rows',
                    title: 'Hapus Massal Baris SKU Terpilih',
                    rowKeys,
                    count: rowKeys.length
                  });
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih ({selectedRowKeys.size})</span>
              </button>
            </div>
          )}

          {/* PAGINATION CONTROLS BAR (MAKSIMAL 100 BARIS PER HALAMAN) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs">
            <div className="text-xs text-slate-600">
              Menampilkan baris <strong className="text-slate-900 font-mono">{startIndex + 1}</strong> – <strong className="text-slate-900 font-mono">{endIndex}</strong> dari <strong className="text-slate-900 font-mono">{displayRows.length}</strong> data
              <span className="text-slate-400 ml-2 font-mono">
                (Batas 100 baris/halaman)
              </span>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Halaman Pertama"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1 cursor-pointer"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>

                <div className="flex items-center space-x-1">
                  {getPageNumbers().map((page, i) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${i}`} className="px-2 py-1 text-slate-400 text-xs">
                          ...
                        </span>
                      );
                    }
                    const pageNum = page as number;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={`page-${pageNum}`}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#0F766E] text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-[#F0FDFA] hover:text-[#0F766E] border border-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center space-x-1 cursor-pointer"
                  title="Halaman Berikutnya"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Halaman Terakhir"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                ✓ Semua baris tertampung dalam 1 halaman
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 3: RAW JSON ARRAY VIEW                                               */
        /* ========================================================================= */
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono">Format Output Wajib: JSON ARRAY Murni (RFC 8259)</span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center space-x-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                <span>{copied ? 'Tersalin' : 'Salin JSON'}</span>
              </button>
              <span className="font-mono text-emerald-600 font-bold">Valid JSON • {displayRows.length} Objects</span>
            </div>
          </div>
          <div className="relative rounded-2xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[500px]">
            <pre className="whitespace-pre">{jsonString}</pre>
          </div>
        </div>
      )}

      {/* Problem Banner if discrepancy exists */}
      {problemItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <div className="flex items-center space-x-2 font-bold text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Ringkasan Ketidaksesuaian Retur (Dispute / Klaim Bukti Unboxing)</span>
          </div>
          <p className="mt-1 text-amber-800/90">
            Terdapat <strong>{problemItems.length} produk</strong> dengan kondisi rusak/hilang (
            {problemItems.slice(0, 5).map((p) => `${p.SKU_ID}: ${p.Kondisi}`).join(', ')}
            {problemItems.length > 5 ? ` dan ${problemItems.length - 5} lainnya...` : ''}). Video evidence di Google Drive dapat digunakan sebagai bukti otentik sanggahan klaim retur.
          </p>
          {onNavigateToDisputes && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onNavigateToDisputes}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Buka Formulir Aju Banding CS ({problemItems.length} Kasus Kerusakan)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS IN-APP (PENGGANTI WINDOW.CONFIRM YANG TERBLOKIR DI IFRAME) */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-rose-100 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold tracking-wide uppercase border border-rose-200">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Otoritas Super Admin</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {deleteTarget.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Tindakan ini permanen. Data yang dihapus tidak dapat dipulihkan.
                </p>
              </div>
            </div>

            {/* Detail data yang ditargetkan untuk dihapus */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
              {deleteTarget.type === 'single_order' && (
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Order ID yang akan dihapus:</div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {deleteTarget.orderId}
                  </div>
                  {deleteTarget.count !== undefined && (
                    <div className="text-[11px] text-slate-600 mt-1">
                      Total produk: <strong>{deleteTarget.count} Unit barang</strong>
                    </div>
                  )}
                </div>
              )}

              {deleteTarget.type === 'single_row' && (
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Baris SKU yang akan dihapus:</div>
                  <div className="font-mono font-bold text-[#0F766E] text-xs mt-0.5">
                    {deleteTarget.skuId}
                  </div>
                  {deleteTarget.skuName && (
                    <div className="text-slate-800 font-semibold text-xs mt-0.5">
                      {deleteTarget.skuName}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1">
                    Dari Order ID: <span className="font-mono font-bold text-slate-700">{deleteTarget.orderId}</span>
                  </div>
                </div>
              )}

              {deleteTarget.type === 'bulk_orders' && (
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Jumlah Order ID terpilih:</div>
                  <div className="font-mono font-bold text-rose-600 text-base mt-0.5">
                    {deleteTarget.orderIds?.length || 0} Order ID
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 line-clamp-2 font-mono">
                    {deleteTarget.orderIds?.slice(0, 5).join(', ')}
                    {(deleteTarget.orderIds?.length || 0) > 5 ? ' ...dan lainnya' : ''}
                  </div>
                </div>
              )}

              {deleteTarget.type === 'bulk_rows' && (
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Jumlah baris SKU terpilih:</div>
                  <div className="font-mono font-bold text-rose-600 text-base mt-0.5">
                    {deleteTarget.rowKeys?.length || 0} Baris SKU
                  </div>
                </div>
              )}
            </div>

            <div className="text-[11px] text-rose-700 bg-rose-50/80 p-3 rounded-xl border border-rose-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>
                Data akan segera dihapus dari tabel dan penyimpanan lokal. Pastikan Anda telah memeriksa kembali data ini sebelum melanjutkan.
              </span>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFIKASI TOAST SUKSES AKSI */}
      {actionSuccessNotice && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-700 flex items-center space-x-2 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessNotice}</span>
        </div>
      )}

      {/* MODAL EKSPOR DENGAN FILTER MULTI-KRITERIA */}
      <ExportFilteredModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        rows={rows}
      />
    </div>
  );
};
