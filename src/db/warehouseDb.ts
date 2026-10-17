import { db } from './index.ts';
import { users, returns, masterSkus, disputes, warehouseMeta } from './schema.ts';
import { eq, inArray, and, desc } from 'drizzle-orm';
import type { ProcessedReturnRow, StandardKondisi } from '../processor.ts';
import type { MasterSKUItem } from '../utils/excelTemplate.ts';
import { DEFAULT_MASTER_DATABASE } from '../utils/excelTemplate.ts';
import type { UserAccount } from '../types/account.ts';
import { INITIAL_ACCOUNTS } from '../types/account.ts';
import { SAMPLE_SCENARIOS } from '../data/sampleScenarios.ts';
import { HISTORICAL_RETURN_ROWS } from '../data/historicalReturns.ts';
import { processUnboxingReport } from '../processor.ts';

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

let isSeeded = false;

export async function ensureDatabaseSeeded(): Promise<void> {
  if (isSeeded) return;
  try {
    // 1. Check & seed users
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length === 0) {
      for (const u of INITIAL_ACCOUNTS) {
        await db.insert(users).values({
          uid: u.id,
          email: u.email,
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          department: u.department,
          company: u.company || 'PT. Tirta Kumala Sari',
          operatorCode: u.operatorCode,
          pin: u.pin || '1234',
          status: u.status || 'ACTIVE',
          avatarColor: u.avatarColor || '',
          customPermissions: u.customPermissions ? JSON.stringify(u.customPermissions) : null,
        }).onConflictDoNothing();
      }
    }

    // 2. Check & seed masterSkus
    const existingMaster = await db.select().from(masterSkus).limit(1);
    if (existingMaster.length === 0) {
      for (const m of DEFAULT_MASTER_DATABASE) {
        await db.insert(masterSkus).values({
          barcode: m.BARCODE,
          skuId: m.SKU_ID,
          skuName: m.SKU_NAME,
          harga: m.HARGA || 0,
        }).onConflictDoNothing();
      }
    }

    // 3. Check & seed initial returns
    const existingReturns = await db.select().from(returns).limit(1);
    if (existingReturns.length === 0) {
      const seedReturns = generateInitialSeedReturns();
      for (const r of seedReturns) {
        await db.insert(returns).values({
          waktuProses: r.Waktu_Proses,
          operatorId: r.Operator_ID,
          orderId: r.Order_ID,
          skuId: r.SKU_ID,
          namaBarang: r.Nama_Barang,
          kondisi: r.Kondisi,
          catatanTambahan: r.Catatan_Tambahan || '',
          videoTimestamp: r.Video_Timestamp || '',
          namaFileVideo: r.Nama_File_Video || '',
          linkVideo: r.Link_Video || '',
        });
      }
    }

    // 4. Check & seed warehouse_meta
    const metaTimestamp = await db.select().from(warehouseMeta).where(eq(warehouseMeta.metaKey, 'lastUpdated'));
    if (metaTimestamp.length === 0) {
      await db.insert(warehouseMeta).values({
        metaKey: 'lastUpdated',
        metaValue: new Date().toISOString(),
      }).onConflictDoNothing();
    }

    isSeeded = true;
  } catch (error) {
    console.error('Error during database seeding check:', error);
  }
}

async function touchLastUpdated(): Promise<string> {
  const now = new Date().toISOString();
  try {
    await db.insert(warehouseMeta)
      .values({ metaKey: 'lastUpdated', metaValue: now })
      .onConflictDoUpdate({
        target: warehouseMeta.metaKey,
        set: { metaValue: now, updatedAt: new Date() },
      });
  } catch (err) {
    console.warn('Could not update warehouse_meta lastUpdated:', err);
  }
  return now;
}

export async function getWarehouseData(): Promise<WarehouseSyncData> {
  await ensureDatabaseSeeded();
  try {
    const [dbUsers, dbReturns, dbMaster, dbDisputes, dbMeta] = await Promise.all([
      db.select().from(users),
      db.select().from(returns).orderBy(desc(returns.id)),
      db.select().from(masterSkus),
      db.select().from(disputes),
      db.select().from(warehouseMeta).where(eq(warehouseMeta.metaKey, 'lastUpdated')),
    ]);

    const formattedUsers: UserAccount[] = dbUsers.map((u) => {
      let customPerms = undefined;
      if (u.customPermissions) {
        try {
          customPerms = JSON.parse(u.customPermissions);
        } catch {}
      }
      return {
        id: u.uid || String(u.id),
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        role: u.role as any,
        department: u.department,
        company: u.company || 'PT. Tirta Kumala Sari',
        operatorCode: u.operatorCode,
        pin: u.pin,
        status: (u.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
        avatarColor: u.avatarColor || undefined,
        customPermissions: customPerms,
      };
    });

    const formattedReturns: ProcessedReturnRow[] = dbReturns.map((r) => ({
      Waktu_Proses: r.waktuProses,
      Operator_ID: r.operatorId,
      Order_ID: r.orderId,
      SKU_ID: r.skuId,
      Nama_Barang: r.namaBarang,
      Kondisi: r.kondisi as StandardKondisi,
      Catatan_Tambahan: r.catatanTambahan || '',
      Video_Timestamp: r.videoTimestamp || '',
      Nama_File_Video: r.namaFileVideo || '',
      Link_Video: r.linkVideo || '',
    }));

    const formattedMaster: MasterSKUItem[] = dbMaster.map((m) => ({
      BARCODE: m.barcode,
      SKU_ID: m.skuId,
      SKU_NAME: m.skuName,
      HARGA: m.harga || undefined,
    }));

    const formattedDisputes: Record<string, any> = {};
    for (const d of dbDisputes) {
      try {
        formattedDisputes[d.orderId] = JSON.parse(d.claimData);
      } catch {
        formattedDisputes[d.orderId] = d.claimData;
      }
    }

    const lastUpdated = dbMeta[0]?.metaValue || new Date().toISOString();

    return {
      version: 1,
      lastUpdated,
      returns: formattedReturns,
      disputes: formattedDisputes,
      masterDatabase: formattedMaster.length > 0 ? formattedMaster : DEFAULT_MASTER_DATABASE,
      users: formattedUsers.length > 0 ? formattedUsers : INITIAL_ACCOUNTS,
    };
  } catch (error) {
    console.error('Error in getWarehouseData:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function dbSaveReturns(rows: ProcessedReturnRow[], orderId?: string): Promise<{ count: number; lastUpdated: string }> {
  await ensureDatabaseSeeded();
  try {
    const targetOrderId = orderId || rows[0]?.Order_ID;
    if (targetOrderId) {
      // Remove previous records for this order to replace with updated state
      await db.delete(returns).where(eq(returns.orderId, targetOrderId));
    }

    for (const r of rows) {
      await db.insert(returns).values({
        waktuProses: r.Waktu_Proses,
        operatorId: r.Operator_ID,
        orderId: r.Order_ID,
        skuId: r.SKU_ID,
        namaBarang: r.Nama_Barang,
        kondisi: r.Kondisi,
        catatanTambahan: r.Catatan_Tambahan || '',
        videoTimestamp: r.Video_Timestamp || '',
        namaFileVideo: r.Nama_File_Video || '',
        linkVideo: r.Link_Video || '',
      });
    }

    const lastUpdated = await touchLastUpdated();
    const countResult = await db.select().from(returns);
    return { count: countResult.length, lastUpdated };
  } catch (error) {
    console.error('Error in dbSaveReturns:', error);
    throw new Error('Failed to save returns to database.', { cause: error });
  }
}

export async function dbSetAllReturns(rows: ProcessedReturnRow[]): Promise<{ count: number; lastUpdated: string }> {
  await ensureDatabaseSeeded();
  try {
    await db.delete(returns);
    for (const r of rows) {
      await db.insert(returns).values({
        waktuProses: r.Waktu_Proses,
        operatorId: r.Operator_ID,
        orderId: r.Order_ID,
        skuId: r.SKU_ID,
        namaBarang: r.Nama_Barang,
        kondisi: r.Kondisi,
        catatanTambahan: r.Catatan_Tambahan || '',
        videoTimestamp: r.Video_Timestamp || '',
        namaFileVideo: r.Nama_File_Video || '',
        linkVideo: r.Link_Video || '',
      });
    }
    const lastUpdated = await touchLastUpdated();
    return { count: rows.length, lastUpdated };
  } catch (error) {
    console.error('Error in dbSetAllReturns:', error);
    throw new Error('Failed to replace returns in database.', { cause: error });
  }
}

export async function dbDeleteOrder(orderId: string): Promise<number> {
  await ensureDatabaseSeeded();
  try {
    await db.delete(returns).where(eq(returns.orderId, orderId));
    await touchLastUpdated();
    const countResult = await db.select().from(returns);
    return countResult.length;
  } catch (error) {
    console.error('Error in dbDeleteOrder:', error);
    throw new Error('Failed to delete order from database.', { cause: error });
  }
}

export async function dbDeleteRow(orderId: string, skuId: string): Promise<number> {
  await ensureDatabaseSeeded();
  try {
    await db.delete(returns).where(
      and(eq(returns.orderId, orderId), eq(returns.skuId, skuId))
    );
    await touchLastUpdated();
    const countResult = await db.select().from(returns);
    return countResult.length;
  } catch (error) {
    console.error('Error in dbDeleteRow:', error);
    throw new Error('Failed to delete row from database.', { cause: error });
  }
}

export async function dbDeleteBulkOrders(orderIds: string[]): Promise<number> {
  await ensureDatabaseSeeded();
  try {
    if (orderIds.length > 0) {
      await db.delete(returns).where(inArray(returns.orderId, orderIds));
      await touchLastUpdated();
    }
    const countResult = await db.select().from(returns);
    return countResult.length;
  } catch (error) {
    console.error('Error in dbDeleteBulkOrders:', error);
    throw new Error('Failed to delete bulk orders.', { cause: error });
  }
}

export async function dbDeleteBulkRows(rowKeys: string[]): Promise<number> {
  await ensureDatabaseSeeded();
  try {
    for (const key of rowKeys) {
      const parts = key.split('_');
      if (parts.length >= 2) {
        const orderId = parts[0];
        const skuId = parts.slice(1).join('_');
        await db.delete(returns).where(
          and(eq(returns.orderId, orderId), eq(returns.skuId, skuId))
        );
      }
    }
    await touchLastUpdated();
    const countResult = await db.select().from(returns);
    return countResult.length;
  } catch (error) {
    console.error('Error in dbDeleteBulkRows:', error);
    throw new Error('Failed to delete bulk rows.', { cause: error });
  }
}

export async function dbSaveDisputes(disputesMap: Record<string, any>): Promise<string> {
  await ensureDatabaseSeeded();
  try {
    for (const [orderId, data] of Object.entries(disputesMap)) {
      const strData = typeof data === 'string' ? data : JSON.stringify(data);
      await db.insert(disputes).values({
        orderId,
        claimData: strData,
      }).onConflictDoUpdate({
        target: disputes.orderId,
        set: { claimData: strData, updatedAt: new Date() },
      });
    }
    return await touchLastUpdated();
  } catch (error) {
    console.error('Error in dbSaveDisputes:', error);
    throw new Error('Failed to save disputes.', { cause: error });
  }
}

export async function dbSaveMasterDatabase(items: MasterSKUItem[]): Promise<number> {
  await ensureDatabaseSeeded();
  try {
    for (const item of items) {
      await db.insert(masterSkus).values({
        barcode: item.BARCODE,
        skuId: item.SKU_ID,
        skuName: item.SKU_NAME,
        harga: item.HARGA || 0,
      }).onConflictDoUpdate({
        target: masterSkus.skuId,
        set: {
          barcode: item.BARCODE,
          skuName: item.SKU_NAME,
          harga: item.HARGA || 0,
          updatedAt: new Date(),
        },
      });
    }
    await touchLastUpdated();
    const countResult = await db.select().from(masterSkus);
    return countResult.length;
  } catch (error) {
    console.error('Error in dbSaveMasterDatabase:', error);
    throw new Error('Failed to save master database.', { cause: error });
  }
}

export async function dbSaveUsers(userList: UserAccount[]): Promise<number> {
  await ensureDatabaseSeeded();
  try {
    for (const u of userList) {
      await db.insert(users).values({
        uid: u.id,
        email: u.email,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        department: u.department,
        company: u.company || 'PT. Tirta Kumala Sari',
        operatorCode: u.operatorCode,
        pin: u.pin,
        status: u.status || 'ACTIVE',
        avatarColor: u.avatarColor || '',
        customPermissions: u.customPermissions ? JSON.stringify(u.customPermissions) : null,
      }).onConflictDoUpdate({
        target: users.operatorCode,
        set: {
          email: u.email,
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          department: u.department,
          company: u.company || 'PT. Tirta Kumala Sari',
          pin: u.pin,
          status: u.status || 'ACTIVE',
          avatarColor: u.avatarColor || '',
          customPermissions: u.customPermissions ? JSON.stringify(u.customPermissions) : null,
          updatedAt: new Date(),
        },
      });
    }
    await touchLastUpdated();
    const countResult = await db.select().from(users);
    return countResult.length;
  } catch (error) {
    console.error('Error in dbSaveUsers:', error);
    throw new Error('Failed to save users.', { cause: error });
  }
}
