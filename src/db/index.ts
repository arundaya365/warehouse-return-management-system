import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as embeddedDrizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool (Object Method)
export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      port: Number(process.env.SQL_PORT || 5432),
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err: any) => {
      const msg = err?.message || String(err);
      if (
        msg.includes('Connection terminated unexpectedly') ||
        msg.includes('write EPIPE') ||
        msg.includes('ECONNRESET') ||
        msg.includes('socket has been ended')
      ) {
        console.warn('SQL idle client disconnected by proxy timeout; pool will refresh connection on next request.');
      } else {
        console.error('Unexpected error on idle SQL pool client:', err);
      }
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
export const localDatabase = process.env.SQL_DRIVER === 'pglite'
  ? new PGlite(path.resolve(process.env.PGLITE_DATA_DIR || '../local-database'))
  : null;
const embeddedDb = localDatabase ? embeddedDrizzle(localDatabase, { schema }) : null;
if (embeddedDb) {
  await migrate(embeddedDb, { migrationsFolder: path.resolve('drizzle') });
}
export const db = embeddedDb || drizzle(createPool(), { schema });
