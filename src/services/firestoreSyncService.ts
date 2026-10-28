/**
 * Layanan Sinkronisasi Cloud Real-Time Firebase Firestore
 * Database: ai-studio-ecommercereturnu-549c0a5d-18b6-49ab-8107-81f431047e0c
 * 
 * Menjamin data Master SKU, Hasil Unboxing Retur, CS Disputes, dan Akun
 * melakukan mirror secara instan antar perangkat (HP, PC 1, PC 2) secara real-time (onSnapshot).
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ProcessedReturnRow } from '../processor';
import type { MasterSKUItem } from '../utils/excelTemplate';
import type { UserAccount } from '../types/account';
import { DEFAULT_MASTER_DATABASE } from '../utils/excelTemplate';
import { INITIAL_ACCOUNTS } from '../types/account';

export interface FirestoreWarehouseState {
  version: number;
  lastUpdated: string;
  updatedByDeviceId?: string;
  returns: ProcessedReturnRow[];
  disputes: Record<string, any>;
  masterDatabase: MasterSKUItem[];
  users: UserAccount[];
}

export type FirestoreSyncListener = (state: FirestoreWarehouseState) => void;
export type FirestoreStatus = 'connected' | 'connecting' | 'error' | 'offline' | 'quota_exceeded';
export type FirestoreStatusListener = (status: FirestoreStatus, lastTime: Date | null) => void;

/**
 * Membersihkan nilai undefined dari objek sebelum dikirim ke Firebase Firestore
 * untuk mencegah "FirebaseError: Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined || val === null) return null as unknown as T;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    const dense: any[] = [];
    for (let i = 0; i < val.length; i++) {
      const item = val[i];
      if (item !== undefined && item !== null) {
        const cleaned = sanitizeForFirestore(item);
        if (cleaned !== undefined) {
          dense.push(cleaned);
        }
      }
    }
    return dense as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [k, v] of Object.entries(val as Record<string, any>)) {
    if (v !== undefined) {
      const cleaned = sanitizeForFirestore(v);
      if (cleaned !== undefined) {
        cleanObj[k] = cleaned;
      }
    }
  }
  return cleanObj as T;
}

class FirestoreSyncService {
  private db: Firestore | null = null;
  private unsubscribeSnapshot: Unsubscribe | null = null;
  private listeners: Set<FirestoreWarehouseStateCallback> = new Set();
  private statusListeners: Set<FirestoreStatusListener> = new Set();
  private deviceId: string;
  private currentState: FirestoreWarehouseState | null = null;
  private isConnected = false;
  private isQuotaExceeded = false;
  private lastSyncTime: Date | null = null;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.initFirestore();
  }

  private getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return 'server-' + Math.random().toString(36).substring(2, 9);
    try {
      let id = localStorage.getItem('unboxin_device_id_v1');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
        localStorage.setItem('unboxin_device_id_v1', id);
      }
      return id;
    } catch {
      return 'fallback_device_' + Math.random().toString(36).substring(2, 7);
    }
  }

  private initFirestore() {
    try {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      this.db = firebaseConfig.firestoreDatabaseId
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app);
      this.setupRealtimeListener();
    } catch (err) {
      console.warn('Inisialisasi Firestore warning:', err);
      this.updateStatus('error');
    }
  }

  private setupRealtimeListener() {
    if (!this.db) return;
    this.updateStatus('connecting');

    const stateDocRef = doc(this.db, 'warehouse_sync', 'realtime_state');

    this.unsubscribeSnapshot = onSnapshot(
      stateDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<FirestoreWarehouseState>;
          const fullState: FirestoreWarehouseState = {
            version: data.version || 1,
            lastUpdated: data.lastUpdated || new Date().toISOString(),
            updatedByDeviceId: data.updatedByDeviceId,
            returns: Array.isArray(data.returns) ? data.returns : [],
            disputes: data.disputes && typeof data.disputes === 'object' ? data.disputes : {},
            masterDatabase: Array.isArray(data.masterDatabase) && data.masterDatabase.length > 0
              ? data.masterDatabase
              : DEFAULT_MASTER_DATABASE,
            users: Array.isArray(data.users) && data.users.length > 0 ? data.users : INITIAL_ACCOUNTS
          };

          this.currentState = fullState;
          this.isConnected = true;
          this.lastSyncTime = new Date();
          this.updateStatus('connected');
          this.notifyListeners(fullState);
        } else {
          // Inisialisasi dokumen cloud pertama kali jika belum ada
          this.seedInitialState();
        }
      },
      (error) => {
        if (this.handleQuotaError(error)) {
          this.isConnected = false;
          return;
        }
        console.warn('Firestore real-time listener error (fallback to local/offline):', error);
        this.isConnected = false;
        this.updateStatus('error');
      }
    );
  }

  public getIsQuotaExceeded(): boolean {
    return this.isQuotaExceeded;
  }

  public getQuotaConsoleUrl(): string {
    return 'https://console.firebase.google.com/project/gen-lang-client-0738104145/firestore/databases/ai-studio-ecommercereturnu-549c0a5d-18b6-49ab-8107-81f431047e0c/data?openUpgradeDialog=true';
  }

  private handleQuotaError(error: unknown): boolean {
    const msg = String(error);
    const code = (error as any)?.code;
    if (code === 'resource-exhausted' || msg.includes('Quota limit exceeded') || msg.includes('resource-exhausted')) {
      if (!this.isQuotaExceeded) {
        this.isQuotaExceeded = true;
        this.updateStatus('quota_exceeded');
        console.warn('Firebase Firestore daily write quota limit reached. Data persistence will continue seamlessly via Cloud SQL / PostgreSQL backend server.');
      }
      return true;
    }
    return false;
  }

  private async seedInitialState() {
    if (!this.db || this.isQuotaExceeded) return;
    try {
      const stateDocRef = doc(this.db, 'warehouse_sync', 'realtime_state');
      const initialState: FirestoreWarehouseState = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        updatedByDeviceId: this.deviceId,
        returns: [],
        disputes: {},
        masterDatabase: DEFAULT_MASTER_DATABASE,
        users: INITIAL_ACCOUNTS
      };
      await setDoc(stateDocRef, sanitizeForFirestore(initialState), { merge: true });
      this.currentState = initialState;
      this.isConnected = true;
      this.lastSyncTime = new Date();
      this.updateStatus('connected');
      this.notifyListeners(initialState);
    } catch (err) {
      if (this.handleQuotaError(err)) return;
      console.warn('Gagal seeding Firestore awal:', err);
    }
  }

  public subscribe(listener: (state: FirestoreWarehouseState) => void): () => void {
    this.listeners.add(listener);
    if (this.currentState) {
      listener(this.currentState);
    }
    return () => this.listeners.delete(listener);
  }

  public subscribeStatus(listener: FirestoreStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.isQuotaExceeded ? 'quota_exceeded' : (this.isConnected ? 'connected' : 'connecting'), this.lastSyncTime);
    return () => this.statusListeners.delete(listener);
  }

  private updateStatus(status: FirestoreStatus) {
    this.statusListeners.forEach((fn) => fn(status, this.lastSyncTime));
  }

  private notifyListeners(state: FirestoreWarehouseState) {
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error('Error notifying Firestore sync listener:', e);
      }
    });
  }

  /**
   * Menyimpan master SKU ke cloud Firestore secara real-time
   * Otomatis memicu onSnapshot di seluruh HP, PC 1, dan PC 2!
   */
  public async pushMasterDatabase(items: MasterSKUItem[]): Promise<boolean> {
    if (!this.db || !Array.isArray(items) || this.isQuotaExceeded) return false;
    try {
      const stateDocRef = doc(this.db, 'warehouse_sync', 'realtime_state');
      const nowIso = new Date().toISOString();
      const sanitizedItems: MasterSKUItem[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        const skuId = String(item.SKU_ID ?? item.BARCODE ?? '').trim();
        const barcode = String(item.BARCODE ?? item.SKU_ID ?? '').trim();
        const skuName = String(item.SKU_NAME ?? '').trim();
        if (!skuId && !barcode) continue;
        const rawHarga = item.HARGA;
        let numHarga = 0;
        if (typeof rawHarga === 'number' && !isNaN(rawHarga)) {
          numHarga = Math.round(rawHarga);
        } else if (rawHarga) {
          const cleanStr = String(rawHarga).replace(/[^0-9]/g, '');
          numHarga = cleanStr ? parseInt(cleanStr, 10) : 0;
        }
        sanitizedItems.push({
          BARCODE: barcode || skuId,
          SKU_ID: skuId || barcode,
          SKU_NAME: skuName || `Produk ${skuId || barcode}`,
          HARGA: numHarga
        });
      }

      await setDoc(
        stateDocRef,
        sanitizeForFirestore({
          masterDatabase: sanitizedItems,
          lastUpdated: nowIso,
          updatedByDeviceId: this.deviceId || 'browser'
        }),
        { merge: true }
      );
      this.lastSyncTime = new Date();
      return true;
    } catch (err) {
      if (this.handleQuotaError(err)) return false;
      console.error('Gagal menyimpan master SKU ke Firestore:', err);
      return false;
    }
  }

  /**
   * Menyimpan / memperbarui hasil unboxing ke Firestore
   */
  public async pushReturns(rows: ProcessedReturnRow[], orderId?: string): Promise<boolean> {
    if (!this.db || !Array.isArray(rows) || this.isQuotaExceeded) return false;
    try {
      const stateDocRef = doc(this.db, 'warehouse_sync', 'realtime_state');
      const nowIso = new Date().toISOString();

      // Gabungkan dengan returns yang ada (replace matching orderId atau prepend)
      const currentReturns = this.currentState?.returns || [];
      let merged: ProcessedReturnRow[];

      if (orderId) {
        const remaining = currentReturns.filter((r) => r.Order_ID !== orderId);
        merged = [...rows, ...remaining];
      } else {
        const orderIds = new Set(rows.map((r) => r.Order_ID));
        const remaining = currentReturns.filter((r) => !orderIds.has(r.Order_ID));
        merged = [...rows, ...remaining];
      }

      await setDoc(
        stateDocRef,
        sanitizeForFirestore({
          returns: merged,
          lastUpdated: nowIso,
          updatedByDeviceId: this.deviceId || 'browser'
        }),
        { merge: true }
      );
      this.lastSyncTime = new Date();
      return true;
    } catch (err) {
      if (this.handleQuotaError(err)) return false;
      console.error('Gagal menyimpan returns ke Firestore:', err);
      return false;
    }
  }

  /**
   * Menimpa seluruh returns (misal setelah hapus massal atau reset)
   */
  public async replaceReturns(rows: ProcessedReturnRow[]): Promise<boolean> {
    if (!this.db || !Array.isArray(rows) || this.isQuotaExceeded) return false;
    try {
      const stateDocRef = doc(this.db, 'warehouse_sync', 'realtime_state');
      const nowIso = new Date().toISOString();
      await setDoc(
        stateDocRef,
        sanitizeForFirestore({
          returns: rows,
          lastUpdated: nowIso,
          updatedByDeviceId: this.deviceId || 'browser'
        }),
        { merge: true }
      );
      this.lastSyncTime = new Date();
      return true;
    } catch (err) {
      if (this.handleQuotaError(err)) return false;
      console.error('Gagal mengganti returns di Firestore:', err);
      return false;
    }
  }

  /**
   * Menghapus baris return spesifik
   */
  public async deleteBulkRows(rowKeys: { orderId: string; skuId: string }[]): Promise<boolean> {
    if (!this.db || !Array.isArray(rowKeys) || rowKeys.length === 0 || this.isQuotaExceeded) return false;
    try {
      const currentReturns = this.currentState?.returns || [];
      const keySet = new Set(rowKeys.map((k) => `${k.orderId}_${k.skuId}`));
      const filtered = currentReturns.filter((r) => !keySet.has(`${r.Order_ID}_${r.SKU_ID}`));

      return await this.replaceReturns(filtered);
    } catch (err) {
      if (this.handleQuotaError(err)) return false;
      console.error('Gagal hapus baris di Firestore:', err);
      return false;
    }
  }

  /**
   * Menyimpan / memperbarui catatan sengketa CS
   */
  public async pushDisputes(disputes: Record<string, any>): Promise<boolean> {
    if (!this.db || typeof disputes !== 'object' || this.isQuotaExceeded) return false;
    try {
      const stateDocRef = doc(this.db, 'warehouse_sync', 'realtime_state');
      const nowIso = new Date().toISOString();
      const currentDisputes = this.currentState?.disputes || {};
      const merged = { ...currentDisputes, ...disputes };

      await setDoc(
        stateDocRef,
        sanitizeForFirestore({
          disputes: merged,
          lastUpdated: nowIso,
          updatedByDeviceId: this.deviceId || 'browser'
        }),
        { merge: true }
      );
      this.lastSyncTime = new Date();
      return true;
    } catch (err) {
      if (this.handleQuotaError(err)) return false;
      console.error('Gagal menyimpan disputes ke Firestore:', err);
      return false;
    }
  }

  /**
   * Menyimpan / memperbarui daftar akun pengguna
   */
  public async pushUsers(users: UserAccount[]): Promise<boolean> {
    if (!this.db || !Array.isArray(users) || this.isQuotaExceeded) return false;
    try {
      const stateDocRef = doc(this.db, 'warehouse_sync', 'realtime_state');
      const nowIso = new Date().toISOString();
      await setDoc(
        stateDocRef,
        sanitizeForFirestore({
          users,
          lastUpdated: nowIso,
          updatedByDeviceId: this.deviceId || 'browser'
        }),
        { merge: true }
      );
      this.lastSyncTime = new Date();
      return true;
    } catch (err) {
      if (this.handleQuotaError(err)) return false;
      console.error('Gagal menyimpan users ke Firestore:', err);
      return false;
    }
  }

  public getCurrentState(): FirestoreWarehouseState | null {
    return this.currentState;
  }
}

type FirestoreWarehouseStateCallback = (state: FirestoreWarehouseState) => void;

export const firestoreSync = new FirestoreSyncService();
