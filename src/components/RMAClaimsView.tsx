import React, { useState, useMemo, useEffect } from 'react';
import {
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Boxes,
  FileSpreadsheet,
  RotateCcw,
  Video,
  Edit3,
  Check,
  X,
  FileText,
  UserCheck,
  ShieldCheck,
  Info
} from 'lucide-react';
import { RmaClaimRecord, RmaStageStatus, RMA_STAGE_LABELS } from '../types/rma';
import { MasterSKUItem } from '../utils/excelTemplate';
import { useLanguage } from '../context/LanguageContext';
import { useAccount } from '../context/AccountContext';
import { getDirectVideoUrl } from './ResultViewer';
import { syncService } from '../services/dataSyncService';

interface RMAClaimsViewProps {
  rmaClaims: RmaClaimRecord[];
  onUpdateRmaClaim: (updatedClaim: RmaClaimRecord) => void;
  onNavigateToDisputes: () => void;
  masterDatabase?: MasterSKUItem[];
}

export const RMAClaimsView: React.FC<RMAClaimsViewProps> = ({
  rmaClaims = [],
  onUpdateRmaClaim,
  onNavigateToDisputes,
  masterDatabase = []
}) => {
  const { t, isEn } = useLanguage();
  const { currentUser } = useAccount();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<'ALL' | RmaStageStatus>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Modal Update Status Investigasi RMA
  const [editingClaim, setEditingClaim] = useState<RmaClaimRecord | null>(null);
  const [modalStage, setModalStage] = useState<RmaStageStatus>('INVESTIGASI');
  const [modalInvestigator, setModalInvestigator] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalApprovedAmount, setModalApprovedAmount] = useState('');
  const [modalResolutionNote, setModalResolutionNote] = useState('');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Statistik Ringkasan RMA
  const stats = useMemo(() => {
    const totalCount = rmaClaims.length;
    const receivedCsCount = rmaClaims.filter((c) => c.stageStatus === 'DITERIMA_CS').length;
    const transferredCount = rmaClaims.filter((c) => c.stageStatus === 'DIALIHKAN_KE_RMA').length;
    const investigationCount = rmaClaims.filter((c) => c.stageStatus === 'INVESTIGASI').length;
    const completedCount = rmaClaims.filter((c) => c.stageStatus === 'SELESAI').length;

    const totalEstimatedValue = rmaClaims.reduce((sum, c) => sum + (c.estimatedCompensation || 0), 0);
    const totalApprovedValue = rmaClaims.reduce((sum, c) => sum + (c.approvedCompensation || 0), 0);

    return {
      totalCount,
      receivedCsCount,
      transferredCount,
      investigationCount,
      completedCount,
      totalEstimatedValue,
      totalApprovedValue
    };
  }, [rmaClaims]);

  // Ekspedisi / Channel unik
  const availableChannels = useMemo(() => {
    const channels = new Set<string>();
    rmaClaims.forEach((c) => {
      if (c.channel) channels.add(c.channel);
    });
    return Array.from(channels).sort();
  }, [rmaClaims]);

  // Filtering list
  const filteredClaims = useMemo(() => {
    return rmaClaims.filter((claim) => {
      // 1. Filter Tahap
      if (filterStage !== 'ALL' && claim.stageStatus !== filterStage) {
        return false;
      }
      // 2. Filter Channel
      if (filterChannel !== 'ALL' && claim.channel !== filterChannel) {
        return false;
      }
      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchOrderId = claim.orderId.toLowerCase().includes(q);
        const matchAwb = (claim.awb || '').toLowerCase().includes(q);
        const matchForwarder = (claim.forwardedBy || '').toLowerCase().includes(q);
        const matchItems = claim.items.some(
          (item) => item.skuId.toLowerCase().includes(q) || item.namaBarang.toLowerCase().includes(q)
        );
        const matchNotes = (claim.csNotes || '').toLowerCase().includes(q);

        if (!matchOrderId && !matchAwb && !matchForwarder && !matchItems && !matchNotes) {
          return false;
        }
      }
      return true;
    });
  }, [rmaClaims, filterStage, filterChannel, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredClaims.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClaims = filteredClaims.slice(startIndex, startIndex + itemsPerPage);

  const toggleOrderExpand = (id: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenEditModal = (claim: RmaClaimRecord) => {
    setEditingClaim(claim);
    setModalStage(claim.stageStatus);
    setModalInvestigator(claim.rmaInvestigator || currentUser?.fullName || '');
    setModalNotes(claim.investigationNotes || '');
    setModalApprovedAmount(claim.approvedCompensation !== undefined ? String(claim.approvedCompensation) : String(claim.estimatedCompensation || ''));
    setModalResolutionNote(claim.resolutionNote || '');
  };

  const handleSaveModal = () => {
    if (!editingClaim) return;

    const approvedAmt = parseInt(modalApprovedAmount.replace(/[^0-9]/g, ''), 10) || 0;
    const nowIso = new Date().toISOString();

    const updated: RmaClaimRecord = {
      ...editingClaim,
      stageStatus: modalStage,
      rmaInvestigator: modalInvestigator.trim(),
      investigationNotes: modalNotes.trim(),
      approvedCompensation: modalStage === 'SELESAI' ? approvedAmt : editingClaim.approvedCompensation,
      resolutionNote: modalStage === 'SELESAI' ? modalResolutionNote.trim() : editingClaim.resolutionNote,
      resolutionDate: modalStage === 'SELESAI' ? (editingClaim.resolutionDate || nowIso) : undefined,
      updatedAt: nowIso
    };

    onUpdateRmaClaim(updated);
    setEditingClaim(null);
    showToast(`✓ Status klaim RMA Order ${editingClaim.orderId} diperbarui ke "${RMA_STAGE_LABELS[modalStage].labelId}"`);
  };

  // Unduh CSV RMA
  const handleDownloadCsv = () => {
    if (filteredClaims.length === 0) return;

    const headers = [
      'Order_ID',
      'AWB',
      'Channel_Ekspedisi',
      'Status_Tahap_RMA',
      'Diteruskan_Oleh_CS',
      'Waktu_Pelimpahan',
      'Estimasi_Ganti_Rugi_IDR',
      'Realisasi_Ganti_Rugi_IDR',
      'Petugas_Investigasi_RMA',
      'Catatan_CS',
      'Catatan_Investigasi_RMA',
      'Catatan_Resolusi',
      'Nama_File_Video',
      'Link_Video_Drive'
    ];

    const csvRows = filteredClaims.map((c) => [
      `"${c.orderId.replace(/"/g, '""')}"`,
      `"${(c.awb || '').replace(/"/g, '""')}"`,
      `"${c.channel.replace(/"/g, '""')}"`,
      `"${RMA_STAGE_LABELS[c.stageStatus].labelId.replace(/"/g, '""')}"`,
      `"${c.forwardedBy.replace(/"/g, '""')}"`,
      `"${c.forwardedAt.replace(/"/g, '""')}"`,
      c.estimatedCompensation || 0,
      c.approvedCompensation || 0,
      `"${(c.rmaInvestigator || '').replace(/"/g, '""')}"`,
      `"${(c.csNotes || '').replace(/"/g, '""')}"`,
      `"${(c.investigationNotes || '').replace(/"/g, '""')}"`,
      `"${(c.resolutionNote || '').replace(/"/g, '""')}"`,
      `"${(c.namaFileVideo || '').replace(/"/g, '""')}"`,
      `"${(c.linkVideo || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REKAP_RMA_CLAIMS_${filteredClaims.length}Kasus.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ Berhasil mengunduh rekap CSV RMA (${filteredClaims.length} kasus)`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header & Summary Statistics Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <span>RMA Claim & Klaim Logistik</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Eskalasi CS
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Peralihan tanggung jawab klaim ekspedisi & logistik yang tidak dapat diselesaikan oleh Customer Service.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onNavigateToDisputes}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <span>← Kembali ke CS Claim</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={filteredClaims.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh CSV RMA</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Kasus */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Kasus RMA</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{stats.totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Diteruskan dari CS</div>
        </div>

        {/* Diterima CS */}
        <div className="p-3.5 rounded-2xl bg-white border border-amber-200 shadow-2xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Diterima CS</div>
          <div className="text-xl font-extrabold text-amber-900 mt-1 font-mono">{stats.receivedCsCount}</div>
          <div className="text-[10px] text-amber-600 mt-0.5 font-medium">Tahap awal pencatatan</div>
        </div>

        {/* Dialihkan ke RMA */}
        <div className="p-3.5 rounded-2xl bg-white border border-indigo-200 shadow-2xs">
          <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Dialihkan ke RMA</div>
          <div className="text-xl font-extrabold text-indigo-900 mt-1 font-mono">{stats.transferredCount}</div>
          <div className="text-[10px] text-indigo-600 mt-0.5 font-medium">Siap ditangani Tim RMA</div>
        </div>

        {/* Dalam Investigasi */}
        <div className="p-3.5 rounded-2xl bg-white border border-blue-200 shadow-2xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Investigasi</div>
          <div className="text-xl font-extrabold text-blue-900 mt-1 font-mono">{stats.investigationCount}</div>
          <div className="text-[10px] text-blue-600 mt-0.5 font-medium">Verifikasi fisik & logistik</div>
        </div>

        {/* Selesai & Realisasi */}
        <div className="p-3.5 rounded-2xl bg-white border border-emerald-200 shadow-2xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Selesai</div>
          <div className="text-xl font-extrabold text-emerald-900 mt-1 font-mono">{stats.completedCount}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5 font-medium truncate" title={`Cair: ${formatRupiah(stats.totalApprovedValue)}`}>
            Realisasi: {formatRupiah(stats.totalApprovedValue)}
          </div>
        </div>
      </div>

      {/* 3. Filter Controls & Search */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari Order ID, AWB, SKU, nama barang, atau nama CS..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Channel Ekspedisi */}
          {availableChannels.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold text-slate-600">Ekspedisi:</span>
              <select
                value={filterChannel}
                onChange={(e) => {
                  setFilterChannel(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              >
                <option value="ALL">Semua Ekspedisi</option>
                {availableChannels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Segmented Status Tabs (Diterima CS -> Dialihkan ke Team RMA -> Investigasi -> Selesai) */}
        <div>
          <div className="text-[11px] font-bold text-slate-700 mb-1.5">Tahapan Pemrosesan RMA:</div>
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setFilterStage('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterStage === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Kasus ({rmaClaims.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStage('DITERIMA_CS');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterStage === 'DITERIMA_CS'
                  ? 'bg-amber-500 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Diterima CS ({stats.receivedCsCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStage('DIALIHKAN_KE_RMA');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterStage === 'DIALIHKAN_KE_RMA'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Case Dialihkan ke Team RMA ({stats.transferredCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStage('INVESTIGASI');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterStage === 'INVESTIGASI'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Investigasi ({stats.investigationCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStage('SELESAI');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterStage === 'SELESAI'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Selesai ({stats.completedCount})
            </button>
          </div>
        </div>
      </div>

      {/* 4. Claims Table / Cards */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {paginatedClaims.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Belum Ada Klaim di Tahap Ini</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {rmaClaims.length === 0
                ? 'Belum ada klaim yang diteruskan oleh Customer Service dari tab CS Claim.'
                : 'Tidak ada data yang cocok dengan kriteria filter atau pencarian Anda.'}
            </p>
            {rmaClaims.length === 0 && (
              <button
                type="button"
                onClick={onNavigateToDisputes}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
              >
                <span>Buka CS Claim List untuk Meneruskan Kasus</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 w-12 text-center">No</th>
                  <th className="py-2.5 px-3 w-48">Order ID & Ekspedisi</th>
                  <th className="py-2.5 px-3 w-40">Pelimpahan CS</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Barang & Kerusakan</th>
                  <th className="py-2.5 px-3 w-36">Estimasi Ganti Rugi</th>
                  <th className="py-2.5 px-3 w-36">Realisasi Logistik</th>
                  <th className="py-2.5 px-3 w-36 text-center">Status Tahap</th>
                  <th className="py-2.5 px-3 w-28 text-center">Aksi RMA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedClaims.map((claim, idx) => {
                  const globalIndex = startIndex + idx + 1;
                  const isExpanded = expandedOrderIds.has(claim.id);
                  const stageInfo = RMA_STAGE_LABELS[claim.stageStatus];

                  return (
                    <React.Fragment key={claim.id}>
                      <tr
                        onClick={() => toggleOrderExpand(claim.id)}
                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        {/* No */}
                        <td className="py-3 px-3 text-center text-slate-500 font-mono font-bold">
                          {globalIndex}
                        </td>

                        {/* Order ID & Ekspedisi */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-extrabold text-slate-900 text-xs select-all">
                              {claim.orderId}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(claim.orderId);
                                showToast(`✓ Order ID ${claim.orderId} disalin!`);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                              title="Salin Order ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
                            <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                              {claim.channel}
                            </span>
                            {claim.awb && <span className="font-mono text-slate-600">AWB: {claim.awb}</span>}
                          </div>
                        </td>

                        {/* Pelimpahan CS */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800 text-[11px] flex items-center space-x-1">
                            <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]">{claim.forwardedBy}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {claim.forwardedAt ? new Date(claim.forwardedAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </div>
                        </td>

                        {/* Barang & Kerusakan */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {claim.items.map((item, iIdx) => (
                              <span
                                key={iIdx}
                                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono border border-slate-200"
                                title={`${item.namaBarang} (${item.kondisi})`}
                              >
                                <span className="font-bold text-indigo-700">{item.skuId}</span>
                                <span className="text-slate-400 font-sans">×</span>
                                <span className="font-bold text-slate-900">{item.qty}</span>
                                <span className="text-rose-600 font-sans text-[9px]">[{item.kondisi}]</span>
                              </span>
                            ))}
                          </div>
                          {claim.csNotes && (
                            <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-1" title={claim.csNotes}>
                              CS: "{claim.csNotes}"
                            </p>
                          )}
                        </td>

                        {/* Estimasi Ganti Rugi */}
                        <td className="py-3 px-3 font-mono">
                          <div className="font-extrabold text-xs text-rose-700">
                            {formatRupiah(claim.estimatedCompensation)}
                          </div>
                          <div className="text-[10px] text-slate-400">Tuntutan Awal</div>
                        </td>

                        {/* Realisasi Logistik */}
                        <td className="py-3 px-3 font-mono">
                          {claim.stageStatus === 'SELESAI' ? (
                            <div>
                              <div className="font-extrabold text-xs text-emerald-700">
                                {formatRupiah(claim.approvedCompensation || 0)}
                              </div>
                              <div className="text-[10px] text-emerald-600 font-medium">Disetujui Ekspedisi</div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Menunggu Hasil</span>
                          )}
                        </td>

                        {/* Status Tahap */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${stageInfo.badgeColor}`}
                          >
                            <span>{stageInfo.labelId}</span>
                          </span>
                        </td>

                        {/* Aksi RMA */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(claim)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                              title="Update status investigasi & hasil klaim logistik"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Update</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleOrderExpand(claim.id)}
                              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="Buka / tutup rincian"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Detail Sub-Panel */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0 bg-slate-50/80 border-b border-slate-200">
                            <div className="p-4 sm:p-5 space-y-4">
                              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                                      <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                                        Rincian Investigasi RMA & Berkas Logistik
                                      </h4>
                                      <p className="text-[11px] text-slate-500">
                                        Order ID: <strong className="font-mono text-slate-800">{claim.orderId}</strong>
                                      </p>
                                    </div>
                                  </div>

                                  {claim.linkVideo && (
                                    <a
                                      href={getDirectVideoUrl(claim.linkVideo, claim.orderId)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 rounded-lg bg-[#F0FDFA] hover:bg-[#CCFBF1] text-[#0F766E] border border-teal-200 text-xs font-semibold flex items-center space-x-1 shrink-0"
                                      title="Buka rekaman video unboxing di Google Drive"
                                    >
                                      <Video className="w-3.5 h-3.5" />
                                      <span>Lihat Video Unboxing</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>

                                {/* Grid Rincian */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  {/* Kolom Kiri: Riwayat Pelimpahan dari CS */}
                                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                    <div className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
                                      <Info className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Catatan Pelimpahan dari Customer Service:</span>
                                    </div>
                                    <p className="text-slate-800 text-[11px] italic bg-white p-2.5 rounded-lg border border-slate-200">
                                      "{claim.csNotes || 'Tidak ada catatan khusus dari CS.'}"
                                    </p>
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                      <span>Diteruskan oleh: <strong>{claim.forwardedBy}</strong></span>
                                      <span>Waktu unboxing: <strong>{claim.waktuProses || '-'}</strong></span>
                                    </div>
                                  </div>

                                  {/* Kolom Kanan: Status & Progres Investigasi RMA */}
                                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                                    <div className="text-[11px] font-bold text-indigo-900 flex items-center space-x-1">
                                      <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>Progres Investigasi Tim RMA:</span>
                                    </div>
                                    <div className="text-[11px] text-slate-700 space-y-1">
                                      <div>Petugas Investigasi: <strong>{claim.rmaInvestigator || 'Belum ditugaskan'}</strong></div>
                                      <div>
                                        Catatan Investigasi: 
                                        <p className="text-slate-800 italic bg-white p-2 rounded-lg border border-slate-200 mt-1">
                                          "{claim.investigationNotes || 'Belum ada catatan investigasi fisik/logistik.'}"
                                        </p>
                                      </div>
                                      {claim.resolutionNote && (
                                        <div>
                                          Catatan Resolusi Akhir:
                                          <p className="text-emerald-900 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200 mt-1">
                                            "{claim.resolutionNote}"
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Tabel Rincian SKU Barang yang Dilimpahkan */}
                                <div>
                                  <div className="text-[11px] font-bold text-slate-700 mb-1.5">
                                    Daftar Barang & Estimasi Nilai Ganti Rugi:
                                  </div>
                                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                                          <th className="py-2 px-2.5">SKU ID</th>
                                          <th className="py-2 px-2.5">Nama Barang</th>
                                          <th className="py-2 px-2 text-center">Qty</th>
                                          <th className="py-2 px-2.5">Kondisi</th>
                                          <th className="py-2 px-2.5 text-right">Harga Satuan</th>
                                          <th className="py-2 px-2.5 text-right">Subtotal Estimasi</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {claim.items.map((it, itIdx) => (
                                          <tr key={itIdx} className="hover:bg-slate-50">
                                            <td className="py-2 px-2.5 font-mono font-bold text-indigo-700">{it.skuId}</td>
                                            <td className="py-2 px-2.5 text-slate-900 font-medium">{it.namaBarang}</td>
                                            <td className="py-2 px-2 text-center font-bold">{it.qty}</td>
                                            <td className="py-2 px-2.5 text-rose-700 font-semibold">{it.kondisi}</td>
                                            <td className="py-2 px-2.5 text-right font-mono text-slate-600">{formatRupiah(it.hargaSatuan)}</td>
                                            <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">{formatRupiah(it.subtotalEstimasi)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-slate-50 font-bold border-t border-slate-200">
                                          <td colSpan={5} className="py-2 px-2.5 text-right text-slate-700">Total Estimasi Ganti Rugi:</td>
                                          <td className="py-2 px-2.5 text-right font-mono text-rose-700">{formatRupiah(claim.estimatedCompensation)}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <div>
              Menampilkan {startIndex + 1} – {Math.min(startIndex + itemsPerPage, filteredClaims.length)} dari {filteredClaims.length} kasus
            </div>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono font-bold text-slate-800">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. MODAL UPDATE STATUS INVESTIGASI RMA */}
      {editingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Update Status Investigasi RMA</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Order ID: {editingClaim.orderId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClaim(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Pilihan 4 Tahapan Status RMA */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tahap Status Klaim RMA:</label>
                <select
                  value={modalStage}
                  onChange={(e) => setModalStage(e.target.value as RmaStageStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="DITERIMA_CS">1. Diterima CS (Tahap Awal Pencatatan)</option>
                  <option value="DIALIHKAN_KE_RMA">2. Case Dialihkan ke Team RMA</option>
                  <option value="INVESTIGASI">3. Investigasi (Pemeriksaan Fisik & Logistik)</option>
                  <option value="SELESAI">4. Selesai (Penetapan Realisasi Klaim)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {RMA_STAGE_LABELS[modalStage].description}
                </p>
              </div>

              {/* Petugas Investigasi */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Petugas Penanggung Jawab RMA:</label>
                <input
                  type="text"
                  value={modalInvestigator}
                  onChange={(e) => setModalInvestigator(e.target.value)}
                  placeholder="Contoh: Budi Santoso / Tim RMA Logistik"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Catatan Investigasi */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Catatan Hasil Investigasi Fisik & Logistik:</label>
                <textarea
                  rows={3}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Tuliskan temuan investigasi fisik gudang, konfirmasi pihak ekspedisi, atau tindak lanjut klaim..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              {/* Khusus jika Status SELESAI */}
              {modalStage === 'SELESAI' && (
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="text-[11px] font-extrabold text-emerald-900 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Resolusi Akhir Klaim Logistik:</span>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Nilai Ganti Rugi Aktual yang Disetujui Logistik (Rp):
                    </label>
                    <input
                      type="text"
                      value={modalApprovedAmount}
                      onChange={(e) => setModalApprovedAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Masukkan nominal ganti rugi yang dicairkan ekspedisi..."
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Estimasi tuntutan awal: {formatRupiah(editingClaim.estimatedCompensation)}
                    </p>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Kesimpulan Penyelesaian:</label>
                    <input
                      type="text"
                      value={modalResolutionNote}
                      onChange={(e) => setModalResolutionNote(e.target.value)}
                      placeholder="Contoh: Ekspedisi menyetujui klaim 100%, dana masuk ke rekening toko tgl..."
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-medium text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingClaim(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Perubahan RMA</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
