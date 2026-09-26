import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from './schema';

export type Database = NodePgDatabase<typeof schema>;

declare global {
  // The dev server reloads modules; without this every reload leaks a pool.
  // eslint-disable-next-line no-var
  var __justdrivePool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __justdriveDb: Database | undefined;
}

export function createPool(connectionString: string): Pool {
  // Fluid compute reuses containers between invocations, so the pool has to
  // report itself as warm to keep the function from pausing.
  const pool = new Pool({ connectionString, max: 1 });
  attachDatabasePool(pool);
  return pool;
}

export function getDb(): Database {
  if (!globalThis.__justdriveDb) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    if (!globalThis.__justdrivePool) {
      globalThis.__justdrivePool = createPool(process.env.DATABASE_URL);
    }
    globalThis.__justdriveDb = drizzle(globalThis.__justdrivePool, { schema });
  }
  return globalThis.__justdriveDb;
}
