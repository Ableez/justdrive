'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { devices } from '#/db/schema';
import { createDevice } from '#/lib/devices';
import {
  claimUserCode,
  denyUserCode,
  findPendingRequest,
} from '#/lib/device-auth';
import { recordServerEvent } from '#/lib/record-event';
import { ApiError, requireUserId } from '#/lib/api-guard';
import { isValidUserCodeFormat, normalizeUserCode } from '#/lib/user-code';
import { rateLimit } from '#/lib/rate-limit';

export async function approveDevice(formData: FormData): Promise<void> {
  const db = getDb();
  const userId = await requireUserIdOrLogin();
  const userCode = normalizeUserCode(String(formData.get('user_code') ?? ''));
  const deviceName = String(formData.get('device_name') ?? '').trim().slice(0, 60);

  if (!isValidUserCodeFormat(userCode)) redirect('/device?error=bad-code');
  if (!rateLimit(`approve:${userId}`, 20).allowed) redirect('/device?error=slow');

  const pending = await findPendingRequest(db, userCode);
  if (!pending) redirect('/device?error=expired');

  const device = await createDevice(db, userId, {
    name: deviceName || pending.hostname || 'device',
    hostname: pending.hostname,
    os: pending.os,
    cliVersion: pending.cliVersion,
  });

  const claimed = await claimUserCode(db, userCode, userId, device.name, device.id);
  if (!claimed) {
    // A lost race must not leave a device row the user cannot see or use.
    await db.delete(devices).where(eq(devices.id, device.id));
    redirect('/device?error=expired');
  }

  await recordServerEvent(db, {
    userId,
    deviceId: device.id,
    type: 'device_approved',
    detail: `${device.name} · ${pending.hostname ?? 'unknown host'} · ${pending.requestIp ?? 'unknown ip'}`,
  });

  redirect('/devices?approved=1');
}

export async function denyDevice(formData: FormData): Promise<void> {
  const db = getDb();
  const userId = await requireUserIdOrLogin();
  const userCode = normalizeUserCode(String(formData.get('user_code') ?? ''));

  if (!isValidUserCodeFormat(userCode)) redirect('/device?error=bad-code');
  await denyUserCode(db, userCode, userId);
  redirect('/devices?denied=1');
}

async function requireUserIdOrLogin(): Promise<string> {
  try {
    return await requireUserId();
  } catch (error) {
    if (error instanceof ApiError) redirect('/login?next=/device');
    throw error;
  }
}
