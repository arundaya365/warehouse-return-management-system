import { db } from './index.ts';
import { users, returns, masterSkus, disputes, warehouseMeta } from './schema.ts';
import { eq, inArray, and, or, ne, desc } from 'drizzle-orm';
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
  learnedPrefixes?: Record<string, any>;
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
    const fetchAllWarehouseTables = async () => {
      return await Promise.all([
        db.select().from(users),
        db.select().from(returns).orderBy(desc(returns.id)),
        db.select().from(masterSkus),
        db.select().from(disputes),
        db.select().from(warehouseMeta),
      ]);
    };

    let dbResults;
    try {
      dbResults = await fetchAllWarehouseTables();
    } catch (firstErr: any) {
      const msg = firstErr?.message || String(firstErr);
      if (
        msg.includes('Connection terminated unexpectedly') ||
        msg.includes('write EPIPE') ||
        msg.includes('ECONNRESET')
      ) {
        console.warn('Transient SQL proxy socket drop, retrying with fresh connection...');
        await new Promise((resolve) => setTimeout(resolve, 350));
        dbResults = await fetchAllWarehouseTables();
      } else {
        throw firstErr;
      }
    }

    const [dbUsers, dbReturns, dbMaster, dbDisputes, dbMeta] = dbResults;

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
      BARCODE: m.barcode || m.skuId || '',
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

    const lastUpdatedMeta = dbMeta.find((m) => m.metaKey === 'lastUpdated');
    const lastUpdated = lastUpdatedMeta?.metaValue || new Date().toISOString();

    const learnedMeta = dbMeta.find((m) => m.metaKey === 'learned_awb_prefixes');
    let formattedLearnedPrefixes: Record<string, any> = {};
    if (learnedMeta && learnedMeta.metaValue) {
      try {
        formattedLearnedPrefixes = JSON.parse(learnedMeta.metaValue);
      } catch {}
    }

    return {
      version: 1,
      lastUpdated,
      returns: formattedReturns,
      disputes: formattedDisputes,
      masterDatabase: formattedMaster.length > 0 ? formattedMaster : DEFAULT_MASTER_DATABASE,
      users: formattedUsers.length > 0 ? formattedUsers : INITIAL_ACCOUNTS,
      learnedPrefixes: formattedLearnedPrefixes,
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
    if (!Array.isArray(items) || items.length === 0) {
      const countResult = await db.select().from(masterSkus);
      return countResult.length;
    }

    // Filter, validate, and deduplicate by SKU_ID
    const validMap = new Map<string, { barcode: string; skuId: string; skuName: string; harga: number }>();
    for (const item of items) {
      if (!item) continue;
      const skuId = String(item.SKU_ID ?? item.BARCODE ?? '').trim().toUpperCase();
      const barcode = String(item.BARCODE ?? item.SKU_ID ?? '').trim().toUpperCase();
      const skuName = String(item.SKU_NAME ?? '').trim();
      if (!skuId) continue;

      let numHarga = 0;
      if (typeof item.HARGA === 'number' && !isNaN(item.HARGA)) {
        numHarga = Math.round(item.HARGA);
      } else if (item.HARGA) {
        const cleanStr = String(item.HARGA).replace(/[^0-9]/g, '');
        numHarga = cleanStr ? parseInt(cleanStr, 10) : 0;
      }
      if (isNaN(numHarga) || numHarga < 0) numHarga = 0;

      validMap.set(skuId, {
        barcode: barcode || skuId,
        skuId,
        skuName: skuName || `Produk ${skuId}`,
        harga: numHarga,
      });
    }

    for (const validItem of validMap.values()) {
      await db.insert(masterSkus).values({
        barcode: validItem.barcode,
        skuId: validItem.skuId,
        skuName: validItem.skuName,
        harga: validItem.harga,
      }).onConflictDoUpdate({
        target: masterSkus.skuId,
        set: {
          barcode: validItem.barcode,
          skuName: validItem.skuName,
          harga: validItem.harga,
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

    // Rekonsiliasi penghapusan: Hapus akun di database yang tidak ada di userList (kecuali Yaya Sanjaya yang diproteksi)
    const validCodes = userList.map((u) => u.operatorCode.trim().toUpperCase()).filter(Boolean);
    const validUids = userList.map((u) => u.id.trim()).filter(Boolean);

    const allDbUsers = await db.select().from(users);
    for (const dbUser of allDbUsers) {
      const code = (dbUser.operatorCode || '').trim().toUpperCase();
      const uid = (dbUser.uid || '').trim();

      // Lindungi Super Admin Yaya Sanjaya
      if (code === 'OPR-HQ-01' || uid === 'USR-001') {
        continue;
      }

      if (!validCodes.includes(code) && !validUids.includes(uid)) {
        console.log(`[Cloud SQL] Menghapus akun dari database: ${dbUser.fullName} (${dbUser.operatorCode})`);
        await db.delete(users).where(eq(users.id, dbUser.id));
      }
    }

    await touchLastUpdated();
    const countResult = await db.select().from(users);
    return countResult.length;
  } catch (error) {
    console.error('Error in dbSaveUsers:', error);
    throw new Error('Failed to save users.', { cause: error });
  }
}

/**
 * Hapus satu akun pengguna berdasarkan UID atau Operator Code
 * Super Admin Yaya Sanjaya diproteksi dan tidak dapat dihapus
 */
export async function dbDeleteUser(idOrCode: string): Promise<boolean> {
  await ensureDatabaseSeeded();
  try {
    const clean = (idOrCode || '').trim();
    if (!clean) return false;

    // Proteksi akun Super Admin Yaya Sanjaya
    if (clean === 'USR-001' || clean.toUpperCase() === 'OPR-HQ-01') {
      console.warn('Super Admin Yaya Sanjaya diproteksi dan tidak dapat dihapus.');
      return false;
    }

    await db.delete(users).where(
      or(
        eq(users.uid, clean),
        eq(users.operatorCode, clean)
      )
    );
    await touchLastUpdated();
    return true;
  } catch (error) {
    console.error('Error in dbDeleteUser:', error);
    throw new Error('Failed to delete user.', { cause: error });
  }
}

/**
 * Bersihkan seluruh akun demo lama dari database Cloud SQL, menyisakan Yaya Sanjaya
 */
export async function dbCleanDemoAccounts(): Promise<number> {
  await ensureDatabaseSeeded();
  try {
    const allUsers = await db.select().from(users);
    for (const u of allUsers) {
      const code = (u.operatorCode || '').trim().toUpperCase();
      const uid = (u.uid || '').trim();
      if (code !== 'OPR-HQ-01' && uid !== 'USR-001') {
        console.log(`[Cloud SQL] Membersihkan akun demo: ${u.fullName} (${u.operatorCode})`);
        await db.delete(users).where(eq(users.id, u.id));
      }
    }
    await touchLastUpdated();
    const remaining = await db.select().from(users);
    return remaining.length;
  } catch (error) {
    console.error('Error in dbCleanDemoAccounts:', error);
    throw error;
  }
}

/**
 * Simpan prefix AWB yang dipelajari ke database Cloud SQL (warehouse_meta)
 */
export async function dbSaveLearnedPrefix(
  prefix: string,
  marketplace: string,
  logistics: string
): Promise<Record<string, any>> {
  await ensureDatabaseSeeded();
  try {
    const cleanPrefix = (prefix || '').trim().toUpperCase();
    if (!cleanPrefix) return {};

    const existingMeta = await db
      .select()
      .from(warehouseMeta)
      .where(eq(warehouseMeta.metaKey, 'learned_awb_prefixes'));

    let currentMap: Record<string, any> = {};
    if (existingMeta.length > 0 && existingMeta[0].metaValue) {
      try {
        currentMap = JSON.parse(existingMeta[0].metaValue);
      } catch {}
    }

    currentMap[cleanPrefix] = {
      prefix: cleanPrefix,
      marketplace,
      logistics,
      createdAt: new Date().toISOString()
    };

    const serialized = JSON.stringify(currentMap);
    await db
      .insert(warehouseMeta)
      .values({
        metaKey: 'learned_awb_prefixes',
        metaValue: serialized
      })
      .onConflictDoUpdate({
        target: warehouseMeta.metaKey,
        set: {
          metaValue: serialized
        }
      });

    await touchLastUpdated();
    return currentMap;
  } catch (err) {
    console.error('Error saving learned prefix in dbSaveLearnedPrefix:', err);
    throw err;
  }
}

/**
 * Ambil seluruh prefix AWB yang telah dipelajari dari database Cloud SQL
 */
export async function dbGetLearnedPrefixes(): Promise<Record<string, any>> {
  try {
    const existing = await db
      .select()
      .from(warehouseMeta)
      .where(eq(warehouseMeta.metaKey, 'learned_awb_prefixes'));

    if (existing.length > 0 && existing[0].metaValue) {
      try {
        return JSON.parse(existing[0].metaValue);
      } catch {}
    }
    return {};
  } catch (err) {
    console.warn('Error reading learned prefixes in dbGetLearnedPrefixes:', err);
    return {};
  }
}


