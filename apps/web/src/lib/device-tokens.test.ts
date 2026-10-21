import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '#/test/db';
import { devices, deviceTokens, users } from '#/db/schema';
import type { Database } from '#/db/client';
import {
  DeviceTokenError,
  issueTokenPair,
  revokeDeviceTokens,
  rotateRefreshToken,
  verifyAccessToken,
} from './device-tokens';

const OLD_KEYS = process.env.TOKEN_ENCRYPTION_KEYS;

let db: Database;

async function seedDevice(revoked = false): Promise<{ userId: string; deviceId: string }> {
  const userId = 'user-1';
  const deviceId = 'device-1';
  await db.insert(users).values({ id: userId, googleSub: 'sub-1', email: 'a@b.com' });
  await db
    .insert(devices)
    .values({ id: deviceId, userId, name: 'vps-1', revokedAt: revoked ? new Date() : null });
  return { userId, deviceId };
}

beforeEach(async () => {
  process.env.TOKEN_ENCRYPTION_KEYS = OLD_KEYS;
  db = await createTestDb();
});

describe('device tokens', () => {
  it('issues a prefixed access and refresh token', async () => {
    const { deviceId } = await seedDevice();
    const tokens = await issueTokenPair(db, deviceId);

    expect(tokens.accessToken.startsWith('jd_at_')).toBe(true);
    expect(tokens.refreshToken.startsWith('jd_rt_')).toBe(true);
    expect(tokens.accessExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('stores only hashes', async () => {
    const { deviceId } = await seedDevice();
    const tokens = await issueTokenPair(db, deviceId);
    const rows = await db.select().from(deviceTokens);

    for (const row of rows) {
      expect(row.tokenHash).not.toContain(tokens.accessToken);
      expect(row.tokenHash).not.toContain(tokens.refreshToken);
    }
  });

  it('verifies a live access token and reports the device', async () => {
    const { userId, deviceId } = await seedDevice();
    const tokens = await issueTokenPair(db, deviceId);

    await expect(verifyAccessToken(db, tokens.accessToken)).resolves.toEqual({
      userId,
      deviceId,
      deviceName: 'vps-1',
    });
  });

  it('rejects unknown, wrong-kind and expired tokens', async () => {
    const { deviceId } = await seedDevice();
    const tokens = await issueTokenPair(db, deviceId);

    await expect(verifyAccessToken(db, 'jd_at_nope')).resolves.toBeNull();
    await expect(verifyAccessToken(db, tokens.refreshToken)).resolves.toBeNull();
    await expect(verifyAccessToken(db, 'some-other-format')).resolves.toBeNull();

    await db
      .update(deviceTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(deviceTokens.kind, 'access'));
    await expect(verifyAccessToken(db, tokens.accessToken)).resolves.toBeNull();
  });

  it('stops honouring a revoked device immediately', async () => {
    const { deviceId } = await seedDevice();
    const tokens = await issueTokenPair(db, deviceId);

    await db.update(devices).set({ revokedAt: new Date() }).where(eq(devices.id, deviceId));
    await expect(verifyAccessToken(db, tokens.accessToken)).resolves.toBeNull();
  });

  it('rotates a refresh token and invalidates the old one', async () => {
    const { deviceId } = await seedDevice();
    const first = await issueTokenPair(db, deviceId);

    const rotated = await rotateRefreshToken(db, first.refreshToken);
    expect(rotated.device.deviceId).toBe(deviceId);
    expect(rotated.tokens.refreshToken).not.toBe(first.refreshToken);
    await expect(verifyAccessToken(db, rotated.tokens.accessToken)).resolves.not.toBeNull();
  });

  it('lets only one of two concurrent rotations win', async () => {
    const { deviceId } = await seedDevice();
    const first = await issueTokenPair(db, deviceId);

    // A thief racing the real client must not be able to launder the token by
    // arriving at the same moment.
    const results = await Promise.allSettled([
      rotateRefreshToken(db, first.refreshToken),
      rotateRefreshToken(db, first.refreshToken),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: 'reuse' });

    // The winner's tokens are dead too, because reuse revoked the family.
    const winner = (fulfilled[0] as { value: { tokens: { accessToken: string } } }).value;
    await expect(verifyAccessToken(db, winner.tokens.accessToken)).resolves.toBeNull();
  });

  it('revokes the whole family when a spent token is replayed', async () => {
    const { userId, deviceId } = await seedDevice();
    const first = await issueTokenPair(db, deviceId);
    const rotated = await rotateRefreshToken(db, first.refreshToken);

    await expect(rotateRefreshToken(db, first.refreshToken)).rejects.toMatchObject({
      code: 'reuse',
    });

    // The attacker holds a token from the same family; it must be dead too.
    await expect(verifyAccessToken(db, rotated.tokens.accessToken)).resolves.toBeNull();
    await expect(rotateRefreshToken(db, rotated.tokens.refreshToken)).rejects.toMatchObject({
      code: 'revoked',
    });
    expect(userId).toBe('user-1');
  });

  it('refuses an expired refresh token', async () => {
    const { deviceId } = await seedDevice();
    const tokens = await issueTokenPair(db, deviceId);
    await db
      .update(deviceTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(deviceTokens.kind, 'refresh'));

    await expect(rotateRefreshToken(db, tokens.refreshToken)).rejects.toMatchObject({
      code: 'expired',
    });
  });

  it('revokes every token for a device', async () => {
    const { deviceId } = await seedDevice();
    const first = await issueTokenPair(db, deviceId);
    const second = await issueTokenPair(db, deviceId);

    await revokeDeviceTokens(db, deviceId);

    await expect(verifyAccessToken(db, first.accessToken)).resolves.toBeNull();
    await expect(verifyAccessToken(db, second.accessToken)).resolves.toBeNull();
  });

  it('rejects a refresh token presented as a bearer token', async () => {
    const { deviceId } = await seedDevice();
    const tokens = await issueTokenPair(db, deviceId);
    await expect(rotateRefreshToken(db, 'garbage')).rejects.toBeInstanceOf(DeviceTokenError);
    await expect(rotateRefreshToken(db, tokens.accessToken)).rejects.toMatchObject({
      code: 'invalid',
    });
  });
});
