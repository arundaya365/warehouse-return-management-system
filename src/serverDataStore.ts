import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProcessedReturnRow, processUnboxingReport } from './processor.ts';
import { MasterSKUItem, DEFAULT_MASTER_DATABASE } from './utils/excelTemplate.ts';
import { SAMPLE_SCENARIOS } from './data/sampleScenarios.ts';
import { HISTORICAL_RETURN_ROWS } from './data/historicalReturns.ts';
import { INITIAL_ACCOUNTS, UserAccount } from './context/AccountContext.tsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'warehouse_sync_store.json');

export interface WarehouseSyncData {
  version: number;
  lastUpdated: string;
  returns: ProcessedReturnRow[];
  disputes: Record<string, any>;
  masterDatabase: MasterSKUItem[];
  users: UserAccount[];
}

function generateInitialSeedReturns(): ProcessedReturnRow[] {
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

  return [...initialRows1, ...initialRows2, ...initialRows3, ...HISTORICAL_RETURN_ROWS];
}

function initDataFile(): WarehouseSyncData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const defaultData: WarehouseSyncData = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    returns: generateInitialSeedReturns(),
    disputes: {},
    masterDatabase: DEFAULT_MASTER_DATABASE,
    users: INITIAL_ACCOUNTS
  };

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.returns)) {
        return {
          version: parsed.version || 1,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
          returns: parsed.returns,
          disputes: parsed.disputes || {},
          masterDatabase: Array.isArray(parsed.masterDatabase) ? parsed.masterDatabase : DEFAULT_MASTER_DATABASE,
          users: Array.isArray(parsed.users) ? parsed.users : INITIAL_ACCOUNTS
        };
      }
    }
  } catch (err) {
    console.warn('Gagal membaca warehouse_sync_store.json, menggunakan default:', err);
  }

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Gagal menulis inisialisasi warehouse_sync_store.json:', err);
  }

  return defaultData;
}

// In-memory cache
let inMemoryStore: WarehouseSyncData = initDataFile();

function persistStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    inMemoryStore.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saat menyimpan warehouse_sync_store.json:', err);
  }
}

export const WarehouseStore = {
  getAll(): WarehouseSyncData {
    return inMemoryStore;
  },

  /**
   * Menyimpan / memperbarui baris return hasil unboxing
   */
  saveReturns(rows: ProcessedReturnRow[], orderId?: string): WarehouseSyncData {
    if (!Array.isArray(rows) || rows.length === 0) return inMemoryStore;

    const targetOrderId = orderId || rows[0]?.Order_ID;
    if (targetOrderId) {
      // Hapus data order lama jika ada, ganti dengan yang baru
      const remaining = inMemoryStore.returns.filter((r) => r.Order_ID !== targetOrderId);
      inMemoryStore.returns = [...rows, ...remaining];
    } else {
      inMemoryStore.returns = [...rows, ...inMemoryStore.returns];
    }

    persistStore();
    return inMemoryStore;
  },

  /**
   * Timpa seluruh daftar return (bulk replace / sync dari client)
   */
  setAllReturns(rows: ProcessedReturnRow[]): WarehouseSyncData {
    if (Array.isArray(rows)) {
      inMemoryStore.returns = rows;
      persistStore();
    }
    return inMemoryStore;
  },

  /**
   * Hapus seluruh baris return berdasarkan Order ID
   */
  deleteOrder(orderId: string): WarehouseSyncData {
    if (!orderId) return inMemoryStore;
    inMemoryStore.returns = inMemoryStore.returns.filter((r) => r.Order_ID !== orderId);

    // Bersihkan klaim dispute terkait orderId ini
    if (inMemoryStore.disputes) {
      Object.keys(inMemoryStore.disputes).forEach((k) => {
        if (k.startsWith(orderId)) {
          delete inMemoryStore.disputes[k];
        }
      });
    }

    persistStore();
    return inMemoryStore;
  },

  /**
   * Hapus baris spesifik return (Order ID + SKU ID)
   */
  deleteRow(orderId: string, skuId: string): WarehouseSyncData {
    if (!orderId || !skuId) return inMemoryStore;
    inMemoryStore.returns = inMemoryStore.returns.filter(
      (r) => !(r.Order_ID === orderId && r.SKU_ID === skuId)
    );
    persistStore();
    return inMemoryStore;
  },

  /**
   * Hapus massal beberapa Order ID
   */
  deleteBulkOrders(orderIds: string[]): WarehouseSyncData {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return inMemoryStore;
    const orderSet = new Set(orderIds);
    inMemoryStore.returns = inMemoryStore.returns.filter((r) => !orderSet.has(r.Order_ID));

    if (inMemoryStore.disputes) {
      Object.keys(inMemoryStore.disputes).forEach((k) => {
        if (orderIds.some((oid) => k.startsWith(oid))) {
          delete inMemoryStore.disputes[k];
        }
      });
    }

    persistStore();
    return inMemoryStore;
  },

  /**
   * Hapus massal baris item
   */
  deleteBulkRows(rowKeys: { orderId: string; skuId: string }[]): WarehouseSyncData {
    if (!Array.isArray(rowKeys) || rowKeys.length === 0) return inMemoryStore;
    const keySet = new Set(rowKeys.map((k) => `${k.orderId}_${k.skuId}`));
    inMemoryStore.returns = inMemoryStore.returns.filter(
      (r) => !keySet.has(`${r.Order_ID}_${r.SKU_ID}`)
    );
    persistStore();
    return inMemoryStore;
  },

  /**
   * Simpan / gabung catatan klaim dispute CS
   */
  saveDisputes(disputes: Record<string, any>): WarehouseSyncData {
    if (disputes && typeof disputes === 'object') {
      inMemoryStore.disputes = {
        ...inMemoryStore.disputes,
        ...disputes
      };
      persistStore();
    }
    return inMemoryStore;
  },

  /**
   * Simpan master database SKU
   */
  saveMasterDatabase(data: MasterSKUItem[]): WarehouseSyncData {
    if (Array.isArray(data)) {
      inMemoryStore.masterDatabase = data;
      persistStore();
    }
    return inMemoryStore;
  },

  /**
   * Simpan daftar pengguna / akun
   */
  saveUsers(users: UserAccount[]): WarehouseSyncData {
    if (Array.isArray(users)) {
      inMemoryStore.users = users;
      persistStore();
    }
    return inMemoryStore;
  }
};
