import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { schema } from '#/db/schema';
import type { Database } from '#/db/client';

const migrationDir = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function createTestDb(): Promise<Database> {
  const client = new PGlite();
  for (const file of readdirSync(migrationDir).filter((n) => n.endsWith('.sql')).sort()) {
    await client.exec(readFileSync(`${migrationDir}/${file}`, 'utf8'));
  }
  return drizzle(client, { schema }) as unknown as Database;
}
