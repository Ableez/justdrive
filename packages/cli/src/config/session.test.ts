import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { clearSession, loadSession, saveSession, type DeviceSession } from './session.js';

let home: string;

const session: DeviceSession = {
  version: 1,
  apiUrl: 'https://justdrive.astexlabs.com',
  accessToken: 'jd_at_access',
  accessExpiresAt: 1_800_000_000_000,
  refreshToken: 'jd_rt_refresh',
  deviceId: 'device-1',
  deviceName: 'vps-1',
};

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'justdrive-session-'));
  process.env.JUSTDRIVE_CONFIG_DIR = home;
});

afterEach(async () => {
  delete process.env.JUSTDRIVE_CONFIG_DIR;
  await fs.rm(home, { recursive: true, force: true });
});

describe('device session', () => {
  it('round-trips a session', async () => {
    await saveSession(session);
    expect(await loadSession()).toEqual(session);
  });

  it('keeps the root folder id and account once learned', async () => {
    await saveSession({ ...session, rootFolderId: 'root-1', email: 'a@b.com' });
    const loaded = await loadSession();

    expect(loaded?.rootFolderId).toBe('root-1');
    expect(loaded?.email).toBe('a@b.com');
  });

  it('returns null when signed out', async () => {
    expect(await loadSession()).toBeNull();
  });

  it('stores the file owner-only', async () => {
    await saveSession(session);
    const mode = (await fs.stat(path.join(home, 'credentials.json'))).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('rejects a corrupt file with a fixable message', async () => {
    await fs.writeFile(path.join(home, 'credentials.json'), 'not json');
    await expect(loadSession()).rejects.toThrow(/corrupt/);
  });

  it('rejects a file missing required fields', async () => {
    await fs.writeFile(path.join(home, 'credentials.json'), JSON.stringify({ version: 1 }));
    await expect(loadSession()).rejects.toThrow(/incomplete/);
  });

  it('clears the session and tolerates it being absent', async () => {
    await saveSession(session);
    await clearSession();
    expect(await loadSession()).toBeNull();
    await expect(clearSession()).resolves.toBeUndefined();
  });
});
