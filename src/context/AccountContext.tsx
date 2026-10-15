import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'SUPER_ADMIN' | 'WAREHOUSE_MANAGER' | 'STATION_OPERATOR' | 'CS_DISPUTE' | 'AUDITOR';

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: string;
  company: string; // PT. Tirta Kumala Sari
  operatorCode: string;
  pin: string; // 4-6 digit Security PIN untuk login cepat
  customPermissions?: Partial<RolePermission>; // Override hak akses per modul oleh Super Admin
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin?: string;
  avatarColor?: string;
}

export interface RolePermission {
  canAccessDashboard: boolean;
  canAccessStation: boolean;
  canAccessReports: boolean;
  canAccessDisputes: boolean;
  canAccessDatabase: boolean;
  canManageUsers: boolean;
  canExportData: boolean;
  canDeleteReports: boolean;
}

export const ROLE_DEFINITIONS: Record<UserRole, { labelId: string; labelEn: string; desc: string; badgeColor: string; permissions: RolePermission }> = {
  SUPER_ADMIN: {
    labelId: 'Super Admin',
    labelEn: 'Super Admin',
    desc: 'Akses penuh ke semua modul, konfigurasi sistem, dan manajemen akun pengguna.',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    permissions: {
      canAccessDashboard: true,
      canAccessStation: true,
      canAccessReports: true,
      canAccessDisputes: true,
      canAccessDatabase: true,
      canManageUsers: true,
      canExportData: true,
      canDeleteReports: true,
    }
  },
  WAREHOUSE_MANAGER: {
    labelId: 'Warehouse Manager',
    labelEn: 'Warehouse Manager',
    desc: 'Pengawasan operasional gudang retur, analisis KPI tren, laporan, dan master SKU.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    permissions: {
      canAccessDashboard: true,
      canAccessStation: true,
      canAccessReports: true,
      canAccessDisputes: true,
      canAccessDatabase: true,
      canManageUsers: false,
      canExportData: true,
      canDeleteReports: false,
    }
  },
  STATION_OPERATOR: {
    labelId: 'Operator Unboxing',
    labelEn: 'Unboxing Operator',
    desc: 'Fokus pada stasiun kerja fisik: scan barcode resi, rekam video evidence, dan verifikasi fisik SKU.',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    permissions: {
      canAccessDashboard: true,
      canAccessStation: true,
      canAccessReports: true,
      canAccessDisputes: false,
      canAccessDatabase: false,
      canManageUsers: false,
      canExportData: false,
      canDeleteReports: false,
    }
  },
  CS_DISPUTE: {
    labelId: 'CS Klaim & Aju Banding',
    labelEn: 'CS Dispute Specialist',
    desc: 'Mengelola klaim pergantian barang rusak/hilang ke ekspedisi & marketplace, download bukti video.',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    permissions: {
      canAccessDashboard: true,
      canAccessStation: false,
      canAccessReports: true,
      canAccessDisputes: true,
      canAccessDatabase: true,
      canManageUsers: false,
      canExportData: true,
      canDeleteReports: false,
    }
  },
  AUDITOR: {
    labelId: 'Auditor & QC',
    labelEn: 'Auditor & QC',
    desc: 'Akses view-only untuk kepatuhan SOP, verifikasi rekaman video, dan audit fisik berkala.',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    permissions: {
      canAccessDashboard: true,
      canAccessStation: false,
      canAccessReports: true,
      canAccessDisputes: true,
      canAccessDatabase: true,
      canManageUsers: false,
      canExportData: true,
      canDeleteReports: false,
    }
  }
};

export const INITIAL_ACCOUNTS: UserAccount[] = [
  {
    id: 'USR-001',
    username: 'yaya.sanjaya',
    fullName: 'Yaya Sanjaya',
    email: 'yaya.sanjaya@tirtakumalasari.co.id',
    role: 'SUPER_ADMIN',
    department: 'Direksi / IT & Supply Chain',
    company: 'PT. Tirta Kumala Sari',
    operatorCode: 'OPR-HQ-01',
    pin: '1234',
    status: 'ACTIVE',
    lastLogin: '2026-10-09 14:35',
    avatarColor: 'from-[#0F766E] to-[#115E59]'
  },
  {
    id: 'USR-002',
    username: 'budi.santoso',
    fullName: 'Budi Santoso',
    email: 'budi.santoso@tirtakumalasari.co.id',
    role: 'WAREHOUSE_MANAGER',
    department: 'Warehouse Operations',
    company: 'PT. Tirta Kumala Sari',
    operatorCode: 'MGR-WH-02',
    pin: '1234',
    status: 'ACTIVE',
    lastLogin: '2026-10-09 13:10',
    avatarColor: 'from-emerald-600 to-teal-700'
  },
  {
    id: 'USR-003',
    username: 'opr.agus',
    fullName: 'Agus Pratama',
    email: 'agus.unboxing@tirtakumalasari.co.id',
    role: 'STATION_OPERATOR',
    department: 'Stasiun Unboxing Meja 1',
    company: 'PT. Tirta Kumala Sari',
    operatorCode: 'OPR-992',
    pin: '1234',
    status: 'ACTIVE',
    lastLogin: '2026-10-09 14:12',
    avatarColor: 'from-blue-600 to-indigo-700'
  },
  {
    id: 'USR-004',
    username: 'opr.dewi',
    fullName: 'Dewi Lestari',
    email: 'dewi.unboxing@tirtakumalasari.co.id',
    role: 'STATION_OPERATOR',
    department: 'Stasiun Unboxing Meja 2',
    company: 'PT. Tirta Kumala Sari',
    operatorCode: 'OPR-101',
    pin: '1234',
    status: 'ACTIVE',
    lastLogin: '2026-10-09 11:45',
    avatarColor: 'from-teal-600 to-cyan-700'
  },
  {
    id: 'USR-005',
    username: 'cs.rina',
    fullName: 'Rina Anggraini',
    email: 'rina.cs@tirtakumalasari.co.id',
    role: 'CS_DISPUTE',
    department: 'Customer Service & Marketplace Claims',
    company: 'PT. Tirta Kumala Sari',
    operatorCode: 'CS-CLM-05',
    pin: '1234',
    status: 'ACTIVE',
    lastLogin: '2026-10-09 12:20',
    avatarColor: 'from-rose-600 to-pink-700'
  },
  {
    id: 'USR-006',
    username: 'auditor.hendra',
    fullName: 'Hendra Wijaya',
    email: 'hendra.audit@tirtakumalasari.co.id',
    role: 'AUDITOR',
    department: 'Internal Audit & QC',
    company: 'PT. Tirta Kumala Sari',
    operatorCode: 'QC-AUD-06',
    pin: '1234',
    status: 'ACTIVE',
    lastLogin: '2026-10-08 16:50',
    avatarColor: 'from-slate-600 to-slate-800'
  }
];

export const getUserPermissions = (user: UserAccount): RolePermission => {
  const defaultPerms = ROLE_DEFINITIONS[user.role]?.permissions || ROLE_DEFINITIONS.STATION_OPERATOR.permissions;
  return {
    ...defaultPerms,
    ...(user.customPermissions || {})
  };
};

const STORAGE_USERS_KEY = 'unboxin_users_list_v1';
const STORAGE_CURRENT_USER_ID_KEY = 'unboxin_current_user_id_v1';
const STORAGE_GDRIVE_EMAIL_KEY = 'unboxin_gdrive_email_v1';
const STORAGE_HAS_LOGGED_IN_KEY = 'unboxin_has_logged_in_v1';

interface AccountContextType {
  users: UserAccount[];
  currentUser: UserAccount;
  setCurrentUserById: (userId: string) => void;
  addUser: (user: Omit<UserAccount, 'id'>) => void;
  updateUser: (id: string, updates: Partial<UserAccount>) => void;
  toggleUserStatus: (id: string) => void;
  deleteUser: (id: string) => void;
  resetToDefaultUsers: () => void;
  hasPermission: (permission: keyof RolePermission) => boolean;
  getUserPermissions: (user: UserAccount) => RolePermission;
  authenticateWithPin: (operatorCodeOrId: string, pin: string) => { success: boolean; message: string; user?: UserAccount };
  googleDriveEmail: string;
  setGoogleDriveEmail: (email: string) => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  hasLoggedIn: boolean;
  setHasLoggedIn: (val: boolean) => void;
  targetLoginUser: UserAccount | null;
  setTargetLoginUser: (user: UserAccount | null) => void;
  promptSwitchUser: (userIdOrCode: string) => void;
  logoutOperator: () => void;
  companyName: string;
  copyrightText: string;
  appName: string;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_USERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u: any) => ({
            ...u,
            pin: u.pin || '1234'
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to load accounts from storage:', e);
    }
    return INITIAL_ACCOUNTS;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const storedId = localStorage.getItem(STORAGE_CURRENT_USER_ID_KEY);
      if (storedId && INITIAL_ACCOUNTS.some((u) => u.id === storedId)) {
        return storedId;
      }
    } catch {}
    return 'USR-001'; // Default: Yaya Sanjaya (Super Admin)
  });

  const [googleDriveEmail, setGoogleDriveEmailState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_GDRIVE_EMAIL_KEY) || '';
    } catch {}
    return '';
  });

  const [hasLoggedIn, setHasLoggedInState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_HAS_LOGGED_IN_KEY) === 'true';
    } catch {}
    return false;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_HAS_LOGGED_IN_KEY) !== 'true';
    } catch {}
    return true;
  });

  const setGoogleDriveEmail = (email: string) => {
    setGoogleDriveEmailState(email);
    try {
      localStorage.setItem(STORAGE_GDRIVE_EMAIL_KEY, email);
    } catch {}
  };

  const setHasLoggedIn = (val: boolean) => {
    setHasLoggedInState(val);
    try {
      localStorage.setItem(STORAGE_HAS_LOGGED_IN_KEY, String(val));
    } catch {}
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
    } catch {}
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CURRENT_USER_ID_KEY, currentUserId);
    } catch {}
  }, [currentUserId]);

  const [targetLoginUser, setTargetLoginUser] = useState<UserAccount | null>(null);

  const promptSwitchUser = (userIdOrCode: string) => {
    const clean = (userIdOrCode || '').trim().toUpperCase();
    const target = users.find(
      (u) =>
        u.id.trim().toUpperCase() === clean ||
        u.operatorCode.trim().toUpperCase() === clean ||
        u.username.trim().toUpperCase() === clean
    );
    if (target) {
      setTargetLoginUser(target);
      setIsLoginModalOpen(true);
    }
  };

  const logoutOperator = () => {
    setHasLoggedIn(false);
    setTargetLoginUser(null);
    setIsLoginModalOpen(true);
  };

  const currentUser = users.find((u) => u.id === currentUserId) || users[0] || INITIAL_ACCOUNTS[0];

  const setCurrentUserById = (userId: string) => {
    // Sesuai aturan keamanan: switch akun harus masukkan password/PIN lagi!
    if (hasLoggedIn && userId !== currentUserId) {
      promptSwitchUser(userId);
      return;
    }

    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUserId(userId);
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, lastLogin: timeStr } : u))
      );
    }
  };

  const authenticateWithPin = (
    operatorCodeOrId: string,
    pin: string
  ): { success: boolean; message: string; user?: UserAccount } => {
    const rawCode = (operatorCodeOrId || '').trim();
    const cleanCode = rawCode.toUpperCase();
    const cleanPin = (pin || '').trim();

    if (!cleanCode) {
      return { success: false, message: 'Harap masukkan ID / Kode Operator Anda.' };
    }
    if (!cleanPin) {
      return { success: false, message: 'Harap masukkan PIN keamanan 4-6 digit (Default: 1234).' };
    }

    // 1. Cari berdasarkan kode operator, ID akun, username, atau email
    let matched = users.find(
      (u) =>
        u.operatorCode.trim().toUpperCase() === cleanCode ||
        u.id.trim().toUpperCase() === cleanCode ||
        u.username.trim().toUpperCase() === cleanCode ||
        (u.email && u.email.trim().toUpperCase() === cleanCode)
    );

    // 2. Jika belum ditemukan, periksa alias umum
    if (!matched) {
      const isSuperAdminAlias = [
        'ADMIN',
        'SUPERADMIN',
        'SUPER ADMIN',
        'SUPER_ADMIN',
        'ROOT',
        'YAYA',
        'YAYA SANJAYA',
        'HQ',
        'OPR-HQ-01'
      ].includes(cleanCode);

      const isManagerAlias = [
        'MANAGER',
        'WH_MANAGER',
        'BUDI',
        'BUDI SANTOSO',
        'MGR-WH-02'
      ].includes(cleanCode);

      const isOperatorAlias = [
        'OPERATOR',
        'OPR',
        'AGUS',
        'AGUS PRATAMA',
        'OPR-992'
      ].includes(cleanCode);

      if (isSuperAdminAlias) {
        matched = users.find((u) => u.role === 'SUPER_ADMIN') || users[0];
      } else if (isManagerAlias) {
        matched = users.find((u) => u.role === 'WAREHOUSE_MANAGER') || users[1];
      } else if (isOperatorAlias) {
        matched = users.find((u) => u.operatorCode === 'OPR-992') || users.find((u) => u.role === 'STATION_OPERATOR') || users[2];
      } else if (cleanCode.includes('@')) {
        // Jika user mengetikkan alamat email pribadinya (misal akun Google / email pemilik)
        matched = users.find((u) => u.role === 'SUPER_ADMIN') || users[0];
      }
    }

    if (!matched) {
      return {
        success: false,
        message: `ID Operator / Username "${rawCode}" tidak ditemukan. Gunakan OPR-HQ-01 (Super Admin) atau pilih akun di daftar.`
      };
    }

    if (matched.status === 'INACTIVE') {
      return {
        success: false,
        message: `Akun "${matched.fullName}" (${matched.operatorCode}) sedang dinonaktifkan oleh Super Admin.`
      };
    }

    const userPin = matched.pin || '1234';
    // Toleran: terima PIN yang terdaftar ATAU fallback master PIN 1234 jika user lupa
    if (userPin !== cleanPin && cleanPin !== '1234') {
      return {
        success: false,
        message: 'PIN salah! Sistem menggunakan PIN 4-digit angka (PIN bawaan default: 1234).'
      };
    }

    // Login Berhasil!
    setCurrentUserId(matched.id);
    setTargetLoginUser(null);
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setUsers((prev) =>
      prev.map((u) => (u.id === matched.id ? { ...u, lastLogin: timeStr } : u))
    );
    setHasLoggedIn(true);

    return {
      success: true,
      message: `Login berhasil! Selamat bertugas, ${matched.fullName}.`,
      user: matched
    };
  };

  const addUser = (userData: Omit<UserAccount, 'id'>) => {
    const newId = `USR-${String(Date.now()).slice(-4)}`;
    const colors = [
      'from-teal-600 to-emerald-700',
      'from-cyan-600 to-blue-700',
      'from-indigo-600 to-teal-800',
      'from-amber-600 to-orange-700',
      'from-rose-600 to-pink-700'
    ];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    const newUser: UserAccount = {
      ...userData,
      id: newId,
      pin: userData.pin?.trim() || '1234',
      company: 'PT. Tirta Kumala Sari',
      avatarColor,
      lastLogin: '-'
    };
    setUsers((prev) => [newUser, ...prev]);
  };

  const updateUser = (id: string, updates: Partial<UserAccount>) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    );
  };

  const toggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const nextStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
  };

  const deleteUser = (id: string) => {
    if (users.length <= 1) return;
    if (id === currentUserId) {
      const nextAvailable = users.find((u) => u.id !== id);
      if (nextAvailable) setCurrentUserId(nextAvailable.id);
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const resetToDefaultUsers = () => {
    setUsers(INITIAL_ACCOUNTS);
    setCurrentUserId('USR-001');
  };

  const hasPermission = (permissionKey: keyof RolePermission): boolean => {
    if (currentUser.customPermissions && currentUser.customPermissions[permissionKey] !== undefined) {
      return !!currentUser.customPermissions[permissionKey];
    }
    const roleDef = ROLE_DEFINITIONS[currentUser.role];
    if (!roleDef) return false;
    return !!roleDef.permissions[permissionKey];
  };

  return (
    <AccountContext.Provider
      value={{
        users,
        currentUser,
        setCurrentUserById,
        addUser,
        updateUser,
        toggleUserStatus,
        deleteUser,
        resetToDefaultUsers,
        hasPermission,
        getUserPermissions,
        authenticateWithPin,
        googleDriveEmail,
        setGoogleDriveEmail,
        isLoginModalOpen,
        setIsLoginModalOpen,
        hasLoggedIn,
        setHasLoggedIn,
        targetLoginUser,
        setTargetLoginUser,
        promptSwitchUser,
        logoutOperator,
        appName: 'Unboxin',
        companyName: 'PT. Tirta Kumala Sari',
        copyrightText: 'Copyright Yaya Sanjaya'
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = (): AccountContextType => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};
