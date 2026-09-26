import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import type { Database } from '../db/client';
import { deviceTokens, devices } from '../db/schema';
import { hashToken } from './crypto';
import {
  DEVICE_ACCESS_TOKEN_TTL_SECONDS,
  DEVICE_REFRESH_TOKEN_TTL_DAYS,
} from './constants';

const ACCESS_PREFIX = 'jd_at_';
const REFRESH_PREFIX = 'jd_rt_';

export class DeviceTokenError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid' | 'expired' | 'revoked' | 'reuse',
  ) {
    super(message);
    this.name = 'DeviceTokenError';
  }
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

function mint(prefix: string): string {
  return prefix + randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

function accessExpiry(): Date {
  return new Date(Date.now() + DEVICE_ACCESS_TOKEN_TTL_SECONDS * 1000);
}

function refreshExpiry(): Date {
  return new Date(Date.now() + DEVICE_REFRESH_TOKEN_TTL_DAYS * 86_400_000);
}

export async function issueTokenPair(
  db: Database,
  deviceId: string,
  familyId: string = randomUUID(),
): Promise<TokenPair> {
  const accessToken = mint(ACCESS_PREFIX);
  const refreshToken = mint(REFRESH_PREFIX);
  const accessExpiresAt = accessExpiry();
  const refreshExpiresAt = refreshExpiry();

  await db.insert(deviceTokens).values([
    {
      id: randomUUID(),
      deviceId,
      kind: 'access',
      tokenHash: hashToken(accessToken),
      familyId,
      expiresAt: accessExpiresAt,
    },
    {
      id: randomUUID(),
      deviceId,
      kind: 'refresh',
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
    },
  ]);

  return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
}

export interface VerifiedDevice {
  userId: string;
  deviceId: string;
  deviceName: string;
}

export async function verifyAccessToken(
  db: Database,
  presented: string,
): Promise<VerifiedDevice | null> {
  if (!presented.startsWith(ACCESS_PREFIX)) return null;

  const row = await db.query.deviceTokens.findFirst({
    where: and(
      eq(deviceTokens.tokenHash, hashToken(presented)),
      eq(deviceTokens.kind, 'access'),
    ),
    with: { device: true },
  });

  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null;
  if (row.device.revokedAt) return null;

  return {
    userId: row.device.userId,
    deviceId: row.deviceId,
    deviceName: row.device.name,
  };
}

function reusedTokenError(): DeviceTokenError {
  return new DeviceTokenError(
    'A spent device token was replayed, so this device session was revoked. Run: justdrive login',
    'reuse',
  );
}

export async function rotateRefreshToken(
  db: Database,
  presented: string,
): Promise<{ device: VerifiedDevice; tokens: TokenPair }> {
  if (!presented.startsWith(REFRESH_PREFIX)) {
    throw new DeviceTokenError('Unrecognized device token', 'invalid');
  }

  const row = await db.query.deviceTokens.findFirst({
    where: and(
      eq(deviceTokens.tokenHash, hashToken(presented)),
      eq(deviceTokens.kind, 'refresh'),
    ),
    with: { device: true },
  });

  if (!row) throw new DeviceTokenError('Unrecognized device token', 'invalid');
  if (row.revokedAt || row.device.revokedAt) {
    throw new DeviceTokenError('This device has been revoked', 'revoked');
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new DeviceTokenError('Device session expired. Run: justdrive login', 'expired');
  }

  if (row.usedAt) {
    await revokeFamily(db, row.familyId ?? row.id);
    throw reusedTokenError();
  }

  // The write is the gate, not the read above: two concurrent rotations of the
  // same token must not both succeed, or a stolen token could race the real one
  // and never trip reuse detection.
  const claimed = await db
    .update(deviceTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(deviceTokens.id, row.id), isNull(deviceTokens.usedAt)))
    .returning({ id: deviceTokens.id });

  if (claimed.length === 0) {
    await revokeFamily(db, row.familyId ?? row.id);
    throw reusedTokenError();
  }

  const tokens = await issueTokenPair(db, row.deviceId, row.familyId ?? row.id);

  return {
    device: {
      userId: row.device.userId,
      deviceId: row.deviceId,
      deviceName: row.device.name,
    },
    tokens,
  };
}

export async function revokeFamily(db: Database, familyId: string): Promise<void> {
  await db
    .update(deviceTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(deviceTokens.familyId, familyId), isNull(deviceTokens.revokedAt)));
}

export async function revokeDeviceTokens(db: Database, deviceId: string): Promise<void> {
  await db
    .update(deviceTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(deviceTokens.deviceId, deviceId), isNull(deviceTokens.revokedAt)));
}

export async function pruneExpiredTokens(db: Database): Promise<void> {
  await db.delete(deviceTokens).where(lt(deviceTokens.expiresAt, new Date()));
}

export async function touchDevice(
  db: Database,
  deviceId: string,
  ip: string | null,
): Promise<void> {
  const recent = new Date(Date.now() - 5 * 60_000);
  await db
    .update(devices)
    .set({ lastSeenAt: new Date(), lastIp: ip })
    .where(
      and(
        eq(devices.id, deviceId),
        or(isNull(devices.lastSeenAt), lt(devices.lastSeenAt, recent)),
      ),
    );
}
