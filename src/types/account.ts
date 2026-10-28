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
  pin: string; // 4-6 digit Security PIN untuk login
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
  canAccessRma: boolean;
  canAccessDatabase: boolean;
  canManageUsers: boolean;
  canExportData: boolean;
  canDeleteReports: boolean;
}

export const ROLE_DEFINITIONS: Record<
  UserRole,
  { labelId: string; labelEn: string; desc: string; badgeColor: string; permissions: RolePermission }
> = {
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
      canAccessRma: true,
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
      canAccessRma: true,
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
      canAccessRma: false,
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
      canAccessRma: true,
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
      canAccessRma: true,
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
  }
];

