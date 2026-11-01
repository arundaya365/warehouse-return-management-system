import {simpleRmaStatus, simpleRmaStage} from '../utils/claimWorkflow';
import {marketplaceSettlement, normalizeOrderId, logisticsChannel, classifyApprovedAmount} from '../utils/claimWorkflow';
import {canReturnToCs as canReturnRmaToCs} from '../utils/claimWorkflow';
import { RMA_TRANSITIONS, rmaActionLabel, rmaQueue } from '../utils/claimWorkflow';
import { validateRmaResolution, validateRmaWorkflow, paymentStatus, isRmaClosed, rmaCashReceived } from '../utils/claimWorkflow';
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import type { StoreProfile } from '../types/store';
import { useLanguage } from '../context/LanguageContext';
import { useAccount } from '../context/AccountContext';
import { getDirectVideoUrl } from './ResultViewer';
import { syncService } from '../services/dataSyncService';
import { ClaimPageHeader } from './ClaimPageHeader';
import { CompactPagination } from './CompactPagination';

interface RMAClaimsViewProps {
  rmaClaims: RmaClaimRecord[];
  onUpdateRmaClaim: (updatedClaim: RmaClaimRecord) => Promise<boolean>;
  onReturnToCs?: (orderId: string, reason: string) => Promise<boolean>;
  onNavigateToDisputes: () => void;
  masterDatabase?: MasterSKUItem[];
  marketplaceDisputes?: Record<string,any>;
  stores?: StoreProfile[];
}

export const RMAClaimsView: React.FC<RMAClaimsViewProps> = ({
  rmaClaims = [],
  onUpdateRmaClaim,
  onReturnToCs,
  onNavigateToDisputes,
  marketplaceDisputes = {},
  stores = [],
  masterDatabase = []
}) => {
  const { t, isEn } = useLanguage();
  const { currentUser } = useAccount();

  const lateMarketplaceOrders = useMemo(() => new Set(rmaClaims.filter(claim => claim.stageStatus !== 'DIKEMBALIKAN_CS' && claim.marketplaceCashAtHandover !== undefined && marketplaceSettlement(marketplaceDisputes,new Set([normalizeOrderId(claim.orderId)])).settlementAmount > claim.marketplaceCashAtHandover).map(claim => claim.orderId)),[rmaClaims,marketplaceDisputes]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterQueue, setFilterQueue] = useState('ALL');
  const [filterStage, setFilterStage] = useState<'ALL' | RmaStageStatus>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Modal Catat hasil banding logistik
  const [editingClaim, setEditingClaim] = useState<RmaClaimRecord | null>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [modalError,setModalError] = useState('');
  const [modalSimpleStatus, setModalSimpleStatus] = useState<'PENDING'|'SUBMITTED'|'WAITING'|'APPROVED'|'REJECTED'>('PENDING');
  const [modalCloseCase, setModalCloseCase] = useState(false);
  const [modalInvestigator, setModalInvestigator] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [modalApprovedAmount, setModalApprovedAmount] = useState('');
  const [modalResolutionNote, setModalResolutionNote] = useState('');
  const [modalDecisionAmount, setModalDecisionAmount] = useState('');
  const [modalTicket, setModalTicket] = useState('');
  const [modalItemAmounts, setModalItemAmounts] = useState<string[]>([]);
  const [modalLogistics, setModalLogistics] = useState('');
  const valuationChanged = !!editingClaim && editingClaim.items.some((item,index)=>item.subtotalEstimasi !== Number(modalItemAmounts[index] || 0));
  const modalEstimate = valuationChanged ? modalItemAmounts.reduce((sum,value)=>sum+(Number(value)||0),0) : (editingClaim?.estimatedCompensation || 0);
  const [modalPaymentReference, setModalPaymentReference] = useState('');
  const [modalClosureReason, setModalClosureReason] = useState('');

  // Modal Rollback / Kembalikan Kasus ke Tim CS
  const [returnTarget, setReturnTarget] = useState<RmaClaimRecord | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');
  const [isReturning, setIsReturning] = useState(false);
  const canReturnToCs = (claim: RmaClaimRecord) => canReturnRmaToCs(claim.stageStatus);
  const retainedClaims = useMemo(() => rmaClaims.filter(claim => claim.stageStatus !== 'DIKEMBALIKAN_CS'), [rmaClaims]);
  const logisticsOutcomeLabel = (outcome?: RmaClaimRecord['logisticsOutcome']) => outcome === 'APPROVED' ? 'Disetujui penuh' : outcome === 'PARTIAL' ? 'Disetujui sebagian' : outcome === 'REJECTED' ? 'Banding tidak berhasil' : 'Belum ada keputusan';

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
    const totalCount = retainedClaims.length;
    const receivedCsCount = retainedClaims.filter((c) => c.stageStatus === 'DITERIMA_CS').length;
    const transferredCount = retainedClaims.filter((c) => c.stageStatus === 'DIALIHKAN_KE_RMA').length;
    const investigationCount = retainedClaims.filter((c) => !['DITERIMA_CS','DIALIHKAN_KE_RMA','SELESAI','TIDAK_LAYAK'].includes(c.stageStatus)).length;
    const completedCount = retainedClaims.filter((c) => isRmaClosed(c.stageStatus)).length;

    const totalEstimatedValue = retainedClaims.reduce((sum, c) => sum + (c.estimatedCompensation || 0), 0);
    const totalApprovedValue = retainedClaims.reduce((sum, c) => sum + rmaCashReceived(c), 0);

    return {
      totalCount,
      receivedCsCount,
      transferredCount,
      investigationCount,
      completedCount,
      totalEstimatedValue,
      totalApprovedValue
    };
  }, [retainedClaims]);

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
      // Returned cases remain readable outside the active RMA queue.
      if (claim.stageStatus === 'DIKEMBALIKAN_CS' && filterQueue !== 'RETURNED') return false;
      if (filterQueue === 'ALL' && (isRmaClosed(claim.stageStatus) || ['APPROVED','REJECTED'].includes(simpleRmaStatus(claim)))) return false;
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
    if (['DIKEMBALIKAN_CS','TIDAK_LAYAK'].includes(claim.stageStatus)) return;
    setModalError('');
    setEditingClaim(claim);
    setModalDecisionAmount(String(claim.approvedAmount ?? claim.approvedCompensation ?? 0));
    setModalTicket(claim.logisticsTicket || '');
    setModalItemAmounts(claim.items.map(item=>String(item.subtotalEstimasi || 0)));
    setModalLogistics(claim.logisticsName || (claim.channel !== 'Lainnya' ? claim.channel : ''));
    setModalPaymentReference(claim.paymentReference || '');
    setModalClosureReason(claim.closureReason || '');
    const status=simpleRmaStatus(claim);
    setModalSimpleStatus(status);
    setModalCloseCase(claim.stageStatus === 'SELESAI');
    setModalInvestigator(claim.rmaInvestigator || currentUser?.fullName || '');
    setModalNotes(claim.investigationNotes || '');
    setModalApprovedAmount(claim.approvedCompensation !== undefined ? String(claim.approvedCompensation) : '');
    setModalResolutionNote(claim.resolutionNote || '');
  };

  const [isSavingRma, setIsSavingRma] = useState(false);
  useEffect(()=>{
    if(!editingClaim)return;
    const dialog=editDialogRef.current;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    if(dialog&&!dialog.open)dialog.showModal();
    return ()=>{if(dialog?.open)dialog.close();document.body.style.overflow=overflow;previous?.focus();};
  },[editingClaim]);
  const reportFormMessage=(message:string)=>{setModalError(message);showToast(message);};
  const handleSaveModal = async () => {
    if (!editingClaim || isSavingRma) return;
    const closed=isRmaClosed(editingClaim.stageStatus);
    const canValue=canReturnRmaToCs(editingClaim.stageStatus);
    const estimate=canValue ? modalEstimate : editingClaim.estimatedCompensation;
    const approved=modalSimpleStatus==='APPROVED' ? Number(modalDecisionAmount) : 0;
    const received=Number(editingClaim.financeReceivedAmount ?? editingClaim.approvedCompensation ?? 0);
    const status=modalSimpleStatus==='APPROVED' ? classifyApprovedAmount(approved,estimate) : modalSimpleStatus;
    if (!status) {reportFormMessage('Isi total hasil banding lebih dari Rp0 dan tidak melebihi total nilai klaim.');return;}
    if (!Number.isSafeInteger(received)||received<0||received>approved) {reportFormMessage('Dana diterima tidak boleh melebihi total hasil banding.');return;}
    const result=['APPROVED','PARTIAL','REJECTED'].includes(status);
    if (!result && (editingClaim.approvedCompensation || 0)>0) {reportFormMessage('Kasus dengan pembayaran tidak dapat diubah kembali menjadi draf.');return;}
    const stage=closed ? editingClaim.stageStatus : modalCloseCase&&result ? 'SELESAI' : simpleRmaStage(status);
    const nextItems=canValue&&valuationChanged ? editingClaim.items.map((item,index)=>({...item,subtotalEstimasi:Number(modalItemAmounts[index]||0)})) : editingClaim.items;
    const now=new Date().toISOString();
    const updated: RmaClaimRecord={...editingClaim,workflowVersion:'SIMPLE',claimStatus:status,stageStatus:stage,
      items:nextItems,estimatedCompensation:estimate,logisticsName:canValue?modalLogistics.trim():editingClaim.logisticsName,
      channel:canValue?logisticsChannel(modalLogistics):editingClaim.channel,
      rmaInvestigator:modalInvestigator.trim()||currentUser.fullName,investigationNotes:modalNotes.trim(),
      approvedAmount:approved,approvedCompensation:result?received:0,logisticsOutcome:result?status as RmaClaimRecord['logisticsOutcome']:undefined,
      financeReceivedAmount:editingClaim.financeReceivedAmount,
      financePaymentDate:editingClaim.financePaymentDate,
      financePaymentReference:editingClaim.financePaymentReference,
      financePaymentMethod:editingClaim.financePaymentMethod,
      financePaymentNote:editingClaim.financePaymentNote,
      logisticsTicket:modalTicket.trim(),paymentReference:editingClaim.paymentReference,paymentStatus:paymentStatus(approved,received),
      resolutionNote:modalResolutionNote.trim(),closureReason:modalClosureReason.trim(),acceptedAt:editingClaim.acceptedAt||now,
      resolutionDate:stage==='SELESAI'?(editingClaim.resolutionDate||now):editingClaim.resolutionDate,updatedAt:now,
      history:[...(editingClaim.history||[]),{at:now,by:currentUser.fullName,from:editingClaim.stageStatus,to:stage,note:'Status '+status+'; nilai diajukan '+estimate+'; hasil banding '+approved+'; dana diterima '+received+(modalResolutionNote.trim()?' | '+modalResolutionNote.trim():'')}]};
    const error=validateRmaWorkflow(editingClaim,updated);if(error){reportFormMessage(error);return;}
    setIsSavingRma(true);
    try {if(!(await onUpdateRmaClaim(updated))){reportFormMessage('Gagal menyimpan. Formulir tetap tersedia; coba lagi.');return;}setEditingClaim(null);reportFormMessage('Hasil banding RMA berhasil disimpan.');}
    finally {setIsSavingRma(false);}
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
    <div className="claim-page space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <h1 className="sr-only">Klaim RMA</h1>
      <ClaimPageHeader
        filterLabel="Filter klaim RMA"
        filterActive={filterQueue !== 'ALL' || filterStage !== 'ALL' || filterChannel !== 'ALL' || Boolean(searchQuery)}
        onOpenFilter={() => setFilterOpen(true)}
        onExport={handleDownloadCsv}
        exportLabel="Unduh klaim RMA"
        exportDisabled={filteredClaims.length === 0}
        summary={<><span>{stats.totalCount} kasus RMA</span><span>•</span><span>{stats.investigationCount} dalam penanganan</span><span>•</span><strong className="font-mono text-slate-900">Nilai disetujui {formatRupiah(stats.totalApprovedValue)}</strong></>}
      />

      {/* 2. Top Metric Cards */}
      <div className="claim-metric-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Total Kasus */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Kasus RMA</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{stats.totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Diteruskan dari CS</div>
        </div>

        {stats.receivedCsCount > 0 && <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200"><div className="text-xs font-bold">Data lama — perlu ditinjau</div><strong>{stats.receivedCsCount}</strong><p className="text-xs">Periksa alasan serah terima dan bukti sebelum banding ke logistik.</p></div>}
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
      <div className={filterOpen ? 'fixed inset-x-4 top-20 bottom-4 z-[60] mx-auto max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-3' : 'hidden'} role="dialog" aria-label="Filter klaim RMA">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3"><strong className="text-sm text-slate-900">Filter klaim RMA</strong><button type="button" className="warehouse-button px-2 py-1" aria-label="Tutup filter" onClick={() => setFilterOpen(false)}><X size={15}/></button></div>
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
          {[['ALL','Semua RMA aktif'],['RECEIVE','Perlu diterima'],['ACTIVE','Dalam penanganan'],['WAITING','Menunggu tindak lanjut'],['RETURNED','Dikembalikan ke CS']].map(([value,label]) => <button type="button" key={value} className="warehouse-button" aria-pressed={filterQueue===value} onClick={()=>{setFilterQueue(value);setFilterStage('ALL');setCurrentPage(1);}}>{label} ({rmaClaims.filter(claim=>value==='ALL'?(!isRmaClosed(claim.stageStatus)&&!['APPROVED','REJECTED'].includes(simpleRmaStatus(claim))):rmaQueue(claim.stageStatus)===value).length})</button>)}
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
                  <th className="py-2.5 px-3 w-40">Hasil banding RMA</th>
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
                            {claim.estimatedCompensation > 0 ? formatRupiah(claim.estimatedCompensation) : 'Belum dinilai'}
                          </div>
                          <div className="text-[10px] text-slate-400">Tuntutan Awal</div>
                        </td>

                        <td className="py-3 px-3">
                          <p className="text-[11px] font-semibold text-slate-700">{logisticsOutcomeLabel(claim.logisticsOutcome)}</p>
                          <p className="mt-1 font-mono text-xs font-extrabold text-indigo-800">{['HASIL_LOGISTIK','SELESAI'].includes(claim.stageStatus) && (claim.approvedAmount !== undefined || claim.logisticsOutcome === 'REJECTED') ? formatRupiah(claim.approvedAmount ?? 0) : '—'}</p>
                          <p className="text-[10px] text-slate-500">Nominal disetujui, bukan dana masuk</p>
                        </td>
                        {/* Dana diterima dari logistik */}
                        <td className="py-3 px-3 font-mono">
                          {['HASIL_LOGISTIK','SELESAI'].includes(claim.stageStatus) ? (
                            <div>
                              <div className="font-extrabold text-xs text-emerald-700">
                                {formatRupiah(claim.financeReceivedAmount ?? claim.approvedCompensation ?? 0)}
                              </div>
                              <div className="text-[10px] text-emerald-600 font-medium">{(claim.financeReceivedAmount ?? claim.approvedCompensation ?? 0) < (claim.approvedAmount ?? claim.approvedCompensation ?? 0) ? 'Belum lunas' : 'Pembayaran tuntas / tidak berlaku'}</div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-600">Rp0 · Belum ada dana tercatat</span>
                          )}
                        </td>

                        {/* Status Tahap */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${stageInfo.badgeColor}`}
                          >
                            <span>{stageInfo.labelId}</span>
                          </span>
                          <p className="mt-1 text-[11px] text-slate-700">{claim.stageStatus === 'TIDAK_LAYAK' ? 'Tidak diajukan: tidak layak logistik' : claim.stageStatus === 'DIKEMBALIKAN_CS' ? 'Penanganan kembali ke CS' : logisticsOutcomeLabel(claim.logisticsOutcome)}</p>
                          {isRmaClosed(claim.stageStatus) && <p className="mt-1 text-[10px] text-slate-500">Penutupan tidak berarti dana diterima penuh.</p>}
                        </td>

                        {/* Aksi RMA */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              disabled={['DIKEMBALIKAN_CS','TIDAK_LAYAK'].includes(claim.stageStatus)}
                              onClick={() => handleOpenEditModal(claim)}
                              className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-[11px] shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                              title="Update status investigasi & hasil klaim logistik"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{['DIKEMBALIKAN_CS','TIDAK_LAYAK'].includes(claim.stageStatus) ? 'Riwayat baca-saja' : isRmaClosed(claim.stageStatus) ? 'Lihat hasil banding' : 'Catat banding logistik'}</span>
                            </button>
                            {onReturnToCs && canReturnToCs(claim) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReturnTarget(claim);
                                  setReturnReason('');
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-[11px] shadow-2xs transition-all flex items-center space-x-1 cursor-pointer"
                                title="Kembalikan kasus ke antrean Klaim CS jika bukan kendala logistik"
                              >
                                <Undo2 className="w-3 h-3 text-amber-700" />
                                <span className="hidden xl:inline">Kembalikan ke CS</span>
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
                          <td colSpan={9} className="p-0 bg-slate-50/80 border-b border-slate-200">
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
                                    {onReturnToCs && canReturnToCs(claim) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReturnTarget(claim);
                                          setReturnReason('');
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                                        title="Kembalikan kasus ke antrean aktif Klaim CS jika terjadi salah pelimpahan"
                                      >
                                        <Undo2 className="w-3.5 h-3.5 text-amber-700" />
                                        <span>Kembalikan ke CS</span>
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
                                      {claim.handoverReason || claim.csNotes || 'Tidak ada catatan khusus dari CS.'}
                                    </p>
                                    {lateMarketplaceOrders.has(claim.orderId) && <p role="status" className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">Pembayaran marketplace bertambah sejak serah terima. Tinjau sisa klaim logistik; pengajuan yang sudah dikirim tidak diubah otomatis.</p>}
                                    <p className="text-[11px] text-slate-700 break-words">Bukti serah terima: {claim.handoverEvidence || claim.marketplaceDecisionEvidence || claim.linkVideo || 'Belum dicatat'}</p>
                                    <p className="text-[11px] text-slate-700">Tiket marketplace: {claim.marketplaceTicket && claim.marketplaceTicket !== '-' ? claim.marketplaceTicket : 'Belum ada / serah terima langsung'}</p>
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

                                {!!claim.history?.length && <details className="rounded-xl border border-slate-200 bg-white p-3">
                                  <summary className="cursor-pointer font-bold text-xs text-slate-800">Riwayat penanganan ({claim.history.length})</summary>
                                  <ol className="mt-2 space-y-2">{claim.history.map((entry, index) => <li key={entry.at + '-' + index} className="border-t border-slate-100 pt-2 text-xs">
                                    <div className="font-semibold">{entry.by} · {new Date(entry.at).toLocaleString('id-ID')}</div>
                                    <div>{RMA_STAGE_LABELS[entry.from as RmaStageStatus]?.labelId || entry.from} → {RMA_STAGE_LABELS[entry.to as RmaStageStatus]?.labelId || entry.to}</div>
                                    <p className="whitespace-pre-wrap text-slate-600">{entry.note}</p>
                                  </li>)}</ol>
                                </details>}
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

        {filteredClaims.length > 0 && <CompactPagination page={currentPage} totalItems={filteredClaims.length} pageSize={itemsPerPage} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setItemsPerPage(size); setCurrentPage(1); }} pageSizeOptions={[25, 50, 100]} itemLabel="kasus" ariaLabel="Paginasi klaim RMA" />}
      </div>

      {/* Formulir banding RMA sederhana */}
      {editingClaim && <dialog ref={editDialogRef} aria-labelledby="rma-form-title" className="warehouse-filter-dialog max-w-lg" onCancel={event=>{if(isSavingRma)event.preventDefault();else setEditingClaim(null);}}>
        <div className="bg-white rounded-3xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-4">
          <header className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h2 id="rma-form-title" className="text-lg font-bold text-slate-900">Catat banding RMA</h2><p className="text-xs text-slate-500">Resi / Order: {editingClaim.awb || editingClaim.orderId}</p><p className="text-xs font-semibold text-indigo-700">Toko: {stores.find(store=>store.id===editingClaim.storeId)?.name || editingClaim.storeName || 'Toko belum dipilih'}</p></div><button type="button" aria-label="Tutup formulir RMA" disabled={isSavingRma} onClick={()=>setEditingClaim(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18}/></button></header>
          <div className="space-y-4 text-sm">
            <label className="block font-semibold">Status banding<select aria-label="Status banding RMA" disabled={isRmaClosed(editingClaim.stageStatus)||isSavingRma} value={modalSimpleStatus} onChange={event=>{const status=event.target.value as typeof modalSimpleStatus;setModalSimpleStatus(status);if(status==='REJECTED'){setModalDecisionAmount('0');setModalApprovedAmount('0');}if(!['APPROVED','REJECTED'].includes(status))setModalCloseCase(false);}} className="mt-1 w-full border border-slate-200 rounded-xl p-2.5"><option value="PENDING">Draf</option><option value="SUBMITTED">Diajukan ke logistik</option><option value="WAITING">Menunggu keputusan</option><option value="APPROVED">Disetujui (penuh atau sebagian)</option><option value="REJECTED">Banding tidak berhasil</option></select></label>
            <section aria-labelledby="rma-valuation-title" className="space-y-3 rounded-xl border border-slate-200 p-3"><h3 id="rma-valuation-title" className="font-bold">Nilai klaim logistik</h3><label className="block">Ekspedisi tujuan <span className="text-slate-500">(opsional)</span><input aria-label="Ekspedisi tujuan RMA" disabled={!canReturnRmaToCs(editingClaim.stageStatus)||isSavingRma} value={modalLogistics} onChange={event=>setModalLogistics(event.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
              {editingClaim.items.map((item,index)=><label key={item.sourceKey||index} className="block"><span className="font-semibold">{item.skuId} · {item.namaBarang}</span><span className="block text-xs text-slate-500">{item.qty} unit · {item.kondisi}</span><input aria-label={'Nominal klaim '+item.skuId+', barang '+(index+1)} inputMode="numeric" disabled={!canReturnRmaToCs(editingClaim.stageStatus)||isSavingRma} value={modalItemAmounts[index]||''} onChange={event=>setModalItemAmounts(values=>values.map((value,i)=>i===index?event.target.value.replace(/[^0-9]/g,''):value))} className="mt-1 w-full border rounded-lg p-2 font-mono"/></label>)}
              <p className="font-bold text-indigo-900">Total nilai klaim: {formatRupiah(modalEstimate)}</p>
            </section>
            {modalSimpleStatus==='APPROVED'&&<section className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3"><label className="block font-bold">Total hasil banding disetujui (Rp)<input aria-label="Total hasil banding RMA" inputMode="numeric" disabled={isRmaClosed(editingClaim.stageStatus)||isSavingRma} value={modalDecisionAmount} onChange={event=>setModalDecisionAmount(event.target.value.replace(/[^0-9]/g,''))} placeholder="Ketik total hasil, misalnya 10000" className="mt-1 w-full border rounded-lg bg-white p-2.5 font-mono"/></label><p className="text-xs text-slate-600">Contoh: SKU A Rp10.000 + SKU B Rp10.000 = klaim Rp20.000. Jika hasilnya Rp10.000, cukup ketik 10000 di sini.</p><p className="text-xs font-semibold text-indigo-800">{classifyApprovedAmount(Number(modalDecisionAmount),modalEstimate)==='APPROVED'?'Disetujui penuh sesuai nilai diajukan':Number(modalDecisionAmount)>0?'Disetujui sebagian dari nilai diajukan':'Isi nominal sesuai keputusan logistik.'}</p><p className="text-xs">Nilai tidak disetujui: <strong>{formatRupiah(Math.max(0,modalEstimate-(Number(modalDecisionAmount)||0)))}</strong></p></section>}
            {modalSimpleStatus==='REJECTED'&&<p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">Banding tidak berhasil. Total hasil banding Rp0.</p>}
            <label className="block font-semibold">Catatan keputusan <span className="font-normal text-slate-500">(opsional)</span><textarea aria-label="Catatan keputusan RMA" value={modalResolutionNote} onChange={event=>setModalResolutionNote(event.target.value)} placeholder="Contoh: Potongan ongkir atau batas penggantian sesuai keputusan logistik" rows={2} className="mt-1 w-full border rounded-lg p-2 resize-none"/></label>
            <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-semibold">Informasi tambahan</summary><div className="mt-3 space-y-3"><div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-indigo-900"><strong>Dana diterima dicatat oleh Finance.</strong><p className="mt-1">RMA hanya memasukkan nominal hasil banding yang disetujui logistik. Penerimaan uang dicatat terpisah melalui menu Finance.</p></div><label className="block">Nomor tiket logistik (opsional)<input aria-label="Nomor tiket logistik (opsional)" value={modalTicket} onChange={event=>setModalTicket(event.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label><label className="block">Penanggung jawab RMA<input value={modalInvestigator} onChange={event=>setModalInvestigator(event.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>{['APPROVED','REJECTED'].includes(modalSimpleStatus)&&<><label className="flex items-center gap-2"><input type="checkbox" checked={modalCloseCase} disabled={isRmaClosed(editingClaim.stageStatus)} onChange={event=>setModalCloseCase(event.target.checked)}/>Tutup kasus setelah disimpan</label>{modalCloseCase&&<label className="block">Alasan penutupan jika dana belum lunas<input value={modalClosureReason} onChange={event=>setModalClosureReason(event.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>}</>}</div></details>
            {!!editingClaim.history?.length&&<details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-semibold">Riwayat penanganan ({editingClaim.history.length})</summary><ol className="mt-2 space-y-2 text-xs">{editingClaim.history.map((entry,index)=><li key={entry.at+'-'+index} className="border-t border-slate-100 pt-2"><strong>{entry.by}</strong> · {new Date(entry.at).toLocaleString('id-ID')}<p>{entry.note}</p></li>)}</ol></details>}
          </div>
          {modalError&&<p role="alert" className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3">{modalError}</p>}
          <footer className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" disabled={isSavingRma} onClick={()=>setEditingClaim(null)} className="warehouse-button">Batal</button><button type="button" disabled={isSavingRma} onClick={handleSaveModal} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-60">{isSavingRma?'Menyimpan…':'Simpan hasil banding'}</button></footer>
        </div>
      </dialog>}

      {/* MODAL ROLLBACK: KEMBALIKAN KASUS KE CUSTOMER SERVICE */}
      {returnTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => { if (!isReturning) setReturnTarget(null); }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-amber-200 max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95"
            role="dialog" aria-modal="true" aria-label="Kembalikan kasus ke CS"
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
                disabled={isReturning}
                onClick={() => { if (!isReturning) setReturnTarget(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Tutup pengembalian kasus</span>
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-1">
                <p className="font-bold text-amber-900">
                  Tanggung jawab penanganan kasus klaim ini akan dikembalikan ke tim Customer Service.
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Setelah berhasil disimpan, kasus kembali ke antrean CS. Riwayat penanganan dan bukti RMA tetap tersimpan dan dapat dibaca.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
                  Pilih / Tulis Alasan Pengembalian ke Tim CS:
                </label>
                <div className="space-y-1.5">
                  {[
                    'Perlu tindak lanjut marketplace oleh CS.',
                    'Dasar klaim logistik belum sesuai; perlu peninjauan CS.'
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      disabled={isReturning}
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
                    Alasan pengembalian ke CS (wajib):
                  </label>
                  <textarea
                    aria-label="Alasan pengembalian ke CS"
                    disabled={isReturning}
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

            {!returnReason.trim() && <p className="text-xs text-amber-900">Isi alasan pengembalian agar CS mengetahui tindak lanjut yang diperlukan.</p>}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isReturning}
                onClick={() => { if (!isReturning) setReturnTarget(null); }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isReturning || !returnReason.trim()}
                onClick={async () => {
                  if (!onReturnToCs || !returnTarget || isReturning) return;
                  if (!returnReason.trim()) { showToast('Isi alasan pengembalian ke CS.'); return; }
                  setIsReturning(true);
                  try {
                    const saved = await onReturnToCs(returnTarget.orderId, returnReason.trim());
                    if (!saved) { showToast('Gagal menyimpan pengembalian. Formulir tetap tersedia; coba lagi.'); return; }
                    showToast(`✓ Kasus Order ${returnTarget.orderId} dikembalikan ke antrean CS. Riwayat RMA tetap tersimpan.`);
                    setReturnTarget(null);
                  } catch {
                    showToast('Gagal menyimpan pengembalian. Formulir tetap tersedia; coba lagi.');
                  } finally { setIsReturning(false); }
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>{isReturning ? 'Menyimpan pengembalian…' : 'Kembalikan ke CS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
