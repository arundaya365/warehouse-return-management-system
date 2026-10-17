import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  PackageCheck,
  Trash2,
  Share2,
  ArrowRight,
  Send,
  Lock
} from 'lucide-react';
import { ProcessedReturnRow, StandardKondisi } from '../processor';
import { MasterSKUItem } from '../utils/excelTemplate';
import { useLanguage } from '../context/LanguageContext';
import { useAccount, ROLE_DEFINITIONS } from '../context/AccountContext';
import { getDirectVideoUrl } from './ResultViewer';
import { syncService } from '../services/dataSyncService';
import { RmaClaimRecord, RmaClaimItem, RMA_STAGE_LABELS } from '../types/rma';
import { detectMarketplaceAndLogistics } from '../utils/awbDetection';

export type ClaimStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'REJECTED';

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
  ticketNumber: string;
  claimAmount: number; // in IDR (nilai tuntutan diajukan ke ekspedisi/marketplace)
  settlementAmount?: number; // in IDR (nilai penggantian aktual yang disetujui/dicairkan ekspedisi)
  settlementNote?: string; // alasan selisih ganti rugi ekspedisi
  csNotes: string;
  updatedAt: string;
}

export interface DamagedDisputeItem {
  key: string;
  itemIndex: number;
  row: ProcessedReturnRow;
  channel: ClaimChannel;
  claimStatus: ClaimStatus;
  ticketNumber: string;
  claimAmount: number;
  settlementAmount?: number;
  settlementNote: string;
  masterPrice?: number;
  basePrice: number;
  actualCompensation: number;
  netLoss: number;
  recoveryPct: number;
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
    missing: number;
    unexpected: number;
  };
}

interface DisputeClaimsViewProps {
  rows: ProcessedReturnRow[];
  onNavigateToStation: () => void;
  onNavigateToReports: () => void;
  onNavigateToRma?: () => void;
  masterDatabase?: MasterSKUItem[];
  onDeleteOrder?: (orderId: string) => void;
  rmaClaims?: RmaClaimRecord[];
  onForwardToRma?: (claim: RmaClaimRecord) => void;
  onDisputeRecordsChange?: (records: Record<string, any>) => void;
}

const DEFAULT_CHANNELS: ClaimChannel[] = [
  'Shopee',
  'TikTok Shop',
  'Tokopedia',
  'Lazada',
  'J&T Express',
  'SiCepat',
  'SPX Express',
  'JNE'
];

export const DisputeClaimsView: React.FC<DisputeClaimsViewProps> = ({
  rows,
  onNavigateToStation,
  onNavigateToReports,
  onNavigateToRma,
  masterDatabase = [],
  onDeleteOrder,
  rmaClaims = [],
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

  // Simpan perubahan ke localStorage & server database Cloud SQL
  const saveDisputeRecords = (updated: Record<string, Partial<DisputeRecord>>) => {
    setDisputeRecords(updated);
    if (onDisputeRecordsChange) {
      onDisputeRecordsChange(updated);
    }
    try {
      localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(updated));
    } catch {}
    syncService.pushDisputes(updated);
  };


  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDamageType, setFilterDamageType] = useState<string>('ALL');
  const [filterChannel, setFilterChannel] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'DAMAGE_ONLY' | 'ALL_RETURNS'>('DAMAGE_ONLY');

  // Pagination State: 100 Order ID / Halaman
  const ORDERS_PER_PAGE = 100;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Expanded Order IDs
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Inline Quick Edit di tabel untuk input angka manual langsung
  const [inlineEditingKey, setInlineEditingKey] = useState<string | null>(null);
  const [inlineSettlementInput, setInlineSettlementInput] = useState<string>('');

  // Modal Detail / Form Aju Banding
  const [selectedDispute, setSelectedDispute] = useState<{
    key: string;
    row: ProcessedReturnRow;
  } | null>(null);

  // Modal Konfirmasi Hapus Order Super Admin (In-App)
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  // Form State dalam Modal
  const [formChannel, setFormChannel] = useState<ClaimChannel>('Shopee');
  const [formStatus, setFormStatus] = useState<ClaimStatus>('PENDING');
  const [formTicketNumber, setFormTicketNumber] = useState<string>('');
  const [formClaimAmount, setFormClaimAmount] = useState<string>('150000');
  const [formSettlementAmount, setFormSettlementAmount] = useState<string>('150000');
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

  // Modal Forward ke Tim RMA (Eskalasi Klaim Logistik)
  const [forwardingOrder, setForwardingOrder] = useState<OrderDisputeGroup | null>(null);
  const [forwardEstCompensation, setForwardEstCompensation] = useState<string>('');
  const [forwardCsNotes, setForwardCsNotes] = useState<string>('');

  const forwardedRmaMap = useMemo(() => {
    const map = new Map<string, RmaClaimRecord>();
    (rmaClaims || []).forEach((c) => {
      map.set(c.orderId, c);
    });
    return map;
  }, [rmaClaims]);

  const handleOpenForwardModal = (order: OrderDisputeGroup) => {
    setForwardingOrder(order);
    const calculatedEst = order.totalClaimAmount > 0
      ? order.totalClaimAmount
      : order.damageItems.reduce((acc, curr) => acc + (curr.masterPrice || curr.basePrice || 150000), 0);
    setForwardEstCompensation(String(calculatedEst || 150000));
    setForwardCsNotes(
      order.damageItems.map((d) => d.csNotes).filter(Boolean).join('; ') ||
      'Ekspedisi menolak ganti rugi tingkat CS / butuh investigasi fisik gudang dan bukti rekaman unboxing.'
    );
  };

  const handleConfirmForwardToRma = () => {
    if (!forwardingOrder) return;
    const estCompNum = parseInt(forwardEstCompensation.replace(/[^0-9]/g, ''), 10) || 0;
    const nowIso = new Date().toISOString();

    const items: RmaClaimItem[] = forwardingOrder.damageItems.map((d) => ({
      skuId: d.row.SKU_ID,
      namaBarang: d.row.Nama_Barang,
      qty: 1,
      kondisi: d.row.Kondisi,
      hargaSatuan: d.masterPrice || d.basePrice || 150000,
      subtotalEstimasi: d.claimAmount || d.masterPrice || d.basePrice || 150000
    }));

    const primaryChannel = forwardingOrder.damageItems[0]?.channel || detectChannelFromOrderId(forwardingOrder.orderId);

    const rmaRecord: RmaClaimRecord = {
      id: `rma_${forwardingOrder.orderId}_${Date.now()}`,
      orderId: forwardingOrder.orderId,
      awb: (forwardingOrder.allItems[0] as Record<string, any>)?.No_Resi || forwardingOrder.orderId,
      channel: primaryChannel,
      stageStatus: 'DIALIHKAN_KE_RMA',
      items,
      estimatedCompensation: estCompNum,
      csNotes: forwardCsNotes.trim(),
      forwardedBy: currentUser?.fullName || 'CS Specialist',
      forwardedAt: nowIso,
      videoTimestamp: forwardingOrder.videoTimestamp,
      namaFileVideo: forwardingOrder.namaFileVideo,
      linkVideo: forwardingOrder.linkVideo,
      operatorId: forwardingOrder.operatorId,
      waktuProses: forwardingOrder.waktuProses,
      updatedAt: nowIso
    };

    if (onForwardToRma) {
      onForwardToRma(rmaRecord);
    }

    // Update dispute record to mark as forwarded
    const updatedDisputes = { ...disputeRecords };
    forwardingOrder.damageItems.forEach((d) => {
      const existing = updatedDisputes[d.key] || {};
      updatedDisputes[d.key] = {
        ...existing,
        id: d.key,
        row: d.row,
        channel: d.channel,
        claimStatus: existing.claimStatus || d.claimStatus,
        ticketNumber: existing.ticketNumber || d.ticketNumber,
        claimAmount: existing.claimAmount !== undefined ? existing.claimAmount : d.claimAmount,
        csNotes: `[DIALIHKAN KE RMA] ${forwardCsNotes.trim()}`,
        updatedAt: nowIso
      };
    });
    saveDisputeRecords(updatedDisputes);

    setForwardingOrder(null);
    showToast(`✓ Kasus Order ${forwardingOrder.orderId} berhasil dialihkan ke Tim RMA!`);
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
    if (detected.logistics === 'J&T') return 'J&T Express';
    if (detected.logistics === 'SiCepat') return 'SiCepat';
    if (detected.logistics === 'Shopee Express') return 'SPX Express';
    if (detected.logistics === 'JNE') return 'JNE';
    if (detected.logistics === 'Ninja Express') return 'Ninja Xpress';
    const id = (orderId || '').toUpperCase();
    if (id.includes('TOKOPEDIA') || id.includes('TKP')) return 'Tokopedia';
    if (id.includes('TIKTOK') || id.includes('TTS')) return 'TikTok Shop';
    if (id.includes('LAZADA') || id.includes('LZD')) return 'Lazada';
    return 'Shopee'; // default paling umum untuk e-commerce Indonesia
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
      const orderId = r.Order_ID || 'UNASSIGNED';
      if (!map.has(orderId)) {
        map.set(orderId, []);
      }
      map.get(orderId)!.push(r);
    }

    const groups: OrderDisputeGroup[] = [];

    for (const [orderId, orderRows] of map.entries()) {
      const firstRow = orderRows[0];
      const goodRows = orderRows.filter((r) => r.Kondisi === 'Good');
      const damageRows = orderRows.filter((r) => r.Kondisi !== 'Good');

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
        const basePrice = itemMasterPrice !== undefined ? itemMasterPrice : 150000;

        const isFull100Claim =
          row.Kondisi === 'Totally Damage' ||
          row.Kondisi === 'Missing Item' ||
          row.Kondisi === 'Missing' ||
          (row.Kondisi as string) === 'Damage Total';

        const defaultClaimAmount = isFull100Claim ? basePrice : (itemMasterPrice !== undefined ? itemMasterPrice : 150000);
        const claimAmount = claim?.claimAmount ?? defaultClaimAmount;
        const defaultStatus: ClaimStatus = isFull100Claim ? 'SUBMITTED' : 'PENDING';
        const status: ClaimStatus = (claim?.claimStatus as ClaimStatus) || defaultStatus;
        const ticketNumber = claim?.ticketNumber || (isFull100Claim ? `AUTO-100-${Math.floor(100000 + Math.random() * 900000)}` : '-');

        const settlementAmount =
          claim?.settlementAmount !== undefined
            ? claim.settlementAmount
            : (status === 'APPROVED' ? claimAmount : (status === 'REJECTED' ? 0 : undefined));

        const actualCompensation = settlementAmount ?? (status === 'APPROVED' ? claimAmount : 0);
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
          settlementAmount,
          settlementNote: claim?.settlementNote || '',
          masterPrice: itemMasterPrice,
          basePrice,
          actualCompensation,
          netLoss,
          recoveryPct,
          csNotes: claim?.csNotes || ''
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
      } else if (damagedItems.some((d) => d.claimStatus === 'SUBMITTED')) {
        overallStatus = 'SUBMITTED';
      }

      // Hitung variasi SKU dan breakdown kondisi persis seperti pada halaman laporan
      const skuList: { skuId: string; namaBarang: string; qty: number }[] = [];
      const conditionBreakdown = {
        good: 0,
        damageProduct: 0,
        damagePackaging: 0,
        missing: 0,
        unexpected: 0
      };

      for (const r of orderRows) {
        if (r.Kondisi === 'Good') conditionBreakdown.good += 1;
        else if (r.Kondisi === 'Damage Packaging') conditionBreakdown.damagePackaging += 1;
        else if (r.Kondisi === 'Missing Item' || r.Kondisi === 'Missing') conditionBreakdown.missing += 1;
        else if (r.Kondisi === 'Wrong Item' || r.Kondisi === 'Unexpected') conditionBreakdown.unexpected += 1;
        else conditionBreakdown.damageProduct += 1;

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

      // 3. Filter Status Klaim
      if (filterStatus !== 'ALL') {
        if (!group.damageItems.some((d) => d.claimStatus === filterStatus)) {
          return false;
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
  }, [orderGroups, viewMode, searchQuery, filterStatus, filterDamageType, filterChannel]);

  // Reset pagination saat filter / query berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterDamageType, filterChannel, viewMode]);

  // Kalkulasi Halaman (100 Order ID per halaman)
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const startIndex = (currentPage - 1) * ORDERS_PER_PAGE;
  const endIndex = Math.min(startIndex + ORDERS_PER_PAGE, filteredOrders.length);
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

  // Helper nomor halaman dengan ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // Semua barang damage dalam filtered orders (untuk kalkulasi & ekspor)
  const allFilteredDamageItems = useMemo(() => {
    return filteredOrders.flatMap((o) => o.damageItems);
  }, [filteredOrders]);

  // Statistik Ringkasan Klaim CS
  const stats = useMemo(() => {
    const totalOrdersWithDamage = orderGroups.filter((o) => o.damageCount > 0).length;
    const allDamageItems = orderGroups.flatMap((o) => o.damageItems);
    const totalCount = allDamageItems.length;
    const pendingCount = allDamageItems.filter((d) => d.claimStatus === 'PENDING').length;
    const submittedCount = allDamageItems.filter((d) => d.claimStatus === 'SUBMITTED').length;
    const approvedCount = allDamageItems.filter((d) => d.claimStatus === 'APPROVED').length;
    const partialCount = allDamageItems.filter((d) => d.claimStatus === 'PARTIAL').length;
    const rejectedCount = allDamageItems.filter((d) => d.claimStatus === 'REJECTED').length;

    const totalDamageGoodsValue = allDamageItems.reduce((acc, curr) => acc + curr.basePrice, 0);
    const totalClaimed = allDamageItems.reduce((acc, curr) => acc + curr.claimAmount, 0);
    const totalSettlementReceived = allDamageItems.reduce((acc, curr) => acc + curr.actualCompensation, 0);
    const totalUncoveredLoss = Math.max(0, totalDamageGoodsValue - totalSettlementReceived);

    return {
      totalOrdersWithDamage,
      totalCount,
      pendingCount,
      submittedCount,
      approvedCount,
      partialCount,
      rejectedCount,
      totalDamageGoodsValue,
      totalClaimed,
      totalSettlementReceived,
      totalUncoveredLoss
    };
  }, [orderGroups]);
  // Open modal handler untuk mengelola status & detail klaim
  const handleOpenEditModal = (item: DamagedDisputeItem) => {
    const { key, row } = item;
    const existing = disputeRecords[key];
    const initialChannel = (existing?.channel as ClaimChannel) || item.channel;
    const itemMasterPrice = lookupItemPrice(row.SKU_ID);
    const defaultAmount = itemMasterPrice !== undefined ? itemMasterPrice : 150000;

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
  const handleSaveModalClaim = () => {
    if (!selectedDispute) return;
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
        settlementAmount: settlementAmountNum,
        settlementNote: formSettlementNote.trim(),
        csNotes: formCsNotes.trim(),
        updatedAt: new Date().toISOString()
      }
    };

    saveDisputeRecords(updated);
    setSelectedDispute(null);
    showToast(`✓ Data klaim Order [${row.Order_ID}] berhasil disimpan`);
  };

  // Inline Quick Edit handler untuk tabel
  const handleStartInlineEdit = (key: string, currentVal?: number, fallbackVal: number = 0) => {
    setInlineEditingKey(key);
    setInlineSettlementInput(String(currentVal !== undefined ? currentVal : fallbackVal));
  };

  const handleSaveInlineEdit = (key: string, row: ProcessedReturnRow, claimAmount: number) => {
    const settlementNum = parseInt(inlineSettlementInput.replace(/[^0-9]/g, ''), 10) || 0;
    const existing = disputeRecords[key] || {};

    let nextStatus: ClaimStatus = (existing.claimStatus as ClaimStatus) || 'SUBMITTED';
    if (settlementNum === 0) {
      nextStatus = 'REJECTED';
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
        settlementAmount: settlementNum,
        updatedAt: new Date().toISOString()
      }
    };

    saveDisputeRecords(updated);
    setInlineEditingKey(null);
    showToast(`✓ Nilai ganti rugi ekspedisi diperbarui: ${formatRupiah(settlementNum)}`);
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingKey(null);
    setInlineSettlementInput('');
  };

  // Aksi Cepat: Setujui Klaim Item (Approved 100%) -> Mengurangi angka badge Klaim CS
  const handleQuickApproveItem = (item: DamagedDisputeItem) => {
    const { key, row, claimAmount, basePrice } = item;
    const finalAmount = claimAmount || basePrice || 150000;
    const existing = disputeRecords[key] || {};
    const updated = {
      ...disputeRecords,
      [key]: {
        ...existing,
        id: key,
        row,
        channel: existing.channel || item.channel,
        claimStatus: 'APPROVED' as ClaimStatus,
        ticketNumber: existing.ticketNumber || (item.ticketNumber !== '-' ? item.ticketNumber : ''),
        claimAmount: finalAmount,
        settlementAmount: finalAmount,
        csNotes: existing.csNotes || 'Disetujui penuh oleh ekspedisi/marketplace',
        updatedAt: new Date().toISOString()
      }
    };
    saveDisputeRecords(updated);
    showToast(`✓ Klaim [${row.SKU_ID}] disetujui penuh (${formatRupiah(finalAmount)}). Angka badge Klaim CS berkurang!`);
  };

  // Aksi Cepat: Tolak Klaim Item (Rejected Rp 0) -> Mengurangi angka badge Klaim CS
  const handleQuickRejectItem = (item: DamagedDisputeItem) => {
    const { key, row, claimAmount } = item;
    const existing = disputeRecords[key] || {};
    const updated = {
      ...disputeRecords,
      [key]: {
        ...existing,
        id: key,
        row,
        channel: existing.channel || item.channel,
        claimStatus: 'REJECTED' as ClaimStatus,
        ticketNumber: existing.ticketNumber || (item.ticketNumber !== '-' ? item.ticketNumber : ''),
        claimAmount: existing.claimAmount || claimAmount,
        settlementAmount: 0,
        csNotes: existing.csNotes || 'Klaim ditolak oleh ekspedisi/marketplace',
        updatedAt: new Date().toISOString()
      }
    };
    saveDisputeRecords(updated);
    showToast(`✓ Klaim [${row.SKU_ID}] ditolak (Rp 0). Kasus selesai & angka badge Klaim CS berkurang.`);
  };

  // Aksi Cepat: Setujui Seluruh SKU dalam 1 Order
  const handleQuickApproveAllOrder = (order: OrderDisputeGroup) => {
    const updated = { ...disputeRecords };
    const nowIso = new Date().toISOString();
    order.damageItems.forEach((item) => {
      const finalAmount = item.claimAmount || item.basePrice || 150000;
      const existing = updated[item.key] || {};
      updated[item.key] = {
        ...existing,
        id: item.key,
        row: item.row,
        channel: existing.channel || item.channel,
        claimStatus: 'APPROVED' as ClaimStatus,
        ticketNumber: existing.ticketNumber || (item.ticketNumber !== '-' ? item.ticketNumber : ''),
        claimAmount: finalAmount,
        settlementAmount: finalAmount,
        csNotes: existing.csNotes || 'Disetujui penuh (Batch Order)',
        updatedAt: nowIso
      };
    });
    saveDisputeRecords(updated);
    showToast(`✓ Seluruh klaim Order [${order.orderId}] (${order.damageCount} SKU) Disetujui. Angka badge Klaim CS berkurang!`);
  };

  // Aksi Cepat: Tolak Seluruh SKU dalam 1 Order
  const handleQuickRejectAllOrder = (order: OrderDisputeGroup) => {
    const updated = { ...disputeRecords };
    const nowIso = new Date().toISOString();
    order.damageItems.forEach((item) => {
      const existing = updated[item.key] || {};
      updated[item.key] = {
        ...existing,
        id: item.key,
        row: item.row,
        channel: existing.channel || item.channel,
        claimStatus: 'REJECTED' as ClaimStatus,
        ticketNumber: existing.ticketNumber || (item.ticketNumber !== '-' ? item.ticketNumber : ''),
        claimAmount: existing.claimAmount || item.claimAmount,
        settlementAmount: 0,
        csNotes: existing.csNotes || 'Ditolak ekspedisi (Batch Order)',
        updatedAt: nowIso
      };
    });
    saveDisputeRecords(updated);
    showToast(`✓ Seluruh klaim Order [${order.orderId}] (${order.damageCount} SKU) Ditolak. Kasus selesai & angka badge Klaim CS berkurang.`);
  };

  // Generator teks template surat / draf aju banding CS per item
  const generateDisputeLetter = (row: ProcessedReturnRow, channel: string, ticketNo?: string, amount?: number) => {
    const formattedAmount = formatRupiah(amount || 150000);
    const driveUrl = getDirectVideoUrl(row.Link_Video || '', row.Order_ID) || 'https://drive.google.com/file/d/evidence-video/view';

    return `Yth. Tim Customer Service / Resolution Center ${channel}
Perihal: Permohonan Aju Banding Retur Barang Rusak / Hilang (Claim Reimbursement)

Dengan hormat,
Bersama pesan ini kami mengajukan permohonan aju banding atas pesanan retur berikut:

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
Perihal: Permohonan Aju Banding Retur Barang Rusak / Hilang (Claim Reimbursement)

Dengan hormat,
Bersama pesan ini kami mengajukan permohonan aju banding resmi atas pesanan retur berikut:

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

  // Salin template teks aju banding
  const handleCopyClaimTemplate = (row: ProcessedReturnRow, channel: string, ticketNo?: string, amount?: number) => {
    const text = generateDisputeLetter(row, channel, ticketNo, amount);
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2500);
    showToast(`✓ Draf aju banding untuk ${row.Order_ID} disalin ke clipboard!`);
  };

  // Salin template teks order lengkap
  const handleCopyOrderLetter = (order: OrderDisputeGroup) => {
    const text = generateDisputeLetterForOrder(order);
    navigator.clipboard.writeText(text);
    showToast(`✓ Draf aju banding Order [${order.orderId}] (${order.totalItemsCount} SKU) berhasil disalin!`);
  };

  // Salin cepat link drive
  const handleCopyDriveLink = (linkVideo?: string, orderId?: string) => {
    if (!linkVideo) return;
    const directUrl = getDirectVideoUrl(linkVideo, orderId);
    navigator.clipboard.writeText(directUrl);
    showToast(`✓ Link Google Drive ${orderId || ''} disalin!`);
  };

  // Export CSV Data Aju Banding dengan kolom rincian finansial & semua SKU
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
            <span>Siap Diajukan</span>
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3 h-3 text-blue-600 animate-spin" />
            <span>Sedang Diajukan</span>
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
            <span>Sebagian (Partial)</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Ditolak (Rp 0)</span>
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
    <div className="space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 1. TOP HEADER                                                           */}
      {/* ======================================================================= */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-900/15 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                {t('disputes_title')}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                {stats.totalOrdersWithDamage} {isEn ? 'Damaged Orders' : 'Order Bermasalah'} ({stats.totalCount} {isEn ? 'Items' : 'Barang Rusak'})
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                100 Order ID / Halaman
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              {t('disputes_subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center space-x-2 gap-y-2 shrink-0">
          <button
            onClick={handleDownloadDisputeCsv}
            disabled={filteredOrders.length === 0}
            className="py-2.5 px-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-medium text-xs sm:text-sm border border-slate-200 shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title={isEn ? "Export filtered claim records to CSV" : "Unduh seluruh berkas klaim terfilter ke format CSV / Excel"}
          >
            <Download className="w-4 h-4 text-rose-600" />
            <span>{isEn ? 'Export Dispute Records' : 'Ekspor Berkas Klaim'} ({filteredOrders.length} Order)</span>
          </button>

          <button
            onClick={onNavigateToReports}
            className="py-2.5 px-3.5 rounded-2xl bg-white hover:bg-[#F0FDFA] text-[#134E4A] font-medium text-xs sm:text-sm border border-[#E2E8F0] transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <FileText className="w-4 h-4 text-[#0F766E]" />
            <span>{isEn ? 'All Reports' : 'Semua Laporan'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 2. STATISTIK KLAIM & KERUGIAN (5 METRIK FINANSIAL)                      */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
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
            {isEn ? 'Pending' : 'Pending'}: {stats.pendingCount} • {isEn ? 'Submitted' : 'Diajukan'}: {stats.submittedCount}
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
            {isEn ? 'Approved payout from courier' : 'Uang cair disetujui kurir'}
          </div>
        </div>

        {/* Card 5: Selisih Kerugian (Beban Toko) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/90 to-red-50/60 border border-rose-200/90 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 text-xs font-bold">
            <span>{isEn ? 'Net Store Loss' : 'Selisih Beban Rugi Toko'}</span>
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
      {/* 2B. BANNER ATURAN BAKU PENGURANGAN ANGKA NAVIGATION BAR                 */}
      {/* ======================================================================= */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-violet-50/90 via-indigo-50/80 to-teal-50/70 border border-indigo-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-indigo-950 flex items-center space-x-1.5">
                <span>Aturan Baku Pengurangan Angka Badge di Navigation Bar</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Resmi CS & RMA
                </span>
              </h3>
              <p className="text-[11px] text-slate-600">
                Angka badge merah pada tab <strong>Klaim CS</strong> menunjukkan jumlah produk rusak yang <strong>masih aktif memerlukan tindakan CS</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-indigo-100 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-white/90 border border-emerald-200 flex items-start space-x-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-900 block text-[11px]">1. Status Disetujui (Approved / Partial)</span>
              <p className="text-[10px] text-emerald-700 leading-relaxed mt-0.5">
                Angka badge <strong>otomatis berkurang</strong> karena dana ganti rugi telah disepakati dan dicairkan oleh ekspedisi/marketplace.
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/90 border border-rose-200 flex items-start space-x-2 shadow-2xs">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-900 block text-[11px]">2. Status Ditolak (Rejected)</span>
              <p className="text-[10px] text-rose-700 leading-relaxed mt-0.5">
                Angka badge <strong>otomatis berkurang</strong> karena tiket klaim ditolak final oleh ekspedisi (kasus ditutup / selesai).
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-white/90 border border-indigo-200 flex items-start space-x-2 shadow-2xs">
            <Truck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-indigo-900 block text-[11px]">3. Dialihkan ke RMA Logistik</span>
              <p className="text-[10px] text-indigo-700 leading-relaxed mt-0.5">
                Angka badge CS <strong>berkurang & berpindah</strong> ke tab <strong>RMA Claim</strong> untuk diproses investigasi oleh Tim RMA.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. TOOLBAR FILTER & PENCARIAN KLAIM                                     */}
      {/* ======================================================================= */}
      <div className="glass-card rounded-3xl p-5 shadow-[0_15px_35px_-10px_rgba(76,29,149,0.15)] space-y-3.5">
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
                title="Tampilkan hanya Order ID yang memiliki produk rusak / diajukan aju banding"
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
              <span>Unduh CSV ({filteredOrders.length} Order)</span>
            </button>
          </div>
        </div>

        {/* Filter Bar Segmented Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Filter Status Klaim */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Status Aju Banding:
            </label>
            <div className="flex flex-wrap gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PENDING')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Draft ({stats.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('SUBMITTED')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'SUBMITTED'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diajukan ({stats.submittedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('APPROVED')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                100% Penuh ({stats.approvedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PARTIAL')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'PARTIAL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sebagian ({stats.partialCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('REJECTED')}
                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterStatus === 'REJECTED'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ditolak ({stats.rejectedCount})
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
              Target Channel (Marketplace / Logistik):
            </label>
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
            >
              <option value="ALL">Semua Channel (Marketplace & Logistik)</option>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs text-slate-600">
              Menampilkan <strong className="text-slate-900 font-mono">{startIndex + 1}</strong> – <strong className="text-slate-900 font-mono">{endIndex}</strong> dari <strong className="text-slate-900 font-mono">{filteredOrders.length}</strong> Order ID
              <span className="text-slate-400 ml-2 font-mono">
                (Batas 100 Order/halaman)
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Expand / Collapse All Controls */}
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Buka Semua
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Tutup Semua
              </button>

              {/* Pagination Page Switcher */}
              {totalPages > 1 && (
                <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Halaman Pertama"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center space-x-1">
                    {getPageNumbers().map((pg, idx) =>
                      typeof pg === 'number' ? (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCurrentPage(pg)}
                          className={`w-7 h-7 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            currentPage === pg
                              ? 'bg-[#0F766E] text-white shadow-xs'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {pg}
                        </button>
                      ) : (
                        <span key={idx} className="px-1 text-slate-400 text-xs">
                          {pg}
                        </span>
                      )
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Halaman Selanjutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Halaman Terakhir"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table Container Grouped by Order ID (Model List Laporan Ringkas & Informatif) */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-2.5 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-40">Order ID & Operator</th>
                  <th className="py-2.5 px-3 w-32">Waktu Proses</th>
                  <th className="py-2.5 px-2 text-center w-24">Jumlah Qty</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Variasi SKU</th>
                  <th className="py-2.5 px-3 w-44">Kondisi Barang</th>
                  <th className="py-2.5 px-3 w-36">Video & Drive</th>
                  <th className="py-2.5 px-3 text-center w-36">Status & Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedOrders.map((order, orderIdx) => {
                  const globalOrderNumber = startIndex + orderIdx + 1;
                  const isExpanded = expandedOrderIds.has(order.orderId);

                  return (
                    <React.Fragment key={order.orderId}>
                      <tr
                        className={`hover:bg-[#F0FDFA]/50 transition-colors cursor-pointer ${
                          isExpanded
                            ? 'bg-[#F0FDFA]/40'
                            : order.damageCount > 0
                            ? 'hover:bg-rose-50/30'
                            : ''
                        }`}
                        onClick={() => toggleOrderExpand(order.orderId)}
                      >
                        {/* No */}
                        <td className="py-3 px-2 text-center text-slate-500 font-mono font-bold">
                          {globalOrderNumber}
                        </td>

                        {/* Order ID & Operator */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-extrabold text-slate-900 text-xs sm:text-sm select-all">
                              {order.orderId}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(order.orderId);
                                showToast(`✓ Order ID ${order.orderId} disalin!`);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Salin Order ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {order.marketplace && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                                <ShoppingBag className="w-2.5 h-2.5 text-teal-600" />
                                <span>{order.marketplace}</span>
                              </span>
                            )}
                            {order.ekspedisi && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                                <Truck className="w-2.5 h-2.5 text-indigo-600" />
                                <span>{order.ekspedisi}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center space-x-1">
                            <span>Operator:</span>
                            <span className="font-mono text-slate-700 font-semibold">{order.operatorId}</span>
                          </div>
                        </td>

                        {/* Waktu Proses */}
                        <td className="py-3 px-3 font-mono text-slate-600 tabular-nums">
                          <div className="text-slate-800 font-semibold text-[11px]">{order.waktuProses}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Rec: {order.videoTimestamp}</div>
                        </td>

                        {/* Jumlah Qty */}
                        <td className="py-3 px-2 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-[#F0FDFA] text-[#0F766E] font-mono font-bold text-xs shadow-2xs border border-teal-200">
                            {order.totalItemsCount} Unit
                          </span>
                          {order.damageCount > 0 && (
                            <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                              {order.damageCount} Rusak
                            </div>
                          )}
                        </td>

                        {/* Variasi SKU */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-1.5 mb-1">
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-[10px] border border-slate-200">
                              <Boxes className="w-3 h-3 text-[#0F766E]" />
                              <span>{order.skuVariationsCount} Variasi SKU</span>
                            </span>
                          </div>

                          {/* Chips daftar SKU & jumlah masing-masing */}
                          <div className="flex flex-wrap gap-1">
                            {order.skuList.map((sku) => (
                              <span
                                key={sku.skuId}
                                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono border border-slate-200"
                                title={`${sku.namaBarang} (Total: ${sku.qty})`}
                              >
                                <span className="font-bold text-[#0F766E]">{sku.skuId}</span>
                                <span className="text-slate-400 font-sans">×</span>
                                <span className="font-extrabold text-slate-900">{sku.qty}</span>
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Kondisi Barang */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {order.conditionBreakdown.good > 0 && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                <span>Good:</span>
                                <span>{order.conditionBreakdown.good}</span>
                              </span>
                            )}
                            {order.conditionBreakdown.damageProduct > 0 && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                                <span>Dmg:</span>
                                <span>{order.conditionBreakdown.damageProduct}</span>
                              </span>
                            )}
                            {order.conditionBreakdown.damagePackaging > 0 && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200">
                                <span>Dus:</span>
                                <span>{order.conditionBreakdown.damagePackaging}</span>
                              </span>
                            )}
                            {order.conditionBreakdown.missing > 0 && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 text-[10px] font-bold border border-rose-200">
                                <span>Hilang:</span>
                                <span>{order.conditionBreakdown.missing}</span>
                              </span>
                            )}
                            {order.conditionBreakdown.unexpected > 0 && (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold border border-slate-200">
                                <span>Wrong:</span>
                                <span>{order.conditionBreakdown.unexpected}</span>
                              </span>
                            )}
                          </div>
                          {order.damageCount > 0 && (
                            <div className="text-[10px] text-rose-700 font-mono font-bold mt-1">
                              Tuntutan: {formatRupiah(order.totalClaimAmount)}
                            </div>
                          )}
                        </td>

                        {/* Video & Drive */}
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <div
                            className="text-[#0F766E] bg-[#F0FDFA] px-1.5 py-0.5 rounded border border-teal-200 inline-block font-semibold truncate max-w-[130px]"
                            title={order.namaFileVideo}
                          >
                            {order.namaFileVideo || '-'}
                          </div>
                          {order.linkVideo && (
                            <div className="mt-0.5">
                              <a
                                href={getDirectVideoUrl(order.linkVideo, order.orderId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[#0F766E] hover:underline font-semibold inline-flex items-center space-x-0.5 text-[10px]"
                              >
                                <span>Drive Video</span>
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                              </a>
                            </div>
                          )}
                        </td>

                        {/* Status & Rincian CS */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <div className="shrink-0 scale-90 origin-center flex flex-col items-center gap-1">
                              {getClaimStatusBadge(order.overallStatus)}
                              {forwardedRmaMap.has(order.orderId) && (
                                <span
                                  onClick={() => onNavigateToRma && onNavigateToRma()}
                                  className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[9px] font-bold border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                                  title="Kasus telah dialihkan ke Tim RMA. Klik untuk buka di RMA Claim"
                                >
                                  <Truck className="w-2.5 h-2.5 text-indigo-600" />
                                  <span>Dialihkan ke RMA</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => toggleOrderExpand(order.orderId)}
                                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                  isExpanded
                                    ? 'bg-[#0F766E] text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-[#F0FDFA] text-slate-700 hover:text-[#0F766E] border border-slate-200'
                                }`}
                                title="Buka / tutup rincian klaim dan SKU order ini"
                              >
                                <span>{isExpanded ? 'Tutup' : 'Rincian'}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                                )}
                              </button>
                              {order.damageCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyOrderLetter(order)}
                                  className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                                  title="Salin Surat Sanggahan / Klaim Order"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* Tombol Forward ke Tim RMA */}
                              {forwardedRmaMap.has(order.orderId) ? (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToRma && onNavigateToRma()}
                                  className="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                                  title="Kasus telah dialihkan ke Tim RMA. Klik untuk lihat di RMA Claim"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                </button>
                              ) : order.damageCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenForwardModal(order)}
                                  className="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                                  title="Forward / Teruskan kasus yang tidak selesai di CS ke Tim RMA"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                              {canDelete && onDeleteOrder && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOrderToDelete(order.orderId);
                                  }}
                                  className="p-1 rounded-lg text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 transition-colors cursor-pointer"
                                  title="Hapus Data Return Order ID (Khusus Super Admin)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* SUB-PANEL: RINCIAN DISPUTE CS & SEMUA SKU */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0 bg-slate-50/80 border-b border-slate-200">
                            <div className="p-4 sm:p-5 space-y-4">
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
                                        Cair Kurir: {formatRupiah(order.totalSettlementReceived)}
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
                                          title="Kasus telah dialihkan ke Tim RMA. Buka status di tab RMA Claim"
                                        >
                                          <Truck className="w-3.5 h-3.5 text-indigo-600" />
                                          <span>Lihat di RMA Claim ({RMA_STAGE_LABELS[forwardedRmaMap.get(order.orderId)!.stageStatus]?.labelId || 'RMA'})</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenForwardModal(order)}
                                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                                          title="Teruskan kasus yang tidak dapat diselesaikan CS ke Tim RMA Logistik"
                                        >
                                          <Share2 className="w-3.5 h-3.5" />
                                          <span>Forward ke RMA Logistik</span>
                                        </button>
                                      )}

                                      {/* Tombol Cepat Selesaikan Order (Setujui / Tolak Semua SKU) */}
                                      {!forwardedRmaMap.has(order.orderId) && (
                                        <div className="flex items-center space-x-1 pl-1 border-l border-slate-200">
                                          <button
                                            type="button"
                                            onClick={() => handleQuickApproveAllOrder(order)}
                                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                                            title="Setujui seluruh klaim barang dalam pesanan ini (langsung mengurangi angka Klaim CS di Navigation Bar)"
                                          >
                                            <Check className="w-3 h-3" />
                                            <span>Setujui Semua</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleQuickRejectAllOrder(order)}
                                            className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                                            title="Tolak seluruh klaim barang dalam pesanan ini (langsung mengurangi angka Klaim CS di Navigation Bar)"
                                          >
                                            <X className="w-3 h-3" />
                                            <span>Tolak Semua</span>
                                          </button>
                                        </div>
                                      )}
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
                                  Barang Rusak untuk Aju Banding & Ganti Rugi ({order.damageCount} SKU)
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
                                  <th className="py-2.5 px-2.5 w-36 bg-amber-50/60">
                                    <span className="flex items-center space-x-1 text-amber-900 font-extrabold">
                                      <span>Realisasi Ekspedisi</span>
                                      <span className="text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-normal">Manual</span>
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

                                      {/* Realisasi Ekspedisi (Manual Inline Edit / Terkunci jika dialihkan ke RMA) */}
                                      <td className="py-3 px-2.5 bg-amber-50/40 border-x border-amber-100/80">
                                        {forwardedRmaMap.has(order.orderId) ? (
                                          <div
                                            className="p-1.5 rounded-xl bg-indigo-50/80 border border-indigo-200/90 flex flex-col items-start gap-1 cursor-default select-none shadow-2xs"
                                            title="Kasus order ini telah dialihkan ke Tim RMA. Nominal refund dan ganti rugi dikelola langsung oleh Tim RMA melalui menu RMA Claim."
                                          >
                                            <div className="font-mono font-bold text-xs text-indigo-950">
                                              {actualCompensation > 0 ? formatRupiah(actualCompensation) : "Belum Ditentukan"}
                                            </div>
                                            <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                                              <Lock className="w-2.5 h-2.5 text-indigo-500" />
                                              <span>Dikelola Tim RMA</span>
                                            </span>
                                          </div>
                                        ) : isInlineEditing ? (
                                          <div className="space-y-1 p-1 bg-white rounded-xl border border-amber-300 shadow-md">
                                            <div className="flex items-center space-x-1">
                                              <span className="text-[10px] font-bold text-slate-400">Rp</span>
                                              <input
                                                type="text"
                                                autoFocus
                                                value={inlineSettlementInput}
                                                onChange={(e) => setInlineSettlementInput(e.target.value.replace(/[^0-9]/g, ''))}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleSaveInlineEdit(key, row, claimAmount);
                                                  if (e.key === 'Escape') handleCancelInlineEdit();
                                                }}
                                                className="w-full text-xs font-mono font-bold text-slate-900 bg-amber-50/50 px-1.5 py-0.5 rounded border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                              />
                                            </div>
                                            <div className="flex items-center justify-end space-x-1">
                                              <button
                                                type="button"
                                                onClick={handleCancelInlineEdit}
                                                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                                                title="Batal"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleSaveInlineEdit(key, row, claimAmount)}
                                                className="p-1 rounded bg-amber-500 text-white hover:bg-amber-600 cursor-pointer"
                                                title="Simpan"
                                              >
                                                <Check className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div
                                            onClick={() => handleStartInlineEdit(key, settlementAmount, claimAmount)}
                                            className="group cursor-pointer hover:bg-amber-100/50 p-1.5 rounded-xl transition-colors flex items-center justify-between"
                                            title="Klik untuk input cepat nilai ganti rugi aktual dari ekspedisi"
                                          >
                                            <div>
                                              <div className="font-mono font-bold text-xs text-amber-950">
                                                {formatRupiah(actualCompensation)}
                                              </div>
                                              <div className="text-[10px] text-amber-700">
                                                {settlementAmount !== undefined ? 'Sudah Diinput' : 'Belum Ditentukan'}
                                              </div>
                                            </div>
                                            <Edit3 className="w-3.5 h-3.5 text-amber-600 opacity-60 group-hover:opacity-100" />
                                          </div>
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
                                            onClick={() => handleOpenEditModal(item)}
                                            className={`px-2 py-1 rounded-lg text-white font-semibold text-[11px] shadow-2xs transition-all flex items-center space-x-1 cursor-pointer ${
                                              forwardedRmaMap.has(order.orderId)
                                                ? "bg-indigo-600 hover:bg-indigo-700"
                                                : "bg-[#0F766E] hover:bg-[#115E59]"
                                            }`}
                                            title={
                                              forwardedRmaMap.has(order.orderId)
                                                ? "Lihat rincian bukti klaim (Terkunci - Dikelola Tim RMA)"
                                                : "Kelola status klaim & formulir detail"
                                            }
                                          >
                                            {forwardedRmaMap.has(order.orderId) ? (
                                              <Eye className="w-3 h-3" />
                                            ) : (
                                              <Edit3 className="w-3 h-3" />
                                            )}
                                            <span>{forwardedRmaMap.has(order.orderId) ? "Lihat" : "Kelola"}</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleCopyClaimTemplate(row, channel, ticketNumber, claimAmount)}
                                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                                            title="Salin template draf surat klaim untuk produk ini"
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                          </button>

                                          {/* Aksi Cepat Setujui / Tolak Item (Mengurangi angka navigation bar) */}
                                          {!forwardedRmaMap.has(order.orderId) && (
                                            <>
                                              {claimStatus !== 'APPROVED' && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleQuickApproveItem(item)}
                                                  className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-300 transition-all cursor-pointer shadow-2xs"
                                                  title="Aksi Cepat: Setujui Klaim 100% (langsung mengurangi angka Klaim CS di Navigation Bar)"
                                                >
                                                  <Check className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                              {claimStatus !== 'REJECTED' && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleQuickRejectItem(item)}
                                                  className="p-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-300 transition-all cursor-pointer shadow-2xs"
                                                  title="Aksi Cepat: Tolak Klaim Rp 0 (langsung mengurangi angka Klaim CS di Navigation Bar)"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </>
                                          )}
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
                  </td>
                </tr>
              )}
            </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BOTTOM PAGINATION TOOLBAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mt-4">
            <div className="text-xs text-slate-600">
              Menampilkan <strong className="text-slate-900 font-mono">{startIndex + 1}</strong> – <strong className="text-slate-900 font-mono">{endIndex}</strong> dari <strong className="text-slate-900 font-mono">{filteredOrders.length}</strong> Order ID
              <span className="text-slate-400 ml-2 font-mono">
                (Batas 100 Order/halaman)
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer flex items-center space-x-1"
                >
                  <ChevronsLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Pertama</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>

                <div className="flex items-center space-x-1">
                  {getPageNumbers().map((pg, idx) =>
                    typeof pg === 'number' ? (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentPage(pg)}
                        className={`w-7 h-7 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          currentPage === pg
                            ? 'bg-[#0F766E] text-white shadow-xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pg}
                      </button>
                    ) : (
                      <span key={idx} className="px-1 text-slate-400 text-xs">
                        {pg}
                      </span>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer flex items-center space-x-1"
                >
                  <span className="hidden sm:inline">Selanjutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer flex items-center space-x-1"
                >
                  <span className="hidden sm:inline">Terakhir</span>
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
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
                    Formulir Aju Banding Klaim Kerusakan
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
                          Penetapan nominal refund dan penyelesaian klaim logistik dikelola langsung oleh Tim RMA melalui menu <strong>RMA Claim</strong>. Formulir di menu CS Claim ini ditampilkan dalam mode baca saja (read-only).
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
                        Channel Tujuan Aju Banding:
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
                            setFormSettlementAmount(formClaimAmount || '150000');
                          } else if (newStatus === 'REJECTED') {
                            setFormSettlementAmount('0');
                          }
                        }}
                        disabled={selectedDispute && forwardedRmaMap.has(selectedDispute.row.Order_ID)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-bold cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      >
                        <option value="PENDING">🟡 Siap Diajukan (Draft CS - Angka Aktif)</option>
                        <option value="SUBMITTED">🔵 Sedang Diajukan (Investigasi - Angka Aktif)</option>
                        <option value="APPROVED">🟢 Disetujui (Ganti Rugi Cair - Mengurangi Angka Nav)</option>
                        <option value="REJECTED">🔴 Ditolak (Tidak Diganti - Mengurangi Angka Nav)</option>
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        💡 Memilih status <strong className="text-emerald-700">Disetujui</strong> atau <strong className="text-rose-700">Ditolak</strong> akan menyelesaikan kasus ini dan <strong>otomatis mengurangi angka di Navigation Bar</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Field: No Tiket & Nominal */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        No. Tiket Komplain / Case ID:
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: SHP-DISPUTE-9901 atau JNT-CLM-88"
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
                        placeholder="Contoh: 150000"
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
                        Template Surat Sanggahan / Aju Banding Resmi
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Salin teks ini dan tempelkan langsung ke formulir sengketa Shopee / TikTok Shop / tiket CS Ekspedisi:
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyClaimTemplate(
                          selectedDispute.row,
                          formChannel,
                          formTicketNumber,
                          parseInt(formClaimAmount, 10) || 150000
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
                      parseInt(formClaimAmount, 10) || 150000
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

      {/* MODAL ESKALASI KLAIM LOGISTIK KE TIM RMA */}
      {forwardingOrder && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setForwardingOrder(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-indigo-100 max-w-xl w-full p-6 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Teruskan Kasus Klaim ke Tim RMA Logistik
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Order ID: <strong className="text-slate-800">{forwardingOrder.orderId}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForwardingOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200 text-indigo-900 space-y-1">
                <p className="font-semibold">
                  Tanggung jawab penanganan kasus klaim ini akan dialihkan dari Customer Service ke Tim RMA Logistik.
                </p>
                <p className="text-[11px] text-indigo-700">
                  Tim RMA akan memproses investigasi fisik gudang dan bukti rekaman video unboxing untuk berkoordinasi langsung dengan pihak ekspedisi.
                </p>
              </div>

              {/* Rincian Barang Rusak */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Daftar Barang yang Diteruskan ({forwardingOrder.damageItems.length} SKU):
                </label>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-2 space-y-1 bg-slate-50">
                  {forwardingOrder.damageItems.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] py-1 px-1.5 bg-white rounded-lg border border-slate-200">
                      <div className="min-w-0 pr-2">
                        <span className="font-mono font-bold text-indigo-700">{d.row.SKU_ID}</span>
                        <span className="text-slate-600 ml-1.5 font-medium truncate">{d.row.Nama_Barang}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-rose-600 font-bold">[{d.row.Kondisi}]</span>
                        <span className="font-mono text-slate-800 font-bold ml-2">
                          {formatRupiah(d.claimAmount || d.masterPrice || d.basePrice || 150000)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Input: Estimasi Nilai Ganti Rugi Barang */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Estimasi Nilai Ganti Rugi Barang (IDR) <span className="text-rose-600">*</span>:
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    value={forwardEstCompensation}
                    onChange={(e) => setForwardEstCompensation(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Contoh: 350000"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Nilai estimasi kerugian barang untuk diajukan klaim ganti rugi ke pihak logistik oleh Tim RMA.
                </p>
              </div>

              {/* Form Input: Alasan Pelimpahan & Catatan CS */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Alasan Kasus Tidak Selesai di CS & Catatan untuk Tim RMA:
                </label>
                <textarea
                  rows={3}
                  value={forwardCsNotes}
                  onChange={(e) => setForwardCsNotes(e.target.value)}
                  placeholder="Jelaskan kendala: misal ekspedisi menolak bukti foto CS, butuh BAP fisik gudang, paket hilang total di transit hub, dll..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Pelimpah: <strong className="text-slate-700">{currentUser?.fullName || 'CS Specialist'}</strong></span>
                <span>Ekspedisi: <strong className="text-slate-700">{forwardingOrder.damageItems[0]?.channel || 'Ekspedisi'}</strong></span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setForwardingOrder(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmForwardToRma}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Konfirmasi Forward ke RMA</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
