import React, { useState, useRef } from 'react';
import { Package, Video, FileSpreadsheet, User, Cloud, FileText, ShieldAlert, Globe, LayoutDashboard, Users, Building2, KeyRound, LogOut, Truck, CheckCircle2, XCircle, Clock, Info, ArrowRight } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useLanguage } from '../context/LanguageContext';
import { useAccount, ROLE_DEFINITIONS } from '../context/AccountContext';

export type AppNavTab = 'dashboard' | 'station' | 'reports' | 'disputes' | 'rma' | 'database' | 'accounts';

export interface CsDisputeStats {
  activeCount: number;
  pendingCount: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  forwardedRmaCount: number;
}

interface NavbarProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  reportCount: number;
  damageCount?: number;
  rmaCount?: number;
  csDisputeStats?: CsDisputeStats;
  masterCount: number;
  operatorId: string;
  googleUser?: FirebaseUser | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  reportCount = 0,
  damageCount = 0,
  rmaCount = 0,
  csDisputeStats,
  masterCount,
  googleUser
}) => {
  const { language, setLanguage, t, isEn } = useLanguage();
  const [isCsPopoverOpen, setIsCsPopoverOpen] = useState(false);
  const csPopoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCsMouseEnter = () => {
    if (csPopoverTimeoutRef.current) clearTimeout(csPopoverTimeoutRef.current);
    setIsCsPopoverOpen(true);
  };

  const handleCsMouseLeave = () => {
    csPopoverTimeoutRef.current = setTimeout(() => {
      setIsCsPopoverOpen(false);
    }, 250);
  };
  const {
    currentUser,
    appName,
    companyName,
    users,
    setCurrentUserById,
    hasPermission,
    setIsLoginModalOpen,
    logoutOperator,
    promptSwitchUser
  } = useAccount();

  const canDashboard = hasPermission('canAccessDashboard');
  const canStation = hasPermission('canAccessStation');
  const canReports = hasPermission('canAccessReports');
  const canDisputes = hasPermission('canAccessDisputes');
  const canRma = hasPermission('canAccessRma');
  const canDatabase = hasPermission('canAccessDatabase');
  const canManageUsers = hasPermission('canManageUsers') || currentUser.role === 'SUPER_ADMIN';

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/95 border-b border-slate-200 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-5">
        {/* ROW 1: TOP BAR (Brand Identity on Left & User Profile/Actions on Right) */}
        <div className="flex items-center justify-between h-14 sm:h-15 border-b border-slate-100">
          {/* Brand Logo & Company Info */}
          <div className="flex items-center space-x-2.5 cursor-pointer shrink-0" onClick={() => setActiveTab('dashboard')}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#0F766E] to-[#115E59] flex items-center justify-center text-white shadow-md shadow-teal-900/20 ring-1 ring-white/10 shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight flex items-center space-x-1.5">
                <span className="text-slate-900 font-black tracking-tight lowercase">unboxin.id</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                  V2.5
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center space-x-1 font-medium">
                <span className="truncate max-w-[180px] sm:max-w-none">{t('nav_subtitle')}</span>
              </p>
            </div>
          </div>

          {/* Top Actions: Cloud Status, Shift PIN, Language Switcher, Google User, Profile & Logout */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Real-time Cloud Mirroring Status Badge */}
            <div
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold shadow-2xs shrink-0"
              title="Real-Time Cloud Mirroring Aktif (Data otomatis sinkron antar HP, PC 1, dan PC 2 via Firestore)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden lg:inline">Cloud Mirroring</span>
              <span className="lg:hidden">Cloud</span>
            </div>

            {/* Quick Shift Switcher (Operator PIN Login) */}
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#0F766E] border border-teal-200/80 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="Ganti Operator Shift / Masukkan ID & PIN Cepat"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shift PIN</span>
              <span className="sm:hidden text-[10px]">PIN</span>
            </button>

            {/* Language Switcher Button (ID / EN) */}
            <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200 shadow-inner shrink-0">
              <button
                type="button"
                onClick={() => setLanguage('id')}
                className={`flex items-center space-x-1 px-1.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  language === 'id'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Ganti ke Bahasa Indonesia"
              >
                <span>🇮🇩</span>
                <span className="font-mono text-[10px] sm:text-[11px]">ID</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex items-center space-x-1 px-1.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Switch to English"
              >
                <span>🇬🇧</span>
                <span className="font-mono text-[10px] sm:text-[11px]">EN</span>
              </button>
            </div>

            {googleUser && (
              <div className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-teal-50 border border-teal-200/80 text-xs font-semibold text-teal-800 shadow-2xs shrink-0">
                <Cloud className="w-3.5 h-3.5 text-teal-600" />
                <span className="truncate max-w-[120px]">{googleUser.email}</span>
              </div>
            )}

            {/* Current Active Account Profile Badge */}
            <div
              onClick={() => {
                if (canManageUsers) {
                  setActiveTab('accounts');
                } else {
                  setIsLoginModalOpen(true);
                }
              }}
              className="flex items-center space-x-1.5 px-2 py-1.5 rounded-xl bg-white hover:bg-teal-50/50 border border-slate-200 hover:border-teal-200 text-xs text-slate-700 shadow-xs transition-all cursor-pointer shrink-0"
              title={`Akun Aktif: ${currentUser.fullName} (${currentUser.role}) — Klik untuk ganti akun`}
            >
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${currentUser.avatarColor || 'from-[#0F766E] to-[#115E59]'} text-white flex items-center justify-center font-bold text-[10px] shrink-0`}>
                {currentUser.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div className="text-left hidden md:block">
                <div className="font-bold text-slate-900 text-[11px] leading-tight truncate max-w-[100px] lg:max-w-[120px]">
                  {currentUser.fullName}
                </div>
                <div className="text-[9px] text-teal-700 font-semibold leading-tight truncate max-w-[100px] lg:max-w-[120px]">
                  {isEn ? ROLE_DEFINITIONS[currentUser.role]?.labelEn : ROLE_DEFINITIONS[currentUser.role]?.labelId}
                </div>
              </div>
            </div>

            {/* Log Out Button */}
            <button
              type="button"
              onClick={logoutOperator}
              className="flex items-center space-x-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="Log Out / Keluar Sesi Operator"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Log Out</span>
            </button>
          </div>
        </div>

        {/* ROW 2: DEDICATED NAVIGATION BAR (Turun ke bawah, tidak menumpuk, lega & simetris di tengah) */}
        <div className="py-2 sm:py-2.5 flex items-center justify-center">
          <nav className="flex items-center justify-start sm:justify-center space-x-1 sm:space-x-1.5 p-1 rounded-2xl bg-slate-100/90 border border-slate-200 shadow-inner w-full sm:w-auto overflow-x-auto no-scrollbar">
            {/* 0. Dashboard Ringkasan & Tren */}
            {canDashboard && (
              <button
                onClick={() => setActiveTab('dashboard')}
                title={isEn ? 'Analytics & Return Trends Dashboard' : 'Dashboard Analisis & Tren Retur'}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <LayoutDashboard className={`w-3.5 h-3.5 ${activeTab === 'dashboard' ? 'text-teal-700' : 'text-slate-500'}`} />
                <span>{t('nav_dashboard')}</span>
              </button>
            )}

            {/* 1. Stasiun Unboxing */}
            {canStation && (
              <button
                onClick={() => setActiveTab('station')}
                title={isEn ? 'Live Unboxing Station & 30 FPS Recording' : 'Stasiun Unboxing & Rekaman Video 30 FPS'}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'station'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Video className={`w-3.5 h-3.5 ${activeTab === 'station' ? 'text-teal-700' : 'text-slate-500'}`} />
                <span>{t('nav_station')}</span>
              </button>
            )}

            {/* 2. Halaman Laporan Unboxing */}
            {canReports && (
              <button
                onClick={() => setActiveTab('reports')}
                title={isEn ? 'Unboxing Reports & SKU Summary' : 'Laporan Hasil Unboxing & Rincian SKU'}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'reports'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <FileText className={`w-3.5 h-3.5 ${activeTab === 'reports' ? 'text-teal-700' : 'text-slate-500'}`} />
                <span>{t('nav_reports')}</span>
                {reportCount > 0 && (
                  <span className="ml-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 tabular-nums">
                    {reportCount}
                  </span>
                )}
              </button>
            )}

            {/* 3. Aju Banding & Klaim Kerusakan CS */}
            {canDisputes && (
              <div
                className="relative inline-block"
                onMouseEnter={handleCsMouseEnter}
                onMouseLeave={handleCsMouseLeave}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('disputes')}
                  title={
                    isEn
                      ? `CS Claims: ${damageCount} active claims (decreases when claim is Approved, Rejected, or Forwarded to RMA)`
                      : `Klaim CS: ${damageCount} klaim aktif (angka berkurang otomatis jika status klaim Disetujui, Ditolak, atau Dialihkan ke RMA)`
                  }
                  className={`flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'disputes'
                      ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <ShieldAlert className={`w-3.5 h-3.5 ${activeTab === 'disputes' ? 'text-rose-600' : 'text-slate-500'}`} />
                  <span>{t('nav_disputes')}</span>
                  {damageCount > 0 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCsPopoverOpen((prev) => !prev);
                      }}
                      className="ml-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-rose-500 text-white shadow-2xs tabular-nums cursor-pointer hover:bg-rose-600 transition-colors"
                      title={isEn ? "Click to view claim status breakdown" : "Klik untuk melihat rincian status klaim"}
                    >
                      {damageCount}
                    </span>
                  )}
                </button>

                {/* Popover Interaktif Status Klaim CS */}
                {isCsPopoverOpen && csDisputeStats && (
                  <div
                    className="absolute top-full mt-2.5 left-1/2 -translate-x-1/2 w-80 sm:w-92 p-4 rounded-2xl bg-white border-2 border-slate-200 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
                    onMouseEnter={handleCsMouseEnter}
                    onMouseLeave={handleCsMouseLeave}
                  >
                    {/* Arrow pointer */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-t-2 border-l-2 border-slate-200 rotate-45" />

                    {/* Popover Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-200 text-rose-600 shrink-0">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {isEn ? 'CS Claim Status Breakdown' : 'Rincian Status Klaim CS'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {isEn ? 'Real-time damage & claim audit' : 'Audit klaim kerusakan real-time'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        {damageCount} {isEn ? 'Orders' : 'Order'}
                      </span>
                    </div>

                    {/* Breakdown List */}
                    <div className="space-y-1.5 text-xs">
                      {/* 1. Siap Diajukan */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/70 border border-amber-200/80">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span className="font-semibold text-amber-900 text-[11px]">
                            {isEn ? 'Draft / Ready to Submit' : 'Siap Diajukan (Draft CS)'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-amber-800 text-[11px] bg-amber-100/90 px-1.5 py-0.2 rounded">
                          {csDisputeStats.pendingCount} order
                        </span>
                      </div>

                      {/* 2. Sedang Diajukan */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/70 border border-blue-200/80">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-semibold text-blue-900 text-[11px]">
                            {isEn ? 'Under Investigation' : 'Sedang Diajukan (Investigasi)'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-blue-800 text-[11px] bg-blue-100/90 px-1.5 py-0.2 rounded">
                          {csDisputeStats.submittedCount} order
                        </span>
                      </div>

                      {/* 3. Disetujui */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-semibold text-emerald-900 text-[11px]">
                            {isEn ? 'Approved / Paid' : 'Disetujui (Cair / Payout)'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-800 text-[11px] bg-emerald-100/90 px-1.5 py-0.2 rounded">
                          {csDisputeStats.approvedCount} order
                        </span>
                      </div>

                      {/* 4. Ditolak */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50/70 border border-rose-200/80">
                        <div className="flex items-center space-x-2">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span className="font-semibold text-rose-900 text-[11px]">
                            {isEn ? 'Rejected' : 'Ditolak (Banding Ditolak)'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-rose-800 text-[11px] bg-rose-100/90 px-1.5 py-0.2 rounded">
                          {csDisputeStats.rejectedCount} order
                        </span>
                      </div>

                      {/* 5. Dialihkan ke RMA */}
                      <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                        <div className="flex items-center space-x-2">
                          <Truck className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-semibold text-indigo-900 text-[11px]">
                            {isEn ? 'Forwarded to RMA' : 'Dialihkan ke RMA Logistik'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-indigo-800 text-[11px] bg-indigo-100/90 px-1.5 py-0.2 rounded">
                          {csDisputeStats.forwardedRmaCount} order
                        </span>
                      </div>
                    </div>

                    {/* Catatan Aturan Baku Badge */}
                    <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-600 flex items-start space-x-1.5">
                      <Info className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>{isEn ? 'Badge Formula:' : 'Aturan Angka Badge:'}</strong>{' '}
                        {isEn
                          ? 'Counts active CS Order IDs (Draft + Investigating). Automatically decreases by 1 per Order when forwarded to RMA, approved, or rejected.'
                          : 'Menghitung Order ID aktif tim CS (Draft + Investigasi). Berkurang otomatis per Order saat dialihkan ke RMA, disetujui, atau ditolak.'}
                      </div>
                    </div>

                    {/* Action Link to tab */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCsPopoverOpen(false);
                        setActiveTab('disputes');
                      }}
                      className="mt-2.5 w-full py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <span>{isEn ? 'Open CS Claims Page' : 'Buka Halaman Klaim CS'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3B. RMA Claim (Eskalasi Klaim Logistik dari CS) */}
            {canRma && (
              <button
                onClick={() => setActiveTab('rma')}
                title={
                  isEn
                    ? `RMA Claims: ${rmaCount} active cases (decreases when RMA stage is Completed)`
                    : `RMA Claim: ${rmaCount} kasus aktif (angka berkurang saat tahapan status RMA Selesai)`
                }
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'rma'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Truck className={`w-3.5 h-3.5 ${activeTab === 'rma' ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>{t('nav_rma')}</span>
                {rmaCount > 0 && (
                  <span
                    className="ml-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 tabular-nums"
                    title={`Aturan Angka: ${rmaCount} kasus RMA aktif. Angka berkurang bila kasus RMA berstatus Selesai.`}
                  >
                    {rmaCount}
                  </span>
                )}
              </button>
            )}

            {/* 4. Master Database SKU */}
            {canDatabase && (
              <button
                onClick={() => setActiveTab('database')}
                title={isEn ? 'Master Product SKU & Price Database' : 'Database Master SKU & Daftar Harga'}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'database'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${activeTab === 'database' ? 'text-teal-700' : 'text-slate-500'}`} />
                <span>{t('nav_database')}</span>
                {masterCount > 0 && (
                  <span className="ml-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 tabular-nums">
                    {masterCount}
                  </span>
                )}
              </button>
            )}

            {/* 5. Manajemen Akun Pengguna */}
            {canManageUsers && (
              <button
                onClick={() => setActiveTab('accounts')}
                title={isEn ? 'Account Management & Access Rights' : 'Manajemen Akun & Hak Akses'}
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'accounts'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Users className={`w-3.5 h-3.5 ${activeTab === 'accounts' ? 'text-teal-700' : 'text-slate-500'}`} />
                <span>{t('nav_accounts')}</span>
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

