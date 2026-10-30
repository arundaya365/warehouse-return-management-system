import { RMA_TRANSITIONS, rmaActionLabel, rmaQueue } from '../utils/claimWorkflow';
import { ClaimFlowNotice } from './ClaimFlowNotice';
import { validateRmaResolution, validateRmaWorkflow, paymentStatus, isRmaClosed, rmaCashReceived } from '../utils/claimWorkflow';
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
  Info,
  Undo2
} from 'lucide-react';
import { RmaClaimRecord, RmaStageStatus, RMA_STAGE_LABELS } from '../types/rma';
import { MasterSKUItem } from '../utils/excelTemplate';
import { useLanguage } from '../context/LanguageContext';
import { useAccount } from '../context/AccountContext';
import { getDirectVideoUrl } from './ResultViewer';
import { syncService } from '../services/dataSyncService';

interface RMAClaimsViewProps {
  rmaClaims: RmaClaimRecord[];
  onUpdateRmaClaim: (updatedClaim: RmaClaimRecord) => Promise<boolean>;
  onReturnToCs?: (orderId: string, reason: string) => void;
  onNavigateToDisputes: () => void;
  masterDatabase?: MasterSKUItem[];
}

export const RMAClaimsView: React.FC<RMAClaimsViewProps> = ({
  rmaClaims = [],
  onUpdateRmaClaim,
  onReturnToCs,
  onNavigateToDisputes,
  masterDatabase = []
}) => {
  const { t, isEn } = useLanguage();
  const { currentUser } = useAccount();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterQueue, setFilterQueue] = useState('ALL');
  const [filterStage, setFilterStage] = useState<'ALL' | RmaStageStatus>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Modal Catat hasil banding logistik
  const [editingClaim, setEditingClaim] = useState<RmaClaimRecord | null>(null);
  const [modalStage, setModalStage] = useState<RmaStageStatus>('INVESTIGASI');
  const [modalInvestigator, setModalInvestigator] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalApprovedAmount, setModalApprovedAmount] = useState('');
  const [modalResolutionNote, setModalResolutionNote] = useState('');
  const [modalDecisionAmount, setModalDecisionAmount] = useState('');
  const [modalOutcome, setModalOutcome] = useState<RmaClaimRecord['logisticsOutcome']>();
  const [modalEligibilityReason, setModalEligibilityReason] = useState('');
  const [modalEvidence, setModalEvidence] = useState('');
  const [modalTicket, setModalTicket] = useState('');
  const [modalPaymentReference, setModalPaymentReference] = useState('');
  const [modalClosureReason, setModalClosureReason] = useState('');

  // Modal Rollback / Kembalikan Kasus ke Tim CS
  const [returnTarget, setReturnTarget] = useState<RmaClaimRecord | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');

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
    const investigationCount = rmaClaims.filter((c) => !['DITERIMA_CS','DIALIHKAN_KE_RMA','SELESAI','TIDAK_LAYAK'].includes(c.stageStatus)).length;
    const completedCount = rmaClaims.filter((c) => isRmaClosed(c.stageStatus)).length;

    const totalEstimatedValue = rmaClaims.reduce((sum, c) => sum + (c.estimatedCompensation || 0), 0);
    const totalApprovedValue = rmaClaims.reduce((sum, c) => sum + rmaCashReceived(c), 0);

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
      if (filterQueue !== 'ALL' && rmaQueue(claim.stageStatus) !== filterQueue) return false;
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
  }, [rmaClaims, filterQueue, filterStage, filterChannel, searchQuery]);

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
    setModalDecisionAmount(String(claim.approvedAmount ?? claim.approvedCompensation ?? 0));
    setModalOutcome(claim.logisticsOutcome || (isRmaClosed(claim.stageStatus) ? ((claim.approvedCompensation || 0) > 0 ? ((claim.approvedCompensation || 0) < claim.estimatedCompensation ? 'PARTIAL' : 'APPROVED') : 'REJECTED') : undefined));
    setModalEligibilityReason(claim.eligibilityReason || '');
    setModalEvidence(claim.evidenceReference || claim.linkVideo || '');
    setModalTicket(claim.logisticsTicket || '');
    setModalPaymentReference(claim.paymentReference || '');
    setModalClosureReason(claim.closureReason || '');
    setModalStage((['DITERIMA_RMA','HASIL_LOGISTIK'].includes(claim.stageStatus) ? claim.stageStatus : RMA_TRANSITIONS[claim.stageStatus]?.[0] || claim.stageStatus) as RmaStageStatus);
    setModalInvestigator(claim.rmaInvestigator || currentUser?.fullName || '');
    setModalNotes(claim.investigationNotes || '');
    setModalApprovedAmount(claim.approvedCompensation !== undefined ? String(claim.approvedCompensation) : '');
    setModalResolutionNote(claim.resolutionNote || '');
  };

  const [isSavingRma, setIsSavingRma] = useState(false);
  const handleSaveModal = async () => {
    if (!editingClaim || isSavingRma) return;
    if (editingClaim.stageStatus === 'SELESAI' && modalStage !== 'SELESAI') { showToast('Kasus selesai tidak dapat dikembalikan ke antrean aktif.'); return; }

    if (!modalInvestigator.trim()) { showToast('Isi penanggung jawab RMA.'); return; }
    const approvedAmt = parseInt(modalApprovedAmount.replace(/[^0-9]/g, ''), 10) || 0;
    const nowIso = new Date().toISOString();

    const updated: RmaClaimRecord = {
      ...editingClaim,
      stageStatus: modalStage,
      rmaInvestigator: modalInvestigator.trim(),
      investigationNotes: modalNotes.trim(),
      approvedCompensation: ['HASIL_LOGISTIK','SELESAI'].includes(modalStage) ? approvedAmt : editingClaim.approvedCompensation,
      approvedAmount: ['HASIL_LOGISTIK','SELESAI'].includes(modalStage) ? Number(modalDecisionAmount) : editingClaim.approvedAmount,
      logisticsOutcome: modalOutcome,
      eligibility: modalStage === 'LAYAK_LOGISTIK' ? 'ELIGIBLE' : modalStage === 'TIDAK_LAYAK' ? 'INELIGIBLE' : modalStage === 'BUKTI_KURANG' ? 'NEEDS_EVIDENCE' : editingClaim.eligibility || 'PENDING',
      eligibilityReason: modalEligibilityReason.trim(), evidenceReference: modalEvidence.trim(),
      logisticsTicket: modalTicket.trim(), paymentReference: modalPaymentReference.trim(), closureReason: modalClosureReason.trim(),
      acceptedAt: modalStage === 'DITERIMA_RMA' ? (editingClaim.acceptedAt || nowIso) : editingClaim.acceptedAt,
      paymentStatus: paymentStatus(Number(modalDecisionAmount), approvedAmt),
      history: [...(editingClaim.history || []), {at:nowIso, by:modalInvestigator.trim(), from:editingClaim.stageStatus, to:modalStage, note:`${modalNotes.trim()} | Disetujui ${modalDecisionAmount}; diterima ${approvedAmt}; ${modalResolutionNote.trim()}`}],
      resolutionNote: modalResolutionNote.trim(),
      resolutionDate: modalStage === 'SELESAI' ? (editingClaim.resolutionDate || nowIso) : undefined,
      updatedAt: nowIso
    };

    const workflowError = validateRmaWorkflow(editingClaim, updated);
    if (workflowError) { showToast(workflowError); return; }
    setIsSavingRma(true);
    const saved = await onUpdateRmaClaim(updated);
    setIsSavingRma(false);
    if (!saved) { showToast('Gagal menyimpan hasil logistik ke server. Data formulir tetap tersedia; coba lagi.'); return; }
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

<ClaimFlowNotice stage="logistics" />
      {/* 1. Header & Summary Statistics Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Klaim RMA · Logistik</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Eskalasi CS
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Banding ke logistik untuk barang yang ditolak marketplace. Hasil banding marketplace tetap tersimpan sebagai riwayat.
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
            <span>Kembali ke Klaim CS</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Total Kasus */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Kasus RMA</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{stats.totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Diteruskan dari CS</div>
        </div>

        {stats.receivedCsCount > 0 && <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200"><div className="text-xs font-bold">Data lama — perlu ditinjau</div><strong>{stats.receivedCsCount}</strong><p className="text-xs">Periksa hasil marketplace sebelum banding ke logistik.</p></div>}
        {/* Dialihkan ke RMA */}
        <div className="p-3.5 rounded-2xl bg-white border border-indigo-200 shadow-2xs">
          <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Dialihkan ke RMA</div>
          <div className="text-xl font-extrabold text-indigo-900 mt-1 font-mono">{stats.transferredCount}</div>
          <div className="text-[10px] text-indigo-600 mt-0.5 font-medium">Siap ditangani Tim RMA</div>
        </div>

        {/* Dalam Investigasi */}
        <div className="p-3.5 rounded-2xl bg-white border border-blue-200 shadow-2xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Banding logistik</div>
          <div className="text-xl font-extrabold text-blue-900 mt-1 font-mono">{stats.investigationCount}</div>
          <div className="text-[10px] text-blue-600 mt-0.5 font-medium">Pemeriksaan bukti dan banding ke kurir</div>
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

        <div className="flex flex-wrap gap-2" aria-label="Filter tahap RMA">
          {[['ALL','Semua'],['RECEIVE','Perlu diterima'],['ACTIVE','Dalam penanganan'],['WAITING','Menunggu tindak lanjut'],['CLOSED','Selesai']].map(([value,label]) => <button type="button" key={value} className="warehouse-button" aria-pressed={filterQueue===value} onClick={()=>{setFilterQueue(value);setFilterStage('ALL');setCurrentPage(1);}}>{label} ({rmaClaims.filter(claim=>value==='ALL'||rmaQueue(claim.stageStatus)===value).length})</button>)}
          <label className="text-xs">Status rinci <select aria-label="Filter status rinci RMA" value={filterStage} onChange={e=>{setFilterStage(e.target.value as RmaStageStatus|'ALL');setFilterQueue('ALL');setCurrentPage(1);}} className="rounded-lg border p-2"><option value="ALL">Semua status</option>{Object.entries(RMA_STAGE_LABELS).filter(([stage])=>rmaClaims.some(claim=>claim.stageStatus===stage)).map(([stage,info])=><option key={stage} value={stage}>{info.labelId}</option>)}</select></label>
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
                ? 'Belum ada klaim yang diteruskan oleh Customer Service dari tab Klaim CS.'
                : 'Tidak ada data yang cocok dengan kriteria filter atau pencarian Anda.'}
            </p>
            {rmaClaims.length === 0 && (
              <button
                type="button"
                onClick={onNavigateToDisputes}
                className="mt-4 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
              >
                <span>Buka Klaim CS</span>
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
                  <th className="py-2.5 px-3 w-36">Dana diterima dari logistik</th>
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
                        className={`hover:bg-slate-50/70 transition-colors ${
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
                            {claim.items.filter((item) => item.kondisi !== 'Good').map((item, iIdx) => (
                              <span
                                key={iIdx}
                                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 text-[10px] font-mono border border-rose-200"
                                title={`${item.namaBarang} (${item.kondisi})`}
                              >
                                <span className="font-bold text-rose-700">{item.skuId}</span>
                                <span className="text-rose-400 font-sans">×</span>
                                <span className="font-bold text-rose-900">{item.qty}</span>
                                <span className="text-rose-600 font-sans text-[9px]">[{item.kondisi}]</span>
                              </span>
                            ))}
                            {claim.items.filter((item) => item.kondisi === 'Good').length > 0 && (
                              <span className="text-[10px] text-emerald-700 font-medium self-center pl-0.5">
                                +{claim.items.filter((item) => item.kondisi === 'Good').length} restock
                              </span>
                            )}
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

                        {/* Dana diterima dari logistik */}
                        <td className="py-3 px-3 font-mono">
                          {['HASIL_LOGISTIK','SELESAI'].includes(claim.stageStatus) ? (
                            <div>
                              <div className="font-extrabold text-xs text-emerald-700">
                                {formatRupiah(claim.approvedCompensation || 0)}
                              </div>
                              <div className="text-[10px] text-emerald-600 font-medium">Disetujui: {formatRupiah(claim.approvedAmount ?? claim.approvedCompensation ?? 0)} · {(claim.approvedCompensation || 0) < (claim.approvedAmount ?? claim.approvedCompensation ?? 0) ? 'Belum lunas' : 'Pembayaran tuntas / tidak berlaku'}</div>
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
                              className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-[11px] shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                              title="Update status investigasi & hasil klaim logistik"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{claim.stageStatus==='DITERIMA_RMA' ? 'Periksa kelayakan' : claim.stageStatus==='HASIL_LOGISTIK' ? 'Catat pembayaran' : isRmaClosed(claim.stageStatus) ? 'Lihat / koreksi catatan' : rmaActionLabel(RMA_TRANSITIONS[claim.stageStatus]?.[0] || claim.stageStatus)}</span>
                            </button>
                            {onReturnToCs && claim.stageStatus !== 'SELESAI' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReturnTarget(claim);
                                  setReturnReason('Bukan kendala ekspedisi/kurir (paket utuh); komplain ditangani CS Marketplace.');
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-[11px] shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                                title="Kembalikan kasus ke antrean Klaim CS jika bukan kendala logistik"
                              >
                                <Undo2 className="w-3 h-3 text-amber-700" />
                                <span className="hidden xl:inline">Koreksi pelimpahan</span>
                              </button>
                            )}
                            <button
                              type="button"
                              aria-expanded={isExpanded} onClick={() => toggleOrderExpand(claim.id)}
                              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              aria-label={`Rincian kasus ${claim.orderId}`} title="Buka / tutup rincian"
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

                                  <div className="flex items-center space-x-2">
                                    {onReturnToCs && claim.stageStatus !== 'SELESAI' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReturnTarget(claim);
                                          setReturnReason('Bukan kendala ekspedisi/kurir (paket utuh); komplain ditangani CS Marketplace.');
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                                        title="Kembalikan kasus ke antrean aktif Klaim CS jika terjadi salah pelimpahan"
                                      >
                                        <Undo2 className="w-3.5 h-3.5 text-amber-700" />
                                        <span>Koreksi pelimpahan ke CS</span>
                                      </button>
                                    )}
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

                                {/* Tabel Terpadu Rincian Seluruh Barang (Damage & Good) */}
                                <div>
                                  {/* Ringkasan Jumlah Barang Paket (misal: 5 Rusak, 2 Baik) */}
                                  {(() => {
                                    const damageItems = claim.items.filter((it) => it.kondisi !== 'Good');
                                    const goodItems = claim.items.filter((it) => it.kondisi === 'Good');
                                    return (
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 mb-2">
                                        <div className="flex items-center space-x-2">
                                          <Boxes className="w-4 h-4 text-slate-600" />
                                          <span className="text-xs font-bold text-slate-800">
                                            Manifest Lengkap Paket: <span className="font-mono">{claim.items.length}</span> Produk
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-2 text-[11px]">
                                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold border border-rose-200">
                                            {damageItems.length} Rusak / Hilang (Dituntut)
                                          </span>
                                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                                            {goodItems.length} Kondisi Baik (Dikembalikan ke stok)
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                                          <th className="py-2 px-2.5">SKU ID</th>
                                          <th className="py-2 px-2.5">Nama Barang</th>
                                          <th className="py-2 px-2 text-center">Qty</th>
                                          <th className="py-2 px-2.5">Kondisi Fisik</th>
                                          <th className="py-2 px-2.5 text-right">Harga Satuan</th>
                                          <th className="py-2 px-2.5 text-right">Subtotal Tuntutan</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {claim.items.map((it, itIdx) => {
                                          const isGood = it.kondisi === 'Good';
                                          return (
                                            <tr key={itIdx} className={`hover:bg-slate-50 transition-colors ${isGood ? 'bg-emerald-50/20' : ''}`}>
                                              <td className="py-2 px-2.5 font-mono font-bold text-indigo-700">{it.skuId}</td>
                                              <td className="py-2 px-2.5 text-slate-900 font-medium">{it.namaBarang}</td>
                                              <td className="py-2 px-2 text-center font-bold">{it.qty}</td>
                                              <td className="py-2 px-2.5">
                                                {isGood ? (
                                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                    <span>Kondisi Baik (Dikembalikan ke stok)</span>
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold text-[10px] border border-rose-200">
                                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                    <span>{it.kondisi}</span>
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-2.5 text-right font-mono text-slate-600">{formatRupiah(it.hargaSatuan)}</td>
                                              <td className="py-2 px-2.5 text-right font-mono font-bold">
                                                {isGood ? (
                                                  <span className="text-slate-400 font-normal text-[11px]">Rp 0 (Dikembalikan ke stok)</span>
                                                ) : (
                                                  <span className="text-rose-700">{formatRupiah(it.subtotalEstimasi)}</span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot>
                                        <tr className="bg-slate-50 font-bold border-t border-slate-200">
                                          <td colSpan={5} className="py-2 px-2.5 text-right text-slate-700">
                                            Total Estimasi Tuntutan Ganti Rugi:
                                            <span className="text-[10px] font-normal text-slate-500 block">
                                              (Hanya dihitung dari item barang rusak/hilang)
                                            </span>
                                          </td>
                                          <td className="py-2 px-2.5 text-right font-mono text-base text-rose-700">
                                            {formatRupiah(claim.estimatedCompensation)}
                                          </td>
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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Catat hasil banding logistik</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Order ID: {editingClaim.orderId}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup formulir RMA" onClick={() => setEditingClaim(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Pilihan 4 Tahapan Status RMA */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tindakan untuk kasus ini:</label>
                <select
                  value={modalStage}
                  onChange={(e) => setModalStage(e.target.value as RmaStageStatus)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {Object.entries(RMA_STAGE_LABELS).filter(([stage]) => stage === editingClaim.stageStatus || RMA_TRANSITIONS[editingClaim.stageStatus]?.includes(stage)).map(([stage, info]) => <option key={stage} value={stage}>{stage===editingClaim.stageStatus ? `Simpan catatan · ${info.labelId}` : rmaActionLabel(stage)}</option>)}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {RMA_STAGE_LABELS[modalStage].description}
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <label className="block">Dasar kelayakan / bukti yang masih kurang<textarea aria-label="Dasar kelayakan RMA" value={modalEligibilityReason} onChange={e => setModalEligibilityReason(e.target.value)} className="w-full border rounded-lg p-2 resize-none" rows={3} /></label>
                <label className="block">Referensi bukti yang diperiksa<input aria-label="Referensi bukti RMA" value={modalEvidence} onChange={e => setModalEvidence(e.target.value)} placeholder="Link video, foto, nomor dokumen, atau referensi berkas" className="w-full border rounded-lg p-2" /></label>
                <label className="block">Nomor tiket / referensi banding logistik<input aria-label="Nomor tiket logistik" value={modalTicket} onChange={e => setModalTicket(e.target.value)} className="w-full border rounded-lg p-2" /></label>
                <p className="text-slate-500">Penolakan marketplace bukan bukti kesalahan kurir. Pilih Pemeriksaan bukti RMA sebelum menetapkan kelayakan. Kasus bukti kurang tetap berada di RMA.</p>
              </div>
              {/* Petugas Investigasi */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Petugas Penanggung jawab RMA:</label>
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

              {!!editingClaim.history?.length && <details className="rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer font-bold">Riwayat penanganan ({editingClaim.history.length})</summary>
                <ol className="mt-2 space-y-2">{editingClaim.history.map((entry, index) => <li key={`${entry.at}-${index}`} className="border-t border-slate-100 pt-2 text-xs">
                  <div className="font-semibold">{entry.by} · {new Date(entry.at).toLocaleString('id-ID')}</div>
                  <div>{RMA_STAGE_LABELS[entry.from as RmaStageStatus]?.labelId || entry.from} → {RMA_STAGE_LABELS[entry.to as RmaStageStatus]?.labelId || entry.to}</div>
                  <p className="whitespace-pre-wrap text-slate-600">{entry.note}</p>
                </li>)}</ol>
              </details>}
              {/* Khusus jika Status SELESAI */}
              {['HASIL_LOGISTIK','SELESAI'].includes(modalStage) && (
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="text-[11px] font-extrabold text-emerald-900 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Resolusi Akhir Klaim Logistik:</span>
                  </div>
                  <label className="block font-bold">Keputusan logistik<select aria-label="Keputusan logistik" value={modalOutcome || ''} onChange={e => setModalOutcome(e.target.value as RmaClaimRecord['logisticsOutcome'])} className="w-full border rounded-lg p-2"><option value="">Pilih keputusan</option><option value="APPROVED">Disetujui</option><option value="PARTIAL">Disetujui sebagian</option><option value="REJECTED">Ditolak</option></select></label>
                  <label className="block font-bold">Nominal disetujui logistik (Rp)<input aria-label="Nominal disetujui logistik" inputMode="numeric" value={modalDecisionAmount} onChange={e => setModalDecisionAmount(e.target.value.replace(/[^0-9]/g,''))} className="w-full border rounded-lg p-2" /></label>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Dana sudah diterima (Rp). Isi 0 jika belum cair:
                    </label>
                    <input
                      type="text"
                      value={modalApprovedAmount}
                      onChange={(e) => setModalApprovedAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      aria-label="Dana diterima logistik" placeholder="Nominal yang benar-benar masuk"
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-mono font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Estimasi tuntutan awal: {formatRupiah(editingClaim.estimatedCompensation)}
                    </p>
                  </div>
                  <label className="block">Referensi pembayaran<input aria-label="Referensi pembayaran logistik" value={modalPaymentReference} onChange={e => setModalPaymentReference(e.target.value)} className="w-full border rounded-lg p-2" /></label>
                  <label className="block">Alasan penutupan jika dana belum lunas<input aria-label="Alasan penutupan tanpa pelunasan" value={modalClosureReason} onChange={e => setModalClosureReason(e.target.value)} className="w-full border rounded-lg p-2" /></label>
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
                disabled={isSavingRma}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingRma ? 'Menyimpan…' : modalStage===editingClaim.stageStatus ? 'Simpan perubahan' : rmaActionLabel(modalStage)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ROLLBACK: KEMBALIKAN KASUS KE CUSTOMER SERVICE */}
      {returnTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setReturnTarget(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-amber-200 max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300">
                  <Undo2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Kembalikan Kasus ke Customer Service
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Order ID: <strong className="text-slate-800">{returnTarget.orderId}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-1">
                <p className="font-bold text-amber-900">
                  Tanggung jawab penanganan kasus klaim ini akan dikembalikan ke tim Customer Service.
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Kasus akan otomatis dicabut dari antrean Tim RMA dan kembali aktif pada antrean Klaim CS. Angka badge Klaim CS di navigation bar akan bertambah 1 kembali, dan badge RMA berkurang 1.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Pilih / Tulis Alasan Pengembalian ke Tim CS:
                </label>
                <div className="space-y-1.5">
                  {[
                    'Bukan kendala ekspedisi/kurir (paket utuh); komplain ditangani CS Marketplace.',
                    'Kemasan luar tersegel aman, indikasi cacat produksi / seller fraud oleh pembeli.',
                    'Salah pelimpahan oleh operator CS, kasus sudah selesai di seller center.',
                    'Lainnya (tulis manual pada catatan di bawah)'
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setReturnReason(preset)}
                      className={`w-full text-left p-2.5 rounded-xl text-[11px] border transition-all cursor-pointer ${
                        returnReason === preset
                          ? 'bg-amber-100/90 text-amber-950 border-amber-400 font-semibold shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="mt-2.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Catatan Tambahan untuk Petugas CS:
                  </label>
                  <textarea
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="Tuliskan catatan detail untuk petugas CS..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Petugas RMA: <strong className="text-slate-700">{currentUser?.fullName || 'RMA Specialist'}</strong></span>
                <span>Ekspedisi: <strong className="text-slate-700">{returnTarget.channel || 'Ekspedisi'}</strong></span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReturnTarget(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onReturnToCs && returnTarget) {
                    onReturnToCs(returnTarget.orderId, returnReason.trim() || 'Dikembalikan oleh Tim RMA');
                    showToast(`✓ Kasus Order ${returnTarget.orderId} berhasil dikembalikan ke antrean Klaim CS!`);
                    setReturnTarget(null);
                  }
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Konfirmasi pengembalian kasus ke CS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
