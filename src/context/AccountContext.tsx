import React, { createContext, useContext, useState, useEffect } from 'react';

import {
  type UserRole,
  type UserAccount,
  type RolePermission,
  ROLE_DEFINITIONS,
  INITIAL_ACCOUNTS
} from '../types/account.ts';
import { syncService } from '../services/dataSyncService';
import { firestoreSync } from '../services/firestoreSyncService';

export type { UserRole, UserAccount, RolePermission };
export { ROLE_DEFINITIONS, INITIAL_ACCOUNTS };



export const getUserPermissions = (user: UserAccount): RolePermission => {
  const defaultPerms = ROLE_DEFINITIONS[user.role]?.permissions || ROLE_DEFINITIONS.STATION_OPERATOR.permissions;
  return {
    ...defaultPerms,
    ...(user.customPermissions || {})
  };
};

export interface TenantConfig {
  companyName: string;
  appName: string;
  tagline: string;
  copyrightText: string;
  accentTheme: 'teal' | 'emerald' | 'slate' | 'indigo';
  isDemoMode: boolean;
  tenantLogoUrl?: string | null;
}

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  companyName: 'PT. Tirta Kumala Sari',
  appName: 'unboxin.id',
  tagline: 'Sistem Inspeksi Retur & Rekaman Video Bukti',
  copyrightText: '© 2026 unboxin.id • PT. Tirta Kumala Sari. Copyright by Yaya Sanjaya.',
  accentTheme: 'teal',
  isDemoMode: false,
  tenantLogoUrl: null
};

const STORAGE_USERS_KEY = 'unboxin_users_list_v1';
const STORAGE_CURRENT_USER_ID_KEY = 'unboxin_current_user_id_v1';
const STORAGE_GDRIVE_EMAIL_KEY = 'unboxin_gdrive_email_v1';
const STORAGE_HAS_LOGGED_IN_KEY = 'unboxin_has_logged_in_v1';
const STORAGE_TENANT_CONFIG_KEY = 'unboxin_tenant_config_v1';

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
  authenticateWithPin: (operatorCodeOrId: string, pin: string) => Promise<{ success: boolean; message: string; user?: UserAccount }>;
  googleDriveEmail: string;
  setGoogleDriveEmail: (email: string) => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  hasLoggedIn: boolean;
  setHasLoggedIn: (val: boolean) => void;
  targetLoginUser: UserAccount | null;
  setTargetLoginUser: (user: UserAccount | null) => void;
  promptSwitchUser: (userIdOrCode: string) => void;
  logoutOperator: () => Promise<void>;
  companyName: string;
  copyrightText: string;
  appName: string;
  tenantConfig: TenantConfig;
  updateTenantConfig: (updates: Partial<TenantConfig>) => void;
  resetTenantConfig: () => void;
  isTenantModalOpen: boolean;
  setIsTenantModalOpen: (open: boolean) => void;
  saveUsersToCloud: (customUsers?: UserAccount[]) => Promise<boolean>;
  cleanDemoAccounts: () => Promise<boolean>;
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

  const [hasLoggedIn, setHasLoggedInState] = useState<boolean>(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(true);

  const [tenantConfig, setTenantConfig] = useState<TenantConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_TENANT_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_TENANT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load tenant config:', e);
    }
    return DEFAULT_TENANT_CONFIG;
  });

  const [isTenantModalOpen, setIsTenantModalOpen] = useState<boolean>(false);

  const updateTenantConfig = (updates: Partial<TenantConfig>) => {
    setTenantConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_TENANT_CONFIG_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetTenantConfig = () => {
    setTenantConfig(DEFAULT_TENANT_CONFIG);
    try {
      localStorage.setItem(STORAGE_TENANT_CONFIG_KEY, JSON.stringify(DEFAULT_TENANT_CONFIG));
    } catch {}
  };

  const setGoogleDriveEmail = (email: string) => {
    setGoogleDriveEmailState(email);
    try {
      localStorage.setItem(STORAGE_GDRIVE_EMAIL_KEY, email);
    } catch {}
  };

  const setHasLoggedIn = (val: boolean) => {
    setHasLoggedInState(val);
    try {
      if (val) {
        localStorage.setItem(STORAGE_HAS_LOGGED_IN_KEY, 'true');
      } else {
        localStorage.removeItem(STORAGE_HAS_LOGGED_IN_KEY);
      }
    } catch {}
  };

  useEffect(() => {
    // 1. Hubungkan pendengar data cloud Firestore real-time (Mirroring instan ke semua HP & PC)
    const unsubFirestore = firestoreSync.subscribe((cloudState) => {
      if (cloudState && Array.isArray(cloudState.users) && cloudState.users.length > 0) {
        setUsers(cloudState.users);
        try {
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(cloudState.users));
        } catch {}
      }
    });

    // 2. Hubungkan pendengar syncService (Polling Express & BroadcastChannel lokal)
    const unsubSyncService = syncService.subscribe((payload) => {
      if (payload.users && Array.isArray(payload.users) && payload.users.length > 0) {
        setUsers(payload.users);
        try {
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(payload.users));
        } catch {}
      }
    });

    // 3. Tarik sinkronisasi awal saat aplikasi dibuka
    syncService.syncPull().catch(() => {});

    return () => {
      unsubFirestore();
      unsubSyncService();
    };
  }, []);

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


  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Sesi tidak aktif');
        return response.json();
      })
      .then((payload) => {
        if (!active || !payload?.user) return;
        const sessionUser = payload.user as UserAccount;
        setCurrentUserId(sessionUser.id);
        setUsers((prev) => prev.some((user) => user.id === sessionUser.id)
          ? prev.map((user) => user.id === sessionUser.id ? { ...user, ...sessionUser } : user)
          : [sessionUser, ...prev]);
        setHasLoggedInState(true);
        setIsLoginModalOpen(false);
      })
      .catch(() => {
        if (!active) return;
        setHasLoggedInState(false);
        setIsLoginModalOpen(true);
        try { localStorage.removeItem(STORAGE_HAS_LOGGED_IN_KEY); } catch {}
      });
    return () => { active = false; };
  }, []);
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

  const logoutOperator = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
    setHasLoggedIn(false);
    setTargetLoginUser(null);
    setIsLoginModalOpen(true);
    try {
      localStorage.removeItem(STORAGE_HAS_LOGGED_IN_KEY);
      localStorage.removeItem(STORAGE_CURRENT_USER_ID_KEY);
    } catch {}
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

  const authenticateWithPin = async (
    operatorCodeOrId: string,
    pin: string
  ): Promise<{ success: boolean; message: string; user?: UserAccount }> => {
    const rawCode = (operatorCodeOrId || '').trim();
    const cleanPin = (pin || '').trim();
    if (!rawCode) return { success: false, message: 'Harap masukkan ID / Kode Operator Anda.' };
    if (!cleanPin) return { success: false, message: 'Harap masukkan PIN keamanan 4-6 digit.' };

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: rawCode, pin: cleanPin })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.user) {
        return { success: false, message: payload?.message || 'Login gagal. Periksa ID operator dan PIN Anda.' };
      }

      const matched = payload.user as UserAccount;
      setCurrentUserId(matched.id);
      setTargetLoginUser(null);
      setUsers((prev) => prev.some((user) => user.id === matched.id)
        ? prev.map((user) => user.id === matched.id ? { ...user, ...matched } : user)
        : [matched, ...prev]);
      setHasLoggedIn(true);
      setIsLoginModalOpen(false);
      return { success: true, message: `Login berhasil! Selamat bertugas, ${matched.fullName}.`, user: matched };
    } catch {
      return { success: false, message: 'Server login tidak dapat dihubungi. Pastikan server aplikasi sedang menyala.' };
    }
  };
  const persistAndSyncUsers = (updatedList: UserAccount[]) => {
    setUsers(updatedList);
    try {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(updatedList));
    } catch {}
    // Otomatis simpan ke Cloud Firestore & endpoint server sinkronisasi
    firestoreSync.pushUsers(updatedList).catch((err) => {
      console.warn('Firestore pushUsers warning:', err);
    });
    syncService.pushUsers(updatedList).catch((err) => {
      console.warn('Server pushUsers warning:', err);
    });
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
    const nextList = [newUser, ...users];
    persistAndSyncUsers(nextList);
  };

  const updateUser = (id: string, updates: Partial<UserAccount>) => {
    const nextList = users.map((u) => (u.id === id ? { ...u, ...updates } : u));
    persistAndSyncUsers(nextList);
  };

  const toggleUserStatus = (id: string) => {
    const nextList: UserAccount[] = users.map((u) => {
      if (u.id === id) {
        const nextStatus: 'ACTIVE' | 'INACTIVE' = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        return { ...u, status: nextStatus };
      }
      return u;
    });
    persistAndSyncUsers(nextList);
  };

  const deleteUser = (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    // Proteksi Super Admin Yaya Sanjaya dari penghapusan
    if (id === 'USR-001' || targetUser?.operatorCode === 'OPR-HQ-01' || targetUser?.role === 'SUPER_ADMIN') {
      console.warn('Super Admin Yaya Sanjaya diproteksi dan tidak dapat dihapus.');
      return;
    }

    if (id === currentUserId) {
      const nextAvailable = users.find((u) => u.id !== id && u.id === 'USR-001') || users.find((u) => u.id !== id);
      if (nextAvailable) setCurrentUserId(nextAvailable.id);
    }
    const nextList = users.filter((u) => u.id !== id);
    persistAndSyncUsers(nextList);

    // Kirim sinyal hapus permanen ke endpoint backend Cloud SQL
    syncService.deleteUser(id, targetUser?.operatorCode).catch((err) => {
      console.warn('Backend deleteUser error:', err);
    });
  };

  const resetToDefaultUsers = () => {
    setCurrentUserId('USR-001');
    persistAndSyncUsers(INITIAL_ACCOUNTS);
    syncService.cleanDemoUsers().catch(() => {});
  };

  const cleanDemoAccounts = async (): Promise<boolean> => {
    setCurrentUserId('USR-001');
    const yayaOnly = INITIAL_ACCOUNTS; // USR-001 Yaya Sanjaya
    persistAndSyncUsers(yayaOnly);
    const ok = await syncService.cleanDemoUsers();
    await firestoreSync.pushUsers(yayaOnly);
    return ok;
  };

  const saveUsersToCloud = async (customUsers?: UserAccount[]): Promise<boolean> => {
    const target = customUsers || users;
    persistAndSyncUsers(target);
    const fOk = await firestoreSync.pushUsers(target);
    const sOk = await syncService.pushUsers(target);
    return fOk || sOk;
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
        cleanDemoAccounts,
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
        appName: tenantConfig.appName,
        companyName: tenantConfig.companyName,
        copyrightText: tenantConfig.copyrightText,
        tenantConfig,
        updateTenantConfig,
        resetTenantConfig,
        isTenantModalOpen,
        setIsTenantModalOpen,
        saveUsersToCloud
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



