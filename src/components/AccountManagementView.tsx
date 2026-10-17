import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  User,
  Key,
  BadgeCheck,
  RotateCcw,
  Search,
  Filter,
  Check,
  X,
  Edit2,
  Trash2,
  LogOut,
  Info,
  Eye,
  EyeOff,
  KeyRound,
  Shield,
  Video,
  FileText,
  ShieldAlert,
  FileSpreadsheet,
  LayoutDashboard,
  Download,
  AlertTriangle,
  Truck
} from 'lucide-react';
import {
  useAccount,
  UserRole,
  UserAccount,
  RolePermission,
  ROLE_DEFINITIONS,
  getUserPermissions
} from '../context/AccountContext';
import { useLanguage } from '../context/LanguageContext';

export interface ModulePermissionConfig {
  key: keyof RolePermission;
  label: string;
  shortLabel: string;
  desc: string;
  icon: any;
  color: string;
}

export const MODULE_PERMISSIONS_LIST: ModulePermissionConfig[] = [
  {
    key: 'canAccessStation',
    label: 'Stasiun Unboxing & Kamera 30 FPS',
    shortLabel: 'Unboxing 30 FPS',
    desc: 'Bisa membuka stasiun webcam, rekam video evidence, scan barcode SKU & cek fisik',
    icon: Video,
    color: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    key: 'canAccessReports',
    label: 'Laporan Hasil Unboxing & Rincian SKU',
    shortLabel: 'Laporan Unboxing',
    desc: 'Bisa melihat data rekapan unboxing, status kecocokan barang, dan link video cloud',
    icon: FileText,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
  },
  {
    key: 'canAccessDisputes',
    label: 'CS Dispute Claims (Klaim Kerusakan Logistik)',
    shortLabel: 'CS Dispute Klaim',
    desc: 'Bisa mengelola aju banding klaim ganti rugi ekspedisi/marketplace (Shopee/Tokopedia/TikTok)',
    icon: ShieldAlert,
    color: 'text-rose-600 bg-rose-50 border-rose-200'
  },
  {
    key: 'canAccessRma',
    label: 'RMA Claim & Eskalasi Klaim Logistik',
    shortLabel: 'RMA Claim Logistik',
    desc: 'Bisa membuka modul klaim logistik tingkat lanjut yang diteruskan dari Customer Service',
    icon: Truck,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
  },
  {
    key: 'canAccessDatabase',
    label: 'Master Database SKU & Template Excel',
    shortLabel: 'Master SKU Database',
    desc: 'Bisa mengunggah dan mengelola daftar referensi master SKU dan barcode produk',
    icon: FileSpreadsheet,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  {
    key: 'canAccessDashboard',
    label: 'Dashboard Analisis & Tren Kerusakan',
    shortLabel: 'Dashboard Tren',
    desc: 'Bisa memantau statistik KPI retur harian, rasio barang rusak, dan tren klaim',
    icon: LayoutDashboard,
    color: 'text-amber-600 bg-amber-50 border-amber-200'
  },
  {
    key: 'canExportData',
    label: 'Ekspor Data (Excel / CSV / PDF)',
    shortLabel: 'Ekspor Data',
    desc: 'Bisa mendownload laporan hasil unboxing dan berkas klaim ekspedisi',
    icon: Download,
    color: 'text-teal-600 bg-teal-50 border-teal-200'
  },
  {
    key: 'canDeleteReports',
    label: 'Hapus Data Order / Laporan Retur',
    shortLabel: 'Hapus Data Retur',
    desc: 'Wewenang khusus untuk menghapus data order atau baris SKU unboxing yang salah input',
    icon: Trash2,
    color: 'text-red-700 bg-red-50 border-red-200'
  },
  {
    key: 'canManageUsers',
    label: 'Kelola Akun, PIN & Hak Akses Pengguna',
    shortLabel: 'Kelola Akun & PIN',
    desc: 'Wewenang Super Admin untuk membuat akun, hapus akun, reset PIN, dan atur akses modul',
    icon: Key,
    color: 'text-purple-700 bg-purple-50 border-purple-200'
  }
];

export const AccountManagementView: React.FC = () => {
  const {
    users,
    currentUser,
    setCurrentUserById,
    addUser,
    updateUser,
    toggleUserStatus,
    deleteUser,
    resetToDefaultUsers,
    appName,
    companyName,
    copyrightText,
    logoutOperator,
    promptSwitchUser
  } = useAccount();
  const { isEn } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Quick Permission modal
  const [permissionTargetUser, setPermissionTargetUser] = useState<UserAccount | null>(null);
  const [quickPerms, setQuickPerms] = useState<RolePermission | null>(null);

  // Delete Confirmation modal
  const [deletingUserTarget, setDeletingUserTarget] = useState<UserAccount | null>(null);

  // Feedback Notification Toast
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // State to toggle show/hide PIN globally or by user id
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3500);
  };

  const togglePinReveal = (userId: string) => {
    setRevealedPins((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Form state
  const [formData, setFormData] = useState<{
    username: string;
    fullName: string;
    email: string;
    role: UserRole;
    department: string;
    operatorCode: string;
    pin: string;
    status: 'ACTIVE' | 'INACTIVE';
    permissions: RolePermission;
  }>({
    username: '',
    fullName: '',
    email: '',
    role: 'STATION_OPERATOR',
    department: '',
    operatorCode: '',
    pin: '1234',
    status: 'ACTIVE',
    permissions: { ...ROLE_DEFINITIONS.STATION_OPERATOR.permissions }
  });

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.operatorCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleOpenAdd = () => {
    const defaultRole: UserRole = 'STATION_OPERATOR';
    const roleDefaultPerms = { ...ROLE_DEFINITIONS[defaultRole].permissions };
    const randCode = `OPR-${Math.floor(100 + Math.random() * 900)}`;
    const randPin = String(Math.floor(1000 + Math.random() * 9000));

    setFormData({
      username: '',
      fullName: '',
      email: '',
      role: defaultRole,
      department: 'Stasiun Unboxing Meja 1',
      operatorCode: randCode,
      pin: randPin,
      status: 'ACTIVE',
      permissions: roleDefaultPerms
    });
    setEditingUser(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user);
    const activePerms = getUserPermissions(user);
    setFormData({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      operatorCode: user.operatorCode,
      pin: user.pin || '',
      status: user.status,
      permissions: { ...activePerms }
    });
    setIsAddModalOpen(true);
  };

  const handleRoleChangeInForm = (newRole: UserRole) => {
    const roleDefaultPerms = { ...ROLE_DEFINITIONS[newRole].permissions };
    setFormData((prev) => ({
      ...prev,
      role: newRole,
      permissions: roleDefaultPerms
    }));
  };

  const handleTogglePermissionInForm = (permKey: keyof RolePermission, value?: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permKey]: value !== undefined ? value : !prev.permissions[permKey]
      }
    }));
  };

  const handleGenerateRandomPin = () => {
    const randPin = String(Math.floor(1000 + Math.random() * 9000));
    setFormData((prev) => ({ ...prev, pin: randPin }));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.username.trim() || !formData.email.trim()) {
      return;
    }

    const cleanPin = formData.pin.trim() || String(Math.floor(1000 + Math.random() * 9000));
    const cleanCode = formData.operatorCode.trim() || `OPR-${Math.floor(100 + Math.random() * 900)}`;

    if (editingUser) {
      updateUser(editingUser.id, {
        username: formData.username.trim().toLowerCase(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        role: formData.role,
        department: formData.department.trim(),
        operatorCode: cleanCode,
        pin: cleanPin,
        status: formData.status,
        customPermissions: { ...formData.permissions }
      });
      showToast(`✓ Akun "${formData.fullName}" berhasil diperbarui dengan Hak Akses terkini!`);
    } else {
      addUser({
        username: formData.username.trim().toLowerCase(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        role: formData.role,
        department: formData.department.trim() || 'Warehouse Operations',
        operatorCode: cleanCode,
        pin: cleanPin,
        status: formData.status,
        company: companyName,
        customPermissions: { ...formData.permissions }
      });
      showToast(`✓ Akun baru "${formData.fullName}" (${cleanCode}) berhasil dibuat!`);
    }
    setIsAddModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deletingUserTarget) return;
    const targetName = deletingUserTarget.fullName;
    const targetCode = deletingUserTarget.operatorCode;
    deleteUser(deletingUserTarget.id);
    setDeletingUserTarget(null);
    showToast(`🗑️ Akun "${targetName}" (${targetCode}) telah berhasil dihapus dari sistem.`);
  };

  const handleOpenQuickPermissions = (targetUser: UserAccount) => {
    setPermissionTargetUser(targetUser);
    setQuickPerms({ ...getUserPermissions(targetUser) });
  };

  const handleSaveQuickPermissions = () => {
    if (!permissionTargetUser || !quickPerms) return;
    updateUser(permissionTargetUser.id, {
      customPermissions: quickPerms
    });
    showToast(`✓ Hak akses modul untuk "${permissionTargetUser.fullName}" berhasil diperbarui!`);
    setPermissionTargetUser(null);
    setQuickPerms(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-teal-900 text-white shadow-xl border border-teal-700 flex items-center space-x-2.5 animate-slide-in">
          <CheckCircle2 className="w-5 h-5 text-teal-300 shrink-0" />
          <div className="text-xs font-bold">{feedbackToast}</div>
        </div>
      )}

      {/* 1. Header Banner & Corporate Identity */}
      <div className="glass-card rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0F766E] text-white flex items-center justify-center shadow-md shadow-teal-900/10 shrink-0">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {isEn ? 'User Accounts & Access Control' : 'Manajemen Akun & Hak Akses Super Admin'}
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0F766E] border border-teal-200">
                {users.length} {isEn ? 'Registered Accounts' : 'Akun Terdaftar'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-slate-700">{appName}</span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center text-[#0F766E] font-medium">
                <Building2 className="w-3.5 h-3.5 mr-1" />
                {companyName}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">{copyrightText}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={resetToDefaultUsers}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer shadow-2xs"
            title="Reset ke akun resmi bawaan PT. Tirta Kumala Sari"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isEn ? 'Reset Default' : 'Reset Bawaan'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs sm:text-sm font-semibold transition-all flex items-center space-x-2 cursor-pointer shadow-sm active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isEn ? '+ Create User Account' : '+ Buat Akun Pengguna Baru'}</span>
          </button>
        </div>
      </div>

      {/* Super Admin Privileges Notice */}
      <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-teal-900">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#0F766E] text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 flex items-center space-x-2">
              <span>Wewenang Kontrol Super Admin Aktif</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                Akses Penuh
              </span>
            </div>
            <p className="text-slate-600 text-[11px] mt-0.5">
              Super Admin dapat <strong>membuat akun baru</strong>, <strong>menghapus akun</strong>, mengatur <strong>PIN login cepat</strong> gudang, dan menentukan <strong>hak akses apa saja yang dibuka</strong> untuk masing-masing staf.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-teal-50 text-[#0F766E] border border-teal-300 font-bold text-xs shrink-0 cursor-pointer shadow-2xs"
        >
          + Tambah Akun Sekarang
        </button>
      </div>

      {/* 2. Active Session Card (Quick Switcher) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-50 via-teal-50/50 to-slate-50 border border-teal-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="relative">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${currentUser.avatarColor || 'from-[#0F766E] to-[#115E59]'} text-white flex items-center justify-center font-bold text-base shadow-sm`}>
              {currentUser.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {isEn ? 'Active Operator Session' : 'Sesi Operator Aktif'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_DEFINITIONS[currentUser.role]?.badgeColor}`}>
                {isEn ? ROLE_DEFINITIONS[currentUser.role]?.labelEn : ROLE_DEFINITIONS[currentUser.role]?.labelId}
              </span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {currentUser.fullName} <span className="text-xs font-normal text-slate-500 font-mono">(@{currentUser.username})</span>
            </div>
            <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 mt-0.5">
              <span>{currentUser.department}</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-[11px] text-[#0F766E] font-semibold">ID: {currentUser.operatorCode}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{currentUser.company}</span>
            </div>
          </div>
        </div>

        {/* Quick User Switcher dropdown & Log Out button */}
        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          <div className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-semibold text-slate-500 pl-1">
              {isEn ? 'Switch Account (PIN Required):' : 'Beralih Akun (Wajib PIN):'}
            </span>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const targetId = e.target.value;
                if (targetId !== currentUser.id) {
                  promptSwitchUser(targetId);
                }
              }}
              className="text-xs font-bold text-[#0F766E] bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-200 cursor-pointer"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} [{u.operatorCode}] — {ROLE_DEFINITIONS[u.role]?.labelId}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={logoutOperator}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-colors"
            title="Keluar dari sesi saat ini"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* 3. Search and Role Filter Bar */}
      <div className="glass-card rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={isEn ? 'Search name, username, operator code, email...' : 'Cari nama, username, kode operator, PIN, email...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-500 shrink-0">{isEn ? 'Role:' : 'Filter Peran:'}</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 cursor-pointer"
          >
            <option value="ALL">{isEn ? 'All Roles' : 'Semua Peran'}</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="WAREHOUSE_MANAGER">Warehouse Manager</option>
            <option value="STATION_OPERATOR">Operator Unboxing</option>
            <option value="CS_DISPUTE">CS Dispute Specialist</option>
            <option value="AUDITOR">Auditor & QC</option>
          </select>
        </div>
      </div>

      {/* 4. Table of Registered Users */}
      <div className="glass-card rounded-3xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Pengguna & Username</th>
                <th className="py-3 px-3 text-center">ID Operator</th>
                <th className="py-3 px-3 text-center">PIN Cepat</th>
                <th className="py-3 px-3">Peran Resmi</th>
                <th className="py-3 px-3">Akses Modul yang Dibuka</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Terakhir Aktif</th>
                <th className="py-3 px-3 text-center">Tindakan Super Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Tidak ada akun yang cocok dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUser.id;
                  const roleDef = ROLE_DEFINITIONS[user.role];
                  const userPerms = getUserPermissions(user);
                  const isPinRevealed = !!revealedPins[user.id];

                  // Count active permissions
                  const activePermKeys = (Object.keys(userPerms) as Array<keyof RolePermission>).filter(
                    (k) => userPerms[k]
                  );

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-[#F0FDFA]/50 transition-colors ${isCurrent ? 'bg-teal-50/30' : ''}`}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${user.avatarColor || 'from-[#0F766E] to-[#115E59]'} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}>
                            {user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs">
                              <span>{user.fullName}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-100 text-[#0F766E] border border-teal-200">
                                  Anda
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">@{user.username}</div>
                            <div className="text-[10px] text-slate-400">{user.department}</div>
                          </div>
                        </div>
                      </td>

                      {/* Operator Code */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono text-xs font-bold text-[#0F766E] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {user.operatorCode}
                        </span>
                      </td>

                      {/* PIN with Reveal / Mask Toggle */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center space-x-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {isPinRevealed ? (user.pin || '1234') : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePinReveal(user.id)}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 cursor-pointer"
                            title={isPinRevealed ? 'Sembunyikan PIN' : 'Lihat PIN'}
                          >
                            {isPinRevealed ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role & Badge */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${roleDef?.badgeColor}`}>
                          {isEn ? roleDef?.labelEn : roleDef?.labelId}
                        </span>
                      </td>

                      {/* Module Permissions Badges */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {MODULE_PERMISSIONS_LIST.map((m) => {
                            const isAllowed = userPerms[m.key];
                            if (!isAllowed) return null;
                            const IconComponent = m.icon;
                            return (
                              <span
                                key={m.key}
                                className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${m.color}`}
                                title={m.label}
                              >
                                <IconComponent className="w-2.5 h-2.5" />
                                <span>{m.shortLabel}</span>
                              </span>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => handleOpenQuickPermissions(user)}
                            className="text-[10px] font-bold text-[#0F766E] hover:underline pl-1 cursor-pointer"
                            title="Atur hak akses modular untuk akun ini"
                          >
                            ({activePermKeys.length} modul aktif · Ubah)
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        {user.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 font-semibold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-500 tabular-nums">
                        {user.lastLogin || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => promptSwitchUser(user.id)}
                              className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-[#0F766E] border border-teal-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                              title="Beralih ke akun ini (Wajib verifikasi PIN)"
                            >
                              Gunakan (PIN)
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 text-slate-500 hover:text-[#0F766E] hover:bg-teal-50 rounded-lg transition-all cursor-pointer"
                            title="Edit data akun & Hak Akses"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleUserStatus(user.id)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              user.status === 'ACTIVE'
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={user.status === 'ACTIVE' ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                          >
                            {user.status === 'ACTIVE' ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Tombol Hapus Akun oleh Super Admin */}
                          {users.length > 1 && !isCurrent && (
                            <button
                              type="button"
                              onClick={() => setDeletingUserTarget(user)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title={`Hapus akun ${user.fullName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Role Hierarchy & Security Matrix Guide */}
      <div className="glass-card rounded-3xl p-6 shadow-sm border border-slate-200 bg-white space-y-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-slate-900">
          <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
          <span>{isEn ? 'Role-Based Access Control (RBAC) Matrix' : 'Standar Matriks Hak Akses Modul & Peran'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(ROLE_DEFINITIONS).map(([roleKey, def]) => (
            <div key={roleKey} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${def.badgeColor}`}>
                  {isEn ? def.labelEn : def.labelId}
                </span>
                <span className="text-[10px] font-mono text-slate-400">{roleKey}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{def.desc}</p>
              <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1 text-[10px]">
                {def.permissions.canAccessStation && (
                  <span className="px-1.5 py-0.5 bg-white text-slate-700 rounded border border-slate-200">✓ Stasiun Unboxing</span>
                )}
                {def.permissions.canAccessReports && (
                  <span className="px-1.5 py-0.5 bg-white text-slate-700 rounded border border-slate-200">✓ Laporan</span>
                )}
                {def.permissions.canAccessDisputes && (
                  <span className="px-1.5 py-0.5 bg-white text-slate-700 rounded border border-slate-200">✓ Aju Banding CS</span>
                )}
                {def.permissions.canAccessDatabase && (
                  <span className="px-1.5 py-0.5 bg-white text-slate-700 rounded border border-slate-200">✓ Master Excel</span>
                )}
                {def.permissions.canManageUsers && (
                  <span className="px-1.5 py-0.5 bg-teal-50 text-[#0F766E] rounded border border-teal-200 font-semibold">✓ Kelola Akun</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TAMBAH / EDIT PENGGUNA LENGKAP DENGAN PIN & CHECKLIST HAK AKSES */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="bg-[#0F766E] p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingUser
                      ? (isEn ? 'Edit User Account & Permissions' : 'Edit Akun Pengguna & Hak Akses Modul')
                      : (isEn ? 'Create New User Account & Set PIN' : 'Buat Akun Pengguna Baru & Set PIN Gudang')}
                  </h3>
                  <p className="text-xs text-teal-100">{companyName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveForm} className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs text-slate-700 flex-1">
              {/* Row 1: Nama Lengkap & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Lengkap Operator / Staf</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rian Gunawan"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-900 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="rian.gunawan"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Email & Departemen */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email Perusahaan</label>
                  <input
                    type="email"
                    required
                    placeholder="rian@tirtakumalasari.co.id"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Departemen / Meja Kerja</label>
                  <input
                    type="text"
                    placeholder="Contoh: Stasiun Unboxing Meja 3"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-900"
                  />
                </div>
              </div>

              {/* Row 3: ID Operator & PIN Keamanan Cepat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-teal-950 flex items-center justify-between">
                    <span>ID / Kode Operator (Barcode Card)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: OPR-102"
                    value={formData.operatorCode}
                    onChange={(e) => setFormData({ ...formData, operatorCode: e.target.value.toUpperCase() })}
                    className="w-full text-xs px-3 py-2 bg-white border border-teal-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-200 outline-none text-slate-900 font-mono font-bold"
                  />
                  <p className="text-[10px] text-teal-700">
                    Bisa discan menggunakan barcode scanner kartu operator.
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-teal-950 flex items-center space-x-1">
                      <KeyRound className="w-3.5 h-3.5 text-[#0F766E]" />
                      <span>PIN Cepat Gudang (4-6 Digit)</span>
                    </label>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={handleGenerateRandomPin}
                        className="text-[10px] text-teal-800 underline hover:text-teal-950 cursor-pointer"
                      >
                        Acak PIN
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Masukkan 4-6 digit PIN"
                    value={formData.pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, pin: val });
                    }}
                    className="w-full text-xs px-3 py-2 bg-white border border-teal-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-200 outline-none text-slate-900 font-mono font-bold tracking-widest text-base"
                  />
                  <p className="text-[10px] text-teal-700">
                    PIN numerik memudahkan operator shift berganti akun via touchscreen tanpa keyboard.
                  </p>
                </div>
              </div>

              {/* Row 4: Peran Dasar & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Peran Dasar (Template Role)</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChangeInForm(e.target.value as UserRole)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-900 cursor-pointer font-semibold"
                  >
                    <option value="SUPER_ADMIN">Super Admin (Akses Penuh)</option>
                    <option value="WAREHOUSE_MANAGER">Warehouse Manager (Manajer Operasional)</option>
                    <option value="STATION_OPERATOR">Operator Unboxing (Stasiun Kerja Fisik)</option>
                    <option value="CS_DISPUTE">CS Dispute Specialist (Klaim Ekspedisi)</option>
                    <option value="AUDITOR">Auditor & QC (Pemeriksaan Kepatuhan)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Status Akun</label>
                  <div className="flex items-center space-x-4 pt-2">
                    <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="ACTIVE"
                        checked={formData.status === 'ACTIVE'}
                        onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                        className="text-[#0F766E] focus:ring-[#0F766E]"
                      />
                      <span className="font-semibold text-emerald-700">Aktif (Bisa Login)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value="INACTIVE"
                        checked={formData.status === 'INACTIVE'}
                        onChange={() => setFormData({ ...formData, status: 'INACTIVE' })}
                        className="text-[#0F766E] focus:ring-[#0F766E]"
                      />
                      <span className="text-slate-500">Nonaktif (Blokir)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Row 5: CHECKLIST HAK AKSES MODUL ("Akses Apa Saja Yang Dibuka") */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
                    <span>Akses Modul Apa Saja Yang Dibuka (Kustomisasi Super Admin):</span>
                  </label>
                  <div className="flex items-center space-x-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = { ...formData.permissions };
                        (Object.keys(allOn) as Array<keyof RolePermission>).forEach((k) => (allOn[k] = true));
                        setFormData((prev) => ({ ...prev, permissions: allOn }));
                      }}
                      className="text-[#0F766E] font-bold hover:underline cursor-pointer"
                    >
                      Centang Semua
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleRoleChangeInForm(formData.role);
                      }}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Reset Sesuai Peran
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {MODULE_PERMISSIONS_LIST.map((m) => {
                    const isChecked = !!formData.permissions[m.key];
                    const IconComp = m.icon;
                    return (
                      <label
                        key={m.key}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start space-x-2.5 select-none ${
                          isChecked
                            ? 'bg-teal-50/80 border-[#0F766E] text-slate-900 shadow-2xs ring-1 ring-[#0F766E]/20'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleTogglePermissionInForm(m.key, e.target.checked)}
                          className="mt-0.5 rounded text-[#0F766E] focus:ring-[#0F766E] cursor-pointer w-4 h-4 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5 font-bold text-xs">
                            <IconComp className={`w-3.5 h-3.5 ${isChecked ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                            <span className={isChecked ? 'text-slate-900 font-semibold' : 'text-slate-600'}>{m.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{m.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingUser ? 'Perbarui Akun & Hak Akses' : 'Simpan Akun Baru'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: UBAH HAK AKSES CEPAT PER PENGGUNA                                */}
      {/* ========================================================================= */}
      {permissionTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0F766E] p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-white">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Atur Akses Modul: {permissionTargetUser.fullName}</h3>
                  <p className="text-[11px] text-teal-100 font-mono">
                    ID: {permissionTargetUser.operatorCode} · Peran: {ROLE_DEFINITIONS[permissionTargetUser.role]?.labelId || permissionTargetUser.role}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPermissionTargetUser(null);
                  setQuickPerms(null);
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Centang modul yang diizinkan untuk <strong>{permissionTargetUser.fullName}</strong>:
                </p>
                <div className="flex items-center space-x-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const allOn: RolePermission = {
                        canAccessDashboard: true,
                        canAccessStation: true,
                        canAccessReports: true,
                        canAccessDisputes: true,
                        canAccessRma: true,
                        canAccessDatabase: true,
                        canManageUsers: true,
                        canExportData: true,
                        canDeleteReports: true,
                      };
                      setQuickPerms(allOn);
                    }}
                    className="text-[#0F766E] font-bold hover:underline cursor-pointer"
                  >
                    Centang Semua
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      const rolePerms = { ...ROLE_DEFINITIONS[permissionTargetUser.role].permissions };
                      setQuickPerms(rolePerms);
                    }}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Reset Peran
                  </button>
                </div>
              </div>

              {(() => {
                const currentPerms = quickPerms || getUserPermissions(permissionTargetUser);
                return (
                  <div className="space-y-2">
                    {MODULE_PERMISSIONS_LIST.map((m) => {
                      const isAllowed = !!currentPerms[m.key];
                      const IconComp = m.icon;
                      return (
                        <label
                          key={m.key}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                            isAllowed
                              ? 'bg-teal-50/80 border-[#0F766E] text-slate-900 shadow-2xs ring-1 ring-[#0F766E]/20'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start space-x-2.5 flex-1 pr-2">
                            <input
                              type="checkbox"
                              checked={isAllowed}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setQuickPerms((prev) => ({
                                  ...(prev || getUserPermissions(permissionTargetUser)),
                                  [m.key]: val
                                }));
                              }}
                              className="mt-1 rounded text-[#0F766E] focus:ring-[#0F766E] cursor-pointer w-4 h-4 shrink-0"
                            />
                            <div className="flex items-start space-x-2">
                              <IconComp className={`w-4 h-4 mt-0.5 ${isAllowed ? 'text-[#0F766E]' : 'text-slate-400'}`} />
                              <div>
                                <div className={`font-bold text-xs ${isAllowed ? 'text-slate-900' : 'text-slate-700'}`}>
                                  {m.label}
                                </div>
                                <div className="text-[10px] text-slate-500">{m.desc}</div>
                              </div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            isAllowed
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {isAllowed ? '✓ Dibuka' : 'Terkunci'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setPermissionTargetUser(null);
                  setQuickPerms(null);
                }}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveQuickPermissions}
                className="px-4 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan Hak Akses</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KONFIRMASI HAPUS AKUN PENGGUNA OLEH SUPER ADMIN                  */}
      {/* ========================================================================= */}
      {deletingUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Akun</h3>
                <p className="text-xs text-slate-500">Wewenang Super Admin</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-1.5">
              <p>
                Apakah Anda yakin ingin menghapus akun pengguna <strong>{deletingUserTarget.fullName}</strong> (ID: <span className="font-mono">{deletingUserTarget.operatorCode}</span>)?
              </p>
              <p className="text-[11px] text-rose-800">
                Setelah dihapus, operator ini tidak akan bisa lagi login ke stasiun unboxing menggunakan ID Operator maupun PIN.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeletingUserTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-900/10 cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Akun Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
