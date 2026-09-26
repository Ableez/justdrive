import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/client';
import { deviceAuthRequests } from '../db/schema';
import { hashToken } from './crypto';
import { DEVICE_CODE_POLL_INTERVAL_SECONDS, DEVICE_CODE_TTL_SECONDS } from './constants';
import { generateDeviceCode, generateUserCode } from './user-code';

export interface DeviceAuthRequestMeta {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export async function createDeviceAuthRequest(
  db: Database,
  baseUrl: string,
  meta: { hostname?: string; os?: string; cliVersion?: string; requestIp?: string },
): Promise<DeviceAuthRequestMeta> {
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const expiresIn = DEVICE_CODE_TTL_SECONDS;

  await db.insert(deviceAuthRequests).values({
    deviceCodeHash: hashToken(deviceCode),
    userCode,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    ...meta,
  });

  const verificationUri = `${baseUrl}/device`;
  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete: `${verificationUri}?user_code=${userCode}`,
    expiresIn,
    interval: DEVICE_CODE_POLL_INTERVAL_SECONDS,
  };
}

export type PollOutcome =
  | { status: 'authorization_pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'access_denied' }
  | { status: 'expired_token' }
  | { status: 'approved'; deviceId: string; deviceName: string; userId: string };

export async function pollDeviceAuthRequest(
  db: Database,
  deviceCode: string,
): Promise<PollOutcome> {
  const hash = hashToken(deviceCode);
  const request = await db.query.deviceAuthRequests.findFirst({
    where: eq(deviceAuthRequests.deviceCodeHash, hash),
  });

  if (!request) return { status: 'access_denied' };
  if (request.expiresAt.getTime() <= Date.now()) {
    return { status: 'expired_token' };
  }

  if (request.status === 'pending') {
    const sinceLastPoll = request.lastPolledAt
      ? Date.now() - request.lastPolledAt.getTime()
      : Infinity;
    const tooFast = sinceLastPoll < DEVICE_CODE_POLL_INTERVAL_SECONDS * 1000;
    await db
      .update(deviceAuthRequests)
      .set({ lastPolledAt: new Date(), pollCount: request.pollCount + 1 })
      .where(eq(deviceAuthRequests.deviceCodeHash, hash));

    return tooFast
      ? { status: 'slow_down', interval: DEVICE_CODE_POLL_INTERVAL_SECONDS }
      : { status: 'authorization_pending' };
  }

  if (request.status === 'denied' || request.status === 'expired') {
    return { status: 'access_denied' };
  }

  if (!request.userId || !request.deviceId) {
    return { status: 'access_denied' };
  }
  return {
    status: 'approved',
    deviceId: request.deviceId,
    deviceName: request.deviceName ?? 'device',
    userId: request.userId,
  };
}

export async function claimUserCode(
  db: Database,
  userCode: string,
  userId: string,
  deviceName: string,
  deviceId: string,
): Promise<boolean> {
  const updated = await db
    .update(deviceAuthRequests)
    .set({ status: 'approved', userId, deviceName, deviceId })
    .where(
      and(
        eq(deviceAuthRequests.userCode, userCode),
        eq(deviceAuthRequests.status, 'pending'),
        isNull(deviceAuthRequests.userId),
      ),
    )
    .returning({ id: deviceAuthRequests.deviceCodeHash });

  return updated.length > 0;
}

export async function denyUserCode(db: Database, userCode: string, userId: string): Promise<boolean> {
  const updated = await db
    .update(deviceAuthRequests)
    .set({ status: 'denied', userId })
    .where(
      and(
        eq(deviceAuthRequests.userCode, userCode),
        eq(deviceAuthRequests.status, 'pending'),
        isNull(deviceAuthRequests.userId),
      ),
    )
    .returning({ id: deviceAuthRequests.deviceCodeHash });

  return updated.length > 0;
}

export async function findPendingRequest(db: Database, userCode: string) {
  return db.query.deviceAuthRequests.findFirst({
    where: and(
      eq(deviceAuthRequests.userCode, userCode),
      eq(deviceAuthRequests.status, 'pending'),
      isNull(deviceAuthRequests.userId),
    ),
  });
}
