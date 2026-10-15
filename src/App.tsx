/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar, AppNavTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { UnboxingStation } from './components/UnboxingStation';
import { ReportsView } from './components/ReportsView';
import { MasterDatabaseView } from './components/MasterDatabaseView';
import { DisputeClaimsView } from './components/DisputeClaimsView';
import { AccountManagementView } from './components/AccountManagementView';
import { BackgroundFloating3D } from './components/BackgroundFloating3D';
import { SAMPLE_SCENARIOS } from './data/sampleScenarios';
import { HISTORICAL_RETURN_ROWS } from './data/historicalReturns';
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
  const [, setCurrentInput] = useState<UnboxingSessionInput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Master Database SKU & Orders (Excel / CSV)
  const [masterDatabase, setMasterDatabase] = useState<MasterOrderSKU[]>([]);
  const [selectedAwbForStation, setSelectedAwbForStation] = useState<string>('ORD-992-JKT');

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

  // Load database pada inisialisasi awal
  useEffect(() => {
    const loaded = loadMasterDatabase();
    setMasterDatabase(loaded);

    // Initial preloaded result HANYA jika aplikasi baru pertama kali dibuka (belum pernah di-seed sebelumnya)
    // Jika pengguna/admin menghapus data hingga kosong, data contoh TIDAK akan dimunculkan kembali.
    const hasBeenSeeded = localStorage.getItem(STORAGE_SEEDED_FLAG);
    if (!hasBeenSeeded) {
      localStorage.setItem(STORAGE_SEEDED_FLAG, 'true');

      const initialScenario = SAMPLE_SCENARIOS[0].payload;
      const initialRows1 = processUnboxingReport({
        ...initialScenario,
        Operator_ID: 'OPR-992',
        Order_ID: 'ORD-992-JKT',
        Expected_SKUs: [
          { SKU_ID: 'SKU-SKINCARE-01', Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml' },
          { SKU_ID: 'SKU-JACKET-02', Nama_Barang: 'Techwear Waterproof Windbreaker Navy - L' }
        ],
        Scanned_SKUs: [
          { SKU_ID: 'SKU-SKINCARE-01', Nama_Barang: 'Glow Radiance Vitamin C Serum 30ml', Kondisi: 'Good' },
          { SKU_ID: 'SKU-JACKET-02', Nama_Barang: 'Techwear Waterproof Windbreaker Navy - L', Kondisi: 'Damage Packaging' }
        ]
      });

      // Sample Case 2: Shopee / SPX - Produk Retak Cacat & Kardus Hancur
      const initialRows2 = processUnboxingReport({
        Operator_ID: 'OPR-101',
        Order_ID: 'SHP-9823441',
        Video_Timestamp: '2026-10-07 14:20:15',
        Link_Video: 'https://drive.google.com/file/d/evidence-video-shopee-9823441/view',
        Expected_SKUs: [
          { SKU_ID: 'SKU-ELEC-001', Nama_Barang: 'Headset Gaming 7.1 Surround RGB' },
          { SKU_ID: 'SKU-ELEC-003', Nama_Barang: 'Mouse Wireless Ergonomic Silent Click' }
        ],
        Scanned_SKUs: [
          { SKU_ID: 'SKU-ELEC-001', Nama_Barang: 'Headset Gaming 7.1 Surround RGB', Kondisi: 'Damage Packaging', Catatan_Tambahan: 'Kardus penyok hancur tertindih ekspedisi saat transit' },
          { SKU_ID: 'SKU-ELEC-003', Nama_Barang: 'Mouse Wireless Ergonomic Silent Click', Kondisi: 'Damage Product', Catatan_Tambahan: 'Tombol klik retak & sensor mati' }
        ]
      });

      // Sample Case 3: Tokopedia / J&T - Barang Hilang / Paket Kosong (Missing Item)
      const initialRows3 = processUnboxingReport({
        Operator_ID: 'OPR-042',
        Order_ID: 'TKP-88492019',
        Video_Timestamp: '2026-10-07 09:12:44',
        Link_Video: 'https://drive.google.com/file/d/evidence-video-tkp-88492019/view',
        Expected_SKUs: [
          { SKU_ID: 'SKU-WATCH-001', Nama_Barang: 'Smartwatch AMOLED Bluetooth Call' },
          { SKU_ID: 'SKU-ACC-002', Nama_Barang: 'Adaptor Charger Magnetic Original' }
        ],
        Scanned_SKUs: [
          { SKU_ID: 'SKU-WATCH-001', Nama_Barang: 'Smartwatch AMOLED Bluetooth Call', Kondisi: 'Good' }
        ]
      });

      const combinedInitial = [...initialRows1, ...initialRows2, ...initialRows3, ...HISTORICAL_RETURN_ROWS];
      setProcessedRows(combinedInitial);
      setCurrentInput(initialScenario);
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(combinedInitial));
      } catch {}
    }
  }, []);

  // Simpan perubahan data returns ke localStorage (termasuk saat seluruh data dihapus sehingga array kosong [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(processedRows));
    } catch {}
  }, [processedRows]);

  const handleProcessComplete = (rows: ProcessedReturnRow[], rawInput: UnboxingSessionInput) => {
    setProcessedRows((prev) => {
      const orderId = rawInput.Order_ID || rawInput.order_id;
      // Perbarui jika order yang sama sudah ada, atau tambahkan di urutan teratas
      const remaining = prev.filter((r) => r.Order_ID !== orderId);
      const updated = [...rows, ...remaining];
      try {
        localStorage.setItem(STORAGE_PROCESSED_RETURNS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
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

  const damageCount = processedRows.filter((r) => r.Kondisi !== 'Good').length;

  return (
    <div className="min-h-screen relative overflow-x-hidden flex flex-col font-sans text-slate-800">
      {/* 1. Vibrant Purple & Violet Background with 3D Minimalist Floating Objects */}
      <BackgroundFloating3D />

      {/* 2. Soft Glassmorphism Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportCount={processedRows.length}
        damageCount={damageCount}
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
            onDeleteOrder={handleDeleteOrder}
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
