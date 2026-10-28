import { ProcessedReturnRow } from '../processor';
import { MasterSKUItem } from '../utils/excelTemplate';
import type { UserAccount } from '../types/account';
import { firestoreSync } from './firestoreSyncService';
import { applyRemoteLearnedPrefixes, saveLearnedAwbPrefix } from '../utils/awbDetection';

export interface SyncPayload {
  version: number;
  lastUpdated: string;
  returns: ProcessedReturnRow[];
  disputes: Record<string, any>;
  masterDatabase: MasterSKUItem[];
  users: UserAccount[];
  learnedPrefixes?: Record<string, any>;
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

type SyncListener = (data: SyncPayload) => void;
type StatusListener = (state: SyncState, lastSyncTime: Date | null) => void;

class DataSyncService {
  private syncListeners: Set<SyncListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private pollingTimer: number | null = null;
  private currentState: SyncState = 'idle';
  private lastSyncTime: Date | null = null;
  private isSyncing = false;
  private lastKnownUpdated: string = '';

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Hubungkan pendengar data cloud Firestore real-time (Mirroring instan HP & PC)
      try {
        firestoreSync.subscribe((cloudState) => {
          if (cloudState && cloudState.lastUpdated) {
            this.notifySyncListeners(cloudState);
          }
        });
      } catch (fErr) {
        console.warn('Firestore subscription warning:', fErr);
      }

      try {
        if ('BroadcastChannel' in window) {
          this.broadcastChannel = new BroadcastChannel('rma_warehouse_sync_channel');
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === 'SYNC_EVENT' && event.data?.payload) {
              this.notifySyncListeners(event.data.payload);
            }
          };
        }
      } catch (err) {
        console.warn('BroadcastChannel tidak didukung di browser ini:', err);
      }

      // Event listener saat tab kembali aktif (misal user beralih dari app lain di HP atau buka browser)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncPull();
        }
      });

      // Event listener saat kembali online
      window.addEventListener('online', () => {
        this.syncPull();
      });

      window.addEventListener('offline', () => {
        this.updateStatus('offline');
      });

      // Mulai polling otomatis setiap 4.5 detik
      this.startPolling(4500);
    }
  }

  public subscribe(onSync: SyncListener): () => void {
    this.syncListeners.add(onSync);
    return () => this.syncListeners.delete(onSync);
  }

  public subscribeStatus(onStatus: StatusListener): () => void {
    this.statusListeners.add(onStatus);
    onStatus(this.currentState, this.lastSyncTime);
    return () => this.statusListeners.delete(onStatus);
  }

  private updateStatus(state: SyncState) {
    this.currentState = state;
    this.statusListeners.forEach((fn) => fn(state, this.lastSyncTime));
  }

  private notifySyncListeners(data: SyncPayload) {
    this.lastSyncTime = new Date();
    this.lastKnownUpdated = data.lastUpdated;
    this.updateStatus('synced');
    if (data.learnedPrefixes && typeof data.learnedPrefixes === 'object') {
      applyRemoteLearnedPrefixes(data.learnedPrefixes);
    }
    this.syncListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (e) {
        console.error('Error in sync listener callback:', e);
      }
    });
  }

  public startPolling(intervalMs: number = 4500) {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.syncPull();
    this.pollingTimer = window.setInterval(() => {
      this.syncPull();
    }, intervalMs);
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Mengambil data terbaru dari server (Pull Sync)
   */
  public async syncPull(): Promise<SyncPayload | null> {
    if (!navigator.onLine) {
      this.updateStatus('offline');
      return null;
    }

    if (this.isSyncing) return null;
    this.isSyncing = true;
    this.updateStatus('syncing');

    try {
      const res = await fetch('/api/sync', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: SyncPayload = await res.json();

      // Cek apakah ada perubahan timestamp
      if (data && data.lastUpdated !== this.lastKnownUpdated) {
        this.notifySyncListeners(data);
      } else {
        this.lastSyncTime = new Date();
        this.updateStatus('synced');
      }

      this.isSyncing = false;
      return data;
    } catch (err) {
      console.warn('Gagal sinkronisasi data dari server:', err);
      this.updateStatus('error');
      this.isSyncing = false;
      return null;
    }
  }

  /**
   * Broadcast perubahan ke tab lain dan trigger pull
   */
  private broadcastChange(payload?: SyncPayload) {
    if (this.broadcastChannel && payload) {
      this.broadcastChannel.postMessage({ type: 'SYNC_EVENT', payload });
    }
  }

  /**
   * Simpan unboxing returns ke cloud Firestore & server
   */
  public async pushReturns(rows: ProcessedReturnRow[], orderId?: string): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      // Push ke Firestore Cloud untuk mirroring instan HP & PC
      firestoreSync.pushReturns(rows, orderId).catch((err) => {
        console.warn('Firestore pushReturns background warning:', err);
      });

      const res = await fetch('/api/sync/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, orderId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal mengirim returns ke server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Hapus Order ID dari cloud & server
   */
  public async deleteOrder(orderId: string): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      const currentReturns = firestoreSync.getCurrentState()?.returns || [];
      const remaining = currentReturns.filter((r) => r.Order_ID !== orderId);
      firestoreSync.replaceReturns(remaining).catch((err) => {
        console.warn('Firestore deleteOrder warning:', err);
      });

      const res = await fetch('/api/sync/delete-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal hapus order di server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Hapus Baris Return (Order ID + SKU ID) dari cloud & server
   */
  public async deleteRow(orderId: string, skuId: string): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      firestoreSync.deleteBulkRows([{ orderId, skuId }]).catch((err) => {
        console.warn('Firestore deleteRow warning:', err);
      });

      const res = await fetch('/api/sync/delete-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, skuId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal hapus baris di server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Hapus massal beberapa Order ID
   */
  public async deleteBulkOrders(orderIds: string[]): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      const currentReturns = firestoreSync.getCurrentState()?.returns || [];
      const idSet = new Set(orderIds);
      const remaining = currentReturns.filter((r) => !idSet.has(r.Order_ID));
      firestoreSync.replaceReturns(remaining).catch((err) => {
        console.warn('Firestore deleteBulkOrders warning:', err);
      });

      const res = await fetch('/api/sync/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal hapus massal order di server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Hapus massal baris item
   */
  public async deleteBulkRows(rowKeys: { orderId: string; skuId: string }[]): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      firestoreSync.deleteBulkRows(rowKeys).catch((err) => {
        console.warn('Firestore deleteBulkRows warning:', err);
      });

      const res = await fetch('/api/sync/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowKeys })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal hapus massal baris di server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Simpan perubahan klaim dispute CS ke cloud Firestore & server
   */
  public async pushDisputes(disputes: Record<string, any>): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      firestoreSync.pushDisputes(disputes).catch((err) => {
        console.warn('Firestore pushDisputes warning:', err);
      });

      const res = await fetch('/api/sync/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputes })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal kirim disputes ke server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Simpan database master SKU ke cloud Firestore & server (Mirroring instan ke HP, PC 1, PC 2)
   */
  public async pushMasterDatabase(masterDatabase: MasterSKUItem[]): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      // Push ke Firestore Cloud
      firestoreSync.pushMasterDatabase(masterDatabase).catch((err) => {
        console.warn('Firestore pushMasterDatabase warning:', err);
      });

      const res = await fetch('/api/sync/master-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterDatabase })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal kirim master SKU ke server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Simpan daftar pengguna / akun ke cloud Firestore & server
   */
  public async pushUsers(users: UserAccount[]): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      firestoreSync.pushUsers(users).catch((err) => {
        console.warn('Firestore pushUsers warning:', err);
      });

      const res = await fetch('/api/sync/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal kirim users ke server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Hapus akun pengguna secara permanen dari Cloud SQL & sinkronkan ke Firestore
   */
  public async deleteUser(userId: string, operatorCode?: string): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      const target = userId || operatorCode;
      if (!target) return false;

      const res = await fetch('/api/sync/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, operatorCode })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal hapus user di server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Bersihkan semua akun demo lama dari Cloud SQL dan sinkronkan ke Firestore
   */
  public async cleanDemoUsers(): Promise<boolean> {
    try {
      this.updateStatus('syncing');
      const res = await fetch('/api/sync/clean-demo-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await this.syncPull();
      return true;
    } catch (err) {
      console.error('Gagal bersihkan akun demo di server:', err);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Simpan prefix AWB yang baru dipelajari ke server Cloud SQL dan localStorage
   */
  public async saveLearnedPrefix(prefix: string, marketplace: string, logistics: string): Promise<boolean> {
    try {
      const cleanPrefix = (prefix || '').trim().toUpperCase();
      if (!cleanPrefix) return false;

      // 1. Simpan ke localStorage lokal
      saveLearnedAwbPrefix(cleanPrefix, marketplace, logistics);

      // 2. Kirim ke backend Cloud SQL
      const res = await fetch('/api/sync/awb-prefix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: cleanPrefix, marketplace, logistics })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.learnedPrefixes) {
          applyRemoteLearnedPrefixes(data.learnedPrefixes);
        }
      }

      return true;
    } catch (err) {
      console.warn('Gagal sinkron learned prefix ke backend:', err);
      return false;
    }
  }
}



export const syncService = new DataSyncService();
