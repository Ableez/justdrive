import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '#/test/db';
import { devices, events, users } from '#/db/schema';
import type { Database } from '#/db/client';
import { recordEvents, recordServerEvent } from './record-event';

let db: Database;
const context = { userId: 'user-1', deviceId: 'device-1', ip: '203.0.113.4' };

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values({ id: 'user-1', googleSub: 'sub-1', email: 'a@b.com' });
  await db.insert(devices).values({ id: 'device-1', userId: 'user-1', name: 'vps-1' });
});

describe('event recording', () => {
  it('stores a batch and counts what was new', async () => {
    const accepted = await recordEvents(db, context, [
      { type: 'upload', path: 'a.txt', bytes: 12, status: 'success' },
      { type: 'download', path: 'b.txt' },
    ]);

    expect(accepted).toBe(2);
    const rows = await db.select().from(events);
    expect(rows.map((row) => row.type).sort()).toEqual(['download', 'upload']);
    expect(rows[0].ip).toBe('203.0.113.4');
  });

  it('treats a replayed client id as the same event', async () => {
    const batch = [{ id: '4b1e0f2a-0000-4000-8000-000000000001', type: 'upload' as const, path: 'a.txt' }];

    expect(await recordEvents(db, context, batch)).toBe(1);
    expect(await recordEvents(db, context, batch)).toBe(0);
    expect(await recordEvents(db, context, [...batch, { type: 'rm' as const, path: 'b.txt' }])).toBe(1);

    const rows = await db.select().from(events);
    expect(rows).toHaveLength(2);
  });

  it('generates an id when the client did not send one', async () => {
    await recordEvents(db, context, [{ type: 'mkdir', path: 'photos' }]);
    const [row] = await db.select().from(events);
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('clamps oversized text and ignores nothing silently', async () => {
    await recordEvents(db, context, [{ type: 'share', path: 'x'.repeat(4000), detail: 'y'.repeat(2000) }]);
    const [row] = await db.select().from(events);

    expect(row.path).toHaveLength(1024);
    expect(row.detail).toHaveLength(500);
  });

  it('records a server-side event with no device', async () => {
    await recordServerEvent(db, { userId: 'user-1', deviceId: null, type: 'google_connected' });
    const [row] = await db.select().from(events).where(eq(events.type, 'google_connected'));

    expect(row.deviceId).toBeNull();
  });

  it('does nothing for an empty batch', async () => {
    expect(await recordEvents(db, context, [])).toBe(0);
  });
});
