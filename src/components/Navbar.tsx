import React from 'react';
import { Package, Video, FileSpreadsheet, User, Cloud, FileText, ShieldAlert, Globe, LayoutDashboard, Users, Building2, KeyRound, LogOut, Truck } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useLanguage } from '../context/LanguageContext';
import { useAccount, ROLE_DEFINITIONS } from '../context/AccountContext';

export type AppNavTab = 'dashboard' | 'station' | 'reports' | 'disputes' | 'rma' | 'database' | 'accounts';

interface NavbarProps {
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  reportCount: number;
  damageCount?: number;
  rmaCount?: number;
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
  masterCount,
  googleUser
}) => {
  const { language, setLanguage, t, isEn } = useLanguage();
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
                <span className="text-slate-900 font-black tracking-tight">{appName}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                  V2.5
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center space-x-1 font-medium">
                <Building2 className="w-3 h-3 text-teal-700 shrink-0" />
                <span className="truncate max-w-[150px] sm:max-w-none">{companyName}</span>
              </p>
            </div>
          </div>

          {/* Top Actions: Shift PIN, Language Switcher, Google User, Profile & Logout */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
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
              <button
                onClick={() => setActiveTab('disputes')}
                title={
                  isEn
                    ? `CS Claims: ${damageCount} active claims (decreases when claim is Approved, Rejected, or Forwarded to RMA)`
                    : `Klaim CS: ${damageCount} klaim aktif (angka berkurang otomatis jika status klaim Disetujui, Ditolak, atau Dialihkan ke RMA)`
                }
                className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'disputes'
                    ? 'bg-white text-teal-900 shadow-xs border border-teal-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <ShieldAlert className={`w-3.5 h-3.5 ${activeTab === 'disputes' ? 'text-rose-600' : 'text-slate-500'}`} />
                <span>{t('nav_disputes')}</span>
                {damageCount > 0 && (
                  <span
                    className="ml-1 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 tabular-nums"
                    title={`Aturan Angka: ${damageCount} barang rusak aktif. Angka berkurang bila status klaim Disetujui / Ditolak / Dialihkan ke RMA.`}
                  >
                    {damageCount}
                  </span>
                )}
              </button>
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
                title={isEn ? 'Account Management & Access Rights (PT. Tirta Kumala Sari)' : 'Manajemen Akun & Hak Akses (PT. Tirta Kumala Sari)'}
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

