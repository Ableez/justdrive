import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '#/test/db';
import { devices, transfers, users } from '#/db/schema';
import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '#/db/client';

const toDevice = alias(devices, 'to_device');
let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values({ id: 'u1', googleSub: 's1', email: 'a@b.com' });
  await db.insert(devices).values([
    { id: 'from', userId: 'u1', name: 'vps-1' },
    { id: 'to', userId: 'u1', name: 'vps-2' },
  ]);
  await db.insert(transfers).values({
    id: 't1',
    userId: 'u1',
    fromDeviceId: 'from',
    toDeviceId: 'to',
    driveFileId: 'f1',
    name: 'db.tar.gz',
  });
});

describe('transfers page query', () => {
  it('joins both devices without an ambiguous alias', async () => {
    const rows = await db
      .select({ transfer: transfers, from: devices.name, to: toDevice.name })
      .from(transfers)
      .leftJoin(devices, eq(devices.id, transfers.fromDeviceId))
      .leftJoin(toDevice, eq(toDevice.id, transfers.toDeviceId))
      .where(eq(transfers.userId, 'u1'))
      .orderBy(desc(transfers.createdAt));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ from: 'vps-1', to: 'vps-2' });
  });
});
