'use server';

import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { deviceAuthRequests } from '#/db/schema';
import { createDevice } from '#/lib/devices';
import { claimUserCode, denyUserCode } from '#/lib/device-auth';
import { recordServerEvent } from '#/lib/record-event';
import { requireUserId } from '#/lib/api-guard';
import { ApiError } from '#/lib/api-guard';
import { isValidUserCodeFormat } from '#/lib/user-code';
import { rateLimit } from '#/lib/rate-limit';

export async function approveDevice(formData: FormData): Promise<void> {
  const db = getDb();
  const userId = await requireUserIdOrLogin();
  const userCode = String(formData.get('user_code') ?? '');
  const deviceName = String(formData.get('device_name') ?? '').trim().slice(0, 60);

  if (!isValidUserCodeFormat(userCode)) redirect('/device?error=bad-code');
  if (!rateLimit(`approve:${userId}`, 20).allowed) redirect('/device?error=slow');

  const pending = await db.query.deviceAuthRequests.findFirst({
    where: and(
      eq(deviceAuthRequests.userCode, userCode),
      eq(deviceAuthRequests.status, 'pending'),
      isNull(deviceAuthRequests.userId),
    ),
  });
  if (!pending) redirect('/device?error=expired');

  const device = await createDevice(db, userId, {
    name: deviceName || pending.hostname || 'device',
    hostname: pending.hostname,
    os: pending.os,
    cliVersion: pending.cliVersion,
  });

  const claimed = await claimUserCode(db, userCode, userId, device.name, device.id);
  if (!claimed) redirect('/device?error=expired');

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
  const userCode = String(formData.get('user_code') ?? '');

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
