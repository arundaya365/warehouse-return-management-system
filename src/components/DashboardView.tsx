import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  CalendarDays,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  FileSpreadsheet,
  ArrowRight,
  Video,
  Download,
  Filter,
  BarChart3,
  Percent,
  Coins,
  DollarSign,
  Truck,
  ShoppingBag,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Share2
} from 'lucide-react';
import { ProcessedReturnRow, StandardKondisi } from '../processor';
import { MasterSKUItem, formatRupiah } from '../utils/excelTemplate';
import { useLanguage } from '../context/LanguageContext';
import { RmaClaimRecord, RMA_STAGE_LABELS } from '../types/rma';

interface DashboardViewProps {
  rows: ProcessedReturnRow[];
  masterDatabase?: MasterSKUItem[];
  onNavigateToStation: () => void;
  onNavigateToReports: () => void;
  onNavigateToDisputes: () => void;
  onNavigateToRma?: () => void;
  rmaClaims?: RmaClaimRecord[];
}

type TrendMode = 'daily' | 'monthly';
type DailyRange = 7 | 14 | 30 | 0; // 0 = all days

export const DashboardView: React.FC<DashboardViewProps> = ({
  rows,
  masterDatabase = [],
  onNavigateToStation,
  onNavigateToReports,
  onNavigateToDisputes,
  onNavigateToRma,
  rmaClaims = []
}) => {
  const { t, isEn, language } = useLanguage();

  // State: Trend view mode (Harian vs Bulanan)
  const [trendMode, setTrendMode] = useState<TrendMode>('daily');
  const [dailyRange, setDailyRange] = useState<DailyRange>(14);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Price lookup helper
  const lookupItemPrice = (skuId: string): number => {
    if (!masterDatabase || masterDatabase.length === 0) return 150000;
    const match = masterDatabase.find(
      (m) =>
        m.SKU_ID.trim().toUpperCase() === (skuId || '').trim().toUpperCase() ||
        m.BARCODE.trim() === (skuId || '').trim()
    );
    return match?.HARGA || 150000;
  };

  // Helper date extractor
  const extractDate = (dt?: string): string => {
    if (!dt) return '';
    const match = dt.match(/^(\d{4}[-/]\d{2}[-/]\d{2})/);
    if (match) return match[1].replace(/\//g, '-');
    return dt.split(' ')[0] || '';
  };

  // Helper month extractor YYYY-MM
  const extractYearMonth = (dt?: string): string => {
    const d = extractDate(dt);
    if (!d || d.length < 7) return '';
    return d.substring(0, 7);
  };

  // =========================================================================
  // 1. HIGH-LEVEL KPI METRICS
  // ==========================================
  const kpiData = useMemo(() => {
    const totalItems = rows.length;

    let goodCount = 0;
    let damagePackagingCount = 0;
    let damageProductCount = 0;
    let missingCount = 0;
    let unexpectedCount = 0;
    let totalReturnGoodsValue = 0;

    rows.forEach((r) => {
      const price = lookupItemPrice(r.SKU_ID);
      totalReturnGoodsValue += price;

      if (r.Kondisi === 'Good') goodCount++;
      else if (r.Kondisi === 'Damage Packaging') damagePackagingCount++;
      else if (r.Kondisi === 'Missing' || r.Kondisi === 'Missing Item') missingCount++;
      else if (r.Kondisi === 'Unexpected' || r.Kondisi === 'Wrong Item') unexpectedCount++;
      else damageProductCount++;
    });

    const totalDefectsAndLosses = damagePackagingCount + damageProductCount + missingCount + unexpectedCount;
    const defectRatePct = totalItems > 0 ? ((totalDefectsAndLosses / totalItems) * 100).toFixed(1) : '0';
    const goodRatePct = totalItems > 0 ? ((goodCount / totalItems) * 100).toFixed(1) : '0';

    // Ambil data dispute dari localStorage untuk nilai klaim riil
    let totalClaimAmount = 0;
    let totalSettlementApproved = 0;
    try {
      const saved = localStorage.getItem('rma_cs_dispute_claims_v1');
      if (saved) {
        const records = JSON.parse(saved);
        Object.values(records).forEach((rec: any) => {
          if (rec?.claimAmount) totalClaimAmount += Number(rec.claimAmount) || 0;
          if (rec?.settlementAmount) totalSettlementApproved += Number(rec.settlementAmount) || 0;
          else if (rec?.claimStatus === 'APPROVED' && rec?.claimAmount) {
            totalSettlementApproved += Number(rec.claimAmount) || 0;
          }
        });
      }
    } catch {}

    const totalDamagedGoodsValue = rows
      .filter((r) => r.Kondisi !== 'Good')
      .reduce((acc, curr) => acc + lookupItemPrice(curr.SKU_ID), 0);

    // Ambil data RMA klaim logistik
    let effectiveRmaClaims = rmaClaims;
    if (!effectiveRmaClaims || effectiveRmaClaims.length === 0) {
      try {
        const savedRma = localStorage.getItem('rma_claims_records_v1');
        if (savedRma) {
          const parsed = JSON.parse(savedRma);
          if (Array.isArray(parsed)) effectiveRmaClaims = parsed;
        }
      } catch {}
    }

    const distinctOrdersSet = new Set(rows.map((r) => r.Order_ID).filter(Boolean));
    (effectiveRmaClaims || []).forEach((c) => {
      if (c.orderId) distinctOrdersSet.add(c.orderId);
    });
    const totalOrders = distinctOrdersSet.size;

    const rmaTotalCount = effectiveRmaClaims.length;
    const rmaCompletedCount = effectiveRmaClaims.filter((c) => c.stageStatus === 'SELESAI').length;
    const rmaInvestigatingCount = effectiveRmaClaims.filter((c) => c.stageStatus === 'INVESTIGASI').length;
    const rmaTransferredCount = effectiveRmaClaims.filter((c) => c.stageStatus === 'DIALIHKAN_KE_RMA').length;
    const rmaReceivedCsCount = effectiveRmaClaims.filter((c) => c.stageStatus === 'DITERIMA_CS').length;
    const rmaTotalEstimated = effectiveRmaClaims.reduce((sum, c) => sum + (c.estimatedCompensation || 0), 0);
    
    // Nilai kompensasi RMA diperhitungkan saat status klaim sudah Selesai (sesuai konfirmasi user)
    const rmaApprovedSettlement = effectiveRmaClaims
      .filter((c) => c.stageStatus === 'SELESAI')
      .reduce((sum, c) => sum + (c.approvedCompensation || 0), 0);

    const csSettlementApproved = totalSettlementApproved;
    const combinedSettlementApproved = csSettlementApproved + rmaApprovedSettlement;

    const recoveryRatePct =
      totalDamagedGoodsValue > 0
        ? Math.min(100, Math.round((combinedSettlementApproved / totalDamagedGoodsValue) * 100))
        : 0;

    return {
      totalItems,
      totalOrders,
      goodCount,
      damagePackagingCount,
      damageProductCount,
      missingCount,
      unexpectedCount,
      totalDefectsAndLosses,
      defectRatePct,
      goodRatePct,
      totalReturnGoodsValue,
      totalDamagedGoodsValue,
      totalClaimAmount,
      totalSettlementApproved: combinedSettlementApproved,
      csSettlementApproved,
      rmaApprovedSettlement,
      combinedSettlementApproved,
      recoveryRatePct,
      rmaTotalCount,
      rmaCompletedCount,
      rmaInvestigatingCount,
      rmaTransferredCount,
      rmaReceivedCsCount,
      rmaTotalEstimated
    };
  }, [rows, masterDatabase, rmaClaims]);

  // =========================================================================
  // 2. DAILY TREND CALCULATION (Harian)
  // =========================================================================
  const dailyTrendData = useMemo(() => {
    const dayMap = new Map<
      string,
      {
        date: string;
        total: number;
        good: number;
        damage: number;
        missingUnexpected: number;
        orders: Set<string>;
      }
    >();

    rows.forEach((r) => {
      const dateStr = extractDate(r.Waktu_Proses || r.Video_Timestamp);
      if (!dateStr) return;

      if (!dayMap.has(dateStr)) {
        dayMap.set(dateStr, {
          date: dateStr,
          total: 0,
          good: 0,
          damage: 0,
          missingUnexpected: 0,
          orders: new Set<string>()
        });
      }

      const entry = dayMap.get(dateStr)!;
      entry.total++;
      if (r.Order_ID) entry.orders.add(r.Order_ID);

      if (r.Kondisi === 'Good') {
        entry.good++;
      } else if (r.Kondisi === 'Damage Packaging' || r.Kondisi === 'Damage Product') {
        entry.damage++;
      } else {
        entry.missingUnexpected++;
      }
    });

    let sorted = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    if (dailyRange > 0 && sorted.length > dailyRange) {
      sorted = sorted.slice(-dailyRange);
    }

    const maxTotal = sorted.reduce((max, d) => Math.max(max, d.total), 0) || 1;

    return {
      items: sorted,
      maxTotal
    };
  }, [rows, dailyRange]);

  // =========================================================================
  // 3. MONTHLY TREND CALCULATION (Bulanan)
  // =========================================================================
  const monthlyTrendData = useMemo(() => {
    const monthMap = new Map<
      string,
      {
        yearMonth: string;
        total: number;
        good: number;
        damage: number;
        missingUnexpected: number;
        orders: Set<string>;
        totalValue: number;
      }
    >();

    rows.forEach((r) => {
      const ym = extractYearMonth(r.Waktu_Proses || r.Video_Timestamp);
      if (!ym) return;

      if (!monthMap.has(ym)) {
        monthMap.set(ym, {
          yearMonth: ym,
          total: 0,
          good: 0,
          damage: 0,
          missingUnexpected: 0,
          orders: new Set<string>(),
          totalValue: 0
        });
      }

      const entry = monthMap.get(ym)!;
      entry.total++;
      entry.totalValue += lookupItemPrice(r.SKU_ID);
      if (r.Order_ID) entry.orders.add(r.Order_ID);

      if (r.Kondisi === 'Good') {
        entry.good++;
      } else if (r.Kondisi === 'Damage Packaging' || r.Kondisi === 'Damage Product') {
        entry.damage++;
      } else {
        entry.missingUnexpected++;
      }
    });

    const sorted = Array.from(monthMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    const maxTotal = sorted.reduce((max, d) => Math.max(max, d.total), 0) || 1;

    // Calculate month-over-month growth for latest month
    let momGrowth: number | null = null;
    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2].total;
      const curr = sorted[sorted.length - 1].total;
      if (prev > 0) {
        momGrowth = Math.round(((curr - prev) / prev) * 100);
      }
    }

    return {
      items: sorted,
      maxTotal,
      momGrowth
    };
  }, [rows, masterDatabase]);

  // Format month name label (e.g. 2026-10 -> Okt 2026 or Oct 2026)
  const formatMonthLabel = (ym: string): string => {
    const [year, month] = ym.split('-');
    const mNum = parseInt(month, 10);
    const monthsId = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthsEn = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = isEn ? monthsEn[mNum] || month : monthsId[mNum] || month;
    return `${monthName} ${year}`;
  };

  // Format daily date label (e.g. 2026-10-09 -> 09 Okt or 09 Oct)
  const formatDailyDateLabel = (dateStr: string): string => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const day = parts[2];
    const mNum = parseInt(parts[1], 10);
    const monthsId = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthsEn = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mName = isEn ? monthsEn[mNum] : monthsId[mNum];
    return `${day} ${mName}`;
  };

  // =========================================================================
  // 4. TOP 5 RETURNED SKUS RANKING
  // =========================================================================
  const topSkus = useMemo(() => {
    const skuMap = new Map<
      string,
      {
        skuId: string;
        name: string;
        count: number;
        damageCount: number;
        price: number;
      }
    >();

    rows.forEach((r) => {
      const sku = r.SKU_ID || 'UNKNOWN';
      if (!skuMap.has(sku)) {
        skuMap.set(sku, {
          skuId: sku,
          name: r.Nama_Barang || sku,
          count: 0,
          damageCount: 0,
          price: lookupItemPrice(sku)
        });
      }
      const item = skuMap.get(sku)!;
      item.count++;
      if (r.Kondisi !== 'Good') {
        item.damageCount++;
      }
    });

    return Array.from(skuMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [rows, masterDatabase]);

  // =========================================================================
  // 5. COURIER & MARKETPLACE BREAKDOWN
  // =========================================================================
  const channelBreakdown = useMemo(() => {
    const channels = [
      { name: 'Shopee (SPX)', prefix: 'SHP', color: 'from-orange-500 to-amber-500' },
      { name: 'Tokopedia (J&T/JNE)', prefix: 'TKP', color: 'from-emerald-500 to-teal-500' },
      { name: 'TikTok Shop', prefix: 'TTK', color: 'from-rose-500 to-pink-500' },
      { name: 'Lazada (Ninja)', prefix: 'LZD', color: 'from-blue-500 to-indigo-500' },
      { name: 'Blibli & Lainnya', prefix: 'BLI', color: 'from-teal-600 to-slate-700' }
    ];

    return channels.map((c) => {
      const matchRows = rows.filter((r) => {
        const oid = (r.Order_ID || '').toUpperCase();
        if (c.prefix === 'BLI') {
          return oid.startsWith('BLI') || (!oid.startsWith('SHP') && !oid.startsWith('TKP') && !oid.startsWith('TTK') && !oid.startsWith('LZD'));
        }
        return oid.startsWith(c.prefix);
      });

      const total = matchRows.length;
      const damage = matchRows.filter((r) => r.Kondisi !== 'Good').length;
      const damageRate = total > 0 ? Math.round((damage / total) * 100) : 0;
      const sharePct = rows.length > 0 ? Math.round((total / rows.length) * 100) : 0;

      return {
        ...c,
        total,
        damage,
        damageRate,
        sharePct
      };
    });
  }, [rows]);

  // Memoized recent RMA Claims untuk Kartu Aktivitas Dashboard
  const recentRmaClaims = useMemo(() => {
    let list = rmaClaims;
    if (!list || list.length === 0) {
      try {
        const savedRma = localStorage.getItem('rma_claims_records_v1');
        if (savedRma) {
          const parsed = JSON.parse(savedRma);
          if (Array.isArray(parsed)) list = parsed;
        }
      } catch {}
    }
    return [...(list || [])]
      .sort((a, b) => new Date(b.updatedAt || b.forwardedAt).getTime() - new Date(a.updatedAt || a.forwardedAt).getTime())
      .slice(0, 5);
  }, [rmaClaims]);

  // =========================================================================
  // 6. EXPORT DASHBOARD SUMMARY CSV
  // =========================================================================
  const handleExportSummaryCsv = () => {
    const csvRows = [
      ['DASHBOARD RINGKASAN RETUR WAREHOUSE UNBOXDESK'],
      ['Waktu Export', new Date().toLocaleString()],
      ['Total Pesanan Retur', kpiData.totalOrders],
      ['Total Unit Retur', kpiData.totalItems],
      ['Rasio Kerusakan & Hilang', `${kpiData.defectRatePct}%`],
      ['Total Estimasi Nilai Barang Retur (IDR)', kpiData.totalReturnGoodsValue],
      ['Total Nilai Barang Kerusakan (IDR)', kpiData.totalDamagedGoodsValue],
      ['Realisasi Klaim Disetujui (IDR)', kpiData.totalSettlementApproved],
      [],
      ['TREN BULANAN RETUR'],
      ['Bulan', 'Total Unit Retur', 'Kondisi Baik', 'Kerusakan Kemasan/Produk', 'Hilang/Salah', 'Total Nilai (IDR)']
    ];

    monthlyTrendData.items.forEach((m) => {
      csvRows.push([
        m.yearMonth,
        m.total,
        m.good,
        m.damage,
        m.missingUnexpected,
        m.totalValue
      ]);
    });

    const csvContent = csvRows.map((e) => e.join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SUMMARY_DASHBOARD_RETUR_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ======================================================================= */}
      {/* 1. TOP HERO HEADER & CONTROLS                                           */}
      {/* ======================================================================= */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0F766E] flex items-center justify-center text-white shadow-md shadow-teal-900/15 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                {t('dash_title')}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0FDFA] text-[#0F766E] border border-teal-200">
                {kpiData.totalItems} {isEn ? 'Total Return Units' : 'Total Unit Retur'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5 max-w-2xl">
              {t('dash_subtitle')}
            </p>
          </div>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center space-x-2 gap-y-2 shrink-0">
          <button
            onClick={handleExportSummaryCsv}
            className="py-2.5 px-3.5 rounded-2xl bg-white hover:bg-[#F0FDFA] text-[#134E4A] font-medium text-xs sm:text-sm border border-[#E2E8F0] shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Download ringkasan metrik dashboard ke format CSV / Excel"
          >
            <Download className="w-4 h-4 text-[#0F766E]" />
            <span>{isEn ? 'Export Summary' : 'Unduh Ringkasan'}</span>
          </button>

          {onNavigateToRma && (
            <button
              onClick={onNavigateToRma}
              className="py-2.5 px-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs sm:text-sm border border-indigo-200 shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
              title="Buka modul eskalasi klaim logistik RMA"
            >
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>RMA Claim</span>
            </button>
          )}

          <button
            onClick={onNavigateToStation}
            className="py-2.5 px-4 rounded-2xl bg-[#0F766E] hover:bg-[#115E59] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center space-x-2 active:scale-95 cursor-pointer shrink-0"
          >
            <Video className="w-4 h-4" />
            <span>{t('dash_action_new_unboxing')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 2. TOP KPI CARDS (5 HIGH-DENSITY METRICS)                               */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Pesanan Retur */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/90 border border-slate-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-700 text-xs font-bold">
            <span>{t('dash_kpi_total_orders')}</span>
            <Package className="w-4 h-4 text-[#0F766E]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {kpiData.totalOrders} <span className="text-xs font-normal text-slate-500">{isEn ? 'orders' : 'pesanan'}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {kpiData.totalItems} {isEn ? 'total units inspected' : 'total unit terverifikasi'}
          </div>
          {kpiData.rmaTotalCount > 0 && (
            <div className="text-[10px] text-indigo-700 font-semibold pt-1 border-t border-slate-200 flex items-center justify-between">
              <span>Eskalasi RMA:</span>
              <span className="font-mono font-bold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                {kpiData.rmaTotalCount} Kasus
              </span>
            </div>
          )}
        </div>

        {/* Card 2: Total Unit Barang Retur */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-blue-50/60 border border-indigo-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-indigo-700 text-xs font-bold">
            <span>{t('dash_kpi_total_items')}</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-950 font-mono">
            {kpiData.totalItems} <span className="text-xs font-normal text-indigo-700">Pcs</span>
          </div>
          <div className="text-[11px] text-indigo-700 font-medium flex items-center space-x-1">
            <span>{kpiData.goodCount} Baik ({kpiData.goodRatePct}%)</span>
          </div>
        </div>

        {/* Card 3: Rasio Kerusakan & Defect Rate */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/90 to-amber-50/60 border border-rose-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-rose-700 text-xs font-bold">
            <span>{t('dash_kpi_damage_rate')}</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-950 font-mono">
            {kpiData.defectRatePct}%
          </div>
          <div className="text-[11px] text-rose-700 font-medium">
            {kpiData.totalDefectsAndLosses} {isEn ? 'damaged / lost items' : 'barang rusak / hilang'}
          </div>
        </div>

        {/* Card 4: Estimasi Total Nilai Retur */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-orange-50/60 border border-amber-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold">
            <span>{t('dash_kpi_est_value')}</span>
            <Coins className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-950 font-mono truncate" title={formatRupiah(kpiData.totalReturnGoodsValue)}>
            {formatRupiah(kpiData.totalReturnGoodsValue)}
          </div>
          <div className="text-[11px] text-amber-800 font-medium">
            Kerugian: <span className="font-mono font-bold text-rose-700">{formatRupiah(kpiData.totalDamagedGoodsValue)}</span>
          </div>
          {kpiData.rmaTotalEstimated > 0 && (
            <div className="text-[10px] text-amber-900/80 pt-1 border-t border-amber-200 flex items-center justify-between">
              <span>Tuntutan RMA:</span>
              <span className="font-mono font-bold text-amber-900">{formatRupiah(kpiData.rmaTotalEstimated)}</span>
            </div>
          )}
        </div>

        {/* Card 5: Tingkat Pencairan Klaim Ekspedisi & RMA */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/60 border border-emerald-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold">
            <span>{t('dash_kpi_recovery_rate')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-950 font-mono">
            {kpiData.recoveryRatePct}%
          </div>
          <div className="text-[11px] text-emerald-800 font-semibold truncate" title={`Total Cair Gabungan: ${formatRupiah(kpiData.combinedSettlementApproved)}`}>
            {formatRupiah(kpiData.combinedSettlementApproved)} {isEn ? 'recovered' : 'cair'}
          </div>
          {/* Rincian Kontribusi CS vs RMA */}
          <div className="text-[10px] text-emerald-900 font-medium pt-1 border-t border-emerald-200/80 flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">CS Selesai:</span>
              <span className="font-mono font-bold text-emerald-700">{formatRupiah(kpiData.csSettlementApproved)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">RMA Selesai:</span>
              <span className="font-mono font-bold text-indigo-700">{formatRupiah(kpiData.rmaApprovedSettlement)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 2B. BANNER RINGKASAN PEMULIHAN SENGKETA LOGISTIK (CS & RMA CLAIM)      */}
      {/* ======================================================================= */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 border border-indigo-100 bg-gradient-to-r from-white via-indigo-50/30 to-teal-50/30 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0 shadow-2xs">
            <Truck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Penyelamatan Aset & Pemulihan Sengketa Logistik (CS & RMA)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Recovery {kpiData.recoveryRatePct}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Hasil klaim dicairkan: CS Dispute <strong className="font-mono text-emerald-700 font-bold">{formatRupiah(kpiData.csSettlementApproved)}</strong> + RMA Logistik <strong className="font-mono text-indigo-700 font-bold">{formatRupiah(kpiData.rmaApprovedSettlement)}</strong> = Total <strong className="font-mono text-slate-900 font-bold">{formatRupiah(kpiData.combinedSettlementApproved)}</strong> dari beban kerusakan barang {formatRupiah(kpiData.totalDamagedGoodsValue)}.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={onNavigateToDisputes}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 transition-all flex items-center space-x-1 cursor-pointer shadow-2xs"
          >
            <span>Klaim CS ({kpiData.totalClaimAmount > 0 ? formatRupiah(kpiData.csSettlementApproved) : 'Buka'})</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </button>
          {onNavigateToRma && (
            <button
              type="button"
              onClick={onNavigateToRma}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>RMA Claim ({kpiData.rmaCompletedCount} Selesai · {kpiData.rmaInvestigatingCount} Investigasi)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. CORE SECTION: TREN HARIAN & TREN BULANAN (INTERACTIVE VISUALIZER)    */}
      {/* ======================================================================= */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(76,29,149,0.18)] space-y-4">
        {/* Trend Section Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDFA] text-[#0F766E] border border-teal-200 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                {t('dash_trend_title')}
              </h2>
              <p className="text-xs text-[#64748B]">
                {trendMode === 'daily'
                  ? (isEn ? 'Daily unboxing return volume distribution' : 'Distribusi volume retur harian berdasarkan hasil scan unboxing')
                  : (isEn ? 'Month-over-month return volume and defect trends' : 'Tren volume retur bulanan & perbandingan MoM antar bulan')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* SEGMENTED SWITCHER: TREN HARIAN VS TREN BULANAN */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
              <button
                type="button"
                onClick={() => setTrendMode('daily')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  trendMode === 'daily'
                    ? 'bg-white text-[#0F766E] shadow-xs border border-teal-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>{t('dash_trend_daily')}</span>
              </button>
              <button
                type="button"
                onClick={() => setTrendMode('monthly')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  trendMode === 'monthly'
                    ? 'bg-white text-[#0F766E] shadow-xs border border-teal-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>{t('dash_trend_monthly')}</span>
              </button>
            </div>

            {/* Daily range selector if Daily mode active */}
            {trendMode === 'daily' && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                {([7, 14, 30] as DailyRange[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setDailyRange(range)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      dailyRange === range
                        ? 'bg-white text-[#0F766E] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {range}d
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Legend Indicator */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2 pt-1">
          <div className="flex items-center space-x-4 flex-wrap">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-md bg-[#059669]" />
              <span>{isEn ? 'Good Condition' : 'Kondisi Baik'}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-md bg-[#B45309]" />
              <span>{isEn ? 'Damaged (Pkg/Product)' : 'Kerusakan (Kemasan/Produk)'}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-md bg-[#DC2626]" />
              <span>{isEn ? 'Missing / Unexpected' : 'Hilang / Salah Kirim'}</span>
            </div>
          </div>

          {trendMode === 'monthly' && monthlyTrendData.momGrowth !== null && (
            <div className="flex items-center space-x-1.5 font-semibold text-slate-700">
              <span>{isEn ? 'Latest MoM Trend:' : 'Tren MoM Terakhir:'}</span>
              <span
                className={`inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                  monthlyTrendData.momGrowth >= 0
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {monthlyTrendData.momGrowth >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                <span>{Math.abs(monthlyTrendData.momGrowth)}%</span>
              </span>
            </div>
          )}
        </div>

        {/* INTERACTIVE CHART CONTAINER */}
        <div className="pt-2">
          {trendMode === 'daily' ? (
            /* ========================================================================= */
            /* A. DAILY BAR VISUALIZATION                                                */
            /* ========================================================================= */
            <div className="space-y-2">
              <div className="h-60 sm:h-72 w-full flex items-end gap-1.5 sm:gap-3 pt-6 pb-2 px-2 bg-slate-50/70 rounded-2xl border border-slate-200/80 relative">
                {dailyTrendData.items.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs italic">
                    {isEn ? 'No return entries in selected daily range.' : 'Belum ada data retur pada rentang harian yang dipilih.'}
                  </div>
                ) : (
                  dailyTrendData.items.map((item, idx) => {
                    const heightPercent = Math.max(12, Math.round((item.total / dailyTrendData.maxTotal) * 100));
                    const isHovered = hoveredBarIndex === idx;

                    return (
                      <div
                        key={item.date}
                        className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        {/* Tooltip on Hover */}
                        {isHovered && (
                          <div className="absolute -top-24 z-30 bg-slate-900 text-white p-2.5 rounded-xl text-[11px] shadow-xl pointer-events-none whitespace-nowrap border border-slate-700 animate-fade-in">
                            <div className="font-semibold text-teal-300 font-mono">{formatDailyDateLabel(item.date)}</div>
                            <div className="font-bold text-sm">{item.total} Unit ({item.orders.size} Order)</div>
                            <div className="text-emerald-400">✓ Baik: {item.good}</div>
                            <div className="text-amber-400">⚠ Rusak: {item.damage}</div>
                            <div className="text-rose-400">✕ Hilang/Salah: {item.missingUnexpected}</div>
                          </div>
                        )}

                        {/* Top bar value count */}
                        <span className="text-[10px] font-mono font-bold text-slate-600 mb-1">
                          {item.total}
                        </span>

                        {/* Stacked Bar */}
                        <div
                          className="w-full max-w-[36px] rounded-t-lg overflow-hidden flex flex-col justify-end transition-all duration-300 shadow-sm"
                          style={{ height: `${heightPercent}%` }}
                        >
                          {/* Missing / Unexpected segment */}
                          {item.missingUnexpected > 0 && (
                            <div
                              style={{ height: `${(item.missingUnexpected / item.total) * 100}%` }}
                              className="w-full bg-[#DC2626]"
                              title={`Hilang/Salah: ${item.missingUnexpected}`}
                            />
                          )}
                          {/* Damage segment */}
                          {item.damage > 0 && (
                            <div
                              style={{ height: `${(item.damage / item.total) * 100}%` }}
                              className="w-full bg-[#B45309]"
                              title={`Rusak: ${item.damage}`}
                            />
                          )}
                          {/* Good segment */}
                          {item.good > 0 && (
                            <div
                              style={{ height: `${(item.good / item.total) * 100}%` }}
                              className="w-full bg-[#059669]"
                              title={`Baik: ${item.good}`}
                            />
                          )}
                        </div>

                        {/* Bottom Date Label */}
                        <span className="text-[10px] font-mono font-medium text-slate-500 mt-2 truncate max-w-full">
                          {item.date.slice(8)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400 px-2 font-mono">
                <span>← {isEn ? 'Earlier' : 'Tanggal Sebelumnya'}</span>
                <span>{isEn ? 'Daily Retur Units Trend' : 'Tren Unit Retur Harian'}</span>
                <span>{isEn ? 'Latest' : 'Hari Ini'} →</span>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* B. MONTHLY BAR VISUALIZATION                                              */
            /* ========================================================================= */
            <div className="space-y-2">
              <div className="h-60 sm:h-72 w-full flex items-end gap-3 sm:gap-6 pt-6 pb-2 px-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 relative">
                {monthlyTrendData.items.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs italic">
                    {isEn ? 'No monthly return data found.' : 'Belum ada data retur bulanan.'}
                  </div>
                ) : (
                  monthlyTrendData.items.map((item, idx) => {
                    const heightPercent = Math.max(15, Math.round((item.total / monthlyTrendData.maxTotal) * 100));
                    const isHovered = hoveredBarIndex === idx;

                    return (
                      <div
                        key={item.yearMonth}
                        className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
                        onMouseEnter={() => setHoveredBarIndex(idx)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        {/* Tooltip on Hover */}
                        {isHovered && (
                          <div className="absolute -top-28 z-30 bg-slate-900 text-white p-3 rounded-xl text-[11px] shadow-xl pointer-events-none whitespace-nowrap border border-slate-700 animate-fade-in">
                            <div className="font-semibold text-teal-300">{formatMonthLabel(item.yearMonth)}</div>
                            <div className="font-bold text-sm">{item.total} Unit ({item.orders.size} Order)</div>
                            <div className="text-emerald-400">✓ Baik: {item.good}</div>
                            <div className="text-amber-400">⚠ Rusak: {item.damage}</div>
                            <div className="text-rose-400">✕ Hilang/Salah: {item.missingUnexpected}</div>
                            <div className="text-slate-300 font-mono mt-1 pt-1 border-t border-slate-700">
                              Estimasi Nilai: {formatRupiah(item.totalValue)}
                            </div>
                          </div>
                        )}

                        {/* Top bar value */}
                        <span className="text-[11px] font-mono font-bold text-slate-700 mb-1">
                          {item.total}
                        </span>

                        {/* Stacked Monthly Bar */}
                        <div
                          className="w-full max-w-[54px] rounded-t-xl overflow-hidden flex flex-col justify-end transition-all duration-300 shadow-md"
                          style={{ height: `${heightPercent}%` }}
                        >
                          {/* Missing / Unexpected */}
                          {item.missingUnexpected > 0 && (
                            <div
                              style={{ height: `${(item.missingUnexpected / item.total) * 100}%` }}
                              className="w-full bg-[#DC2626]"
                            />
                          )}
                          {/* Damage */}
                          {item.damage > 0 && (
                            <div
                              style={{ height: `${(item.damage / item.total) * 100}%` }}
                              className="w-full bg-[#B45309]"
                            />
                          )}
                          {/* Good */}
                          {item.good > 0 && (
                            <div
                              style={{ height: `${(item.good / item.total) * 100}%` }}
                              className="w-full bg-[#059669]"
                            />
                          )}
                        </div>

                        {/* Bottom Month Label */}
                        <span className="text-xs font-semibold text-slate-700 mt-2 truncate max-w-full">
                          {formatMonthLabel(item.yearMonth)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400 px-2 font-mono">
                <span>← {isEn ? 'Past Months' : 'Bulan Lalu'}</span>
                <span>{isEn ? 'Monthly Return Aggregation' : 'Rekapitulasi Retur Bulanan'}</span>
                <span>{isEn ? 'Current Month' : 'Bulan Berjalan'} →</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 4. DUAL BREAKDOWN: KONDISI RETUR & KANAL EKSPEDISI                      */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Box A: Distribusi Kondisi Barang Retur */}
        <div className="glass-card rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <Percent className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {t('dash_cond_distribution')}
              </h3>
            </div>
            <button
              onClick={onNavigateToDisputes}
              className="text-xs font-bold text-rose-700 hover:text-rose-800 flex items-center space-x-1 cursor-pointer"
            >
              <span>{isEn ? 'View Damage Claims' : 'Lihat Kasus Rusak'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Condition Breakdown List with Visual Bar */}
          <div className="space-y-3 text-xs">
            {/* 1. Good */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-800 flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Baik (Good Condition)</span>
                </span>
                <span className="font-mono text-slate-700">
                  {kpiData.goodCount} Unit ({kpiData.goodRatePct}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${kpiData.goodRatePct}%` }}
                />
              </div>
            </div>

            {/* 2. Damage Packaging */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-800 flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Rusak Kemasan (Damage Packaging)</span>
                </span>
                <span className="font-mono text-slate-700">
                  {kpiData.damagePackagingCount} Unit ({kpiData.totalItems > 0 ? ((kpiData.damagePackagingCount / kpiData.totalItems) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${kpiData.totalItems > 0 ? (kpiData.damagePackagingCount / kpiData.totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 3. Damage Product */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-800 flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  <span>Cacat / Rusak Produk (Damage Product)</span>
                </span>
                <span className="font-mono text-slate-700">
                  {kpiData.damageProductCount} Unit ({kpiData.totalItems > 0 ? ((kpiData.damageProductCount / kpiData.totalItems) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${kpiData.totalItems > 0 ? (kpiData.damageProductCount / kpiData.totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 4. Missing */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-800 flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
                  <span>Barang Hilang / Tak Lengkap (Missing)</span>
                </span>
                <span className="font-mono text-slate-700">
                  {kpiData.missingCount} Unit ({kpiData.totalItems > 0 ? ((kpiData.missingCount / kpiData.totalItems) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#DC2626] h-full rounded-full transition-all duration-500"
                  style={{ width: `${kpiData.totalItems > 0 ? (kpiData.missingCount / kpiData.totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 5. Unexpected */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-800 flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <span>Salah Kirim / Barang Nyasar (Unexpected)</span>
                </span>
                <span className="font-mono text-slate-700">
                  {kpiData.unexpectedCount} Unit ({kpiData.totalItems > 0 ? ((kpiData.unexpectedCount / kpiData.totalItems) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-slate-700 h-full rounded-full transition-all duration-500"
                  style={{ width: `${kpiData.totalItems > 0 ? (kpiData.unexpectedCount / kpiData.totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Box B: Distribusi Ekspedisi & Marketplace */}
        <div className="glass-card rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Truck className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {t('dash_courier_breakdown')}
              </h3>
            </div>
            <button
              onClick={onNavigateToReports}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer"
            >
              <span>{isEn ? 'Filter by Courier' : 'Filter di Laporan'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            {channelBreakdown.map((item) => (
              <div
                key={item.name}
                className="p-2.5 rounded-2xl bg-white/70 border border-slate-200/70 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`w-3 h-8 rounded-md bg-gradient-to-b ${item.color}`} />
                  <div>
                    <div className="font-bold text-slate-900">{item.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {item.total} {isEn ? 'return items' : 'unit retur'} • Share: {item.sharePct}%
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">
                    {item.damage} Rusak
                  </div>
                  <div className={`text-[10px] font-bold ${item.damageRate > 25 ? 'text-rose-600' : 'text-slate-500'}`}>
                    Rasio Rusak: {item.damageRate}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 4B. KARTU AKTIVITAS & RINGKASAN STATUS KLAIM RMA LOGISTIK               */}
      {/* ======================================================================= */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 shadow-xl border border-indigo-100/90 space-y-4 bg-gradient-to-br from-white via-indigo-50/25 to-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold shadow-2xs shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                  {isEn ? 'RMA Logistics Claim Activity & Status' : 'Aktivitas & Ringkasan Status Klaim RMA Logistik'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {kpiData.rmaTotalCount} {isEn ? 'Total Cases' : 'Total Kasus'}
                </span>
                {kpiData.rmaApprovedSettlement > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Cair: {formatRupiah(kpiData.rmaApprovedSettlement)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEn
                  ? 'Real-time overview of cases forwarded by Customer Service to RMA logistics team for warehouse physical investigation'
                  : 'Monitoring kasus sengketa logistik yang dialihkan Customer Service untuk investigasi fisik gudang dan bukti rekaman unboxing'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {onNavigateToDisputes && (
              <button
                type="button"
                onClick={onNavigateToDisputes}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 transition-all flex items-center space-x-1 cursor-pointer shadow-2xs"
              >
                <span>{isEn ? 'CS Claim List' : 'Klaim CS'}</span>
              </button>
            )}
            {onNavigateToRma && (
              <button
                type="button"
                onClick={onNavigateToRma}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{isEn ? 'Open RMA Claims' : 'Buka RMA Claim'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Status Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">1. Diterima CS</div>
              <div className="text-xl font-mono font-extrabold text-amber-950 mt-0.5">{kpiData.rmaReceivedCsCount}</div>
              <div className="text-[10px] text-amber-700/80 font-medium">Tiket masuk CS</div>
            </div>
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
          </div>

          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">2. Dialihkan ke RMA</div>
              <div className="text-xl font-mono font-extrabold text-indigo-950 mt-0.5">{kpiData.rmaTransferredCount}</div>
              <div className="text-[10px] text-indigo-700/80 font-medium">Diserahkan ke tim RMA</div>
            </div>
            <Truck className="w-5 h-5 text-indigo-500 shrink-0" />
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">3. Investigasi</div>
              <div className="text-xl font-mono font-extrabold text-purple-950 mt-0.5">{kpiData.rmaInvestigatingCount}</div>
              <div className="text-[10px] text-purple-700/80 font-medium">Cek fisik & video</div>
            </div>
            <AlertTriangle className="w-5 h-5 text-purple-500 shrink-0" />
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">4. Selesai & Cair</div>
              <div className="text-xl font-mono font-extrabold text-emerald-950 mt-0.5">{kpiData.rmaCompletedCount}</div>
              <div className="text-[10px] text-emerald-700/90 font-mono font-bold">{formatRupiah(kpiData.rmaApprovedSettlement)}</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          </div>
        </div>

        {/* Daftar Aktivitas Kasus RMA Terkini */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Kasus RMA Terkini ({recentRmaClaims.length})</span>
            {recentRmaClaims.length > 0 && onNavigateToRma && (
              <button
                type="button"
                onClick={onNavigateToRma}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                Lihat Semua Kasus RMA →
              </button>
            )}
          </div>

          {recentRmaClaims.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center space-y-1.5 py-6">
              <Truck className="w-7 h-7 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">Belum ada klaim yang dialihkan dari CS ke Tim RMA</p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Customer Service dapat mengalihkan klaim kerusakan logistik bermasalah ke Tim RMA melalui tombol "Forward ke RMA" di daftar Klaim CS.
              </p>
              {onNavigateToDisputes && (
                <button
                  type="button"
                  onClick={onNavigateToDisputes}
                  className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 cursor-pointer transition-colors"
                >
                  <Share2 className="w-3 h-3" />
                  <span>Buka Klaim CS untuk Forward Kasus</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {recentRmaClaims.map((claim) => {
                const stage = RMA_STAGE_LABELS[claim.stageStatus] || RMA_STAGE_LABELS.DIALIHKAN_KE_RMA;
                return (
                  <div
                    key={claim.id}
                    onClick={() => onNavigateToRma && onNavigateToRma()}
                    className="p-3 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer shadow-2xs group"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold shrink-0 mt-0.5 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-slate-900">{claim.orderId}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {claim.channel}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${stage.badgeColor}`}>
                            {stage.labelId}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {claim.items.length} SKU ({claim.items.map((it) => it.skuId).join(', ')}) • Diteruskan oleh: <strong className="text-slate-700">{claim.forwardedBy}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 text-right">
                      <div>
                        <div className="text-[10px] text-slate-500">
                          {claim.stageStatus === 'SELESAI' ? 'Realisasi Cair:' : 'Estimasi Klaim:'}
                        </div>
                        <div className="font-mono font-bold text-xs text-slate-900">
                          {claim.stageStatus === 'SELESAI' && claim.approvedCompensation !== undefined
                            ? <span className="text-emerald-700">{formatRupiah(claim.approvedCompensation)}</span>
                            : formatRupiah(claim.estimatedCompensation)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onNavigateToRma) onNavigateToRma();
                        }}
                        className="p-1.5 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white transition-colors"
                        title="Buka detail di modul RMA Claim"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="glass-card rounded-3xl overflow-hidden shadow-xl border border-white/80">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">
                {t('dash_top_skus')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEn ? 'SKUs with the highest return frequency and damaged parcel rates' : 'Daftar produk dengan volume retur tertinggi untuk evaluasi QC & supplier'}
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToReports}
            className="text-xs font-semibold text-[#0F766E] hover:text-[#115E59] flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
          >
            <span>{isEn ? 'View in Reports' : 'Buka di Laporan'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/75 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4 font-mono">SKU ID</th>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4 text-center">Total Retur</th>
                <th className="py-3 px-4 text-center">Rasio Rusak</th>
                <th className="py-3 px-4 text-right">Harga Satuan</th>
                <th className="py-3 px-4 text-right">Total Nilai Retur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 bg-white/50">
              {topSkus.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    Belum ada data SKU retur.
                  </td>
                </tr>
              ) : (
                topSkus.map((sku, index) => {
                  const defectPct = sku.count > 0 ? Math.round((sku.damageCount / sku.count) * 100) : 0;
                  const totalValue = sku.count * sku.price;

                  return (
                    <tr key={sku.skuId} className="hover:bg-[#F0FDFA]/60 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                          index === 0
                            ? 'bg-amber-100 text-amber-900 font-black'
                            : index === 1
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          #{index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#0F766E] whitespace-nowrap">
                        {sku.skuId}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {sku.name}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {sku.count} Pcs
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          defectPct > 30
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {defectPct}% ({sku.damageCount} cacat)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                        {formatRupiah(sku.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(totalValue)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
