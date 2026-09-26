'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { googleConnections, users } from '#/db/schema';
import { open } from '#/lib/crypto';
import { markConnectionRevoked, revokeToken } from '#/lib/google';
import { recordServerEvent } from '#/lib/record-event';
import { requireUserId } from '#/lib/api-guard';
import { deleteAllSessions } from '#/lib/session';
import { devices } from '#/db/schema';

export async function disconnectGoogle(): Promise<void> {
  const db = getDb();
  const userId = await requireUserId();

  const connection = await db.query.googleConnections.findFirst({
    where: eq(googleConnections.userId, userId),
  });
  if (connection) {
    try {
      await revokeToken(open(connection.refreshTokenEnc, userId));
    } catch {
      // The grant may already be gone at Google.
    }
    await markConnectionRevoked(db, userId);
  }

  await db.update(users).set({ driveRootFolderId: null }).where(eq(users.id, userId));
  await recordServerEvent(db, { userId, deviceId: null, type: 'google_disconnected' });
  redirect('/settings?disconnected=1');
}

export async function deleteAccount(): Promise<void> {
  const db = getDb();
  const userId = await requireUserId();

  const connection = await db.query.googleConnections.findFirst({
    where: eq(googleConnections.userId, userId),
  });
  if (connection) {
    try {
      await revokeToken(open(connection.refreshTokenEnc, userId));
    } catch {
      // Nothing to revoke at Google.
    }
  }

  const owned = await db.select({ id: devices.id }).from(devices).where(eq(devices.userId, userId));
  for (const device of owned) {
    await db.update(devices).set({ revokedAt: new Date() }).where(eq(devices.id, device.id));
  }

  await db.delete(googleConnections).where(eq(googleConnections.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await deleteAllSessions(db, userId);
  redirect('/');
}
