import {dashboardPreview} from './data/dashboardPreview';
import type { SyncState } from './services/dataSyncService';
import { isRmaClosed } from './utils/claimWorkflow';
import { financeOutstandingCases } from './utils/claimSummary';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar, AppNavTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { UnboxingStation } from './components/UnboxingStation';
import { ReportsView } from './components/ReportsView';
import { MasterDatabaseView } from './components/MasterDatabaseView';
import { DisputeClaimsView } from './components/DisputeClaimsView';
import { RMAClaimsView } from './components/RMAClaimsView';
import { ClaimHistoryView } from './components/ClaimHistoryView';
import { AccountManagementView } from './components/AccountManagementView';
import { FinanceView } from './components/FinanceView';
import { StoreManagementView } from './components/StoreManagementView';
import { BackupSettingsView } from './components/BackupSettingsView';
import type { StoreProfile } from './types/store';
import { SAMPLE_SCENARIOS } from './data/sampleScenarios';
import { HISTORICAL_RETURN_ROWS } from './data/historicalReturns';
import { RmaClaimRecord } from './types/rma';
import { canonicalizeReturnRows } from './utils/returnRows';
import {
  ProcessedReturnRow,
  UnboxingSessionInput,
  processUnboxingReport
} from './processor';
import {
  MasterOrderSKU,
  saveMasterDatabase
} from './utils/excelTemplate';
import { initAuth, googleSignIn, logoutGoogle } from './services/googleDriveService';
import type { User } from 'firebase/auth';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LoginGateModal } from './components/LoginGateModal';
import { LoginScreen } from './components/LoginScreen';
import { AccountProvider, useAccount } from './context/AccountContext';
import { syncService } from './services/dataSyncService';


const STORAGE_PROCESSED_RETURNS_KEY = 'unboxin_processed_returns_v1';
const SERVER_SOURCE_MIGRATION_KEY = 'onboxin_postgres_source_v1';

function AppContent() {
  const localTrial = import.meta.env.VITE_LOCAL_TRIAL === 'true';
  const { t, isEn } = useLanguage();
  const { currentUser, isLoginModalOpen, setIsLoginModalOpen, hasPermission, hasLoggedIn } = useAccount();
  const [activeTab, setActiveTab] = useState<AppNavTab>('dashboard');

  // Jamin tab yang aktif selalu sesuai hak akses pengguna saat berganti shift / akun
  useEffect(() => {
    const tabPermMap: Record<AppNavTab, boolean> = {
      dashboard: hasPermission('canAccessDashboard'),
      station: hasPermission('canAccessStation'),
      reports: hasPermission('canAccessReports'),
      disputes: hasPermission('canAccessDisputes'),
      rma: hasPermission('canAccessRma'),
      finance: hasPermission('canAccessFinance'),
      claimHistory: hasPermission('canAccessDisputes') || hasPermission('canAccessRma'),
      database: hasPermission('canAccessDatabase'),
      stores: hasPermission('canAccessDatabase'),
      accounts: hasPermission('canManageUsers') || currentUser.role === 'SUPER_ADMIN',
      backup: currentUser.role === 'SUPER_ADMIN'
    };

    if (!tabPermMap[activeTab]) {
      const allowedTab = (Object.keys(tabPermMap) as AppNavTab[]).find((tab) => tabPermMap[tab]);
      if (allowedTab) {
        setActiveTab(allowedTab);
      }
    }
  }, [currentUser, activeTab, hasPermission]);
  const STORAGE_SEEDED_FLAG = 'rma_initial_seed_completed_v1';
  const STORAGE_RMA_CLAIMS_KEY = 'rma_claims_records_v1';

  // Data operasional dimulai kosong sampai API PostgreSQL menyelesaikan pull awal.
  // Cache browser hanya disimpan untuk dukungan offline, bukan dipakai sebagai sumber awal.
  const [processedRows, setProcessedRows] = useState<ProcessedReturnRow[]>([]);
  const [rmaClaims, setRmaClaims] = useState<RmaClaimRecord[]>([]);
  const [disputeRecords, setDisputeRecords] = useState<Record<string, any>>({});
  const stores = useMemo<StoreProfile[]>(() => Array.isArray(disputeRecords['_stores_list_']) ? disputeRecords['_stores_list_'] : [], [disputeRecords]);
  const [, setCurrentInput] = useState<UnboxingSessionInput | null>(null);
  const [previewMode] = useState(()=>new URLSearchParams(window.location.search).get('dashboard-demo')==='1');
  const [previewState,setPreviewState] = useState<SyncState>(()=>{
    const state=new URLSearchParams(window.location.search).get('dashboard-state');
    return state==='loading'||state==='updating'?'syncing':state==='error'?'error':state==='offline'?'offline':'synced';
  });
  const [previewInitial] = useState(()=>new URLSearchParams(window.location.search).get('dashboard-state')||'success');
  const preview = useMemo(()=>previewMode?dashboardPreview():null,[previewMode]);
  const [previewUpdatedAt] = useState(()=>new Date());
  const [dashboardSyncState,setDashboardSyncState]=useState<SyncState>('idle');
  const [dashboardUpdatedAt,setDashboardUpdatedAt]=useState<Date|null>(null);
  useEffect(()=>syncService.subscribeStatus((state,time)=>{setDashboardSyncState(state);if(time)setDashboardUpdatedAt(time);}),[]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [masterDatabase, setMasterDatabase] = useState<MasterOrderSKU[]>([]);
  const [selectedAwbForStation, setSelectedAwbForStation] = useState<string>('');

  // Google Drive Authentication State
  const [googleUser, setGoogleUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Sinkronisasi data real-time dengan server database Cloud SQL (Mirroring Web & Mobile Browser)
  useEffect(() => {
    // Sekali saat migrasi ke PostgreSQL: buang cache Firestore/browser lama agar
    // angka lama tidak kembali tercampur ke data resmi server.
    try {
      if (!localStorage.getItem(SERVER_SOURCE_MIGRATION_KEY)) {
        [STORAGE_PROCESSED_RETURNS_KEY, STORAGE_RMA_CLAIMS_KEY, 'rma_cs_dispute_claims_v1', 'rma_claims_records_v1', 'rma_claims_storage_v1'].forEach((key) => localStorage.removeItem(key));
        localStorage.setItem(SERVER_SOURCE_MIGRATION_KEY, '1');
      }
    } catch {}
    const unsubscribe = syncService.subscribe((payload) => {
      if (payload.returns && Array.isArray(payload.returns)) {
        setProcessedRows(canonicalizeReturnRows(payload.returns));
        try {
          localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(canonicalizeReturnRows(payload.returns)));
        } catch {}

        if (payload.returns.length === 0) {
          setRmaClaims([]);
          setDisputeRecords({});
          try {
            localStorage.removeItem('rma_cs_dispute_claims_v1');
            localStorage.removeItem(STORAGE_RMA_CLAIMS_KEY);
            localStorage.removeItem('rma_claims_records_v1');
            localStorage.removeItem('rma_claims_storage_v1');
          } catch {}
        }
      }
      if (payload.disputes && typeof payload.disputes === 'object') {
        if (payload.returns && payload.returns.length === 0) {
          setRmaClaims([]);
          setDisputeRecords({});
        } else {
          if (Array.isArray(payload.disputes['_rma_claims_list_'])) {
            setRmaClaims(payload.disputes['_rma_claims_list_']);
            try {
              localStorage.setItem(STORAGE_RMA_CLAIMS_KEY, JSON.stringify(payload.disputes['_rma_claims_list_']));
            } catch {}
          }
          setDisputeRecords(payload.disputes);
        }
      }
      if (payload.masterDatabase && Array.isArray(payload.masterDatabase)) {
        setMasterDatabase(payload.masterDatabase);
        saveMasterDatabase(payload.masterDatabase);
      }
    });

    // Ambil data terbaru dari server saat mount
    syncService.syncPull().catch((err) => {
      console.warn('Initial sync pull warning:', err);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSaveRmaClaims = async (newClaims: RmaClaimRecord[]): Promise<boolean> => {
    try {
      const saved = localStorage.getItem('rma_cs_dispute_claims_v1');
      const parsed = saved ? JSON.parse(saved) : {};
      const payload = { ...parsed, _rma_claims_list_: newClaims };
      if (!(await syncService.pushDisputes(payload))) return false;
      setRmaClaims(newClaims);
      setDisputeRecords(payload);
      localStorage.setItem(STORAGE_RMA_CLAIMS_KEY, JSON.stringify(newClaims));
      localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error('Error saving RMA claims:', error);
      return false;
    }
  };

  // CS has already saved the combined dispute/RMA payload once.
  const handleForwardToRma = (claim: RmaClaimRecord) => {
    setRmaClaims((previous) => previous.some((item) => item.stageStatus !== 'DIKEMBALIKAN_CS' && item.orderId.trim().toUpperCase() === claim.orderId.trim().toUpperCase())
      ? previous : [claim, ...previous]);
  };

  const handleUpdateRmaClaim = async (updatedClaim: RmaClaimRecord): Promise<boolean> => {
    const next = rmaClaims.map((claim) => claim.id === updatedClaim.id ? updatedClaim : claim);
    return await handleSaveRmaClaims(next);
  };

  const handleFinancePayment = async (payment: { lane: 'CS'|'RMA'; recordId: string; amount: number; date: string; reference: string; method: string; note: string }): Promise<boolean> => {
    const now = new Date().toISOString();
    const payload = { ...disputeRecords };
    if (!Number.isSafeInteger(payment.amount) || payment.amount < 0) return false;
    if (payment.lane === 'CS') {
      const orderId = String(payment.recordId || '').trim().toUpperCase();
      const entries = Object.entries(payload).filter(([, value]) => value?.row && String(value.row.Order_ID || '').trim().toUpperCase() === orderId);
      if (!entries.length) return false;
      const canonicalEntries = entries.filter(([key]) => key.includes('__'));
      const targetKey = (canonicalEntries[0] || entries[0])[0];
      entries.forEach(([key, current]) => { payload[key] = { ...current, financeReceivedAmount: key === targetKey ? payment.amount : 0, financePaymentDate: payment.date || now, financePaymentReference: payment.reference.trim(), financePaymentMethod: payment.method.trim(), financePaymentNote: payment.note.trim(), financeUpdatedAt: now, financeUpdatedBy: currentUser.fullName }; });
    } else {
      const current = rmaClaims.find(claim => claim.id === payment.recordId);
      if (!current) return false;
      const updatedClaims = rmaClaims.map(claim => claim.id === payment.recordId ? { ...claim, financeReceivedAmount: payment.amount, financePaymentDate: payment.date || now, financePaymentReference: payment.reference.trim(), financePaymentMethod: payment.method.trim(), financePaymentNote: payment.note.trim(), financeUpdatedAt: now, financeUpdatedBy: currentUser.fullName } : claim);
      payload._rma_claims_list_ = updatedClaims;
      if (!(await syncService.pushDisputes(payload))) return false;
      setRmaClaims(updatedClaims);
      setDisputeRecords(payload);
      localStorage.setItem(STORAGE_RMA_CLAIMS_KEY, JSON.stringify(updatedClaims));
      localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(payload));
      return true;
    }
    if (!(await syncService.pushDisputes(payload))) return false;
    setDisputeRecords(payload);
    localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(payload));
    return true;
  };
  const handleSaveStores = async (nextStores: StoreProfile[]): Promise<boolean> => {
    const payload = { ...disputeRecords, _stores_list_: nextStores };
    if (await syncService.pushDisputes(payload)) {
      setDisputeRecords(payload);
      localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(payload));
      return true;
    }
    // Database toko tidak boleh menimpa pembaruan klaim dari perangkat lain.
    // Muat data terakhir, pertahankan klaim terbaru, lalu coba simpan daftar toko lagi sekali.
    const latest = await syncService.syncPull();
    if (!latest?.disputes) return false;
    const retryPayload = { ...latest.disputes, _stores_list_: nextStores };
    if (!(await syncService.pushDisputes(retryPayload))) return false;
    setDisputeRecords(retryPayload);
    localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(retryPayload));
    return true;
  };

  // Save the ownership change and its history atomically before changing either queue.
  const handleReturnToCs = async (orderId: string, reason: string): Promise<boolean> => {
    if (!reason.trim()) return false;
    const cleanOrderId = String(orderId || '').trim().toUpperCase();
    const active = rmaClaims.find(claim => claim.orderId.trim().toUpperCase() === cleanOrderId && claim.stageStatus !== 'DIKEMBALIKAN_CS');
    if (!active) return false;
    const nowIso = new Date().toISOString();
    const returned: RmaClaimRecord = {...active, stageStatus:'DIKEMBALIKAN_CS', returnReason:reason.trim(), returnedAt:nowIso, returnedBy:currentUser.fullName, updatedAt:nowIso,
      history:[...(active.history || []),{at:nowIso,by:currentUser.fullName,from:active.stageStatus,to:'DIKEMBALIKAN_CS',note:reason.trim()}]};
    const nextRmaClaims = rmaClaims.map(claim => claim.id === active.id ? returned : claim);
    const updated = {...disputeRecords};
    for (const [key,item] of Object.entries(updated)) {
      if (key.startsWith('_') || !item?.row || String(item.row.Order_ID || '').trim().toUpperCase() !== cleanOrderId) continue;
      updated[key] = {...item,isForwardedToRma:false,csNotes:String(item.csNotes || '').replaceAll('[DIALIHKAN KE RMA]','').trim(),updatedAt:nowIso,
        history:[...(item.history || []),{at:nowIso,by:currentUser.fullName,note:'Dikembalikan ke CS: '+reason.trim()}]};
    }
    const payload = {...updated,_rma_claims_list_:nextRmaClaims};
    if (!(await syncService.pushDisputes(payload))) return false;
    setRmaClaims(nextRmaClaims); setDisputeRecords(payload);
    localStorage.setItem('rma_cs_dispute_claims_v1',JSON.stringify(payload));
    localStorage.setItem(STORAGE_RMA_CLAIMS_KEY,JSON.stringify(nextRmaClaims));
    return true;
  };

  const handleRestoreArchivedClaim = async (row: any, target: 'CS'|'RMA', reason: string): Promise<boolean> => {
    if (currentUser.role !== 'SUPER_ADMIN' || !reason.trim()) return false;
    const now = new Date().toISOString();
    const audit = {at:now,by:currentUser.fullName,note:`Kasus dibuka kembali ke ${target}: ${reason.trim()}`};
    const orderId = String(row.orderId || '').trim().toUpperCase();
    if (row.lane === 'RMA') {
      const nextClaims = rmaClaims.map(claim => claim.id !== row.id ? claim : ({
        ...claim,
        previousResolution:{claimStatus:claim.claimStatus,stageStatus:claim.stageStatus,approvedAmount:claim.approvedAmount,approvedCompensation:claim.approvedCompensation,paymentStatus:claim.paymentStatus,resolutionDate:claim.resolutionDate,resolutionNote:claim.resolutionNote,closureReason:claim.closureReason},
        workflowVersion:'SIMPLE', claimStatus:'PENDING', stageStatus:target==='RMA'?'DIALIHKAN_KE_RMA':'DIKEMBALIKAN_CS',
        approvedAmount:0, approvedCompensation:0, paymentStatus:'NOT_APPLICABLE', resolutionDate:undefined,resolutionNote:undefined,closureReason:undefined,
        reopenedAt:now,reopenedBySuperAccount:currentUser.fullName,reopenReason:reason.trim(),updatedAt:now,
        history:[...(claim.history||[]),{at:now,by:currentUser.fullName,from:claim.stageStatus,to:target==='RMA'?'DIALIHKAN_KE_RMA':'DIKEMBALIKAN_CS',note:audit.note}]
      } as any));
      const reopenedDisputes={...disputeRecords};
      if(target==='CS')for(const [key,item] of Object.entries(reopenedDisputes)){
        if(key.startsWith('_')||!item?.row||String(item.row.Order_ID||'').trim().toUpperCase()!==orderId)continue;
        reopenedDisputes[key]={...item,previousResolution:item.previousResolution||{claimStatus:item.claimStatus,approvedAmount:item.approvedAmount,settlementAmount:item.settlementAmount,closedAt:item.closedAt,closureReason:item.closureReason},claimStatus:'PENDING',approvedAmount:0,settlementAmount:0,closedAt:undefined,closureReason:undefined,isForwardedToRma:false,reopenedAt:now,reopenedBySuperAccount:currentUser.fullName,reopenReason:reason.trim(),updatedAt:now,history:[...(item.history||[]),audit]};
      }
      const payload={...reopenedDisputes,_rma_claims_list_:nextClaims};
      if (!(await syncService.pushDisputesAsSuperAdmin(payload,currentUser.id,currentUser.pin))) return false;
      setRmaClaims(nextClaims);setDisputeRecords(payload);localStorage.setItem('rma_cs_dispute_claims_v1',JSON.stringify(payload));localStorage.setItem(STORAGE_RMA_CLAIMS_KEY,JSON.stringify(nextClaims));
      setActiveTab(target==='RMA'?'rma':'disputes'); return true;
    }
    const nextRecords={...disputeRecords};
    for(const [key,item] of Object.entries(nextRecords)){
      if(key.startsWith('_')||!item?.row||String(item.row.Order_ID||'').trim().toUpperCase()!==orderId)continue;
      if(!['APPROVED','PARTIAL','REJECTED'].includes(item.claimStatus)&&!item.closedAt)continue;
      nextRecords[key]={...item,previousResolution:{claimStatus:item.claimStatus,approvedAmount:item.approvedAmount,settlementAmount:item.settlementAmount,closedAt:item.closedAt,closureReason:item.closureReason},claimStatus:'PENDING',approvedAmount:0,settlementAmount:0,closedAt:undefined,closureReason:undefined,isForwardedToRma:target==='RMA',reopenedAt:now,reopenedBySuperAccount:currentUser.fullName,reopenReason:reason.trim(),updatedAt:now,history:[...(item.history||[]),audit]};
    }
    let nextClaims=rmaClaims;
    if(target==='RMA'){
      const existingRma=rmaClaims.find(claim=>claim.orderId.trim().toUpperCase()===orderId&&claim.stageStatus!=='DIKEMBALIKAN_CS');
      if(existingRma){
        nextClaims=rmaClaims.map(claim=>claim.id!==existingRma.id?claim:({...claim,previousResolution:{claimStatus:claim.claimStatus,stageStatus:claim.stageStatus,approvedAmount:claim.approvedAmount,approvedCompensation:claim.approvedCompensation,paymentStatus:claim.paymentStatus,resolutionDate:claim.resolutionDate,resolutionNote:claim.resolutionNote,closureReason:claim.closureReason},workflowVersion:'SIMPLE',claimStatus:'PENDING',stageStatus:'DIALIHKAN_KE_RMA',approvedAmount:0,approvedCompensation:0,paymentStatus:'NOT_APPLICABLE',resolutionDate:undefined,resolutionNote:undefined,closureReason:undefined,reopenedAt:now,reopenedBySuperAccount:currentUser.fullName,reopenReason:reason.trim(),updatedAt:now,history:[...(claim.history||[]),{at:now,by:currentUser.fullName,from:claim.stageStatus,to:'DIALIHKAN_KE_RMA',note:audit.note}]} as any));
        nextRecords._rma_claims_list_=nextClaims;
      } else {
      let sources=Object.entries(nextRecords).filter(([key,item])=>!key.startsWith('_')&&item?.row&&String(item.row.Order_ID||'').trim().toUpperCase()===orderId&&item.row.Kondisi!=='Good');
      if(sources.some(([key])=>key.includes('__')))sources=sources.filter(([key])=>key.includes('__'));
      const items=sources.map(([key,item])=>({sourceKey:key,sourceClaimAmount:Number(item.claimAmount)||0,marketplaceReservedAmount:0,valuationPending:!(Number(item.claimAmount)>0),skuId:String(item.row.SKU_ID||''),namaBarang:String(item.row.Nama_Produk||item.row.Nama_Barang||item.row.SKU_ID||''),qty:1,kondisi:String(item.row.Kondisi||''),hargaSatuan:Number(item.claimAmount)||0,subtotalEstimasi:Number(item.claimAmount)||0}));
      const first=sources[0]?.[1];
      const newClaim:any={id:`rma_reopen_${orderId}_${Date.now()}`,orderId,awb:String(first?.row?.AWB||first?.row?.No_Resi||''),channel:first?.channel||'Lainnya',stageStatus:'DIALIHKAN_KE_RMA',workflowVersion:'SIMPLE',claimStatus:'PENDING',items,estimatedCompensation:items.reduce((sum,item)=>sum+item.subtotalEstimasi,0),csNotes:`Dibuka kembali oleh Super Akun: ${reason.trim()}`,forwardedBy:currentUser.fullName,forwardedAt:now,updatedAt:now,reopenedAt:now,reopenedBySuperAccount:currentUser.fullName,reopenReason:reason.trim(),history:[{at:now,by:currentUser.fullName,from:'RIWAYAT',to:'DIALIHKAN_KE_RMA',note:audit.note}]};
      nextClaims=[newClaim,...rmaClaims];nextRecords._rma_claims_list_=nextClaims;
      }
    }
    if (!(await syncService.pushDisputesAsSuperAdmin(nextRecords,currentUser.id,currentUser.pin))) return false;
    setRmaClaims(nextClaims);setDisputeRecords(nextRecords);localStorage.setItem('rma_cs_dispute_claims_v1',JSON.stringify(nextRecords));localStorage.setItem(STORAGE_RMA_CLAIMS_KEY,JSON.stringify(nextClaims));setActiveTab(target==='RMA'?'rma':'disputes');return true;
  };

  // Simpan perubahan data returns ke localStorage sebagai offline cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(processedRows));
    } catch {}
  }, [processedRows]);

  const handleProcessComplete = (rows: ProcessedReturnRow[], rawInput: UnboxingSessionInput, alreadySaved = false) => {
    const orderId = rawInput.Order_ID || rawInput.order_id;
    setProcessedRows((prev) => {
      const remaining = prev.filter((r) => r.Order_ID !== orderId);
      const updated = [...rows, ...remaining];
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    // API /process-unboxing sudah menyimpan hasilnya. Mengirim ulang ke endpoint
    // sinkronisasi dapat membuat dua transaksi tulis untuk sesi yang sama.
    if (alreadySaved) {
      syncService.syncPull().catch(() => {});
    } else {
      syncService.pushReturns(rows, orderId);
    }
    setCurrentInput(rawInput);
  };

  // Hapus data return per Order ID (Khusus Super Admin)
  const handleDeleteOrder = (orderId: string) => {
    const cleanId = String(orderId || '').trim();
    const idUpper = cleanId.toUpperCase();

    setProcessedRows((prev) => {
      const remaining = prev.filter((r) => String(r.Order_ID || '').trim().toUpperCase() !== idUpper);
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(remaining));
      } catch {}

      // Jika seluruh return terhapus (kosong), bersihkan juga seluruh klaim sengketa dan RMA
      if (remaining.length === 0) {
        setRmaClaims([]);
        handleSaveRmaClaims([]);
        setDisputeRecords({});
        try {
          localStorage.removeItem('rma_cs_dispute_claims_v1');
          localStorage.removeItem(STORAGE_RMA_CLAIMS_KEY);
          localStorage.removeItem('rma_claims_records_v1');
          localStorage.removeItem('rma_claims_storage_v1');
        } catch {}
        syncService.pushDisputes({});
      }

      return remaining;
    });

    // Sinkronkan penghapusan ke database bersama Cloud SQL & Firestore
    syncService.deleteOrder(orderId);

    // Bersihkan juga RMA claims yang terkait orderId ini
    setRmaClaims((prev) => {
      const nextRma = (prev || []).filter((c) => String(c.orderId || '').trim().toUpperCase() !== idUpper);
      handleSaveRmaClaims(nextRma);
      return nextRma;
    });

    // Bersihkan catatan klaim dispute di state & localStorage
    setDisputeRecords((prev) => {
      const updated = { ...prev };
      let changed = false;
      Object.keys(updated).forEach((k) => {
        const kUpper = k.toUpperCase();
        if (
          kUpper.startsWith(idUpper) ||
          kUpper.includes(`__${idUpper}__`) ||
          kUpper.includes(`_${idUpper}_`) ||
          kUpper.includes(`${idUpper}__`) ||
          kUpper.includes(`${idUpper}_`)
        ) {
          delete updated[k];
          changed = true;
        }
      });
      if (changed) {
        try {
          localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(updated));
        } catch {}
        syncService.pushDisputes(updated);
      }
      return updated;
    });
  };

  // Hapus baris data return tertentu (Khusus Super Admin)
  const handleDeleteRow = (orderId: string, skuId: string) => {
    const oUpper = String(orderId || '').trim().toUpperCase();
    const sUpper = String(skuId || '').trim().toUpperCase();

    setProcessedRows((prev) => {
      const idx = prev.findIndex(
        (r) => String(r.Order_ID || '').trim().toUpperCase() === oUpper && String(r.SKU_ID || '').trim().toUpperCase() === sUpper
      );
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(next));
      } catch {}

      if (next.length === 0) {
        setRmaClaims([]);
        handleSaveRmaClaims([]);
        setDisputeRecords({});
        try {
          localStorage.removeItem('rma_cs_dispute_claims_v1');
          localStorage.removeItem(STORAGE_RMA_CLAIMS_KEY);
          localStorage.removeItem('rma_claims_records_v1');
          localStorage.removeItem('rma_claims_storage_v1');
        } catch {}
        syncService.pushDisputes({});
      }

      return next;
    });
    syncService.deleteRow(orderId, skuId);

    // Hapus juga dispute record terkait item ini
    setDisputeRecords((prev) => {
      const updated = { ...prev };
      let changed = false;
      const p1 = `${oUpper}__${sUpper}`;
      const p2 = `${oUpper}_${sUpper}`;
      Object.keys(updated).forEach((k) => {
        const kUpper = k.toUpperCase();
        if (kUpper.startsWith(p1) || kUpper.startsWith(p2)) {
          delete updated[k];
          changed = true;
        }
      });
      if (changed) {
        try {
          localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(updated));
        } catch {}
        syncService.pushDisputes(updated);
      }
      return updated;
    });
  };

  // Hapus massal beberapa Order ID sekaligus (Khusus Super Admin)
  const handleDeleteBulkOrders = (orderIds: string[]) => {
    if (!orderIds || orderIds.length === 0) return;
    const cleanIdSet = new Set(orderIds.map((id) => String(id || '').trim().toUpperCase()));

    setProcessedRows((prev) => {
      const remaining = prev.filter((r) => !cleanIdSet.has(String(r.Order_ID || '').trim().toUpperCase()));
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(remaining));
      } catch {}

      // Jika seluruh data retur habis setelah hapus massal, reset total sengketa & klaim
      if (remaining.length === 0) {
        setRmaClaims([]);
        handleSaveRmaClaims([]);
        setDisputeRecords({});
        try {
          localStorage.removeItem('rma_cs_dispute_claims_v1');
          localStorage.removeItem(STORAGE_RMA_CLAIMS_KEY);
          localStorage.removeItem('rma_claims_records_v1');
          localStorage.removeItem('rma_claims_storage_v1');
        } catch {}
        syncService.pushDisputes({});
      }

      return remaining;
    });

    syncService.deleteBulkOrders(orderIds);

    // Bersihkan RMA claims yang terkait orderIds ini
    setRmaClaims((prev) => {
      const nextRma = (prev || []).filter((c) => !cleanIdSet.has(String(c.orderId || '').trim().toUpperCase()));
      handleSaveRmaClaims(nextRma);
      return nextRma;
    });

    // Bersihkan juga catatan klaim dispute di state & localStorage
    setDisputeRecords((prev) => {
      const updated = { ...prev };
      let changed = false;
      Object.keys(updated).forEach((k) => {
        const kUpper = k.toUpperCase();
        for (const cid of cleanIdSet) {
          if (
            kUpper.startsWith(cid) ||
            kUpper.includes(`__${cid}__`) ||
            kUpper.includes(`_${cid}_`) ||
            kUpper.includes(`${cid}__`) ||
            kUpper.includes(`${cid}_`)
          ) {
            delete updated[k];
            changed = true;
            break;
          }
        }
      });
      if (changed) {
        try {
          localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(updated));
        } catch {}
        syncService.pushDisputes(updated);
      }
      return updated;
    });
  };

  // Hapus massal beberapa baris SKU spesifik sekaligus (Khusus Super Admin)
  const handleDeleteBulkRows = (rowKeys: { orderId: string; skuId: string }[]) => {
    if (!rowKeys || rowKeys.length === 0) return;
    const keySet = new Set(
      rowKeys.map((k) => `${String(k.orderId || '').trim().toUpperCase()}__${String(k.skuId || '').trim().toUpperCase()}`)
    );
    setProcessedRows((prev) => {
      const remaining = prev.filter(
        (r) => !keySet.has(`${String(r.Order_ID || '').trim().toUpperCase()}__${String(r.SKU_ID || '').trim().toUpperCase()}`)
      );
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
    syncService.deleteBulkRows(rowKeys);

    // Hapus juga dispute records terkait baris-baris ini
    setDisputeRecords((prev) => {
      const updated = { ...prev };
      let changed = false;
      rowKeys.forEach((rk) => {
        const oUpper = String(rk.orderId || '').trim().toUpperCase();
        const sUpper = String(rk.skuId || '').trim().toUpperCase();
        const p1 = `${oUpper}__${sUpper}`;
        const p2 = `${oUpper}_${sUpper}`;
        Object.keys(updated).forEach((k) => {
          const kUpper = k.toUpperCase();
          if (kUpper.startsWith(p1) || kUpper.startsWith(p2)) {
            delete updated[k];
            changed = true;
          }
        });
      });
      if (changed) {
        try {
          localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(updated));
        } catch {}
        syncService.pushDisputes(updated);
      }
      return updated;
    });
  };


  const handleSelectAwbFromDatabase = (awb: string) => {
    setSelectedAwbForStation(awb);
    setActiveTab('station');
  };

  const handleGoogleSignIn = async () => {
    const result = await googleSignIn();
    setGoogleUser(result.user);
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
  };

  // 1. Kumpulan order ID yang sudah dialihkan ke RMA Claim (ditrim agar case & spasi konsisten)
  const forwardedOrderIds = useMemo(() => {
    const set = new Set<string>();
    (rmaClaims || []).forEach((c) => {
      const oid = String(c.orderId || '').trim();
      if (oid) {
        set.add(oid);
        set.add(oid.toUpperCase());
        set.add(oid.toLowerCase());
      }
    });
    return set;
  }, [rmaClaims]);

  // 2. Aturan baku penghitungan angka badge CS Claims (per Order ID yang membutuhkan tindakan CS):
  const csDisputeBreakdown = useMemo(() => {
    // Kelompokkan baris per Order ID terlebih dahulu
    const orderMap = new Map<string, ProcessedReturnRow[]>();
    processedRows.forEach((r) => {
      const oid = String(r.Order_ID || '').trim();
      if (!oid) return;
      if (!orderMap.has(oid)) orderMap.set(oid, []);
      orderMap.get(oid)!.push(r);
    });

    let activeOrderCount = 0;
    let pendingOrderCount = 0;
    let submittedOrderCount = 0;
    let approvedOrderCount = 0;
    let rejectedOrderCount = 0;
    let forwardedRmaOrderCount = 0;

    orderMap.forEach((rowsInOrder, orderId) => {
      // 1. Filter hanya item barang rusak/hilang (Kondisi !== 'Good')
      const damageRows = rowsInOrder.filter((r) => r.Kondisi !== 'Good' && r.Kondisi?.trim().toLowerCase() !== 'good');
      if (damageRows.length === 0) return; // Order ini tidak memiliki klaim kerusakan

      // 2. Jika Order ID sudah dialihkan ke Tim RMA, hitung ke forwardedRmaOrderCount dan kurangi dari CS
      const cleanOid = orderId.trim();
      const isForwarded =
        forwardedOrderIds.has(cleanOid) ||
        forwardedOrderIds.has(cleanOid.toUpperCase()) ||
        forwardedOrderIds.has(cleanOid.toLowerCase()) ||
        damageRows.some((r, idxInOrder) => {
          const keyPrimary = `${cleanOid}__${r.SKU_ID}__${idxInOrder}`;
          const keyLegacy = `${cleanOid}_${r.SKU_ID}_${idxInOrder}`;
          const rec = disputeRecords[keyPrimary] || disputeRecords[keyLegacy];
          return rec?.isForwardedToRma === true || (rec?.csNotes && rec.csNotes.includes('[DIALIHKAN KE RMA]'));
        });

      if (isForwarded) {
        forwardedRmaOrderCount += 1;
        return; // Tidak dihitung ke badge aktif CS
      }

      if (damageRows.length && damageRows.every((row,index) => (disputeRecords[`${orderId}__${row.SKU_ID}__${index}`] || disputeRecords[`${orderId}_${row.SKU_ID}_${index}`])?.closedAt)) return;

      // 3. Tentukan status gabungan klaim untuk Order ID ini
      let orderHasPending = false;
      let orderHasSubmitted = false;
      let orderAllApproved = true;
      let orderAllRejected = true;

      damageRows.forEach((r, idxInOrder) => {
        const keyPrimary = `${orderId}__${r.SKU_ID}__${idxInOrder}`;
        const keyLegacy = `${orderId}_${r.SKU_ID}_${idxInOrder}`;

        const matchedRecord =
          disputeRecords[keyPrimary] ||
          disputeRecords[keyLegacy] ||
          Object.entries(disputeRecords).find(([k]) =>
            k.startsWith(`${orderId}__${r.SKU_ID}__${idxInOrder}`) ||
            k.startsWith(`${orderId}_${r.SKU_ID}_${idxInOrder}`)
          )?.[1] ||
          Object.entries(disputeRecords).find(([k]) =>
            k.startsWith(`${orderId}__${r.SKU_ID}`) ||
            k.startsWith(`${orderId}_${r.SKU_ID}`)
          )?.[1];

        const defaultStatus = 'PENDING';

        const status = matchedRecord?.claimStatus || defaultStatus;

        if (status === 'APPROVED' || status === 'PARTIAL') {
          orderAllRejected = false;
        } else if (status === 'REJECTED') {
          orderAllApproved = false;
        } else if ((status === 'SUBMITTED' || status === 'WAITING')) {
          orderHasSubmitted = true;
          orderAllApproved = false;
          orderAllRejected = false;
        } else {
          orderHasPending = true;
          orderAllApproved = false;
          orderAllRejected = false;
        }
      });

      if (orderHasSubmitted) {
        submittedOrderCount += 1;
        activeOrderCount += 1;
      } else if (orderHasPending) {
        pendingOrderCount += 1;
        activeOrderCount += 1;
      } else if (orderAllApproved) {
        approvedOrderCount += 1;
      } else if (orderAllRejected) {
        rejectedOrderCount += 1;
        activeOrderCount += 1;
      } else {
        activeOrderCount += 1; // Mixed/partial results still need a CS decision or RMA handover.
      }
    });

    return {
      activeCount: activeOrderCount,
      pendingCount: pendingOrderCount,
      submittedCount: submittedOrderCount,
      approvedCount: approvedOrderCount,
      rejectedCount: rejectedOrderCount,
      forwardedRmaCount: forwardedRmaOrderCount
    };
  }, [processedRows, forwardedOrderIds, disputeRecords]);

  const activeCsDisputeCount = csDisputeBreakdown.activeCount;

  // 3. Badge RMA hanya menampilkan banding yang masih membutuhkan tindakan RMA.
  // Keputusan akhir sudah menjadi urusan Finance atau Riwayat Klaim, bukan antrean RMA.
  const activeRmaCount = useMemo(() => {
    return (rmaClaims || []).filter((claim) => {
      const hasFinalOutcome = ['APPROVED', 'PARTIAL', 'REJECTED'].includes(String(claim.logisticsOutcome || claim.claimStatus || ''));
      return !isRmaClosed(claim.stageStatus) && !hasFinalOutcome;
    }).length;
  }, [rmaClaims]);

  // 4. Badge Finance menampilkan jumlah jalur klaim dengan sisa dana belum diterima.
  // Satu order dihitung sekali per jalur (Marketplace atau Logistik), walaupun memuat banyak SKU.
  const outstandingFinanceCount = useMemo(
    () => financeOutstandingCases(processedRows, disputeRecords, rmaClaims).total,
    [processedRows, disputeRecords, rmaClaims]
  );

  // 5. Aturan baku angka badge Halaman Laporan:
  // - Menampilkan JUMLAH RETURN (Order ID / paket retur unik), bukan jumlah total baris SKU
  const distinctReturnOrdersCount = useMemo(() => {
    return new Set(
      processedRows
        .map((r) => String(r.Order_ID || '').trim().toUpperCase())
        .filter(Boolean)
    ).size;
  }, [processedRows]);

  // Jika pengguna belum login, kunci layar secara penuh (Full-Page Auth Gate)
  if (!hasLoggedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="warehouse-app min-h-screen relative flex flex-col font-sans text-slate-800">
      {/* 1. Vibrant Purple & Violet Background with 3D Minimalist Floating Objects */}

      {/* 2. Soft Glassmorphism Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportCount={distinctReturnOrdersCount}
        damageCount={activeCsDisputeCount}
        rmaCount={activeRmaCount}
        financeCount={outstandingFinanceCount}
        csDisputeStats={csDisputeBreakdown}
        masterCount={masterDatabase.length}
        operatorId="RMA Warehouse Otwoo"
        googleUser={googleUser}
      />

      {/* 3. Main Content Viewport */}
      <main id="warehouse-content" className={`warehouse-content ${activeTab==='dashboard'?'dashboard-content':''} flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 sm:py-5 space-y-6 relative`}>
        {localTrial && activeTab!=='dashboard' && <details className="warehouse-trial-note"><summary>{isEn ? 'Local trial · storage information' : 'Trial lokal · informasi penyimpanan'}</summary><p>{isEn ? 'Returns, master SKUs, accounts and CS disputes are stored on this laptop. Firestore sync is disabled. CS and RMA claims are synced to the laptop database. Save videos separately. Initial records are sample data.' : 'Retur, master SKU, akun, dan klaim CS tersimpan di laptop ini. Sinkronisasi Firestore dimatikan. Klaim CS dan RMA ikut disinkronkan ke database laptop. Simpan video secara terpisah. Data awal merupakan contoh.'}</p></details>}
        {/* TAB 0: Dashboard Analisis & Tren Retur (Harian & Bulanan) */}
        {activeTab === 'dashboard' && (
          <DashboardView
            rows={preview ? (previewInitial==='empty'||previewInitial==='loading'&&previewState==='syncing'?[]:preview.rows) : processedRows}
            disputes={preview?.disputes||disputeRecords}
            syncState={preview ? previewState : dashboardSyncState}
            lastUpdated={preview ? (previewInitial==='loading'&&previewState==='syncing'?null:previewUpdatedAt) : dashboardUpdatedAt}
            onRetry={preview ? async()=>{setPreviewState('syncing');await new Promise(resolve=>setTimeout(resolve,300));setPreviewState('synced');return true;} : ()=>syncService.syncPull()}
            dataDemo={previewMode}
            masterDatabase={preview?.master||masterDatabase}
            onNavigateToStation={() => setActiveTab('station')}
            onNavigateToReports={() => setActiveTab('reports')}
            onNavigateToDisputes={() => setActiveTab('disputes')}
            onNavigateToRma={() => setActiveTab('rma')}
            rmaClaims={preview?[]:rmaClaims}
          />
        )}

        {/* TAB 1: Stasiun Unboxing */}
        {activeTab === 'station' && (
          <div className="space-y-4">
            <UnboxingStation
              masterDatabase={masterDatabase}
              onProcessComplete={handleProcessComplete}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              initialAwb={selectedAwbForStation}
              googleUser={googleUser}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleLogout={handleGoogleLogout}
              onNavigateToReports={() => setActiveTab('reports')}
            />
          </div>
        )}

        {/* TAB 2: Halaman Laporan Unboxing */}
        {activeTab === 'reports' && (
          <ReportsView
            masterDatabase={masterDatabase}
            rows={processedRows}
            onNavigateToStation={() => setActiveTab('station')}
            onDeleteOrder={handleDeleteOrder}
            onDeleteRow={handleDeleteRow}
            onDeleteBulkOrders={handleDeleteBulkOrders}
            onDeleteBulkRows={handleDeleteBulkRows}
          />
        )}

        {/* TAB 3: Halaman Aju Banding & Klaim Kerusakan CS (Marketplace & Logistik) */}
        {activeTab === 'disputes' && (
          <DisputeClaimsView
            rows={processedRows}
            masterDatabase={masterDatabase}
            onNavigateToStation={() => setActiveTab('station')}
            onNavigateToReports={() => setActiveTab('reports')}
            onNavigateToRma={() => setActiveTab('rma')}
            onNavigateToHistory={() => setActiveTab('claimHistory')}
            onDeleteOrder={handleDeleteOrder}
            rmaClaims={rmaClaims}
            stores={stores}
            onForwardToRma={handleForwardToRma}
            onDisputeRecordsChange={setDisputeRecords}
          />
        )}

        {/* TAB 3B: Halaman RMA Claim (Eskalasi Klaim Logistik dari CS) */}
        {activeTab === 'rma' && (
          <RMAClaimsView
            rmaClaims={rmaClaims}
            onUpdateRmaClaim={handleUpdateRmaClaim}
            onReturnToCs={handleReturnToCs}
            marketplaceDisputes={disputeRecords}
            stores={stores}
            onNavigateToDisputes={() => setActiveTab('disputes')}
            masterDatabase={masterDatabase}
          />
        )}

        {activeTab === 'finance' && (
          <FinanceView
            rows={processedRows}
            disputes={disputeRecords}
            rmaClaims={rmaClaims}
            stores={stores}
            onSavePayment={handleFinancePayment}
          />
        )}

        {activeTab === 'claimHistory' && (
          <ClaimHistoryView disputes={disputeRecords} rmaClaims={rmaClaims} onRestore={handleRestoreArchivedClaim} />
        )}

        {/* TAB 4: Database Master SKU (Excel / CSV & Template) */}
        {activeTab === 'database' && (
          <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200">
            <MasterDatabaseView
              masterData={masterDatabase}
              setMasterData={(data) => {
                setMasterDatabase(data);
                saveMasterDatabase(data);
                syncService.pushMasterDatabase(data);
              }}

              onSelectAwbForUnboxing={handleSelectAwbFromDatabase}
            />
          </div>
        )}

        {activeTab === 'stores' && <StoreManagementView stores={stores} onSave={handleSaveStores} />}

        {activeTab === 'backup' && <BackupSettingsView />}

        {/* TAB 5: Manajemen Akun Pengguna & Hak Akses Peran */}
        {activeTab === 'accounts' && <AccountManagementView />}
      </main>

      {/* 4. Keterangan PT Tirta & Copyright Satu Baris Ringkas di Bagian Paling Bawah Aplikasi */}
      {activeTab==='dashboard' ? <footer className="saas-dashboard-footer">unboxin.id · Ringkasan operasional gudang. Data awal aplikasi dapat berisi contoh.</footer> : <footer className="mt-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-2.5 text-xs text-slate-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
            <span className="font-extrabold text-[#0F766E] tracking-tight">unboxin.id</span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <span className="font-medium text-slate-700">PT. Tirta Kumala Sari</span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <span className="text-slate-500">Copyright by Yaya Sanjaya</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-2.5 text-slate-400">
            <span className="inline-flex items-center space-x-1.5 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{isEn ? 'Warehouse workspace' : 'Ruang kerja gudang'}</span>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-teal-700 font-medium">{localTrial ? 'Database di laptop' : t('footer_drive_ready')}</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>All Rights Reserved</span>
          </div>
        </div>
      </footer>}

      {/* MODAL OTORISASI LOGIN & GOOGLE DRIVE */}
      <LoginGateModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        googleUser={googleUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleLogout={handleGoogleLogout}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AccountProvider>
        <AppContent />
      </AccountProvider>
    </LanguageProvider>
  );
}
