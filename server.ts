import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { processUnboxingReport } from './src/processor.ts';
import type { UnboxingSessionInput, StandardKondisi } from './src/processor.ts';
import { WarehouseStore } from './src/serverDataStore.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Inisialisasi Gemini AI jika key tersedia
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Gemini client initialization warning:', err);
  }
}

/**
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Backend Logic Processor - Sistem Aplikasi Retur Gudang e-Commerce',
    geminiEnabled: Boolean(aiClient),
    timestamp: new Date().toISOString()
  });
});

/**
 * Endpoint Utama: Memproses sesi unboxing
 * Menerima payload dari frontend dan mengembalikan FORMAT OUTPUT WAJIB (JSON ARRAY murni).
 */
app.post('/api/process-unboxing', async (req: Request, res: Response) => {
  try {
    const payload: UnboxingSessionInput = req.body;

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Payload harus berupa JSON object sesi unboxing' });
      return;
    }

    const transcript = String(
      payload.audio_transcript || payload.Audio_Transcript || payload.transcript || ''
    ).trim();

    // Jika ada transcript dan Gemini AI aktif, gunakan Gemini untuk ekstraksi ucapan tingkat lanjut
    if (transcript && aiClient) {
      try {
        const expectedItems = payload.Expected_SKUs || payload.expected_skus || payload.expectedSkus || [];
        const prompt = `Anda adalah asisten gudang e-commerce. Analisis ucapan operator unboxing berikut:
"${transcript}"

Daftar barang pesanan:
${JSON.stringify(expectedItems, null, 2)}

Ekstrak status kondisi untuk setiap barang yang disebutkan.
Status kondisi HANYA boleh salah satu dari: "Good", "Damage Product", "Damage Packaging", "Missing", "Unexpected".
Berikan catatan tambahan yang jelas dan faktual berdasarkan ucapan operator.`;

        const geminiCall = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sku_id: { type: Type.STRING },
                  kondisi: {
                    type: Type.STRING,
                    description: 'HANYA: Good, Damage Product, Damage Packaging, Missing, atau Unexpected'
                  },
                  catatan: { type: Type.STRING, description: 'Deskripsi ringkas temuan dari ucapan' }
                },
                required: ['sku_id', 'kondisi', 'catatan']
              }
            }
          }
        });

        // Batasi maksimal 4.5 detik agar API responsif
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini timeout')), 4500)
        );

        const response = await Promise.race([geminiCall, timeoutPromise]);

        if (response && response.text) {
          const aiParsed = JSON.parse(response.text.trim()) as Array<{
            sku_id: string;
            kondisi: string;
            catatan: string;
          }>;

          // Perkaya scanned_skus dengan hasil analisis AI jika belum ada
          const scannedList = (payload.Scanned_SKUs || payload.scanned_skus || payload.scannedSkus || []) as Array<Record<string, unknown>>;
          for (const item of aiParsed) {
            const found = scannedList.find(s => 
              String(s.SKU_ID || s.sku_id || s.sku || '').toLowerCase() === item.sku_id.toLowerCase()
            );
            if (found) {
              if (!found.Kondisi && !found.kondisi) {
                found.Kondisi = item.kondisi;
              }
              const oldNote = String(found.Catatan_Tambahan || found.catatan || '');
              found.Catatan_Tambahan = oldNote ? `${oldNote} (Audio AI: ${item.catatan})` : item.catatan;
            }
          }
        }
      } catch (aiErr) {
        // Fallback gracefully ke rule-based processor jika Gemini API gagal atau rate limit
        console.warn('Gemini audio transcript analysis skipped, falling back to rule-based engine:', aiErr);
      }
    }

    // Jalankan pemrosesan aturan wajib 1 - 6
    const processedRows = processUnboxingReport(payload);

    // Otomatis sinkronkan hasil unboxing ke database bersama Cloud SQL (Web & Mobile)
    try {
      const orderId = payload.Order_ID || payload.order_id;
      WarehouseStore.saveReturns(processedRows, orderId);
      dbSaveReturns(processedRows, orderId).catch((dbErr) => {
        console.warn('Gagal async save return ke PostgreSQL Cloud SQL:', dbErr);
      });
    } catch (saveErr) {
      console.warn('Gagal sinkron otomatis return ke WarehouseStore:', saveErr);
    }


    // KEMBALIKAN FORMAT OUTPUT WAJIB: JSON ARRAY murni
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(processedRows);
  } catch (error) {
    console.error('Error processing unboxing payload:', error);
    res.status(500).json({
      error: 'Gagal memproses sesi unboxing',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

import {
  getWarehouseData,
  dbSaveReturns,
  dbSetAllReturns,
  dbDeleteOrder,
  dbDeleteRow,
  dbDeleteBulkOrders,
  dbDeleteBulkRows,
  dbSaveDisputes,
  dbSaveMasterDatabase,
  dbSaveUsers,
  dbDeleteUser,
  dbCleanDemoAccounts,
  dbSaveLearnedPrefix,
  dbGetLearnedPrefixes,
  ensureDatabaseSeeded
} from './src/db/warehouseDb.ts';

// Inisialisasi seeding database di background
ensureDatabaseSeeded().catch((err) => {
  console.warn('Database seeding check deferred:', err);
});

/**
 * =========================================================================
 * ENDPOINTS SINKRONISASI DATA MULTI-PERANGKAT (WEB BROWSER & MOBILE BROWSER)
 * DENGAN CLOUD SQL POSTGRESQL (PERSISTENSI LINTAS DEVICE)
 * =========================================================================
 */

// 1. Ambil seluruh data pusat gudang (Returns, Disputes, Master SKU, Users)
app.get('/api/sync', async (_req: Request, res: Response) => {
  try {
    const data = await getWarehouseData();
    res.json(data);
  } catch (error) {
    console.warn('Fallback to in-memory store for /api/sync:', error);
    try {
      const fallbackData = WarehouseStore.getAll();
      res.json(fallbackData);
    } catch (fbErr) {
      res.status(500).json({ error: 'Gagal membaca data sinkronisasi server' });
    }
  }
});

// 2. Simpan / perbarui baris return hasil unboxing
app.post('/api/sync/returns', async (req: Request, res: Response) => {
  try {
    const { rows, orderId } = req.body;
    if (!Array.isArray(rows)) {
      res.status(400).json({ error: 'rows harus berupa array data return' });
      return;
    }
    // Simpan ke PostgreSQL Cloud SQL
    const result = await dbSaveReturns(rows, orderId);
    // Simpan juga ke in-memory cache
    WarehouseStore.saveReturns(rows, orderId);
    res.json({ success: true, count: result.count, lastUpdated: result.lastUpdated });
  } catch (error) {
    console.error('Error saving returns to database, fallback in-memory:', error);
    try {
      const { rows, orderId } = req.body;
      const updated = WarehouseStore.saveReturns(rows, orderId);
      res.json({ success: true, count: updated.returns.length, lastUpdated: updated.lastUpdated });
    } catch (fbErr) {
      res.status(500).json({ error: 'Gagal sinkron data return' });
    }
  }
});

// 3. Timpa seluruh daftar return (bulk sync / full refresh)
app.post('/api/sync/replace-returns', async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      res.status(400).json({ error: 'rows harus berupa array' });
      return;
    }
    const result = await dbSetAllReturns(rows);
    WarehouseStore.setAllReturns(rows);
    res.json({ success: true, count: result.count, lastUpdated: result.lastUpdated });
  } catch (error) {
    console.error('Error replacing returns:', error);
    try {
      const { rows } = req.body;
      const updated = WarehouseStore.setAllReturns(rows);
      res.json({ success: true, count: updated.returns.length, lastUpdated: updated.lastUpdated });
    } catch (fbErr) {
      res.status(500).json({ error: 'Gagal sinkron full returns' });
    }
  }
});

// 4. Hapus order spesifik
app.post('/api/sync/delete-order', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      res.status(400).json({ error: 'orderId wajib diisi' });
      return;
    }
    const count = await dbDeleteOrder(orderId);
    WarehouseStore.deleteOrder(orderId);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error deleting order:', error);
    try {
      const updated = WarehouseStore.deleteOrder(req.body.orderId);
      res.json({ success: true, count: updated.returns.length });
    } catch (fbErr) {
      res.status(500).json({ error: 'Gagal menghapus order dari server' });
    }
  }
});

// 5. Hapus baris spesifik (orderId + skuId)
app.post('/api/sync/delete-row', async (req: Request, res: Response) => {
  try {
    const { orderId, skuId } = req.body;
    if (!orderId || !skuId) {
      res.status(400).json({ error: 'orderId dan skuId wajib diisi' });
      return;
    }
    const count = await dbDeleteRow(orderId, skuId);
    WarehouseStore.deleteRow(orderId, skuId);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error deleting row:', error);
    try {
      const updated = WarehouseStore.deleteRow(req.body.orderId, req.body.skuId);
      res.json({ success: true, count: updated.returns.length });
    } catch (fbErr) {
      res.status(500).json({ error: 'Gagal menghapus baris dari server' });
    }
  }
});

// 6. Hapus massal (bulk delete orders atau rows)
app.post('/api/sync/bulk-delete', async (req: Request, res: Response) => {
  try {
    const { orderIds, rowKeys } = req.body;
    let count = 0;
    if (Array.isArray(orderIds) && orderIds.length > 0) {
      count = await dbDeleteBulkOrders(orderIds);
      WarehouseStore.deleteBulkOrders(orderIds);
    } else if (Array.isArray(rowKeys) && rowKeys.length > 0) {
      count = await dbDeleteBulkRows(rowKeys);
      WarehouseStore.deleteBulkRows(rowKeys);
    } else {
      res.status(400).json({ error: 'orderIds atau rowKeys wajib diisi' });
      return;
    }
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error bulk delete:', error);
    res.status(500).json({ error: 'Gagal hapus massal di server' });
  }
});

// 7. Simpan / perbarui catatan dispute claims CS
app.post('/api/sync/disputes', async (req: Request, res: Response) => {
  try {
    const { disputes } = req.body;
    if (!disputes || typeof disputes !== 'object') {
      res.status(400).json({ error: 'disputes harus berupa object' });
      return;
    }
    let lastUpdated: string | null = null;
    try {
      lastUpdated = await dbSaveDisputes(disputes);
    } catch (dbErr) {
      console.warn('Database save warning (disputes), falling back to WarehouseStore:', dbErr);
    }
    const updated = WarehouseStore.saveDisputes(disputes);
    res.json({ success: true, lastUpdated: lastUpdated || updated.lastUpdated });
  } catch (error) {
    console.error('Error saving disputes:', error);
    res.status(500).json({ error: 'Gagal sinkron disputes' });
  }
});

// 8. Simpan / perbarui database master SKU
app.post('/api/sync/master-db', async (req: Request, res: Response) => {
  try {
    const { masterDatabase } = req.body;
    if (!Array.isArray(masterDatabase)) {
      res.status(400).json({ error: 'masterDatabase harus berupa array' });
      return;
    }
    let count = 0;
    try {
      count = await dbSaveMasterDatabase(masterDatabase);
    } catch (dbErr) {
      console.warn('Database save warning (master-db), falling back to WarehouseStore:', dbErr);
    }
    const updated = WarehouseStore.saveMasterDatabase(masterDatabase);
    res.json({
      success: true,
      count: count || updated.masterDatabase.length,
      lastUpdated: updated.lastUpdated
    });
  } catch (error) {
    console.error('Error saving master database:', error);
    res.status(500).json({ error: 'Gagal sinkron master database' });
  }
});

// 9. Simpan / perbarui pengguna
app.post('/api/sync/users', async (req: Request, res: Response) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users)) {
      res.status(400).json({ error: 'users harus berupa array' });
      return;
    }
    let count = 0;
    try {
      count = await dbSaveUsers(users);
    } catch (dbErr) {
      console.warn('Database save warning (users), falling back to WarehouseStore:', dbErr);
    }
    const updated = WarehouseStore.saveUsers(users);
    res.json({
      success: true,
      count: count || updated.users.length,
      lastUpdated: updated.lastUpdated
    });
  } catch (error) {
    console.error('Error saving users:', error);
    res.status(500).json({ error: 'Gagal sinkron users' });
  }
});

// 10. Hapus akun pengguna secara permanen lintas perangkat
app.post('/api/sync/delete-user', async (req: Request, res: Response) => {
  try {
    const { userId, operatorCode } = req.body;
    const target = userId || operatorCode;
    if (!target) {
      res.status(400).json({ error: 'userId atau operatorCode wajib disertakan' });
      return;
    }

    const clean = String(target).trim();
    if (clean === 'USR-001' || clean.toUpperCase() === 'OPR-HQ-01') {
      res.status(403).json({ error: 'Akun Super Admin Yaya Sanjaya dilindungi dan tidak dapat dihapus' });
      return;
    }

    try {
      await dbDeleteUser(clean);
    } catch (dbErr) {
      console.warn('Database delete warning (user), falling back to in-memory:', dbErr);
    }

    const updated = WarehouseStore.deleteUser(clean);
    res.json({
      success: true,
      remainingCount: updated.users.length,
      lastUpdated: updated.lastUpdated
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Gagal menghapus akun pengguna' });
  }
});

// 11. Bersihkan seluruh akun demo lama (hanya menyisakan Yaya Sanjaya)
app.post('/api/sync/clean-demo-users', async (_req: Request, res: Response) => {
  try {
    let count = 1;
    try {
      count = await dbCleanDemoAccounts();
    } catch (dbErr) {
      console.warn('dbCleanDemoAccounts warning, falling back to in-memory:', dbErr);
    }
    const updated = WarehouseStore.saveUsers([
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
    ]);
    res.json({
      success: true,
      remainingCount: count || updated.users.length,
      lastUpdated: updated.lastUpdated
    });
  } catch (error) {
    console.error('Error cleaning demo users:', error);
    res.status(500).json({ error: 'Gagal membersihkan akun demo' });
  }
});

// 12. Simpan prefix AWB yang dipelajari ke database Cloud SQL dan in-memory store
app.post('/api/sync/awb-prefix', async (req: Request, res: Response) => {
  try {
    const { prefix, marketplace, logistics } = req.body;
    const cleanPrefix = String(prefix || '').trim().toUpperCase();
    if (!cleanPrefix) {
      res.status(400).json({ error: 'Prefix resi wajib disertakan' });
      return;
    }

    let learned: Record<string, any> = {};
    try {
      learned = await dbSaveLearnedPrefix(cleanPrefix, String(marketplace || 'Lainnya'), String(logistics || 'Lainnya'));
    } catch (dbErr) {
      console.warn('Database save warning (awb-prefix), falling back to in-memory:', dbErr);
    }

    const updated = WarehouseStore.saveLearnedPrefix(cleanPrefix, String(marketplace || 'Lainnya'), String(logistics || 'Lainnya'));
    res.json({
      success: true,
      learnedPrefixes: (Object.keys(learned).length > 0 ? learned : updated.learnedPrefixes) || {},
      lastUpdated: updated.lastUpdated
    });
  } catch (error) {
    console.error('Error saving learned awb prefix:', error);
    res.status(500).json({ error: 'Gagal menyimpan prefix resi' });
  }
});




// Setup Vite atau Static File serving
async function initServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend Logic Processor Server running at http://0.0.0.0:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
