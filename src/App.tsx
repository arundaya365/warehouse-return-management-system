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
  saveMasterDatabase
} from './utils/excelTemplate';
import { initAuth, googleSignIn, logoutGoogle } from './services/googleDriveService';
import type { User } from 'firebase/auth';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LoginGateModal } from './components/LoginGateModal';
import { AccountProvider, useAccount } from './context/AccountContext';
import { syncService } from './services/dataSyncService';


const STORAGE_PROCESSED_RETURNS_KEY = 'unboxin_processed_returns_v1';

function AppContent() {
  const { t } = useLanguage();
  const { currentUser, isLoginModalOpen, setIsLoginModalOpen, hasPermission } = useAccount();
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
      const saved = localStorage.getItem('rma_cs_dispute_claims_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const [, setCurrentInput] = useState<UnboxingSessionInput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Master Database SKU & Orders (Excel / CSV)
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
    const unsubscribe = syncService.subscribe((payload) => {
      if (payload.returns && Array.isArray(payload.returns)) {
        setProcessedRows(payload.returns);
        try {
          localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(payload.returns));
        } catch {}
      }
      if (payload.disputes && typeof payload.disputes === 'object') {
        if (Array.isArray(payload.disputes['_rma_claims_list_'])) {
          setRmaClaims(payload.disputes['_rma_claims_list_']);
          try {
            localStorage.setItem(STORAGE_RMA_CLAIMS_KEY, JSON.stringify(payload.disputes['_rma_claims_list_']));
          } catch {}
        }
        setDisputeRecords(payload.disputes);
      }
      if (payload.masterDatabase && Array.isArray(payload.masterDatabase) && payload.masterDatabase.length > 0) {
        setMasterDatabase(payload.masterDatabase);
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
      const filtered = prev.filter((c) => c.orderId !== claim.orderId);
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
    setProcessedRows((prev) => {
      const remaining = prev.filter((r) => r.Order_ID !== orderId);
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });

    // Sinkronkan penghapusan ke database bersama Cloud SQL
    syncService.deleteOrder(orderId);

    // Bersihkan juga catatan klaim dispute di localStorage jika ada
    try {
      const savedDisputes = localStorage.getItem('rma_cs_dispute_claims_v1');
      if (savedDisputes) {
        const parsed = JSON.parse(savedDisputes);
        let changed = false;
        Object.keys(parsed).forEach((k) => {
          if (k.startsWith(orderId)) {
            delete parsed[k];
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(parsed));
          syncService.pushDisputes(parsed);
        }
      }
    } catch {}
  };

  // Hapus baris data return tertentu (Khusus Super Admin)
  const handleDeleteRow = (orderId: string, skuId: string) => {
    setProcessedRows((prev) => {
      const idx = prev.findIndex((r) => r.Order_ID === orderId && r.SKU_ID === skuId);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    syncService.deleteRow(orderId, skuId);
  };

  // Hapus massal beberapa Order ID sekaligus (Khusus Super Admin)
  const handleDeleteBulkOrders = (orderIds: string[]) => {
    if (!orderIds || orderIds.length === 0) return;
    const orderSet = new Set(orderIds);
    setProcessedRows((prev) => {
      const remaining = prev.filter((r) => !orderSet.has(r.Order_ID));
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });

    syncService.deleteBulkOrders(orderIds);

    // Bersihkan juga catatan klaim dispute di localStorage jika ada
    try {
      const savedDisputes = localStorage.getItem('rma_cs_dispute_claims_v1');
      if (savedDisputes) {
        const parsed = JSON.parse(savedDisputes);
        let changed = false;
        Object.keys(parsed).forEach((k) => {
          if (orderIds.some((oid) => k.startsWith(oid))) {
            delete parsed[k];
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('rma_cs_dispute_claims_v1', JSON.stringify(parsed));
          syncService.pushDisputes(parsed);
        }
      }
    } catch {}
  };

  // Hapus massal beberapa baris SKU spesifik sekaligus (Khusus Super Admin)
  const handleDeleteBulkRows = (rowKeys: { orderId: string; skuId: string }[]) => {
    if (!rowKeys || rowKeys.length === 0) return;
    const keySet = new Set(rowKeys.map((k) => `${k.orderId}__${k.skuId}`));
    setProcessedRows((prev) => {
      const remaining = prev.filter((r) => !keySet.has(`${r.Order_ID}__${r.SKU_ID}`));
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
    syncService.deleteBulkRows(rowKeys);
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

  // 1. Kumpulan order ID yang sudah dialihkan ke RMA Claim
  const forwardedOrderIds = useMemo(() => {
    return new Set((rmaClaims || []).map((c) => c.orderId));
  }, [rmaClaims]);

  // 2. Aturan baku penghitungan angka badge CS Claims:
  // - Hanya menghitung barang dengan Kondisi !== 'Good'
  // - Berkurang karena kasus dialihkan ke RMA Claim (forwardedOrderIds.has(r.Order_ID))
  // - Berkurang karena status claim sudah disetujui (APPROVED / PARTIAL) atau ditolak (REJECTED)
  // - Tetap aktif (dihitung) jika status PENDING (Siap Diajukan) atau SUBMITTED (Sedang Diajukan)
  const activeCsDisputeCount = useMemo(() => {
    const damageIndexByOrder: Record<string, number> = {};

    return processedRows.filter((r) => {
      // Aturan 1: Barang kondisi Good tidak masuk klaim kerusakan CS
      if (r.Kondisi === 'Good') return false;

      // Aturan 2: Berkurang karena Order ID sudah dialihkan ke RMA Claim
      if (forwardedOrderIds.has(r.Order_ID)) return false;

      const orderId = r.Order_ID || '';
      const idxInOrder = damageIndexByOrder[orderId] || 0;
      damageIndexByOrder[orderId] = idxInOrder + 1;

      // Aturan 3: Periksa status di disputeRecords dengan kunci deterministik
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

      // Aturan 4: Angka di navigation bar berkurang karena status claim sudah disetujui atau ditolak
      if (status === 'APPROVED' || status === 'REJECTED' || status === 'PARTIAL') {
        return false;
      }

      // Tetap dihitung jika masih dalam proses (PENDING / SUBMITTED)
      return true;
    }).length;
  }, [processedRows, forwardedOrderIds, disputeRecords]);

  // 3. Aturan baku angka badge RMA Claim:
  // - Kasus klaim logistik RMA yang masih aktif (stageStatus belum SELESAI)
  const activeRmaCount = useMemo(() => {
    return (rmaClaims || []).filter((c) => c.stageStatus !== 'SELESAI').length;
  }, [rmaClaims]);

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col font-sans text-slate-800">
      {/* 1. Vibrant Purple & Violet Background with 3D Minimalist Floating Objects */}
      <BackgroundFloating3D />

      {/* 2. Soft Glassmorphism Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportCount={processedRows.length}
        damageCount={activeCsDisputeCount}
        rmaCount={activeRmaCount}
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

      {/* 4. Professional Enterprise Corporate Footer */}
      <footer className="mt-auto bg-white/90 backdrop-blur-md border-t border-slate-200 py-4 text-xs text-slate-600 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700">
            <span className="font-bold text-[#0F766E] text-sm">Unboxin</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-slate-800">PT. Tirta Kumala Sari</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">Copyright Yaya Sanjaya</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 text-slate-500 tabular-nums text-[11px]">
            <span className="inline-flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Sistem Operasional Stabil</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[#0F766E] font-medium">{t('footer_drive_ready')}</span>
            <span className="text-slate-300">·</span>
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
