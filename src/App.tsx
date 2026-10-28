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
import { AccountManagementView } from './components/AccountManagementView';
import { BackgroundFloating3D } from './components/BackgroundFloating3D';
import { SAMPLE_SCENARIOS } from './data/sampleScenarios';
import { HISTORICAL_RETURN_ROWS } from './data/historicalReturns';
import { RmaClaimRecord } from './types/rma';
import {
  ProcessedReturnRow,
  UnboxingSessionInput,
  processUnboxingReport
} from './processor';
import {
  MasterOrderSKU,
  loadMasterDatabase,
  saveMasterDatabase,
  mergeMasterSkus
} from './utils/excelTemplate';
import { initAuth, googleSignIn, logoutGoogle } from './services/googleDriveService';
import type { User } from 'firebase/auth';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LoginGateModal } from './components/LoginGateModal';
import { LoginScreen } from './components/LoginScreen';
import { AccountProvider, useAccount } from './context/AccountContext';
import { syncService } from './services/dataSyncService';


const STORAGE_PROCESSED_RETURNS_KEY = 'unboxin_processed_returns_v1';

function AppContent() {
  const { t } = useLanguage();
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
      database: hasPermission('canAccessDatabase'),
      accounts: hasPermission('canManageUsers') || currentUser.role === 'SUPER_ADMIN'
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

  const [processedRows, setProcessedRows] = useState<ProcessedReturnRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROCESSED_RETURNS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [rmaClaims, setRmaClaims] = useState<RmaClaimRecord[]>(() => {
    try {
      const savedReturns = localStorage.getItem(STORAGE_PROCESSED_RETURNS_KEY);
      if (savedReturns && JSON.parse(savedReturns).length === 0) return [];
      const saved = localStorage.getItem(STORAGE_RMA_CLAIMS_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [disputeRecords, setDisputeRecords] = useState<Record<string, any>>(() => {
    try {
      const savedReturns = localStorage.getItem(STORAGE_PROCESSED_RETURNS_KEY);
      if (savedReturns && JSON.parse(savedReturns).length === 0) return {};
      const saved = localStorage.getItem('rma_cs_dispute_claims_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const [, setCurrentInput] = useState<UnboxingSessionInput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Master Database SKU & Orders (Excel / CSV) - Inisialisasi awal langsung dari penyimpanan lokal browser
  const [masterDatabase, setMasterDatabase] = useState<MasterOrderSKU[]>(() => {
    try {
      const initial = loadMasterDatabase();
      if (Array.isArray(initial) && initial.length > 0) return initial;
    } catch {}
    return [];
  });
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
    const unsubscribe = syncService.subscribe((payload) => {
      if (payload.returns && Array.isArray(payload.returns)) {
        setProcessedRows(payload.returns);
        try {
          localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(payload.returns));
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
      if (payload.masterDatabase && Array.isArray(payload.masterDatabase) && payload.masterDatabase.length > 0) {
        const local = loadMasterDatabase();
        if (local && local.length > payload.masterDatabase.length) {
          const mergedWithLocal = mergeMasterSkus(local, payload.masterDatabase).merged;
          setMasterDatabase(mergedWithLocal);
          saveMasterDatabase(mergedWithLocal);
          syncService.pushMasterDatabase(mergedWithLocal).catch(() => {});
        } else {
          setMasterDatabase(payload.masterDatabase);
          saveMasterDatabase(payload.masterDatabase);
        }
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

  const handleSaveRmaClaims = (newClaims: RmaClaimRecord[]) => {
    setRmaClaims(newClaims);
    try {
      localStorage.setItem(STORAGE_RMA_CLAIMS_KEY, JSON.stringify(newClaims));
      const savedDisputes = localStorage.getItem('rma_cs_dispute_claims_v1');
      const parsed = savedDisputes ? JSON.parse(savedDisputes) : {};
      parsed['_rma_claims_list_'] = newClaims;
      localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(parsed));
      syncService.pushDisputes(parsed);
    } catch (err) {
      console.error('Error saving RMA claims:', err);
    }
  };

  const handleForwardToRma = (claim: RmaClaimRecord) => {
    setRmaClaims((prev) => {
      const cleanOrderId = String(claim.orderId || '').trim();
      const filtered = prev.filter((c) => String(c.orderId || '').trim().toUpperCase() !== cleanOrderId.toUpperCase());
      const next = [claim, ...filtered];
      handleSaveRmaClaims(next);
      return next;
    });
  };

  const handleUpdateRmaClaim = (updatedClaim: RmaClaimRecord) => {
    setRmaClaims((prev) => {
      const next = prev.map((c) => (c.id === updatedClaim.id ? updatedClaim : c));
      handleSaveRmaClaims(next);
      return next;
    });
  };

  // Rollback / Kembalikan kasus dari Tim RMA ke Tim Customer Service
  const handleReturnToCs = (orderId: string, reason: string) => {
    const cleanOrderId = String(orderId || '').trim();
    // 1. Cabut kasus dari antrean aktif RMA
    const nextRmaClaims = (rmaClaims || []).filter(
      (c) => String(c.orderId || '').trim().toUpperCase() !== cleanOrderId.toUpperCase()
    );
    handleSaveRmaClaims(nextRmaClaims);

    // 2. Perbarui status dispute records agar kembali aktif di antrean CS dengan audit catatan pengembalian
    setDisputeRecords((prev) => {
      const updated = { ...prev };
      const nowIso = new Date().toISOString();
      Object.keys(updated).forEach((key) => {
        if (key.startsWith(`${cleanOrderId}__`) || key.startsWith(`${cleanOrderId}_`)) {
          const item = updated[key];
          if (item) {
            updated[key] = {
              ...item,
              isForwardedToRma: false, // Reset flag agar order aktif kembali di CS
              claimStatus: 'SUBMITTED', // Aktifkan kembali sebagai klaim investigasi CS
              csNotes: `[DIKEMBALIKAN DARI RMA: ${reason}] ${item.csNotes || ''}`.trim(),
              updatedAt: nowIso
            };
          }
        }
      });
      try {
        const payload = { ...updated, _rma_claims_list_: nextRmaClaims };
        localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(payload));
        localStorage.setItem(STORAGE_RMA_CLAIMS_KEY, JSON.stringify(nextRmaClaims));
        syncService.pushDisputes(payload);
      } catch {}
      return updated;
    });
  };

  // Load database lokal pada inisialisasi awal jika offline
  useEffect(() => {
    const loaded = loadMasterDatabase();
    if (loaded && loaded.length > 0) {
      setMasterDatabase(loaded);
    }
  }, []);

  // Simpan perubahan data returns ke localStorage sebagai offline cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(processedRows));
    } catch {}
  }, [processedRows]);

  const handleProcessComplete = (rows: ProcessedReturnRow[], rawInput: UnboxingSessionInput) => {
    const orderId = rawInput.Order_ID || rawInput.order_id;
    setProcessedRows((prev) => {
      const remaining = prev.filter((r) => r.Order_ID !== orderId);
      const updated = [...rows, ...remaining];
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    // Kirim langsung ke server database bersama (Cloud SQL)
    syncService.pushReturns(rows, orderId);
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

        const defaultStatus =
          r.Kondisi === 'Totally Damage' || r.Kondisi === 'Missing Item' || r.Kondisi === 'Missing'
            ? 'SUBMITTED'
            : 'PENDING';

        const status = matchedRecord?.claimStatus || defaultStatus;

        if (status === 'APPROVED' || status === 'PARTIAL') {
          orderAllRejected = false;
        } else if (status === 'REJECTED') {
          orderAllApproved = false;
        } else if (status === 'SUBMITTED') {
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

  // 3. Aturan baku angka badge RMA Claim:
  // - Kasus klaim logistik RMA yang masih aktif (stageStatus belum SELESAI)
  const activeRmaCount = useMemo(() => {
    return (rmaClaims || []).filter((c) => c.stageStatus !== 'SELESAI').length;
  }, [rmaClaims]);

  // 4. Aturan baku angka badge Halaman Laporan:
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
    <div className="min-h-screen relative overflow-x-hidden flex flex-col font-sans text-slate-800">
      {/* 1. Vibrant Purple & Violet Background with 3D Minimalist Floating Objects */}
      <BackgroundFloating3D />

      {/* 2. Soft Glassmorphism Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportCount={distinctReturnOrdersCount}
        damageCount={activeCsDisputeCount}
        rmaCount={activeRmaCount}
        csDisputeStats={csDisputeBreakdown}
        masterCount={masterDatabase.length}
        operatorId="RMA Warehouse Otwoo"
        googleUser={googleUser}
      />

      {/* 3. Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 sm:py-5 space-y-6 relative z-10">
        {/* TAB 0: Dashboard Analisis & Tren Retur (Harian & Bulanan) */}
        {activeTab === 'dashboard' && (
          <DashboardView
            rows={processedRows}
            masterDatabase={masterDatabase}
            onNavigateToStation={() => setActiveTab('station')}
            onNavigateToReports={() => setActiveTab('reports')}
            onNavigateToDisputes={() => setActiveTab('disputes')}
            onNavigateToRma={() => setActiveTab('rma')}
            rmaClaims={rmaClaims}
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
            rows={processedRows}
            onNavigateToStation={() => setActiveTab('station')}
            onNavigateToDisputes={() => setActiveTab('disputes')}
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
            onDeleteOrder={handleDeleteOrder}
            rmaClaims={rmaClaims}
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
            onNavigateToDisputes={() => setActiveTab('disputes')}
            masterDatabase={masterDatabase}
          />
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

        {/* TAB 5: Manajemen Akun Pengguna & Hak Akses Peran */}
        {activeTab === 'accounts' && <AccountManagementView />}
      </main>

      {/* 4. Keterangan PT Tirta & Copyright Satu Baris Ringkas di Bagian Paling Bawah Aplikasi */}
      <footer className="mt-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-2.5 text-xs text-slate-500 relative z-10">
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
              <span>Sistem Stabil</span>
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span className="text-teal-700 font-medium">{t('footer_drive_ready')}</span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>All Rights Reserved</span>
          </div>
        </div>
      </footer>

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
