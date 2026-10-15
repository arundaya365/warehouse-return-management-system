import { ProcessedReturnRow } from '../processor';
import { MasterSKUItem } from '../utils/excelTemplate';
import { UserAccount } from '../context/AccountContext';

export interface SyncPayload {
  version: number;
  lastUpdated: string;
  returns: ProcessedReturnRow[];
  disputes: Record<string, any>;
  masterDatabase: MasterSKUItem[];
  users: UserAccount[];
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
   * Simpan unboxing returns ke server
   */
  public async pushReturns(rows: ProcessedReturnRow[], orderId?: string): Promise<boolean> {
    try {
      this.updateStatus('syncing');
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
   * Hapus Order ID dari server
   */
  public async deleteOrder(orderId: string): Promise<boolean> {
    try {
      this.updateStatus('syncing');
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
   * Hapus Baris Return (Order ID + SKU ID) dari server
   */
  public async deleteRow(orderId: string, skuId: string): Promise<boolean> {
    try {
      this.updateStatus('syncing');
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
   * Simpan perubahan klaim dispute CS ke server
   */
  public async pushDisputes(disputes: Record<string, any>): Promise<boolean> {
    try {
      this.updateStatus('syncing');
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
   * Simpan database master SKU ke server
   */
  public async pushMasterDatabase(masterDatabase: MasterSKUItem[]): Promise<boolean> {
    try {
      this.updateStatus('syncing');
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
   * Simpan daftar pengguna / akun ke server
   */
  public async pushUsers(users: UserAccount[]): Promise<boolean> {
    try {
      this.updateStatus('syncing');
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
}

export const syncService = new DataSyncService();
