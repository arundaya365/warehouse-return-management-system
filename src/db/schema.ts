import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table (Cloud SQL and App Accounts)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or internal User ID
  email: text('email').notNull(),
  username: text('username').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull(),
  department: text('department').notNull(),
  company: text('company').default('PT. Tirta Kumala Sari'),
  operatorCode: text('operator_code').notNull().unique(),
  pin: text('pin').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  avatarColor: text('avatar_color'),
  customPermissions: text('custom_permissions'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Returns unboxing processed records (Universal mirroring across desktop web and mobile browsers)
export const returns = pgTable('returns', {
  id: serial('id').primaryKey(),
  waktuProses: text('waktu_proses').notNull(),
  operatorId: text('operator_id').notNull(),
  orderId: text('order_id').notNull(),
  skuId: text('sku_id').notNull(),
  namaBarang: text('nama_barang').notNull(),
  kondisi: text('kondisi').notNull(),
  catatanTambahan: text('catatan_tambahan').default(''),
  videoTimestamp: text('video_timestamp').default(''),
  namaFileVideo: text('nama_file_video').default(''),
  linkVideo: text('link_video').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// Master Database SKU items
export const masterSkus = pgTable('master_skus', {
  id: serial('id').primaryKey(),
  barcode: text('barcode').notNull().unique(),
  skuId: text('sku_id').notNull().unique(),
  skuName: text('sku_name').notNull(),
  harga: integer('harga'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Dispute Claims records
export const disputes = pgTable('disputes', {
  id: serial('id').primaryKey(),
  orderId: text('order_id').notNull().unique(),
  claimData: text('claim_data').notNull(), // JSON stringified dispute payload
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Warehouse System Global metadata (versioning & lastUpdated timestamp)
export const warehouseMeta = pgTable('warehouse_meta', {
  id: serial('id').primaryKey(),
  metaKey: text('meta_key').notNull().unique(),
  metaValue: text('meta_value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  returns: many(returns),
}));
