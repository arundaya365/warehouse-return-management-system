import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  FileSpreadsheet,
  Filter,
  Search,
  Download,
  Package,
  ShieldAlert,
  Video,
  Truck,
  ShoppingBag,
  DollarSign,
  X,
  Edit3,
  FileText,
  RotateCcw,
  Boxes,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  PackageCheck,
  Trash2,
  Share2,
  ArrowRight,
  Send,
  Lock,
  CheckSquare
} from 'lucide-react';
import { ProcessedReturnRow, StandardKondisi } from '../processor';
import { MasterSKUItem } from '../utils/excelTemplate';
import { useLanguage } from '../context/LanguageContext';
import { useAccount, ROLE_DEFINITIONS } from '../context/AccountContext';
import { getDirectVideoUrl } from './ResultViewer';
import { syncService } from '../services/dataSyncService';
import { RmaClaimRecord, RmaClaimItem, RMA_STAGE_LABELS } from '../types/rma';
import type { StoreProfile } from '../types/store';
import { getEscalationError, rejectedItems, logisticsChannel, approvedMarketplaceAmount, uncoveredClaimAmount, allocateClaimAmount, paymentStatus } from '../utils/claimWorkflow';
import { detectMarketplaceAndLogistics } from '../utils/awbDetection';
import { ClaimPageHeader } from './ClaimPageHeader';
import { CompactPagination } from './CompactPagination';

export type ClaimStatus = 'PENDING' | 'SUBMITTED' | 'WAITING' | 'APPROVED' | 'PARTIAL' | 'REJECTED';

export type ClaimChannel =
  | 'Shopee'
  | 'TikTok Shop'
  | 'Tokopedia'
  | 'Lazada'
  | 'Blibli'
  | 'J&T Express'
  | 'SiCepat'
  | 'SPX Express'
  | 'JNE'
  | 'Anteraja'
  | 'Ninja Xpress'
  | 'Lainnya';

export interface DisputeRecord {
  id: string; // Order_ID + SKU_ID
  row: ProcessedReturnRow;
  channel: ClaimChannel;
  claimStatus: ClaimStatus;
  closedAt?: string;
  closureReason?: string;
  ticketNumber: string;
  claimAmount: number; // in IDR (nilai tuntutan diajukan ke ekspedisi/marketplace)
  approvedAmount?: number;
  /** Nominal keputusan marketplace untuk seluruh order, bukan per SKU. */
  orderApprovedAmount?: number;
  storeId?: string;
  storeName?: string;
  storeCode?: string;
  paymentStatus?: string;
  paymentReference?: string;
  financeReceivedAmount?: number;
  financePaymentDate?: string;
  financePaymentReference?: string;
  financePaymentMethod?: string;
  history?: Array<{at:string; by:string; note:string}>;
  settlementAmount?: number; // in IDR (nilai penggantian aktual yang disetujui/dicairkan ekspedisi)
  settlementNote?: string; // alasan selisih ganti rugi ekspedisi
  isForwardedToRma?: boolean;
  csNotes: string;
  updatedAt: string;
}

export interface DamagedDisputeItem {
  key: string;
  itemIndex: number;
  row: ProcessedReturnRow;
  channel: ClaimChannel;
  claimStatus: ClaimStatus;
  closedAt?: string;
  closureReason?: string;
  ticketNumber: string;
  claimAmount: number;
  approvedAmount?: number;
  orderApprovedAmount?: number;
  storeId?: string;
  storeName?: string;
  storeCode?: string;
  paymentStatus?: string;
  paymentReference?: string;
  financeReceivedAmount?: number;
  history?: Array<{at:string; by:string; note:string}>;
  settlementAmount?: number;
  settlementNote: string;
  masterPrice?: number;
  basePrice: number;
  actualCompensation: number;
  netLoss: number;
  recoveryPct: number;
  isForwardedToRma?: boolean;
  csNotes: string;
}

export interface OrderDisputeGroup {
  orderId: string;
  operatorId: string;
  marketplace?: string;
  ekspedisi?: string;
  waktuProses: string;
  videoTimestamp: string;
  namaFileVideo: string;
  linkVideo?: string;
  allItems: ProcessedReturnRow[];
  goodItems: ProcessedReturnRow[];
  damageItems: DamagedDisputeItem[];
  totalItemsCount: number;
  goodCount: number;
  damageCount: number;
  totalClaimAmount: number;
  totalSettlementReceived: number;
  totalNetLoss: number;
  overallStatus: ClaimStatus;
  skuList: { skuId: string; namaBarang: string; qty: number }[];
  skuVariationsCount: number;
  conditionBreakdown: {
    good: number;
    damageProduct: number;
    damagePackaging: number;
    totallyDamage: number;
    missing: number;
    unexpected: number;
  };
}

interface DisputeClaimsViewProps {
  rows: ProcessedReturnRow[];
  onNavigateToStation: () => void;
  onNavigateToReports: () => void;
  onNavigateToRma?: () => void;
  onNavigateToHistory?: () => void;
  masterDatabase?: MasterSKUItem[];
  onDeleteOrder?: (orderId: string) => void;
  rmaClaims?: RmaClaimRecord[];
  stores?: StoreProfile[];
  onForwardToRma?: (claim: RmaClaimRecord) => void;
  onDisputeRecordsChange?: (records: Record<string, any>) => void;
}

const DEFAULT_CHANNELS: ClaimChannel[] = ['Shopee', 'TikTok Shop', 'Tokopedia', 'Lazada', 'Blibli', 'Lainnya'];

export const DisputeClaimsView: React.FC<DisputeClaimsViewProps> = ({
  rows,
  onNavigateToStation,
  onNavigateToReports,
  onNavigateToRma,
  onNavigateToHistory,
  masterDatabase = [],
  onDeleteOrder,
  rmaClaims = [],
  stores = [],
  onForwardToRma,
  onDisputeRecordsChange
}) => {
  const { t, isEn } = useLanguage();
  const { currentUser } = useAccount();
  const canDelete = currentUser.role === 'SUPER_ADMIN' || ROLE_DEFINITIONS[currentUser.role]?.permissions?.canDeleteReports === true;

  // Lookup item price from master database SKU
  const lookupItemPrice = (skuId: string): number | undefined => {
    if (!masterDatabase || masterDatabase.length === 0) return undefined;
    const match = masterDatabase.find(
      (m) =>
        m.SKU_ID.trim().toUpperCase() === (skuId || '').trim().toUpperCase() ||
        m.BARCODE.trim() === (skuId || '').trim()
    );
    return match?.HARGA;
  };

  // State dispute / data klaim dari localStorage
  const [disputeRecords, setDisputeRecords] = useState<Record<string, Partial<DisputeRecord>>>(() => {
    try {
      const saved = localStorage.getItem('rma_cs_dispute_claims_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Sinkronisasi klaim dispute dari database pusat Cloud SQL
  useEffect(() => {
    const unsubscribe = syncService.subscribe((payload) => {
      if (payload.disputes && typeof payload.disputes === 'object') {
        setDisputeRecords(payload.disputes);
        if (onDisputeRecordsChange) {
          onDisputeRecordsChange(payload.disputes);
        }
        try {
          localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(payload.disputes));
        } catch {}
      }
    });
    return () => unsubscribe();
  }, [onDisputeRecordsChange]);

  // Simpan perubahan ke localStorage & server database Cloud SQL dengan menjaga _rma_claims_list_
  const saveDisputeRecords = async (
    updated: Record<string, Partial<DisputeRecord>>,
    explicitRmaClaims?: RmaClaimRecord[]
  ) => {
    try {
      const currentRmaList = explicitRmaClaims || (rmaClaims && rmaClaims.length > 0 ? rmaClaims : (() => {
        try {
          const raw = localStorage.getItem('rma_claims_records_v1') || localStorage.getItem('rma_claims_storage_v1');
          return raw ? JSON.parse(raw) : [];
        } catch { return []; }
      })());
      const payloadToSave: Record<string, any> = { ...updated };
      if (Array.isArray(currentRmaList)) {
        payloadToSave['_rma_claims_list_'] = currentRmaList;
      }
      const saved = await syncService.pushDisputes(payloadToSave);
      if (!saved) {
        showToast(syncService.getLastErrorMessage() || 'Gagal menyimpan klaim ke server. Periksa koneksi lalu coba lagi.');
        return false;
      }
      setDisputeRecords(payloadToSave);
      onDisputeRecordsChange?.(payloadToSave);
      localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(payloadToSave));
      if (Array.isArray(currentRmaList)) {
        localStorage.setItem('rma_claims_records_v1', JSON.stringify(currentRmaList));
        localStorage.setItem('rma_claims_storage_v1', JSON.stringify(currentRmaList));
      }
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan klaim. Coba lagi.');
      return false;
    }
  };


  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDamageType, setFilterDamageType] = useState<string>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'DAMAGE_ONLY' | 'ALL_RETURNS'>('DAMAGE_ONLY');

  // Pagination State: 50 Order ID per halaman secara default
  const [ordersPerPage, setOrdersPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Expanded Order IDs
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Inline Quick Edit di tabel untuk input angka manual langsung
  const [inlineEditingKey, setInlineEditingKey] = useState<string | null>(null);
  const [inlineSettlementInput, setInlineSettlementInput] = useState<string>('');

  // Checkbox seleksi batch order
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  // Modal Hasil Pengajuan banding Klaim Order (Per 1 Order dengan checklist produk)
  const [claimModalOrder, setClaimModalOrder] = useState<OrderDisputeGroup | null>(null);
  const [claimModalChannel, setClaimModalChannel] = useState<ClaimChannel>('Shopee');
  const [claimModalStoreId, setClaimModalStoreId] = useState('');
  const [claimModalStatus, setClaimModalStatus] = useState<ClaimStatus>('SUBMITTED');
  const [claimModalTicketNumber, setClaimModalTicketNumber] = useState<string>('');
  const [claimModalTotalSettlement, setClaimModalTotalSettlement] = useState<string>('');
  const [marketplaceReceived, setMarketplaceReceived] = useState('0');
  const [marketplacePaymentRef, setMarketplacePaymentRef] = useState('');
  const [claimModalCsNotes, setClaimModalCsNotes] = useState<string>('');
  const [selectedSuccessSkuKeys, setSelectedSuccessSkuKeys] = useState<Set<string>>(new Set());
  const [claimModalActiveTab, setClaimModalActiveTab] = useState<'form' | 'template' | 'evidence'>('form');

  // Modal Detail / Form Pengajuan banding (Legacy / per item fallback)
  const [selectedDispute, setSelectedDispute] = useState<{
    key: string;
    row: ProcessedReturnRow;
  } | null>(null);

  // Modal Konfirmasi Hapus Order Super Admin (In-App)
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [closingOrder, setClosingOrder] = useState<OrderDisputeGroup | null>(null);
  const [csClosureReason, setCsClosureReason] = useState('');
  const [closingBusy,setClosingBusy] = useState(false);
  const [csClosureError,setCsClosureError] = useState('');
  const closeDialogRef = useRef<HTMLDialogElement>(null);
  const claimSnapshotRef = useRef('');
  const closingSnapshotRef = useRef('');
  const snapshotItems = (order: OrderDisputeGroup) => JSON.stringify(Object.entries(disputeRecords).filter(([key,item]) => !key.startsWith('_') && String(item?.row?.Order_ID || '').trim().toUpperCase() === order.orderId.trim().toUpperCase()).sort(([a],[b])=>a.localeCompare(b)));
  useEffect(()=>{if(closingOrder) closeDialogRef.current?.showModal(); else closeDialogRef.current?.close();},[closingOrder]);

  // Form State dalam Modal
  const [formChannel, setFormChannel] = useState<ClaimChannel>('Shopee');
  const [formStatus, setFormStatus] = useState<ClaimStatus>('PENDING');
  const [formTicketNumber, setFormTicketNumber] = useState<string>('');
  const [formClaimAmount, setFormClaimAmount] = useState<string>('0');
  const [formSettlementAmount, setFormSettlementAmount] = useState<string>('0');
  const [formSettlementNote, setFormSettlementNote] = useState<string>('');
  const [formCsNotes, setFormCsNotes] = useState<string>('');
  const [activeModalTab, setActiveModalTab] = useState<'form' | 'template' | 'evidence'>('form');

  // Status feedback copy
  const [copiedDraft, setCopiedDraft] = useState<boolean>(false);
  const [copiedQuick, setCopiedQuick] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // One click transfers existing evidence and ownership; RMA completes missing details.
  const [forwardingOrderId, setForwardingOrderId] = useState<string | null>(null);
  const forwardingBusyRef = useRef(false);

  const forwardedRmaMap = useMemo(() => {
    const map = new Map<string, RmaClaimRecord>();
    (rmaClaims || []).filter(c => c.stageStatus !== 'DIKEMBALIKAN_CS').forEach((c) => {
      const oid = String(c.orderId || '').trim();
      if (oid) {
        map.set(oid, c);
        map.set(oid.toUpperCase(), c);
        map.set(oid.toLowerCase(), c);
      }
    });
    return map;
  }, [rmaClaims]);

  const handleDirectForwardToRma = async (order: OrderDisputeGroup, selectedStore?: StoreProfile) => {
    if (forwardingBusyRef.current) return;
    const error = getEscalationError(order.damageItems, forwardedRmaMap.has(order.orderId.trim().toUpperCase()));
    if (error) { showToast(error); return; }
    const handoverStore = selectedStore || stores.find(store => store.id === order.damageItems.find(item => item.storeId)?.storeId && store.status === 'ACTIVE');
    if (!handoverStore) { showToast('Pilih toko asal klaim sebelum memindahkan kasus ke RMA.'); return; }
    const eligible = rejectedItems(order.damageItems);
    const nowIso = new Date().toISOString();
    const cleanOrderId = order.orderId.trim();
    const handoverBy = String(currentUser.fullName || currentUser.username || currentUser.operatorCode || '').trim() || 'Petugas CS';
    const existingNotes = eligible.map(item=>item.csNotes).filter(Boolean).join('; ');
    const handoverNote = existingNotes || 'Dipindahkan langsung oleh CS';
    const logisticsName = order.ekspedisi && order.ekspedisi !== 'Lainnya' ? order.ekspedisi : '';
    const allRmaItems: RmaClaimItem[] = eligible.map(item => ({
      sourceKey:item.key, skuId:item.row.SKU_ID, namaBarang:item.row.Nama_Barang,
      qty:1, kondisi:item.row.Kondisi, hargaSatuan:item.masterPrice ?? item.basePrice ?? 0,
      subtotalEstimasi:uncoveredClaimAmount(item), sourceClaimAmount:item.claimAmount || 0,
      marketplaceReservedAmount:Math.max(approvedMarketplaceAmount(item),item.actualCompensation),
      valuationPending:!(item.claimAmount > 0)
    }));
    const rmaRecord: RmaClaimRecord = {
      id:'rma_'+cleanOrderId+'_'+Date.now(), orderId:cleanOrderId,
      awb:(order.allItems[0] as Record<string,any>)?.No_Resi || cleanOrderId,
      channel:logisticsChannel(logisticsName), logisticsName,
      marketplaceChannel:eligible[0]?.channel,
      storeId:handoverStore.id, storeName:handoverStore.name, storeCode:handoverStore.code,
      handoverReason:handoverNote, handoverEvidence:order.linkVideo || order.namaFileVideo || '',
      marketplaceCashAtHandover:order.damageItems.reduce((sum,item)=>sum+item.actualCompensation,0),
      marketplaceTicket:eligible.map(item=>item.ticketNumber).find(ticket=>!!ticket && ticket!=='-'),
      stageStatus:'DIALIHKAN_KE_RMA', items:allRmaItems,
      estimatedCompensation:allRmaItems.reduce((sum,item)=>sum+item.subtotalEstimasi,0),
      csNotes:handoverNote, forwardedBy:handoverBy, forwardedAt:nowIso,
      videoTimestamp:order.videoTimestamp, namaFileVideo:order.namaFileVideo, linkVideo:order.linkVideo,
      operatorId:order.operatorId, waktuProses:order.waktuProses,
      history:[{at:nowIso,by:handoverBy,from:'CS',to:'DIALIHKAN_KE_RMA',note:'Dipindahkan langsung oleh CS; data pemeriksaan dan bukti yang tersedia ikut terbawa.'}],
      updatedAt:nowIso
    };
    const updatedDisputes={...disputeRecords};
    order.damageItems.forEach(item=>{
      const existing=updatedDisputes[item.key] || {};
      const updated={...existing,id:item.key,row:item.row,channel:item.channel,
        claimStatus:existing.claimStatus || item.claimStatus,ticketNumber:existing.ticketNumber || item.ticketNumber,
        claimAmount:existing.claimAmount ?? item.claimAmount,approvedAmount:existing.approvedAmount ?? item.approvedAmount,
        storeId:handoverStore.id,storeName:handoverStore.name,storeCode:handoverStore.code,
        settlementAmount:existing.settlementAmount ?? item.settlementAmount,isForwardedToRma:true,
        csNotes:'[DIALIHKAN KE RMA] '+(existing.csNotes || item.csNotes || ''),updatedAt:nowIso};
      updatedDisputes[item.key]=updated;
      const legacyKey=item.row.Order_ID+'_'+item.row.SKU_ID+'_'+item.itemIndex;
      if(legacyKey!==item.key)updatedDisputes[legacyKey]={...updated,id:legacyKey};
    });
    forwardingBusyRef.current=true;setForwardingOrderId(cleanOrderId);
    try {
      if (!(await saveDisputeRecords(updatedDisputes,[rmaRecord,...(rmaClaims || [])]))) return;
      onForwardToRma?.(rmaRecord);
      setClaimModalOrder(current => current?.orderId === cleanOrderId ? null : current);
      showToast('Kasus '+cleanOrderId+' dipindahkan ke antrean RMA.');
    } finally { forwardingBusyRef.current=false;setForwardingOrderId(null); }
  };

  // Generate Key unik untuk setiap item retur kerusakan (deterministik per Order ID)
  const getItemKey = (row: ProcessedReturnRow, index: number) => {
    return `${row.Order_ID || 'ORDER'}__${row.SKU_ID || 'SKU'}__${index}`;
  };

  // Deteksi channel klaim baku dari Order ID menggunakan formula resmi Excel
  const detectChannelFromOrderId = (orderId: string): ClaimChannel => {
    const detected = detectMarketplaceAndLogistics(orderId);
    if (detected.marketplace === 'TikTok Shop') return 'TikTok Shop';
    if (detected.marketplace === 'Tokopedia Indonesia') return 'Tokopedia';
    if (detected.marketplace === 'Lazada Indonesia') return 'Lazada';
    if (detected.marketplace === 'Shopee Indonesia') return 'Shopee';
    const id = (orderId || '').toUpperCase();
    if (id.includes('TOKOPEDIA') || id.includes('TKP')) return 'Tokopedia';
    if (id.includes('TIKTOK') || id.includes('TTS')) return 'TikTok Shop';
    if (id.includes('LAZADA') || id.includes('LZD')) return 'Lazada';
    return 'Lainnya'; // Kanal belum diketahui: harus dipilih operator.
  };

  // Format IDR currency
  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  };

  // KELOMPOKKAN SEMUA DATA PER ORDER ID LALU RINCIKAN SEMUA SKU (GOOD & DAMAGE)
  const orderGroups = useMemo(() => {
    const map = new Map<string, ProcessedReturnRow[]>();
    for (const r of rows) {
      const orderId = String(r.Order_ID || 'UNASSIGNED').trim();
      if (!map.has(orderId)) {
        map.set(orderId, []);
      }
      map.get(orderId)!.push(r);
    }

    const groups: OrderDisputeGroup[] = [];

    for (const [orderId, orderRows] of map.entries()) {
      const firstRow = orderRows[0];
      const goodRows = orderRows.filter((r) => r.Kondisi === 'Good' || r.Kondisi?.trim().toLowerCase() === 'good');
      const damageRows = orderRows.filter((r) => r.Kondisi !== 'Good' && r.Kondisi?.trim().toLowerCase() !== 'good');

      const damagedItems: DamagedDisputeItem[] = damageRows.map((row, idxInOrder) => {
        const key = getItemKey(row, idxInOrder);
        const legacyKey1 = `${row.Order_ID || 'ORDER'}_${row.SKU_ID || 'SKU'}_${idxInOrder}`;
        const claim =
          disputeRecords[key] ||
          disputeRecords[legacyKey1] ||
          Object.entries(disputeRecords).find(([k]) =>
            k.startsWith(`${row.Order_ID}__${row.SKU_ID}__${idxInOrder}`) ||
            k.startsWith(`${row.Order_ID}_${row.SKU_ID}_${idxInOrder}`)
          )?.[1] ||
          Object.entries(disputeRecords).find(([k]) =>
            k.startsWith(`${row.Order_ID}__${row.SKU_ID}`) ||
            k.startsWith(`${row.Order_ID}_${row.SKU_ID}`)
          )?.[1];
        const channel = (claim?.channel as ClaimChannel) || detectChannelFromOrderId(row.Order_ID);
        const itemMasterPrice = lookupItemPrice(row.SKU_ID);
        const basePrice = itemMasterPrice !== undefined ? itemMasterPrice : 0;

        const isFull100Claim =
          row.Kondisi === 'Totally Damage' ||
          row.Kondisi === 'Missing Item' ||
          row.Kondisi === 'Missing' ||
          (row.Kondisi as string) === 'Damage Total';

        const defaultClaimAmount = isFull100Claim ? basePrice : (itemMasterPrice !== undefined ? itemMasterPrice : 0);
        const claimAmount = claim?.claimAmount ?? defaultClaimAmount;
        const defaultStatus: ClaimStatus = 'PENDING';
        const status: ClaimStatus = (claim?.claimStatus as ClaimStatus) || defaultStatus;
        const ticketNumber = claim?.ticketNumber || '-';

        const settlementAmount =
          claim?.settlementAmount !== undefined
            ? claim.settlementAmount
            : (status === 'REJECTED' ? 0 : undefined);
        const financeReceivedAmount = claim?.financeReceivedAmount;
        const actualCompensation = ['APPROVED', 'PARTIAL'].includes(status) ? (financeReceivedAmount ?? settlementAmount ?? 0) : 0;
        const netLoss = Math.max(0, basePrice - actualCompensation);
        const recoveryPct = basePrice > 0 ? Math.min(100, Math.round((actualCompensation / basePrice) * 100)) : 0;

        return {
          key,
          itemIndex: idxInOrder,
          row,
          channel,
          claimStatus: status,
          ticketNumber,
          claimAmount,
          approvedAmount: claim?.approvedAmount ?? (['APPROVED','PARTIAL'].includes(status) ? settlementAmount : 0),
          orderApprovedAmount: claim?.orderApprovedAmount,
          storeId: claim?.storeId,
          storeName: claim?.storeName,
          storeCode: claim?.storeCode,
          settlementAmount,
          financeReceivedAmount,
          settlementNote: claim?.settlementNote || '',
          masterPrice: itemMasterPrice,
          basePrice,
          actualCompensation,
          netLoss,
          recoveryPct,
          csNotes: claim?.csNotes || '',
          closedAt: claim?.closedAt,
          closureReason: claim?.closureReason
        };
      });

      const totalClaimAmount = damagedItems.reduce((acc, curr) => acc + curr.claimAmount, 0);
      const totalSettlementReceived = damagedItems.reduce((acc, curr) => acc + curr.actualCompensation, 0);
      const totalNetLoss = damagedItems.reduce((acc, curr) => acc + curr.netLoss, 0);

      // Status overall order
      let overallStatus: ClaimStatus = 'PENDING';
      if (damagedItems.length === 0) {
        overallStatus = 'APPROVED';
      } else if (damagedItems.every((d) => d.claimStatus === 'APPROVED')) {
        overallStatus = 'APPROVED';
      } else if (damagedItems.every((d) => d.claimStatus === 'REJECTED')) {
        overallStatus = 'REJECTED';
      } else if (damagedItems.some((d) => d.claimStatus === 'PARTIAL' || d.claimStatus === 'APPROVED')) {
        overallStatus = 'PARTIAL';
      } else if (damagedItems.some((d) => ['SUBMITTED','WAITING'].includes(d.claimStatus))) {
        overallStatus = 'SUBMITTED';
      }

      // Hitung variasi SKU dan breakdown kondisi persis seperti pada halaman laporan
      const skuList: { skuId: string; namaBarang: string; qty: number }[] = [];
      const conditionBreakdown = {
        good: 0,
        damageProduct: 0,
        damagePackaging: 0,
        totallyDamage: 0,
        missing: 0,
        unexpected: 0
      };

      for (const r of orderRows) {
        const k = (r.Kondisi || '').trim();
        if (k === 'Good' || k === 'Good Condition' || k === 'Baik') {
          conditionBreakdown.good += 1;
        } else if (k === 'Damage Packaging' || k === 'Dus' || k === 'Kemasan Rusak') {
          conditionBreakdown.damagePackaging += 1;
        } else if (k === 'Totally Damage' || k === 'Damage Total' || k === 'Total Rusak') {
          conditionBreakdown.totallyDamage += 1;
        } else if (k === 'Wrong Item' || k === 'Unexpected' || k === 'Salah Barang') {
          conditionBreakdown.unexpected += 1;
        } else if (k === 'Missing Item' || k === 'Missing' || k === 'Barang Hilang') {
          conditionBreakdown.missing += 1;
        } else {
          conditionBreakdown.damageProduct += 1;
        }

        const sId = r.SKU_ID || '-';
        let sEntry = skuList.find((s) => s.skuId === sId);
        if (!sEntry) {
          sEntry = { skuId: sId, namaBarang: r.Nama_Barang || '-', qty: 0 };
          skuList.push(sEntry);
        }
        sEntry.qty += 1;
      }

      const detected = detectMarketplaceAndLogistics(orderId);
      const marketplace = firstRow.Marketplace || detected.marketplace || 'Lainnya';
      const ekspedisi = firstRow.Ekspedisi || detected.logistics || 'Lainnya';

      groups.push({
        orderId,
        operatorId: firstRow.Operator_ID || 'Operator',
        marketplace,
        ekspedisi,
        waktuProses: firstRow.Waktu_Proses || firstRow.Video_Timestamp || '-',
        videoTimestamp: firstRow.Video_Timestamp || '-',
        namaFileVideo: firstRow.Nama_File_Video || '',
        linkVideo: getDirectVideoUrl(firstRow.Link_Video, firstRow.Order_ID),
        allItems: orderRows,
        goodItems: goodRows,
        damageItems: damagedItems,
        totalItemsCount: orderRows.length,
        goodCount: goodRows.length,
        damageCount: damageRows.length,
        totalClaimAmount,
        totalSettlementReceived,
        totalNetLoss,
        overallStatus,
        skuList,
        skuVariationsCount: skuList.length,
        conditionBreakdown
      });
    }

    return groups;
  }, [rows, disputeRecords, masterDatabase]);

  // Saring Order ID berdasarkan kriteria pencarian dan filter CS
  const filteredOrders = useMemo(() => {
    return orderGroups.filter((group) => {
      // 1. View Mode (Default: Hanya Order dengan barang Damage / Klaim)
      if (viewMode === 'DAMAGE_ONLY' && group.damageCount === 0) {
        return false;
      }

      // 2. Search Query (Order ID, SKU ID, Nama Barang, Operator, No Tiket)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchOrder = group.orderId.toLowerCase().includes(q);
        const matchOperator = group.operatorId.toLowerCase().includes(q);
        const matchSku = group.allItems.some((r) => r.SKU_ID.toLowerCase().includes(q));
        const matchName = group.allItems.some((r) => r.Nama_Barang.toLowerCase().includes(q));
        const matchTicket = group.damageItems.some((d) => d.ticketNumber.toLowerCase().includes(q));
        const matchNotes = group.allItems.some((r) => (r.Catatan_Tambahan || '').toLowerCase().includes(q));
        if (!matchOrder && !matchOperator && !matchSku && !matchName && !matchTicket && !matchNotes) {
          return false;
        }
      }

      // 3. Filter Status Klaim & Pemisahan Antrean RMA
      const cleanId = group.orderId.trim();
      const isForwardedToRma =
        forwardedRmaMap.has(cleanId) ||
        forwardedRmaMap.has(cleanId.toUpperCase()) ||
        forwardedRmaMap.has(cleanId.toLowerCase()) ||
        group.damageItems.some((d) => {
          const rec = disputeRecords[d.key];
          return rec?.isForwardedToRma === true || (rec?.csNotes && rec.csNotes.includes('[DIALIHKAN KE RMA]'));
        });

      const closed = group.damageItems.length > 0 && group.damageItems.every(item=>!!item.closedAt);
      const terminal = group.damageItems.length > 0 && group.damageItems.every(item=>['APPROVED','PARTIAL','REJECTED'].includes(item.claimStatus));
      if (filterStatus === 'CLOSED') {
        if (!closed || isForwardedToRma) return false;
      } else if (filterStatus === 'PAYMENT_PENDING') {
        if (!group.damageItems.some(item => approvedMarketplaceAmount(item) > item.actualCompensation)) return false;
      } else if (filterStatus === 'FORWARDED_RMA') {
        // Tampilkan hanya order yang telah dialihkan ke Tim RMA
        if (!isForwardedToRma) return false;
      } else {
        // Pada antrean aktif CS (Semua Aktif, Draft, Diajukan, Disetujui, Ditolak):
        // Sembunyikan order yang sudah dialihkan ke RMA agar antrean CS bersih!
        if (isForwardedToRma || closed || terminal) return false;

        if (filterStatus !== 'ALL') {
          if (!group.damageItems.some((d) => filterStatus === 'SUBMITTED' ? ['SUBMITTED','WAITING'].includes(d.claimStatus) : d.claimStatus === filterStatus)) {
            return false;
          }
        }
      }

      // 4. Filter Jenis Kerusakan
      if (filterDamageType !== 'ALL') {
        if (
          !group.damageItems.some((d) => {
            if (filterDamageType === 'Totally Damage') {
              return d.row.Kondisi === 'Totally Damage' || (d.row.Kondisi as string) === 'Damage Total';
            }
            if (filterDamageType === 'Missing Item') {
              return d.row.Kondisi === 'Missing Item' || d.row.Kondisi === 'Missing';
            }
            if (filterDamageType === 'Wrong Item') {
              return d.row.Kondisi === 'Wrong Item' || d.row.Kondisi === 'Unexpected';
            }
            return d.row.Kondisi === filterDamageType;
          })
        ) {
          return false;
        }
      }

      // 5. Filter Channel
      if (filterChannel !== 'ALL') {
        if (!group.damageItems.some((d) => d.channel === filterChannel)) {
          return false;
        }
      }

      return true;
    });
  }, [orderGroups, viewMode, searchQuery, filterStatus, filterDamageType, filterChannel, forwardedRmaMap]);

  // Reset pagination saat filter / query berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterDamageType, filterChannel, viewMode]);

  // Kalkulasi Halaman (100 Order ID per halaman)
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = Math.min(startIndex + ordersPerPage, filteredOrders.length);
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, startIndex, endIndex]);

  // Kondisi default dropdown order adalah TERTUTUP (ringkas) sesuai permintaan.
  // Dibuka saat user mengklik baris atau tombol chevron untuk order tersebut.
  // Saat halaman atau filter berubah, tetap pertahankan kondisi tertutup.
  useEffect(() => {
    setExpandedOrderIds(new Set());
  }, [currentPage, searchQuery, filterStatus, filterDamageType, filterChannel, viewMode]);

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedOrderIds(new Set(paginatedOrders.map((o) => o.orderId)));
  };

  const handleCollapseAll = () => {
    setExpandedOrderIds(new Set());
  };

  // Semua barang damage dalam filtered orders (untuk kalkulasi & ekspor)
  const allFilteredDamageItems = useMemo(() => {
    return filteredOrders.flatMap((o) => o.damageItems);
  }, [filteredOrders]);

  // Statistik Ringkasan Klaim CS (Memisahkan antrean CS aktif vs kasus yang dialihkan ke RMA)
  const stats = useMemo(() => {
    const forwardedOrdersCount = orderGroups.filter((o) => forwardedRmaMap.has(o.orderId)).length;
    const nonForwardedDamageOrders = orderGroups.filter(
      (o) => o.damageCount > 0 && !forwardedRmaMap.has(o.orderId) && !o.damageItems.every(item=>!!item.closedAt)
    );
    const activeOrdersCount = nonForwardedDamageOrders.filter(
      (o) => o.damageItems.some((item) => item.claimStatus !== 'APPROVED')
    ).length;

    const nonForwardedDamageItems = nonForwardedDamageOrders.flatMap((o) => o.damageItems);

    const totalCount = nonForwardedDamageItems.length;
    const pendingCount = nonForwardedDamageItems.filter((d) => d.claimStatus === 'PENDING').length;
    const submittedCount = nonForwardedDamageItems.filter((d) => ['SUBMITTED','WAITING'].includes(d.claimStatus)).length;
    const approvedCount = nonForwardedDamageItems.filter((d) => d.claimStatus === 'APPROVED').length;
    const partialCount = nonForwardedDamageItems.filter((d) => d.claimStatus === 'PARTIAL').length;
    const rejectedCount = nonForwardedDamageItems.filter((d) => d.claimStatus === 'REJECTED').length;

    const totalDamageGoodsValue = nonForwardedDamageItems.reduce((acc, curr) => acc + curr.basePrice, 0);
    const totalClaimed = nonForwardedDamageItems.reduce((acc, curr) => acc + curr.claimAmount, 0);
    const totalSettlementReceived = nonForwardedDamageItems.reduce((acc, curr) => acc + curr.actualCompensation, 0);
    const totalUncoveredLoss = Math.max(0, totalDamageGoodsValue - totalSettlementReceived);

    return {
      totalOrdersWithDamage: nonForwardedDamageOrders.length,
      activeOrdersCount,
      totalCount,
      pendingCount,
      submittedCount,
      approvedCount,
      partialCount,
      rejectedCount,
      forwardedRmaCount: forwardedOrdersCount,
      totalDamageGoodsValue,
      totalClaimed,
      totalSettlementReceived,
      totalUncoveredLoss
    };
  }, [orderGroups, forwardedRmaMap]);
  // Daftar item target untuk modal klaim order (menggunakan damageItems atau fallback allItems)
  const targetItemsForModal = useMemo(() => {
    if (!claimModalOrder) return [];
    if (claimModalOrder.damageItems.length > 0) return claimModalOrder.damageItems;
    return claimModalOrder.allItems.map((r, i) => {
      const key = `${r.Order_ID}_${r.SKU_ID}_${i}`;
      const rec = disputeRecords[key] || {};
      const basePrice = lookupItemPrice(r.SKU_ID) || 0;
      return {
        key,
        itemIndex: i,
        row: r,
        channel: (rec.channel || detectChannelFromOrderId(r.Order_ID)) as ClaimChannel,
        claimStatus: (rec.claimStatus || 'PENDING') as ClaimStatus,
        ticketNumber: rec.ticketNumber || '',
        claimAmount: rec.claimAmount || basePrice,
        settlementAmount: rec.settlementAmount,
        settlementNote: rec.settlementNote || '',
        masterPrice: basePrice,
        basePrice,
        actualCompensation: rec.settlementAmount ?? 0,
        netLoss: basePrice - (rec.settlementAmount ?? 0),
        recoveryPct: 0,
        csNotes: rec.csNotes || ''
      } as DamagedDisputeItem;
    });
  }, [claimModalOrder, disputeRecords, masterDatabase]);
  const selectedClaimModalStore = stores.find(store => store.id === claimModalStoreId && store.status === 'ACTIVE');

  const openCloseCs = (order: OrderDisputeGroup) => {
    closingSnapshotRef.current=snapshotItems(order); setCsClosureReason(''); setCsClosureError(''); setClosingOrder(order);
  };
  const confirmCloseCs = async () => {
    if (!closingOrder || closingBusy) return;
    if (!csClosureReason.trim()) { setCsClosureError('Isi alasan penutupan kasus CS.'); return; }
    if (closingSnapshotRef.current!==snapshotItems(closingOrder)) { setCsClosureError('Data kasus berubah. Tutup dan buka kembali dialog penutupan.'); return; }
    if (forwardedRmaMap.has(closingOrder.orderId.trim().toUpperCase()) || closingOrder.damageItems.some(item=>!['APPROVED','PARTIAL','REJECTED'].includes(item.claimStatus))) { setCsClosureError('Kasus hanya dapat ditutup setelah semua keputusan marketplace dicatat dan masih ditangani CS.'); return; }
    const now = new Date().toISOString(); const payload={...disputeRecords};
    closingOrder.damageItems.forEach(item=>{const previous=payload[item.key] || {}; const record={...previous,id:item.key,row:item.row,channel:item.channel,claimStatus:item.claimStatus,ticketNumber:item.ticketNumber,claimAmount:item.claimAmount,approvedAmount:approvedMarketplaceAmount(item),settlementAmount:item.actualCompensation,closedAt:now,closureReason:csClosureReason.trim(),updatedAt:now,history:[...(previous.history || []),{at:now,by:currentUser.fullName,note:'Kasus CS ditutup: '+csClosureReason.trim()}]};payload[item.key]=record; const alias=item.row.Order_ID+'_'+item.row.SKU_ID+'_'+item.itemIndex;if(alias!==item.key)payload[alias]={...record,id:alias};});
    setClosingBusy(true); const saved=await saveDisputeRecords(payload);setClosingBusy(false);
    if (!saved) { setCsClosureError('Gagal menyimpan penutupan kasus. Formulir tetap tersedia; coba lagi.'); return; }setClosingOrder(null);showToast('Kasus CS ditutup. Keputusan dan dana tetap tercatat.');
  };

  // Handler membuka Modal Hasil Pengajuan banding per 1 Order ID (Checklist SKU + Total Nominal Order)
  const handleOpenOrderClaimModal = (order: OrderDisputeGroup) => {
    if (!order.damageItems.length) { showToast('Barang kondisi baik tidak perlu dibuatkan klaim kerusakan.'); return; }
    claimSnapshotRef.current = snapshotItems(order);
    setClaimModalOrder(order);
    const primaryChannel = order.damageItems[0]?.channel || detectChannelFromOrderId(order.orderId);
    setClaimModalChannel(DEFAULT_CHANNELS.includes(primaryChannel) ? primaryChannel : 'Lainnya');
    setClaimModalStoreId(order.damageItems.find(item=>item.storeId)?.storeId || '');

    // Status klaim keseluruhan: default ke SUBMITTED jika baru diajukan
    setClaimModalStatus(order.overallStatus === 'PARTIAL' ? 'APPROVED' : (order.overallStatus || 'PENDING'));

    // Pre-fill No. Tiket
    const existingTicket = order.damageItems.find((d) => d.ticketNumber && d.ticketNumber !== '-')?.ticketNumber || '';
    setClaimModalTicketNumber(existingTicket);

    // Pre-fill total nominal: total per 1 order
    setClaimModalTotalSettlement(String(order.damageItems.reduce((sum,item) => sum + approvedMarketplaceAmount(item),0)));
    setMarketplaceReceived(String(order.totalSettlementReceived || 0));
    setMarketplacePaymentRef(order.damageItems.map(item => disputeRecords[item.key]?.paymentReference).find(Boolean) || '');

    // Pre-fill checklist produk yang berhasil diklaim
    const items = order.damageItems.length > 0 ? order.damageItems : order.allItems.map((r, i) => ({
      key: `${r.Order_ID}_${r.SKU_ID}_${i}`
    }));
    const initialChecked = new Set<string>();
    items.forEach((d) => {
      const rec = disputeRecords[d.key];
      if (rec?.claimStatus !== 'REJECTED') {
        initialChecked.add(d.key);
      }
    });
    if (initialChecked.size === 0) {
      items.forEach((d) => initialChecked.add(d.key));
    }
    setSelectedSuccessSkuKeys(initialChecked);

    // Pre-fill catatan CS
    const existingNotes = order.damageItems.map((d) => d.csNotes).filter(Boolean).join('; ') || '';
    setClaimModalCsNotes(existingNotes);

    setClaimModalActiveTab('form');
  };

  // Simpan hasil pengajuan banding order (Total nominal 1 order & checklist produk lolos banding)
  const handleSaveOrderClaim = async () => {
    if (!claimModalOrder) return;
    if (claimSnapshotRef.current !== snapshotItems(claimModalOrder)) { showToast('Data kasus telah diperbarui. Tutup dan buka kembali formulir sebelum menyimpan.'); return; }
    const locked = claimModalOrder.damageItems.every(item=>!!item.closedAt) || forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase());
    const nowIso = new Date().toISOString();
    const items = targetItemsForModal;
    if (!locked && !DEFAULT_CHANNELS.includes(claimModalChannel)) { showToast('Pilih marketplace tujuan banding.'); return; }
    const selectedStore=stores.find(store=>store.id===claimModalStoreId&&store.status==='ACTIVE');
    if (!locked && !selectedStore) { showToast('Pilih toko asal klaim.'); return; }
    if (!locked && (claimModalStatus === 'REJECTED' || (claimModalStatus === 'APPROVED' && items.some(item => !selectedSuccessSkuKeys.has(item.key)))) && !claimModalCsNotes.trim()) { showToast('Isi alasan banding tidak berhasil untuk barang yang tidak disetujui.'); return; }
    const approvedTotal = locked ? items.reduce((sum,item) => sum+approvedMarketplaceAmount(item),0) : (claimModalStatus === 'APPROVED' ? Number(claimModalTotalSettlement) : 0);
    const receivedTotal = items.reduce((sum,item) => sum + Number(disputeRecords[item.key]?.financeReceivedAmount ?? disputeRecords[item.key]?.settlementAmount ?? 0), 0);
    if (!Number.isSafeInteger(approvedTotal) || approvedTotal < 0) { showToast('Nominal disetujui tidak valid.'); return; }
    if (!locked && claimModalStatus === 'APPROVED' && (!selectedSuccessSkuKeys.size || approvedTotal <= 0)) { showToast('Pilih barang dan isi nominal disetujui marketplace.'); return; }
    let approvedAmounts: number[];
    let receivedAmounts: number[];
    try {
      approvedAmounts = locked ? items.map(item=>approvedMarketplaceAmount(item)) : allocateClaimAmount(approvedTotal,items.map(item => selectedSuccessSkuKeys.has(item.key) && claimModalStatus === 'APPROVED' ? item.claimAmount : 0));
      receivedAmounts = allocateClaimAmount(receivedTotal,approvedAmounts);
    } catch (error) { showToast((error as Error).message); return; }
    const updatedDisputes = {...disputeRecords};
    items.forEach((item,index) => {
      const previous = updatedDisputes[item.key] || {};
      const approved = approvedAmounts[index];
      const received = receivedAmounts[index];
      const status: ClaimStatus = locked ? item.claimStatus : claimModalStatus === 'APPROVED' ? (approved === 0 ? 'REJECTED' : approved < item.claimAmount ? 'PARTIAL' : 'APPROVED') : claimModalStatus;
      const record = {
        ...previous, id:item.key,row:item.row, channel:locked ? item.channel : claimModalChannel,
        claimStatus:status, ticketNumber:locked ? item.ticketNumber : claimModalTicketNumber.trim(),
        claimAmount:item.claimAmount,approvedAmount:approved,orderApprovedAmount:approvedTotal,
        storeId:selectedStore?.id ?? previous.storeId,storeName:selectedStore?.name ?? previous.storeName,storeCode:selectedStore?.code ?? previous.storeCode,
        settlementAmount:previous.settlementAmount,
        financeReceivedAmount:previous.financeReceivedAmount,
        paymentStatus:paymentStatus(approved,received),paymentReference:previous.paymentReference,
        csNotes:locked ? item.csNotes : claimModalCsNotes.trim(),updatedAt:nowIso,
        history:[...(previous.history || []),{at:nowIso,by:currentUser.fullName,note:`Marketplace ${status}; disetujui ${approved}; diterima ${received}`}],
      };
      updatedDisputes[item.key]=record;
      const alias=`${item.row.Order_ID}_${item.row.SKU_ID}_${item.itemIndex}`;
      if (alias!==item.key) updatedDisputes[alias]={...record,id:alias};
    });
    if (!(await saveDisputeRecords(updatedDisputes))) return;
    const savedOrderId = claimModalOrder.orderId;
    setClaimModalOrder(null);
    showToast(`✓ Hasil klaim Order [${savedOrderId}] berhasil disimpan! Status: ${claimModalStatus}`);
  };

  // Open modal handler untuk mengelola status & detail klaim
  const handleOpenEditModal = (item: DamagedDisputeItem) => {
    const { key, row } = item;
    const existing = disputeRecords[key];
    const initialChannel = (existing?.channel as ClaimChannel) || item.channel;
    const itemMasterPrice = lookupItemPrice(row.SKU_ID);
    const defaultAmount = itemMasterPrice !== undefined ? itemMasterPrice : 0;

    setSelectedDispute({ key, row });
    setFormChannel(initialChannel);
    setFormStatus((existing?.claimStatus as ClaimStatus) || item.claimStatus);
    setFormTicketNumber(existing?.ticketNumber || (item.ticketNumber !== '-' ? item.ticketNumber : ''));
    setFormClaimAmount(existing?.claimAmount ? String(existing.claimAmount) : String(item.claimAmount));
    setFormSettlementAmount(
      existing?.settlementAmount !== undefined
        ? String(existing.settlementAmount)
        : (item.settlementAmount !== undefined
            ? String(item.settlementAmount)
            : (item.claimStatus === 'APPROVED' ? String(defaultAmount) : (item.claimStatus === 'REJECTED' ? '0' : String(defaultAmount))))
    );
    setFormSettlementNote(existing?.settlementNote || item.settlementNote || '');
    setFormCsNotes(existing?.csNotes || item.csNotes || '');
    setActiveModalTab('form');
  };

  // Simpan data klaim dari modal
  const handleSaveModalClaim = async () => {
    if (!selectedDispute) return;
    if (!DEFAULT_CHANNELS.includes(formChannel)) { showToast('Pilih marketplace tujuan banding CS. Banding logistik ditangani RMA.'); return; }
    const { key, row } = selectedDispute;
    const claimAmountNum = parseInt(formClaimAmount.replace(/[^0-9]/g, ''), 10) || 0;
    const settlementAmountNum = parseInt(formSettlementAmount.replace(/[^0-9]/g, ''), 10) || 0;

    const updated = {
      ...disputeRecords,
      [key]: {
        id: key,
        row,
        channel: formChannel,
        claimStatus: formStatus,
        ticketNumber: formTicketNumber.trim(),
        claimAmount: claimAmountNum,
        approvedAmount: ['APPROVED', 'PARTIAL'].includes(formStatus) ? settlementAmountNum : 0,
        settlementAmount: disputeRecords[key]?.settlementAmount,
        financeReceivedAmount: disputeRecords[key]?.financeReceivedAmount,
        settlementNote: formSettlementNote.trim(),
        csNotes: formCsNotes.trim(),
        updatedAt: new Date().toISOString()
      }
    };

    if (!(await saveDisputeRecords(updated))) return;
    setSelectedDispute(null);
    showToast(`✓ Data klaim Order [${row.Order_ID}] berhasil disimpan`);
  };

  // Inline Quick Edit handler untuk tabel
  const handleStartInlineEdit = (key: string, currentVal?: number, fallbackVal: number = 0) => {
    setInlineEditingKey(key);
    setInlineSettlementInput(String(currentVal !== undefined ? currentVal : fallbackVal));
  };

  const handleSaveInlineEdit = async (key: string, row: ProcessedReturnRow, claimAmount: number) => {
    const settlementNum = parseInt(inlineSettlementInput.replace(/[^0-9]/g, ''), 10) || 0;
    const existing = disputeRecords[key] || {};

    let nextStatus: ClaimStatus = (existing.claimStatus as ClaimStatus) || 'SUBMITTED';
    if (settlementNum === 0) {
      nextStatus = (existing.claimStatus as ClaimStatus) || 'PENDING';
    } else if (settlementNum >= claimAmount) {
      nextStatus = 'APPROVED';
    } else if (settlementNum > 0 && settlementNum < claimAmount) {
      nextStatus = 'PARTIAL';
    }

    const updated = {
      ...disputeRecords,
      [key]: {
        ...existing,
        id: key,
        row,
        channel: existing.channel || detectChannelFromOrderId(row.Order_ID),
        claimStatus: nextStatus,
        ticketNumber: existing.ticketNumber || '',
        claimAmount: existing.claimAmount || claimAmount,
        approvedAmount: settlementNum,
        settlementAmount: existing.settlementAmount,
        financeReceivedAmount: existing.financeReceivedAmount,
        updatedAt: new Date().toISOString()
      }
    };

    if (!(await saveDisputeRecords(updated))) return;
    setInlineEditingKey(null);
    showToast(`✓ Nilai ganti rugi marketplace diperbarui: ${formatRupiah(settlementNum)}`);
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingKey(null);
    setInlineSettlementInput('');
  };

  // Generator teks template surat / draf pengajuan banding CS per item
  const generateDisputeLetter = (row: ProcessedReturnRow, channel: string, ticketNo?: string, amount?: number) => {
    const formattedAmount = formatRupiah(amount || 0);
    const driveUrl = getDirectVideoUrl(row.Link_Video || '', row.Order_ID) || 'https://drive.google.com/file/d/evidence-video/view';

    return `Yth. Tim Customer Service / Resolution Center ${channel}
Perihal: Pengajuan banding atas retur barang rusak atau hilang

Dengan hormat,
Bersama pesan ini kami mengajukan permohonan pengajuan banding atas pesanan retur berikut:

1. DATA PESANAN & RETUR:
- No. Pesanan / Order ID : ${row.Order_ID}
- No. Resi / AWB         : ${row.Order_ID}
- Waktu Selesai Unboxing : ${row.Waktu_Proses || row.Video_Timestamp}
- Operator Pemeriksa     : ${row.Operator_ID}
${ticketNo && ticketNo !== '-' ? `- No. Kasus / Tiket CS   : ${ticketNo}\n` : ''}
2. RINCIAN PRODUK & KERUSAKAN:
- Kode SKU       : ${row.SKU_ID}
- Nama Produk    : ${row.Nama_Barang}
- Klasifikasi    : ${row.Kondisi.toUpperCase()}
- Temuan Kerusakan: ${row.Catatan_Tambahan || 'Barang diterima dalam kondisi cacat / rusak'}

3. BUKTI OTENTIK REKAMAN UNBOXING GUDANG:
- Standarisasi   : CCTV Live Inspection Stasiun RMA Otwoo Cosmetics
- Nama File Video: ${row.Nama_File_Video}
- Tautan Video Bukti (Google Drive):
  ${driveUrl}

KETERANGAN KRONOLOGIS:
Paket retur dibuka di stasiun unboxing resmi RMA Warehouse dengan perekaman webcam kontinu 30 FPS dan watermark live timestamp tanpa terputus. Kerusakan/kehilangan terjadi di luar kendali penjual selama proses penanganan logistik transit.

Kami memohon ganti rugi/kompensasi dana penuh sebesar ${formattedAmount} sesuai ketentuan perlindungan seller. Mohon proses investigasi dan pencairan dana klaim.

Terima kasih atas kerja sama dan dukungannya.
Hormat kami,
Customer Service & RMA Resolution Team
PT. Tirta Kumala Sari — Warehouse Otwoo Cosmetics Indonesia`;
  };

  // Generator surat klaim menyeluruh untuk 1 Order ID (memuat semua SKU, baik good maupun damage)
  const generateDisputeLetterForOrder = (order: OrderDisputeGroup, channel?: ClaimChannel) => {
    const targetChannel = channel || (order.damageItems[0]?.channel) || detectChannelFromOrderId(order.orderId);
    const driveUrl = getDirectVideoUrl(order.linkVideo || '', order.orderId) || 'https://drive.google.com/file/d/evidence-video/view';

    const damageLines = order.damageItems
      .map(
        (d, i) =>
          `  ${i + 1}. [KLAIM GANTI RUGI] SKU: ${d.row.SKU_ID} - ${d.row.Nama_Barang}
     - Klasifikasi: ${d.row.Kondisi}
     - Temuan Fisik: ${d.row.Catatan_Tambahan || 'Barang diterima cacat / rusak'}
     - Nilai Tuntutan: ${formatRupiah(d.claimAmount)}`
      )
      .join('\n');

    const goodLines =
      order.goodItems.length > 0
        ? order.goodItems
            .map(
              (g, i) =>
                `  ${i + 1}. [VERIFIKASI AMAN / TIDAK DIKLAIM] SKU: ${g.SKU_ID} - ${g.Nama_Barang} (Kondisi: Baik / Good Condition)`
            )
            .join('\n')
        : '  (Tidak ada barang kondisi baik dalam pesanan ini)';

    return `Yth. Tim Customer Service / Resolution Center ${targetChannel}
Perihal: Pengajuan banding atas retur barang rusak atau hilang

Dengan hormat,
Bersama pesan ini kami mengajukan permohonan pengajuan banding resmi atas pesanan retur berikut:

1. DATA PESANAN:
- No. Pesanan / Order ID : ${order.orderId}
- No. Resi / AWB         : ${order.orderId}
- Waktu Selesai Unboxing : ${order.waktuProses}
- Operator Pemeriksa     : ${order.operatorId}
- Total Isi Paket        : ${order.totalItemsCount} Unit (${order.goodCount} Unit Aman, ${order.damageCount} Unit Rusak/Hilang)

2. BARANG RUSAK YANG DIAJUKAN KLAIM GANTI RUGI (${order.damageCount} PRODUK):
${damageLines}

3. BARANG KONDISI BAIK SEBAGAI DAFTAR REFERENSI VERIFIKASI (${order.goodCount} PRODUK - TIDAK DIKLAIM):
${goodLines}

4. BUKTI OTENTIK REKAMAN UNBOXING GUDANG:
- Standarisasi   : CCTV Live Inspection Stasiun RMA Otwoo Cosmetics
- Nama File Video: ${order.namaFileVideo}
- Tautan Video Bukti (Google Drive):
  ${driveUrl}

KETERANGAN KRONOLOGIS:
Paket retur dibuka di stasiun unboxing resmi RMA Warehouse dengan perekaman webcam kontinu 30 FPS dan watermark live timestamp tanpa jeda. Tim gudang telah memverifikasi seluruh isi paket secara detail. Kerusakan/kehilangan pada barang yang diklaim terjadi di luar kendali penjual selama proses penanganan logistik transit.

Kami memohon ganti rugi/kompensasi dana penuh sebesar ${formatRupiah(order.totalClaimAmount)} sesuai ketentuan perlindungan seller. Mohon proses investigasi dan pencairan dana klaim.

Terima kasih atas kerja sama dan dukungannya.
Hormat kami,
Customer Service & RMA Resolution Team
PT. Tirta Kumala Sari — Warehouse Otwoo Cosmetics Indonesia`;
  };

  // Salin template teks pengajuan banding
  const handleCopyClaimTemplate = (row: ProcessedReturnRow, channel: string, ticketNo?: string, amount?: number) => {
    const text = generateDisputeLetter(row, channel, ticketNo, amount);
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2500);
    showToast(`✓ Draf pengajuan banding untuk ${row.Order_ID} disalin ke clipboard!`);
  };

  // Salin template teks order lengkap
  const handleCopyOrderLetter = (order: OrderDisputeGroup) => {
    const text = generateDisputeLetterForOrder(order);
    navigator.clipboard.writeText(text);
    showToast(`✓ Draf pengajuan banding Order [${order.orderId}] (${order.totalItemsCount} SKU) berhasil disalin!`);
  };

  // Salin cepat link drive
  const handleCopyDriveLink = (linkVideo?: string, orderId?: string) => {
    if (!linkVideo) return;
    const directUrl = getDirectVideoUrl(linkVideo, orderId);
    navigator.clipboard.writeText(directUrl);
    showToast(`✓ Link Google Drive ${orderId || ''} disalin!`);
  };

  // Export CSV Data Pengajuan banding dengan kolom rincian finansial & semua SKU
  const handleDownloadDisputeCsv = () => {
    if (filteredOrders.length === 0) return;

    const headers = [
      'Order_ID',
      'Operator_ID',
      'Waktu_Proses',
      'SKU_ID',
      'Nama_Barang',
      'Kondisi_Fisik',
      'Status_Verifikasi_Klaim',
      'Harga_Master_IDR',
      'Nilai_Diajukan_Klaim_IDR',
      'Realisasi_Penggantian_Ekspedisi_IDR',
      'Selisih_Rugi_Toko_IDR',
      'Persentase_Cair_Pct',
      'Target_Channel',
      'Status_Klaim_CS',
      'No_Tiket_Dispute',
      'Catatan_Temuan_Gudang',
      'Nama_File_Video',
      'Link_Video_Google_Drive'
    ];

    const csvRows: string[] = [];

    filteredOrders.forEach((order) => {
      // 1. Baris barang rusak (yang diajukan klaim)
      order.damageItems.forEach((d) => {
        csvRows.push(
          [
            `"${order.orderId.replace(/"/g, '""')}"`,
            `"${order.operatorId.replace(/"/g, '""')}"`,
            `"${order.waktuProses.replace(/"/g, '""')}"`,
            `"${d.row.SKU_ID.replace(/"/g, '""')}"`,
            `"${d.row.Nama_Barang.replace(/"/g, '""')}"`,
            `"${d.row.Kondisi.replace(/"/g, '""')}"`,
            `"DIAJUKAN KLAIM (DAMAGE)"`,
            d.basePrice,
            d.claimAmount,
            d.actualCompensation,
            d.netLoss,
            `"${d.recoveryPct}%"`,
            `"${d.channel.replace(/"/g, '""')}"`,
            `"${d.claimStatus.replace(/"/g, '""')}"`,
            `"${d.ticketNumber.replace(/"/g, '""')}"`,
            `"${(d.row.Catatan_Tambahan || '').replace(/"/g, '""')}"`,
            `"${order.namaFileVideo.replace(/"/g, '""')}"`,
            `"${(order.linkVideo || '').replace(/"/g, '""')}"`
          ].join(',')
        );
      });

      // 2. Baris barang baik (sebagai list verifikasi lengkap)
      order.goodItems.forEach((g) => {
        const itemMasterPrice = lookupItemPrice(g.SKU_ID) || 0;
        csvRows.push(
          [
            `"${order.orderId.replace(/"/g, '""')}"`,
            `"${order.operatorId.replace(/"/g, '""')}"`,
            `"${order.waktuProses.replace(/"/g, '""')}"`,
            `"${g.SKU_ID.replace(/"/g, '""')}"`,
            `"${g.Nama_Barang.replace(/"/g, '""')}"`,
            `"Good"`,
            `"TIDAK DIKLAIM (KONDISI BAIK)"`,
            itemMasterPrice,
            0,
            0,
            0,
            `"100%"`,
            `"-"`,
            `"VERIFIED_GOOD"`,
            `"-"`,
            `"${(g.Catatan_Tambahan || 'Barang diterima aman & utuh').replace(/"/g, '""')}"`,
            `"${order.namaFileVideo.replace(/"/g, '""')}"`,
            `"${(order.linkVideo || '').replace(/"/g, '""')}"`
          ].join(',')
        );
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REKAP_DISPUTE_CS_${filteredOrders.length}Order.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ File CSV rekap klaim (${filteredOrders.length} Order ID) berhasil diunduh!`);
  };

  // Helper badge status klaim
  const getClaimStatusBadge = (status: ClaimStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Draf</span>
          </span>
        );
      case 'WAITING':
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3 h-3 text-blue-600 animate-spin" />
            <span>{status === 'WAITING' ? 'Menunggu keputusan' : 'Diajukan'}</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Disetujui Penuh (100%)</span>
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Disetujui sebagian</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Banding tidak berhasil</span>
          </span>
        );
    }
  };

  // Helper badge kondisi unboxing (Good, Packaging, Damage, dll - Sesuai Gambar Referensi)
  const getConditionBadge = (kondisi: StandardKondisi | string) => {
    switch (kondisi) {
      case 'Good':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Good
          </span>
        );
      case 'Damage Packaging':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            Damage Packaging
          </span>
        );
      case 'Damage Product':
      case 'Damage Products':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Damage Products
          </span>
        );
      case 'Totally Damage':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            Totally Damage
          </span>
        );
      case 'Missing Item':
      case 'Missing':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
            Missing Item
          </span>
        );
      case 'Wrong Item':
      case 'Unexpected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 text-slate-800 border border-slate-300">
            Wrong Item
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {kondisi}
          </span>
        );
    }
  };

  // Helper badge tipe kondisi kerusakan
  const getDamageBadge = (kondisi: StandardKondisi) => {
    switch (kondisi) {
      case 'Totally Damage':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            Totally Damage (Klaim 100%)
          </span>
        );
      case 'Missing Item':
      case 'Missing':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-900 border border-slate-400">
            Missing Item (Klaim 100%)
          </span>
        );
      case 'Wrong Item':
      case 'Unexpected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Wrong Item (Salah Barang)
          </span>
        );
      case 'Damage Product':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Damage Products
          </span>
        );
      case 'Damage Packaging':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Damage Packaging
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">
            {kondisi}
          </span>
        );
    }
  };

  return (
    <div className="claim-page space-y-5 animate-fade-in">
      <h1 className="sr-only">Klaim dan banding marketplace</h1>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <ClaimPageHeader
        filterLabel="Filter klaim CS"
        filterActive={filterStatus !== 'ALL' || filterDamageType !== 'ALL' || filterChannel !== 'ALL' || Boolean(searchQuery) || viewMode !== 'DAMAGE_ONLY'}
        onOpenFilter={() => setFilterOpen(true)}
        onExport={handleDownloadDisputeCsv}
        exportLabel="Unduh klaim CS"
        exportDisabled={filteredOrders.length === 0}
        summary={<><span>{stats.activeOrdersCount} order aktif</span><span>•</span><span>{stats.totalCount} barang bermasalah</span><span>•</span><strong className="font-mono text-slate-900">Nilai tuntutan {formatRupiah(stats.totalClaimed)}</strong></>}
      />

      {/* ======================================================================= */}
      {/* 2. STATISTIK KLAIM & KERUGIAN (5 METRIK FINANSIAL)                      */}
      {/* ======================================================================= */}
      <div className="claim-metric-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Kasus Damage */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between text-slate-700 text-xs font-bold">
            <span>{t('disputes_stat_total_damage')}</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            {stats.totalCount} <span className="text-xs font-normal text-slate-500">{isEn ? 'items' : 'barang'}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">
            {isEn ? 'Draft' : 'Draf'}: {stats.pendingCount} • {isEn ? 'Submitted' : 'Diajukan'}: {stats.submittedCount}
          </div>
        </div>

        {/* Card 2: Total Nilai Barang (Harga Master) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-blue-50/60 border border-indigo-200/90 shadow-sm">
          <div className="flex items-center justify-between text-indigo-700 text-xs font-bold">
            <span>{isEn ? 'Original Item Value' : 'Nilai Barang Asli (Rp)'}</span>
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-indigo-950 font-mono mt-1 truncate" title={formatRupiah(stats.totalDamageGoodsValue)}>
            {formatRupiah(stats.totalDamageGoodsValue)}
          </div>
          <div className="text-[10px] text-indigo-700 font-medium mt-0.5">
            {isEn ? 'Based on Master SKU' : 'Berdasarkan Master SKU'}
          </div>
        </div>

        {/* Card 3: Total Diajukan CS */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-orange-50/60 border border-amber-200/90 shadow-sm">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold">
            <span>{t('disputes_stat_claim_value')}</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-amber-950 font-mono mt-1 truncate" title={formatRupiah(stats.totalClaimed)}>
            {formatRupiah(stats.totalClaimed)}
          </div>
          <div className="text-[10px] text-amber-700 font-medium mt-0.5">
            {isEn ? 'CS demanded claim amount' : 'Nilai klaim tuntutan CS'}
          </div>
        </div>

        {/* Card 4: Realisasi Ganti Rugi Cair */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 to-teal-50/60 border border-emerald-200/90 shadow-sm">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold">
            <span>{t('disputes_stat_settlement_value')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-950 font-mono mt-1 truncate" title={formatRupiah(stats.totalSettlementReceived)}>
            {formatRupiah(stats.totalSettlementReceived)}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
            {isEn ? 'Recorded marketplace payout' : 'Realisasi dari marketplace'}
          </div>
        </div>

        {/* Card 5: Selisih Kerugian (Beban Toko) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/90 to-red-50/60 border border-rose-200/90 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 text-xs font-bold">
            <span>{isEn ? 'Net Store Loss' : 'Sisa nilai yang belum terganti'}</span>
            <DollarSign className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-rose-950 font-mono mt-1 truncate" title={formatRupiah(stats.totalUncoveredLoss)}>
            {formatRupiah(stats.totalUncoveredLoss)}
          </div>
          <div className="text-[10px] text-rose-700 font-medium mt-0.5">
            {stats.totalDamageGoodsValue > 0 ? `${Math.round((stats.totalUncoveredLoss / stats.totalDamageGoodsValue) * 100)}% ${isEn ? 'uncovered' : 'tak tercover'}` : (isEn ? 'Uncovered by courier' : 'Tak tercover ekspedisi')}
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. TOOLBAR FILTER & PENCARIAN KLAIM                                     */}
      {/* ======================================================================= */}
      <div className={filterOpen ? 'fixed inset-x-4 top-20 bottom-4 z-[60] mx-auto max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-3.5' : 'hidden'} role="dialog" aria-label="Filter klaim CS">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3"><strong className="text-sm text-slate-900">Filter klaim CS</strong><button type="button" className="warehouse-button px-2 py-1" aria-label="Tutup filter" onClick={() => setFilterOpen(false)}><X size={15}/></button></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Quick Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Order ID, No Resi, SKU, Nama Produk, No Tiket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mode Tampilan & Download CSV */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('DAMAGE_ONLY')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'DAMAGE_ONLY'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan hanya Order ID yang memiliki produk rusak / diajukan pengajuan banding"
              >
                Order Damage ({orderGroups.filter((o) => o.damageCount > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('ALL_RETURNS')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'ALL_RETURNS'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan seluruh Order ID termasuk yang semua SKU berkondisi Good"
              >
                Semua Order ({orderGroups.length})
              </button>
            </div>

            {(filterStatus !== 'ALL' || filterDamageType !== 'ALL' || filterChannel !== 'ALL' || searchQuery || viewMode !== 'DAMAGE_ONLY') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('ALL');
                  setFilterDamageType('ALL');
                  setFilterChannel('ALL');
                  setViewMode('DAMAGE_ONLY');
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadDisputeCsv}
              disabled={filteredOrders.length === 0}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unduh klaim ({filteredOrders.length} order)</span>
            </button>
          </div>
        </div>

        {/* Filter Bar Segmented Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Filter Status Klaim */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Status pengajuan banding:
            </label>
            <div className="flex flex-wrap gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan seluruh order aktif yang membutuhkan penanganan CS"
              >
                Semua kasus CS ({stats.activeOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PENDING')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Draf ({stats.pendingCount} barang)
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('SUBMITTED')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'SUBMITTED'
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diajukan / menunggu ({stats.submittedCount} barang)
              </button>
              <button type="button" onClick={onNavigateToHistory} className="warehouse-button">
                Riwayat hasil banding ({stats.approvedCount + stats.partialCount + stats.rejectedCount} barang)
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('FORWARDED_RMA')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                  filterStatus === 'FORWARDED_RMA'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200/90'
                }`}
                title="Lihat seluruh kasus yang telah dialihkan penanganannya ke Tim RMA Logistik"
              >
                <Truck className="w-3 h-3" />
                <span>Dialihkan ke RMA ({stats.forwardedRmaCount})</span>
              </button>
            </div>
          </div>

          {/* Filter Jenis Kerusakan */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Klasifikasi Kerusakan:
            </label>
            <select
              value={filterDamageType}
              onChange={(e) => setFilterDamageType(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
            >
              <option value="ALL">Semua Masalah & Kerusakan Retur</option>
              <option value="Totally Damage">Totally Damage (Kerusakan Parah / Hancur 100%)</option>
              <option value="Missing Item">Missing Item (Barang Hilang / Kurang 100%)</option>
              <option value="Damage Product">Damage Products (Cacat Fisik Unit)</option>
              <option value="Damage Packaging">Damage Packaging (Kemasan / Dus Rusak)</option>
              <option value="Wrong Item">Wrong Item (Salah Kirim / Beda SKU)</option>
            </select>
          </div>

          {/* Filter Channel */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Marketplace:
            </label>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
            >
              <option value="ALL">Semua Marketplace</option>
              <option value="Shopee">Shopee</option>
              <option value="TikTok Shop">TikTok Shop</option>
              <option value="Tokopedia">Tokopedia</option>
              <option value="Lazada">Lazada</option>
              <option value="J&T Express">J&T Express</option>
              <option value="SiCepat">SiCepat</option>
              <option value="SPX Express">SPX Express</option>
              <option value="JNE">JNE</option>
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 4. TABEL UTAMA BARANG DAMAGE & AJU BANDING                             */}
      {/* ======================================================================= */}
      {rows.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">
              Belum Ada Sesi Unboxing yang Dicatat
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Silakan lakukan pemeriksaan paket retur di Stasiun Unboxing terlebih dahulu untuk mulai mendata barang Good maupun Damage.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={onNavigateToStation}
              className="py-2.5 px-5 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Buka Stasiun Unboxing
            </button>
            <button
              onClick={onNavigateToReports}
              className="py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Lihat Riwayat Laporan
            </button>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            Tidak Ada Order ID yang Cocok dengan Kriteria Filter
          </h3>
          <p className="text-xs text-slate-500">
            Silakan sesuaikan kata kunci pencarian atau bersihkan filter di atas.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('ALL');
              setFilterDamageType('ALL');
              setFilterChannel('ALL');
              setViewMode('DAMAGE_ONLY');
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* TOP PAGINATION TOOLBAR */}
          <div className="flex flex-col gap-3">
            <CompactPagination page={currentPage} totalItems={filteredOrders.length} pageSize={ordersPerPage} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setOrdersPerPage(size); setCurrentPage(1); }} pageSizeOptions={[25, 50, 100]} itemLabel="Order ID" ariaLabel="Paginasi klaim CS" />
            <div className="flex justify-end">
              <button type="button" className="warehouse-button" aria-expanded={paginatedOrders.length > 0 && paginatedOrders.every(order => expandedOrderIds.has(order.orderId))} onClick={() => paginatedOrders.every(order => expandedOrderIds.has(order.orderId)) ? handleCollapseAll() : handleExpandAll()}>
                {paginatedOrders.length > 0 && paginatedOrders.every(order => expandedOrderIds.has(order.orderId)) ? 'Tutup semua rincian' : 'Buka semua rincian'}
              </button>
            </div>
          </div>

          {/* List of Separated Order Cards with Thick Borders, Visual Spacing & Sequence Badges */}
          <div className="space-y-4">
            {paginatedOrders.map((order, orderIdx) => {
              const globalOrderNumber = startIndex + orderIdx + 1;
              const isExpanded = expandedOrderIds.has(order.orderId);
              const cleanOrderId = order.orderId.trim();
              const isOrderForwarded =
                forwardedRmaMap.has(cleanOrderId) ||
                forwardedRmaMap.has(cleanOrderId.toUpperCase()) ||
                forwardedRmaMap.has(cleanOrderId.toLowerCase()) ||
                order.damageItems.some((d) => disputeRecords[d.key]?.isForwardedToRma);

              return (
                <div
                  key={order.orderId}
                  className={`rounded-2xl border-2 transition-all duration-200 bg-white shadow-xs hover:shadow-md overflow-visible ${
                    isExpanded
                      ? 'border-teal-500 ring-2 ring-teal-500/15 shadow-md'
                      : order.damageCount > 0
                      ? 'border-slate-300 hover:border-teal-400'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Order Card Header: Clickable to expand/collapse */}
                  <div
                    className={`p-4 sm:p-4.5 rounded-2xl transition-colors ${
                      isExpanded
                        ? 'bg-gradient-to-r from-teal-50/60 via-slate-50/50 to-white'
                        : order.damageCount > 0
                        ? 'hover:bg-rose-50/20'
                        : 'hover:bg-slate-50/60'
                    }`}
                  >
                    {/* ROW 1: PRIMARY IDENTITY & STATUS ACTIONS (Sesuai Referensi Gambar) */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      {/* Left: Checkbox, Sequence Badge, Resi, Marketplace, Ekspedisi, Operator */}
                      <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
                        {/* Checkbox Batch Seleksi */}
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has(order.orderId)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectOrder(order.orderId);
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E] cursor-pointer"
                        />

                        {/* Nomor Urut Kontras */}
                        <div className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-slate-900 text-white font-mono font-black text-xs tracking-wider shadow-xs border border-slate-800 shrink-0">
                          <span>ORDER</span>
                          <span className="text-teal-400">#{String(globalOrderNumber).padStart(2, '0')}</span>
                        </div>

                        {/* Order ID / No Resi */}
                        <div className="flex items-center space-x-1.5 bg-slate-100/90 px-2.5 py-1 rounded-xl border border-slate-200 shrink-0">
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm select-all">
                            {order.orderId}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(order.orderId);
                              showToast(`✓ Order ID ${order.orderId} disalin!`);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-white transition-colors cursor-pointer"
                            title="Salin No Resi / Order ID"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Marketplace Chip */}
                        {order.marketplace && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold shrink-0">
                            <ShoppingBag className="w-3.5 h-3.5 text-teal-600" />
                            <span>{order.marketplace}</span>
                          </span>
                        )}

                        {/* Ekspedisi Chip */}
                        {order.ekspedisi && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold shrink-0">
                            <Truck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{order.ekspedisi}</span>
                          </span>
                        )}

                        {/* Operator */}
                        <span className="text-[11px] text-slate-500 font-medium flex items-center space-x-1 pl-1">
                          <span>Opr:</span>
                          <strong className="font-mono text-slate-700">{order.operatorId}</strong>
                        </span>
                      </div>

                      {/* Right: Tombol Klaim, Tombol Pindahkan ke RMA, Tombol Tutup Rincian, Tombol Hapus */}
                      <div className="flex items-center flex-wrap gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Tombol Klaim */}
                        {!isOrderForwarded ? (
                          <button
                            type="button"
                            onClick={() => handleOpenOrderClaimModal(order)}
                            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                            title="Buka formulir klaim / hasil pengajuan banding order ini"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-teal-200" />
                            <span>Catat banding marketplace</span>
                          </button>
                        ) : (
                          <button type="button" onClick={() => handleOpenOrderClaimModal(order)} className="px-3 py-2 rounded-xl border border-teal-300 text-teal-800 text-xs font-bold">Catat pembayaran marketplace</button>
                        )}

                        {/* Status RMA hanya tampil setelah pemindahan dilakukan dari formulir banding. */}
                        {isOrderForwarded ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToRma && onNavigateToRma()}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs transition-colors cursor-pointer"
                            title="Kasus telah dialihkan ke Tim RMA. Klik untuk lihat di menu Klaim RMA"
                          >
                            <Truck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Di Tim RMA</span>
                          </button>
                        ) : null}

                        {!isOrderForwarded && order.damageItems.length>0 && order.damageItems.every(item=>!!item.closedAt) && <span className="text-xs font-semibold text-slate-700">Kasus CS ditutup</span>}
                        {!isOrderForwarded && order.damageItems.length>0 && !order.damageItems.every(item=>!!item.closedAt) && order.damageItems.every(item=>['APPROVED','PARTIAL','REJECTED'].includes(item.claimStatus)) && <button type="button" className="warehouse-button" onClick={()=>openCloseCs(order)}>Tutup kasus CS</button>}
                        {/* Tombol Tutup Rincian / Buka Rincian */}
                        <button
                          type="button"
                          aria-expanded={isExpanded} onClick={() => toggleOrderExpand(order.orderId)}
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

                        {/* Tombol Hapus (Super Admin) */}
                        {canDelete && onDeleteOrder && (
                          <details className="warehouse-action-menu">
                            <summary aria-label={`Tindakan lainnya untuk order ${order.orderId}`}>⋯ Lainnya</summary>
                            <div className="warehouse-menu-panel">
                              <button type="button" className="warehouse-danger" onClick={e => {setOrderToDelete(order.orderId); e.currentTarget.closest('details')?.removeAttribute('open');}}>Hapus retur…</button>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>

                    {/* ROW 2: DETAILED METRICS STRIP (Variasi SKU, Qty, Kondisi, Waktu, Video) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 text-xs">
                      {/* Metric 1: Jumlah Unit */}
                      <div className="flex items-center space-x-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Jumlah barang (unit)</div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                              {order.totalItemsCount} Unit
                            </span>
                            {order.damageCount > 0 ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                                {order.damageCount} Rusak
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                Semua Good
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Metric 2: Variasi SKU */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase flex items-center space-x-1">
                            <Boxes className="w-3 h-3 text-[#0F766E]" />
                            <span>Variasi SKU ({order.skuVariationsCount})</span>
                          </span>
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

                      {/* Metric 3: Kondisi Barang */}
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
                          <div className="text-[11px] font-mono text-slate-800 font-semibold truncate max-w-[140px]" title={order.namaFileVideo}>
                            {order.namaFileVideo || '-'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {order.waktuProses}
                          </div>
                        </div>
                        {order.linkVideo && (
                          <a
                            href={getDirectVideoUrl(order.linkVideo, order.orderId)}
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

                  {/* SUB-PANEL: RINCIAN DISPUTE CS & SEMUA SKU (Panel berlatar kontras dengan header sub-bagian) */}
                  {isExpanded && (
                    <div className="bg-slate-50/95 border-t-2 border-teal-500 p-4 sm:p-5 space-y-4 shadow-inner">
                              {/* Sub-Header baris rincian (identik dengan laporan + ringkasan finansial CS) */}
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 flex-wrap gap-y-1">
                                  <Package className="w-4 h-4 text-[#0F766E]" />
                                  <span>
                                    Rincian Barang dalam Order ID: <strong className="font-mono text-[#0F766E]">{order.orderId}</strong>
                                  </span>
                                  {order.marketplace && (
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-[10px] font-bold text-teal-800">
                                      <ShoppingBag className="w-2.5 h-2.5 text-teal-600" />
                                      <span>{order.marketplace}</span>
                                    </span>
                                  )}
                                  {order.ekspedisi && (
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-800">
                                      <Truck className="w-2.5 h-2.5 text-indigo-600" />
                                      <span>{order.ekspedisi}</span>
                                    </span>
                                  )}
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-600 font-normal">
                                    Total <strong>{order.totalItemsCount} Unit</strong> ({order.skuVariationsCount} Variasi SKU)
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    Operator: <strong className="text-slate-700">{order.operatorId}</strong>
                                  </span>

                                  {order.damageCount > 0 && (
                                    <>
                                      <span className="text-slate-300">|</span>
                                      <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                        Tuntutan: {formatRupiah(order.totalClaimAmount)}
                                      </span>
                                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        Dana marketplace: {formatRupiah(order.totalSettlementReceived)}
                                      </span>
                                      <span className="text-[11px] font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                        Selisih Rugi: {formatRupiah(order.totalNetLoss)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyOrderLetter(order)}
                                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                                        title="Salin draf surat sanggahan lengkap (SKU rusak + konteks barang baik + link drive)"
                                      >
                                        <Copy className="w-3 h-3" />
                                        <span>Salin Surat Order</span>
                                      </button>
                                      {/* Tombol Teruskan ke RMA di subpanel */}
                                      {forwardedRmaMap.has(order.orderId) ? (
                                        <button
                                          type="button"
                                          onClick={() => onNavigateToRma && onNavigateToRma()}
                                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition-all shadow-2xs flex items-center space-x-1 cursor-pointer"
                                          title="Kasus telah dialihkan ke Tim RMA. Buka status di tab Klaim RMA"
                                        >
                                          <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                          <span>Lihat di Klaim RMA ({RMA_STAGE_LABELS[forwardedRmaMap.get(order.orderId)!.stageStatus]?.labelId || 'RMA'})</span>
                                        </button>
                                      ) : null}
                                    </>
                                  )}

                                  {order.linkVideo && (
                                    <a
                                      href={getDirectVideoUrl(order.linkVideo, order.orderId)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 rounded-lg bg-[#F0FDFA] hover:bg-[#CCFBF1] text-[#0F766E] border border-teal-200 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                                      title="Buka bukti video unboxing di Google Drive"
                                    >
                                      <Video className="w-3.5 h-3.5" />
                                      <span>Video Drive</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                      {/* ======================================================== */}
                      {/* SECTION A: BARANG RUSAK YANG DIAJUKAN KLAIM (DAMAGE)      */}
                      {/* ======================================================== */}
                      {order.damageCount > 0 ? (
                        <div className="rounded-2xl border border-rose-200 bg-white overflow-hidden shadow-xs">
                          <div className="px-4 py-3 bg-gradient-to-r from-rose-100/80 via-rose-50 to-amber-50/50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <h4 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider">
                                  Barang bermasalah dalam pengajuan banding ({order.damageCount} SKU)
                                </h4>
                                <p className="text-[11px] text-rose-700">
                                  Hanya barang rusak berikut yang diajukan klaim penggantian dana ke ekspedisi/marketplace.
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-rose-800 bg-white/80 px-2.5 py-0.5 rounded-full border border-rose-200 shrink-0">
                              Total Tuntutan: {formatRupiah(order.totalClaimAmount)}
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-rose-50/40 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                                  <th className="py-2.5 px-2 w-9 text-center">No</th>
                                  <th className="py-2.5 px-2.5 min-w-[140px]">SKU ID & Nama Produk</th>
                                  <th className="py-2.5 px-2.5 min-w-[130px]">Kerusakan & Bukti</th>
                                  <th className="py-2.5 px-2 w-24">Channel</th>
                                  <th className="py-2.5 px-2 w-28">Status Klaim</th>
                                  <th className="py-2.5 px-2 w-24">No. Tiket</th>
                                  <th className="py-2.5 px-2.5 w-28">Nilai Diajukan</th>
                                  <th className="py-2.5 px-2.5 w-36 bg-indigo-50/60">
                                    <span className="flex items-center space-x-1 text-amber-900 font-extrabold">
                                      <span>Nilai disetujui marketplace</span>
                                      <span className="text-[9px] bg-indigo-200 text-indigo-900 px-1 py-0.2 rounded font-normal">Operation</span>
                                    </span>
                                  </th>
                                  <th className="py-2.5 px-2.5 w-28">Selisih Rugi</th>
                                  <th className="py-2.5 px-2 text-center w-28">Aksi CS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-rose-100/80">
                                {order.damageItems.map((item, dIdx) => {
                                  const {
                                    row,
                                    key,
                                    channel,
                                    claimStatus,
                                    ticketNumber,
                                    claimAmount,
                                    settlementAmount,
                                    approvedAmount,
                                    actualCompensation,
                                    netLoss,
                                    masterPrice
                                  } = item;

                                  const isInlineEditing = inlineEditingKey === key;

                                  return (
                                    <tr key={key} className="hover:bg-rose-50/30 transition-colors">
                                      {/* No */}
                                      <td className="py-3 px-2 text-center text-slate-500 font-mono font-bold">
                                        {dIdx + 1}
                                      </td>

                                      {/* SKU ID & Nama Barang */}
                                      <td className="py-3 px-2.5">
                                        <div className="font-mono font-extrabold text-[#0F766E] text-xs">
                                          {row.SKU_ID}
                                        </div>
                                        <div className="font-semibold text-slate-900 text-xs line-clamp-1" title={row.Nama_Barang}>
                                          {row.Nama_Barang}
                                        </div>
                                        {masterPrice !== undefined && (
                                          <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                                            Harga Master: {formatRupiah(masterPrice)}
                                          </div>
                                        )}
                                      </td>

                                      {/* Kerusakan & Temuan */}
                                      <td className="py-3 px-2.5">
                                        <div className="flex items-center space-x-1">
                                          {getDamageBadge(row.Kondisi)}
                                        </div>
                                        {row.Catatan_Tambahan && (
                                          <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200/80 rounded px-2 py-0.5 mt-1 font-medium">
                                            {row.Catatan_Tambahan}
                                          </div>
                                        )}
                                      </td>

                                      {/* Target Channel */}
                                      <td className="py-3 px-2">
                                        <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-bold border border-slate-200">
                                          {channel.includes('Express') || channel.includes('J&T') || channel.includes('SiCepat') || channel.includes('SPX') || channel.includes('JNE') ? (
                                            <Truck className="w-3.5 h-3.5 text-amber-600" />
                                          ) : (
                                            <ShoppingBag className="w-3.5 h-3.5 text-rose-600" />
                                          )}
                                          <span>{channel}</span>
                                        </div>
                                      </td>

                                      {/* Status Klaim */}
                                      <td className="py-3 px-2">
                                        {getClaimStatusBadge(claimStatus)}
                                      </td>

                                      {/* No Tiket */}
                                      <td className="py-3 px-2 font-mono text-xs">
                                        {ticketNumber && ticketNumber !== '-' ? (
                                          <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            {ticketNumber}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 italic">Belum ada</span>
                                        )}
                                      </td>

                                      {/* Nilai Diajukan */}
                                      <td className="py-3 px-2.5 font-mono">
                                        <div className="font-bold text-slate-900 text-xs">
                                          {formatRupiah(claimAmount)}
                                        </div>
                                        <div className="text-[10px] text-slate-400">Tuntutan</div>
                                      </td>

                                      {/* Nilai disetujui marketplace; penerimaan uang dicatat Finance */}
                                      <td className="py-3 px-2.5 bg-indigo-50/40 border-x border-indigo-100/80">
                                        {forwardedRmaMap.has(order.orderId) ? (
                                          <div
                                            className="p-1.5 rounded-xl bg-indigo-50/80 border border-indigo-200/90 flex flex-col items-start gap-1 cursor-default select-none shadow-2xs"
                                            title="Kasus order ini telah dialihkan ke Tim RMA. Nilai pengembalian dana dan ganti rugi dikelola langsung oleh Tim RMA melalui menu Klaim RMA."
                                          >
                                            <div className="font-mono font-bold text-xs text-indigo-950">
                                              {(approvedAmount ?? 0) > 0 ? formatRupiah(approvedAmount ?? 0) : "Belum Ditentukan"}
                                            </div>
                                            <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                                              <Lock className="w-2.5 h-2.5 text-indigo-500" />
                                              <span>Dikelola Tim RMA</span>
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="p-1.5"><div className="font-mono font-bold text-xs">{formatRupiah(approvedAmount || 0)}</div><div className="text-[10px] text-slate-500">{approvedAmount !== undefined ? 'Hasil marketplace tercatat' : 'Belum ada keputusan'}</div></div>
                                        )}
                                      </td>

                                      {/* Selisih Rugi */}
                                      <td className="py-3 px-2.5 font-mono">
                                        <div className={`font-bold text-xs ${netLoss > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                          {formatRupiah(netLoss)}
                                        </div>
                                        <div className="text-[10px] text-slate-400">Beban Toko</div>
                                      </td>

                                      {/* Aksi CS */}
                                      <td className="py-3 px-2 text-center">
                                        <div className="flex items-center justify-center space-x-1">


                                          <button
                                            type="button"
                                            onClick={() => handleCopyClaimTemplate(row, channel, ticketNumber, claimAmount)}
                                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                                            title="Salin template draf surat klaim untuk produk ini"
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Tidak ada barang rusak dalam order ini.</strong> Seluruh unit yang diterima terverifikasi dalam kondisi baik (Good).
                          </span>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* SECTION B: DAFTAR BARANG KONDISI BAIK (REFERENSI LIST)    */}
                      {/* ======================================================== */}
                      {order.goodCount > 0 && (
                        <div className="rounded-2xl border border-emerald-200 bg-white overflow-hidden shadow-xs">
                          <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-100/70 via-emerald-50 to-teal-50/40 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div className="flex items-center space-x-2">
                              <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <PackageCheck className="w-3 h-3" />
                              </div>
                              <div>
                                <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                                  Daftar Barang Kondisi Baik / Utuh ({order.goodCount} SKU) — Referensi Isi Paket (Tidak Diajukan Klaim)
                                </h4>
                                <p className="text-[11px] text-emerald-800">
                                  Barang-barang ini diterima utuh & aman saat unboxing. Ditampilkan sebagai referensi agar tim CS tidak keliru saat mengajukan klaim.
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-800 bg-white/90 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                              Verified Safe (Non-Claimable)
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-emerald-50/30 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                                  <th className="py-2 px-2 w-9 text-center">No</th>
                                  <th className="py-2 px-2.5 w-32">SKU ID</th>
                                  <th className="py-2 px-2.5 min-w-[160px]">Nama Produk</th>
                                  <th className="py-2 px-2 w-32">Kondisi Fisik</th>
                                  <th className="py-2 px-2.5 w-32">Harga Master SKU</th>
                                  <th className="py-2 px-2.5 min-w-[150px]">Keterangan Pemeriksaan</th>
                                  <th className="py-2 px-2 text-center w-28">Status Verifikasi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-100/60">
                                {order.goodItems.map((gRow, gIdx) => {
                                  const itemMasterPrice = lookupItemPrice(gRow.SKU_ID);

                                  return (
                                    <tr key={`${gRow.Order_ID}_${gRow.SKU_ID}_${gIdx}`} className="hover:bg-emerald-50/20 transition-colors">
                                      {/* No */}
                                      <td className="py-2.5 px-2 text-center text-slate-400 font-mono">
                                        {gIdx + 1}
                                      </td>

                                      {/* SKU ID */}
                                      <td className="py-2.5 px-2.5 font-mono font-bold text-slate-800">
                                        {gRow.SKU_ID}
                                      </td>

                                      {/* Nama Produk */}
                                      <td className="py-2.5 px-2.5 font-medium text-slate-800">
                                        {gRow.Nama_Barang}
                                      </td>

                                      {/* Kondisi */}
                                      <td className="py-2.5 px-2">
                                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          <span>Good (Aman & Utuh)</span>
                                        </span>
                                      </td>

                                      {/* Harga Master */}
                                      <td className="py-2.5 px-2.5 font-mono text-slate-700">
                                        {itemMasterPrice !== undefined ? formatRupiah(itemMasterPrice) : '-'}
                                      </td>

                                      {/* Keterangan */}
                                      <td className="py-2.5 px-2.5 text-slate-500 text-[11px]">
                                        {gRow.Catatan_Tambahan || 'Barang diterima lengkap, segel utuh, tidak diajukan klaim.'}
                                      </td>

                                      {/* Status Verifikasi */}
                                      <td className="py-2.5 px-2 text-center">
                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                          Non-Claimable
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* BOTTOM PAGINATION TOOLBAR */}
          <CompactPagination page={currentPage} totalItems={filteredOrders.length} pageSize={ordersPerPage} onPageChange={setCurrentPage} onPageSizeChange={(size) => { setOrdersPerPage(size); setCurrentPage(1); }} pageSizeOptions={[25, 50, 100]} itemLabel="Order ID" ariaLabel="Paginasi klaim CS" />
        </div>
      )}

      {/* ======================================================================= */}
      {/* 5. MODAL FORMULIR & TEMPLATE AJU BANDING CS                             */}
      {/* ======================================================================= */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-rose-50/60 to-amber-50/40 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Formulir banding atas kerusakan barang
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Order ID: <strong className="font-mono text-slate-900">{selectedDispute.row.Order_ID}</strong> • SKU: <strong className="font-mono text-[#0F766E]">{selectedDispute.row.SKU_ID}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDispute(null)}
                className="p-1.5 rounded-full hover:bg-white text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex items-center px-5 border-b border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveModalTab('form')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'form'
                    ? 'border-rose-600 text-rose-700 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Status & Detail Klaim
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('template')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'template'
                    ? 'border-rose-600 text-rose-700 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Draf Surat Banding (Siap Salin)
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('evidence')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'evidence'
                    ? 'border-rose-600 text-rose-700 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Bukti Video Drive
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {activeModalTab === 'form' && (
                <div className="space-y-4 text-xs">
                  {/* Banner Kasus Dialihkan ke RMA */}
                  {selectedDispute && forwardedRmaMap.has(selectedDispute.row.Order_ID) && (
                    <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-start space-x-3">
                      <Lock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-extrabold text-xs">Kasus Order Telah Dialihkan ke Tim RMA Logistik</h4>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                            🔒 Nominal Refund Terkunci
                          </span>
                        </div>
                        <p className="text-[11px] text-indigo-700 leading-relaxed">
                          Penetapan nominal refund dan penyelesaian klaim logistik dikelola langsung oleh Tim RMA melalui menu <strong>Klaim RMA</strong>. Formulir di menu Klaim CS ini ditampilkan dalam mode baca saja (read-only).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Info Box Ringkasan Kerusakan dari Gudang */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">Temuan Unboxing Gudang:</span>
                      {getDamageBadge(selectedDispute.row.Kondisi)}
                    </div>
                    <div className="text-slate-800 font-medium">
                      {selectedDispute.row.Nama_Barang}
                    </div>
                    <div className="text-rose-700 font-mono text-[11px] bg-rose-50 p-2 rounded-lg border border-rose-100">
                      Catatan: {selectedDispute.row.Catatan_Tambahan || 'Tidak ada catatan kerusakan tambahan'}
                    </div>
                  </div>

                  {/* Field: Channel Tujuan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Marketplace Tujuan Banding:
                      </label>
                      <select
                        value={formChannel}
                        onChange={(e) => setFormChannel(e.target.value as ClaimChannel)}
                        disabled={selectedDispute && forwardedRmaMap.has(selectedDispute.row.Order_ID)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        {DEFAULT_CHANNELS.map((ch) => (
                          <option key={ch} value={ch}>
                            {ch}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Field: Status Klaim */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Status Proses Banding:
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => {
                          const newStatus = e.target.value as ClaimStatus;
                          setFormStatus(newStatus);
                          if (newStatus === 'APPROVED' && (!formSettlementAmount || formSettlementAmount === '0')) {
                            setFormSettlementAmount(formClaimAmount || '0');
                          } else if (newStatus === 'REJECTED') {
                            setFormSettlementAmount('0');
                          }
                        }}
                        disabled={selectedDispute && forwardedRmaMap.has(selectedDispute.row.Order_ID)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-bold cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        <option value="PENDING">Draf</option>
                        <option value="SUBMITTED">Diajukan ke marketplace</option>
                        <option value="WAITING">Menunggu keputusan</option>
                        <option value="APPROVED">Disetujui (penuh atau sebagian)</option>
                        <option value="REJECTED">Banding tidak berhasil</option>
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Catat keputusan marketplace sesuai bukti. Banding tidak berhasil tetap dapat ditindaklanjuti atau diserahkan ke RMA.
                      </p>
                    </div>
                  </div>

                  {/* Field: No Tiket & Nominal */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Nomor tiket marketplace (opsional):
                      </label>
                      <input
                        type="text"
                        placeholder="Boleh kosong — gunakan nomor resi"
                        value={formTicketNumber}
                        onChange={(e) => setFormTicketNumber(e.target.value)}
                        disabled={selectedDispute && forwardedRmaMap.has(selectedDispute.row.Order_ID)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Estimasi Nilai Klaim Ganti Rugi (Rp):
                      </label>
                      <input
                        type="number"
                        placeholder="Contoh: 0"
                        value={formClaimAmount}
                        onChange={(e) => setFormClaimAmount(e.target.value)}
                        disabled={selectedDispute && forwardedRmaMap.has(selectedDispute.row.Order_ID)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono font-bold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Field: Catatan CS */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Catatan Tindak Lanjut CS:
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tuliskan perkembangan respon agen CS marketplace, janji SLA investigasi, atau alasan jika ditolak..."
                      value={formCsNotes}
                      onChange={(e) => setFormCsNotes(e.target.value)}
                      disabled={selectedDispute && forwardedRmaMap.has(selectedDispute.row.Order_ID)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {activeModalTab === 'template' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Draf surat pengajuan banding
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Salin teks ini dan tempelkan langsung ke formulir sengketa Shopee / TikTok Shop / tiket CS Marketplace:
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyClaimTemplate(
                          selectedDispute.row,
                          formChannel,
                          formTicketNumber,
                          parseInt(formClaimAmount, 10) || 0
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedDraft ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Teks Lengkap</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-y-auto border border-slate-800 select-all">
                    {generateDisputeLetter(
                      selectedDispute.row,
                      formChannel,
                      formTicketNumber,
                      parseInt(formClaimAmount, 10) || 0
                    )}
                  </div>
                </div>
              )}

              {activeModalTab === 'evidence' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-2xl bg-[#F0FDFA] border border-teal-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-teal-900 flex items-center space-x-1.5">
                        <Video className="w-4 h-4 text-[#0F766E]" />
                        <span>Bukti Video Unboxing Google Drive</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#0F766E] bg-white px-2 py-0.5 rounded border border-teal-200">
                        {selectedDispute.row.Nama_File_Video}
                      </span>
                    </div>

                    <p className="text-teal-900/80 text-xs">
                      Video ini direkam tanpa jeda dengan watermark dan live timestamp untuk membuktikan bahwa barang memang sudah rusak saat paket pertama kali dibuka oleh operator gudang.
                    </p>

                    {selectedDispute.row.Link_Video && (() => {
                      const directUrl = getDirectVideoUrl(selectedDispute.row.Link_Video, selectedDispute.row.Order_ID);
                      return (
                        <div className="pt-2 flex flex-wrap gap-2">
                          <a
                            href={directUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <span>Buka Video di Tab Baru</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(directUrl);
                              showToast('✓ Link Google Drive tersalin!');
                            }}
                            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Salin Link Drive Saja
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                Tersimpan di sistem browser tim CS
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedDispute(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                {selectedDispute && forwardedRmaMap.has(selectedDispute.row.Order_ID) ? (
                  <button
                    type="button"
                    onClick={() => setSelectedDispute(null)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center space-x-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Tutup (Hanya Baca)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveModalClaim}
                    className="px-5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/20 active:scale-95 cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP HASIL AJU BANDING KLAIM PER 1 ORDER ID */}
      {claimModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setClaimModalOrder(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-teal-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center shrink-0 shadow-inner">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30 font-mono">
                      Order Klaim CS
                    </span>
                    <span className="font-mono text-xs text-slate-300 font-bold">
                      Order ID: <strong className="text-white select-all">{claimModalOrder.orderId}</strong>
                    </span>
                    {claimModalOrder.marketplace && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-200 border border-teal-500/30">
                        {claimModalOrder.marketplace}
                      </span>
                    )}
                    {claimModalOrder.ekspedisi && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                        {claimModalOrder.ekspedisi}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                    Formulir banding dan keputusan marketplace
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClaimModalOrder(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-5">
              <button
                type="button"
                onClick={() => setClaimModalActiveTab('form')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
                  claimModalActiveTab === 'form'
                    ? 'border-[#0F766E] text-[#0F766E] bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>1. Status dan keputusan banding</span>
              </button>
              <button
                type="button"
                onClick={() => setClaimModalActiveTab('evidence')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-1.5 ${
                  claimModalActiveTab === 'evidence'
                    ? 'border-[#0F766E] text-[#0F766E] bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>2. Bukti Video Unboxing Drive</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              {claimModalActiveTab === 'form' && (
                <>
                  {/* Rule Note for CS */}
                  <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-950 flex items-start space-x-2.5">
                    <PackageCheck className="w-4 h-4 text-[#0F766E] shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-bold text-[#0F766E]">Pencatatan Hasil Banding 1 Order:</span>
                      {' '}Pilih produk yang disetujui dan catat nilai keputusan marketplace. Dana yang sudah masuk dicatat terpisah. CS dapat menyerahkan kasus langsung ke RMA tanpa menunggu keputusan marketplace.
                    </div>
                  </div>

                  {/* Grid Channel & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Marketplace Tujuan Banding:
                      </label>
                      <select
                        value={claimModalChannel}
                        disabled={!!claimModalOrder && (claimModalOrder.damageItems.every(item=>!!item.closedAt) || forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase()))}
                        onChange={(e) => setClaimModalChannel(e.target.value as ClaimChannel)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-semibold cursor-pointer"
                      >
                        {DEFAULT_CHANNELS.map((ch) => (
                          <option key={ch} value={ch}>
                            {ch}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Tahap / hasil banding:
                      </label>
                      <select
                        value={claimModalStatus}
                        disabled={!!claimModalOrder && (claimModalOrder.damageItems.every(item=>!!item.closedAt) || forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase()))}
                        onChange={(e) => {
                          const nextSt = e.target.value as ClaimStatus;
                          setClaimModalStatus(nextSt);
                          if (nextSt === 'REJECTED') {
                            // Tidak ada pencairan jika ditolak marketplace
                            setClaimModalTotalSettlement('0');
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-bold cursor-pointer"
                      >
                        <option value="PENDING">Draf</option>
                        <option value="SUBMITTED">Diajukan ke marketplace</option>
                        <option value="WAITING">Menunggu keputusan</option>
                        <option value="APPROVED">Disetujui (penuh atau sebagian)</option>
                        <option value="REJECTED">Banding tidak berhasil</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Toko asal klaim:</label>
                      <select value={claimModalStoreId} disabled={!!claimModalOrder && (claimModalOrder.damageItems.every(item=>!!item.closedAt) || forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase()))} onChange={event=>setClaimModalStoreId(event.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-semibold cursor-pointer">
                        <option value="">Pilih toko</option>
                        {stores.filter(store=>store.status==='ACTIVE'&&store.marketplace===claimModalChannel).map(store=><option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}
                      </select>
                      {!selectedClaimModalStore && <p className="mt-1 text-[11px] font-medium text-amber-700">Wajib dipilih sebelum menyimpan hasil klaim atau memindahkan kasus ke RMA.</p>}
                    </div>
                  </div>

                  {/* No. Tiket Banding */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Nomor tiket marketplace (opsional):
                    </label>
                    <input
                      type="text"
                      placeholder="Boleh kosong — nomor resi tetap menjadi referensi utama"
                      value={claimModalTicketNumber}
                      onChange={(e) => setClaimModalTicketNumber(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono"
                    />
                  </div>

                  {/* Checklist Produk yang Berhasil Lolos Pengajuan banding */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-bold text-slate-800 text-xs block">
                          Rincian Produk dalam Order ({targetItemsForModal.length} Produk):
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Centang produk mana saja yang disetujui / dikabulkan kompensasinya oleh marketplace:
                        </p>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const allKeys = new Set(targetItemsForModal.map((d) => d.key));
                            setSelectedSuccessSkuKeys(allKeys);
                          }}
                          className="px-2 py-1 text-[10px] font-bold rounded-lg bg-teal-50 text-[#0F766E] border border-teal-200 hover:bg-teal-100 transition-colors cursor-pointer"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedSuccessSkuKeys(new Set())}
                          className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          Kosongkan
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                            <th className="py-2.5 px-3 w-10 text-center">Pilih</th>
                            <th className="py-2.5 px-3 min-w-[140px]">SKU ID & Nama Produk</th>
                            <th className="py-2.5 px-3 min-w-[110px]">Kondisi Fisik</th>
                            <th className="py-2.5 px-3 text-right">Nilai Barang</th>
                            <th className="py-2.5 px-3 text-center w-32">Status Banding</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80 bg-white">
                          {targetItemsForModal.map((item) => {
                            const isChecked = selectedSuccessSkuKeys.has(item.key);
                            return (
                              <tr
                                key={item.key}
                                onClick={() => {
                                  if (claimModalStatus !== 'APPROVED' || claimModalOrder.damageItems.every(item=>!!item.closedAt) || forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase())) return;
                                  setSelectedSuccessSkuKeys((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.key)) next.delete(item.key);
                                    else next.add(item.key);
                                    return next;
                                  });
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isChecked ? 'bg-teal-50/40 hover:bg-teal-50/70' : 'hover:bg-slate-50 opacity-80'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={claimModalStatus !== 'APPROVED' || claimModalOrder.damageItems.every(item=>!!item.closedAt) || forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase())}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedSuccessSkuKeys((prev) => {
                                        const next = new Set(prev);
                                        if (checked) next.add(item.key);
                                        else next.delete(item.key);
                                        return next;
                                      });
                                    }}
                                    className="w-4 h-4 rounded border-slate-300 text-[#0F766E] focus:ring-[#0F766E] cursor-pointer"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-bold text-[#0F766E]">{item.row.SKU_ID}</span>
                                  <div className="font-medium text-slate-800 truncate max-w-[220px]" title={item.row.Nama_Barang}>
                                    {item.row.Nama_Barang}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  {getDamageBadge(item.row.Kondisi)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                  {formatRupiah(item.claimAmount || item.masterPrice || item.basePrice || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {claimModalStatus === 'APPROVED' && isChecked ? (
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>Lolos Banding</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                      <X className="w-3 h-3 text-rose-500" />
                                      <span>{claimModalStatus === 'REJECTED' || claimModalStatus === 'APPROVED' ? 'Banding tidak berhasil' : 'Belum ada keputusan'}</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Total Nominal Pencairan (Per 1 Order) */}
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="font-extrabold text-amber-950 text-xs block">
                          Nominal penggantian disetujui marketplace (Rp):
                        </label>
                        <p className="text-[11px] text-amber-800/90">
                          Isi sesuai keputusan marketplace. Nominal bisa lebih kecil dari nilai barang karena potongan atau batas penggantian. Dana masuk dicatat terpisah.
                        </p>
                      </div>
                      <div className="relative min-w-[220px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-amber-900 text-sm">Rp</span>
                        <input
                          type="text"
                          value={claimModalTotalSettlement}
                          onChange={(e) => setClaimModalTotalSettlement(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="Contoh: 350000"
                          disabled={claimModalStatus !== 'APPROVED' || claimModalOrder.damageItems.every(item=>!!item.closedAt) || forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase())}
                          className="w-full pl-9 pr-3 py-2 bg-white border border-amber-300 rounded-xl font-mono font-black text-amber-950 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-indigo-900"><strong>Dana diterima dicatat oleh Finance.</strong><p className="mt-1">CS hanya mengisi nominal yang disetujui marketplace. Setelah uang benar-benar masuk, tim Finance mencatat penerimaannya melalui menu Finance.</p></div>
                    <dl className="rounded-xl border border-amber-200 bg-white p-3 text-xs space-y-1"><div>Bagian nilai diajukan yang tidak disetujui: <strong>{formatRupiah(Math.max(0,claimModalOrder.totalClaimAmount-(Number(claimModalTotalSettlement)||0)))}</strong></div></dl>
                  {/* Rangkuman Finansial Order */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200/60 text-[11px] font-mono">
                      <div>
                        <span className="text-amber-800 text-[10px] block">Tuntutan Awal:</span>
                        <strong className="text-slate-800">
                          {formatRupiah(claimModalOrder.totalClaimAmount || 0)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-emerald-800 text-[10px] block">Nilai disetujui:</span>
                        <strong className="text-emerald-700">
                          {formatRupiah(parseInt(claimModalTotalSettlement.replace(/[^0-9]/g, ''), 10) || 0)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-rose-800 text-[10px] block">Nilai tidak disetujui:</span>
                        <strong className="text-rose-700">
                          {formatRupiah(
                            Math.max(
                              0,
                              (claimModalOrder.totalClaimAmount || 0) -
                                (parseInt(claimModalTotalSettlement.replace(/[^0-9]/g, ''), 10) || 0)
                            )
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {claimModalStatus === 'REJECTED' && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">Catat alasan banding tidak berhasil. Kasus juga dapat diserahkan langsung ke RMA tanpa menunggu keputusan marketplace.</p>}

                  {/* Catatan CS */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Catatan keputusan / alasan potongan atau penolakan:</label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Potongan ongkir atau batas penggantian sesuai keputusan marketplace"
                      value={claimModalCsNotes}
                      disabled={!!claimModalOrder && (claimModalOrder.damageItems.every(item=>!!item.closedAt) || forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase()))}
                      onChange={(e) => setClaimModalCsNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
                    />
                  </div>
                </>
              )}

              {claimModalActiveTab === 'evidence' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-teal-900 flex items-center space-x-1.5">
                        <Video className="w-4 h-4 text-[#0F766E]" />
                        <span>Bukti Video Unboxing Google Drive</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#0F766E] bg-white px-2 py-0.5 rounded border border-teal-200">
                        {claimModalOrder.namaFileVideo || '-'}
                      </span>
                    </div>
                    <p className="text-teal-900/80 text-xs">
                      Video direkam tanpa jeda dengan watermark dan live timestamp untuk membuktikan kondisi saat paket pertama kali dibuka oleh operator unboxing gudang.
                    </p>
                    {claimModalOrder.linkVideo && (() => {
                      const directUrl = getDirectVideoUrl(claimModalOrder.linkVideo, claimModalOrder.orderId);
                      return (
                        <div className="pt-2 flex flex-wrap gap-2">
                          <a
                            href={directUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <span>Buka Video di Tab Baru</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(directUrl);
                              showToast('✓ Link Google Drive tersalin!');
                            }}
                            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Salin Link Drive Saja
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 font-medium">
                Tersimpan & tersinkronisasi langsung ke sistem
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setClaimModalOrder(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => claimModalOrder && selectedClaimModalStore && void handleDirectForwardToRma(claimModalOrder, selectedClaimModalStore)}
                  disabled={!claimModalOrder || !selectedClaimModalStore || forwardingOrderId === claimModalOrder.orderId || Boolean(getEscalationError(claimModalOrder.damageItems, forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase())))}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 flex items-center space-x-1.5"
                  title={claimModalOrder ? !selectedClaimModalStore ? 'Pilih toko asal klaim terlebih dahulu.' : getEscalationError(claimModalOrder.damageItems, forwardedRmaMap.has(claimModalOrder.orderId.trim().toUpperCase())) || 'Pindahkan kasus ini langsung ke antrean RMA tanpa menyimpan formulir banding.' : undefined}
                >
                  <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{claimModalOrder && forwardingOrderId === claimModalOrder.orderId ? 'Memindahkan…' : 'Pindahkan ke RMA'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveOrderClaim}
                  className="px-5 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-700/20 active:scale-95 cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Hasil Klaim</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS ORDER IN-APP (SUPER ADMIN) */}
      {orderToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setOrderToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-rose-100 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold tracking-wide uppercase border border-rose-200">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Otoritas Super Admin</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Hapus Data Return & Klaim CS
                </h3>
                <p className="text-xs text-slate-500">
                  Order ID: <strong className="font-mono text-slate-800">{orderToDelete}</strong>
                </p>
              </div>
            </div>
            <div className="text-[11px] text-rose-700 bg-rose-50/80 p-3 rounded-xl border border-rose-200">
              Tindakan ini akan menghapus permanen data return dan seluruh catatan klaim sengketa CS terkait Order ID ini.
            </div>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteOrder && orderToDelete) {
                    onDeleteOrder(orderToDelete);
                  }
                  setOrderToDelete(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <dialog ref={closeDialogRef} aria-labelledby="cs-close-title" onCancel={event=>{if(closingBusy)event.preventDefault();else setClosingOrder(null);}} className="rounded-2xl border border-slate-200 p-6 w-full max-w-lg backdrop:bg-slate-900/60">
        {closingOrder && <div className="space-y-4"><h2 id="cs-close-title" className="text-lg font-bold">Tutup kasus CS</h2><p className="text-sm text-slate-600">Order {closingOrder.orderId}. Penutupan tidak berarti dana sudah diterima penuh.</p><div className="text-sm space-y-2"><div>Nilai diajukan: {formatRupiah(closingOrder.totalClaimAmount)}</div><div>Dana diterima: {formatRupiah(closingOrder.totalSettlementReceived)}</div><div>Sisa klaim belum terganti: {formatRupiah(Math.max(0,closingOrder.totalClaimAmount-closingOrder.totalSettlementReceived))}</div><div>Hasil: {closingOrder.damageItems.every(item=>item.claimStatus==='APPROVED')?'Disetujui penuh':closingOrder.damageItems.every(item=>item.claimStatus==='REJECTED')?'Banding tidak berhasil':'Disetujui sebagian / hasil campuran'}</div></div><p role="alert" className="text-sm text-rose-700">{csClosureError}</p><label className="block text-sm font-semibold" htmlFor="cs-close-reason">Alasan penutupan wajib diisi</label><textarea id="cs-close-reason" aria-invalid={!!csClosureError} value={csClosureReason} onChange={event=>setCsClosureReason(event.target.value)} disabled={closingBusy} rows={3} className="w-full rounded-xl border border-slate-300 p-3"/><div className="flex justify-end gap-2"><button type="button" className="warehouse-button" disabled={closingBusy} onClick={()=>setClosingOrder(null)}>Batal</button><button type="button" className="warehouse-button" disabled={closingBusy} onClick={confirmCloseCs}>{closingBusy?'Menyimpan…':'Konfirmasi tutup kasus'}</button></div></div>}
      </dialog>

    </div>
  );
};
