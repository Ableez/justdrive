import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/client';
import { devices, type Device } from '../db/schema';
import { ApiError } from './api-guard';

export interface NewDeviceMeta {
  name: string;
  hostname?: string | null;
  os?: string | null;
  cliVersion?: string | null;
}

export function suggestDeviceName(meta: { name?: string | null; hostname?: string | null }): string {
  const candidate = (meta.name || meta.hostname || 'device').trim().slice(0, 60);
  return candidate.length > 0 ? candidate : 'device';
}

export async function createDevice(db: Database, userId: string, meta: NewDeviceMeta): Promise<Device> {
  const base = suggestDeviceName(meta);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const inserted = await db
      .insert(devices)
      .values({
        id: randomUUID(),
        userId,
        name,
        hostname: meta.hostname ?? null,
        os: meta.os ?? null,
        cliVersion: meta.cliVersion ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) return inserted[0];
  }
  throw new ApiError('Could not pick a free device name', 409);
}

export async function listDevices(db: Database, userId: string) {
  return db
    .select()
    .from(devices)
    .where(eq(devices.userId, userId))
    .orderBy(asc(devices.name));
}

export async function findActiveDeviceByName(db: Database, userId: string, name: string) {
  return db.query.devices.findFirst({
    where: and(eq(devices.userId, userId), eq(devices.name, name), isNull(devices.revokedAt)),
  });
}
