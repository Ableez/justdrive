import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '#/test/db';
import { devices, deviceAuthRequests, users } from '#/db/schema';
import type { Database } from '#/db/client';
import { claimUserCode, createDeviceAuthRequest, denyUserCode, pollDeviceAuthRequest } from './device-auth';

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values({ id: 'user-1', googleSub: 'sub-1', email: 'a@b.com' });
  await db.insert(devices).values({ id: 'device-1', userId: 'user-1', name: 'vps-1' });
});

describe('device authorization requests', () => {
  it('returns a verification URL carrying the user code', async () => {
    const meta = await createDeviceAuthRequest(db, 'https://drive.astexlabs.com', {
      hostname: 'vps-2',
      os: 'linux',
      cliVersion: '0.2.0',
      requestIp: '203.0.113.4',
    });

    expect(meta.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(meta.verificationUri).toBe('https://drive.astexlabs.com/device');
    expect(meta.verificationUriComplete).toContain(meta.userCode);
    expect(meta.interval).toBeGreaterThan(0);
  });

  it('stays pending until someone approves', async () => {
    const meta = await createDeviceAuthRequest(db, 'https://drive.astexlabs.com', {});

    await expect(pollDeviceAuthRequest(db, meta.deviceCode)).resolves.toEqual({
      status: 'authorization_pending',
    });
  });

  it('tells a too-fast client to slow down', async () => {
    const meta = await createDeviceAuthRequest(db, 'https://drive.astexlabs.com', {});
    await pollDeviceAuthRequest(db, meta.deviceCode);

    await expect(pollDeviceAuthRequest(db, meta.deviceCode)).resolves.toEqual({
      status: 'slow_down',
      interval: meta.interval,
    });
  });

  it('reports the device once approved', async () => {
    const meta = await createDeviceAuthRequest(db, 'https://drive.astexlabs.com', {
      hostname: 'vps-2',
    });
    await expect(claimUserCode(db, meta.userCode, 'user-1', 'vps-2', 'device-1')).resolves.toBe(true);

    await expect(pollDeviceAuthRequest(db, meta.deviceCode)).resolves.toEqual({
      status: 'approved',
      deviceId: 'device-1',
      deviceName: 'vps-2',
      userId: 'user-1',
    });
  });

  it('lets a code be claimed only once', async () => {
    const meta = await createDeviceAuthRequest(db, 'https://drive.astexlabs.com', {});

    await expect(claimUserCode(db, meta.userCode, 'user-1', 'vps-2', 'device-1')).resolves.toBe(true);
    await expect(claimUserCode(db, meta.userCode, 'user-1', 'vps-3', 'device-1')).resolves.toBe(false);
  });

  it('reports a denial', async () => {
    const meta = await createDeviceAuthRequest(db, 'https://drive.astexlabs.com', {});
    await expect(denyUserCode(db, meta.userCode, 'user-1')).resolves.toBe(true);

    await expect(pollDeviceAuthRequest(db, meta.deviceCode)).resolves.toEqual({
      status: 'access_denied',
    });
  });

  it('refuses an unknown or expired code', async () => {
    await expect(pollDeviceAuthRequest(db, 'not-a-real-code')).resolves.toEqual({
      status: 'access_denied',
    });

    const meta = await createDeviceAuthRequest(db, 'https://drive.astexlabs.com', {});
    await db
      .update(deviceAuthRequests)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(deviceAuthRequests.userCode, meta.userCode));

    await expect(pollDeviceAuthRequest(db, meta.deviceCode)).resolves.toEqual({
      status: 'expired_token',
    });
  });
});
