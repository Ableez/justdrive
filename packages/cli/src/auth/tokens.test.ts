import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { saveAuth, loadAuth, loadTokens, updateTokens, clearTokens, getTokenPath } from './tokens.js';
import type { StoredAuth } from '@juststore/shared';

const auth: StoredAuth = {
  version: 1,
  clientId: 'client-1',
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  email: 'user@test.com',
  tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: 1234 },
};

describe('auth/tokens', () => {
  let home: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'justdrive-tokens-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(home, { recursive: true, force: true });
  });

  it('round-trips a saved login', async () => {
    await saveAuth(auth);
    expect(await loadAuth()).toEqual(auth);
    expect(await loadTokens()).toEqual(auth.tokens);
  });

  it.skipIf(process.platform === 'win32')('writes the token file and config dir owner-only', async () => {
    await saveAuth(auth);
    const fileMode = (await fs.stat(getTokenPath())).mode & 0o777;
    const dirMode = (await fs.stat(path.dirname(getTokenPath()))).mode & 0o777;
    expect(fileMode).toBe(0o600);
    expect(dirMode).toBe(0o700);
  });

  it('tightens a config dir created world-readable by older versions', async () => {
    await fs.mkdir(path.dirname(getTokenPath()), { mode: 0o755 });
    await saveAuth(auth);
    const dirMode = (await fs.stat(path.dirname(getTokenPath()))).mode & 0o777;
    if (process.platform !== 'win32') expect(dirMode).toBe(0o700);
  });

  it('returns null when not logged in', async () => {
    expect(await loadAuth()).toBeNull();
  });

  it('reads the legacy bare-token format', async () => {
    await fs.mkdir(path.dirname(getTokenPath()), { recursive: true });
    await fs.writeFile(
      getTokenPath(),
      JSON.stringify({ access_token: 'at', refresh_token: 'rt', scope: 'a b' }),
    );

    const loaded = await loadAuth();
    expect(loaded).toMatchObject({ version: 1, clientId: '', scopes: ['a', 'b'] });
    expect(loaded?.tokens.refresh_token).toBe('rt');
  });

  it('surfaces read errors other than a missing file', async () => {
    await fs.mkdir(getTokenPath(), { recursive: true });
    await expect(loadAuth()).rejects.toThrow(/EISDIR/);
  });

  it('throws an AuthError for a corrupted file', async () => {
    await fs.mkdir(path.dirname(getTokenPath()), { recursive: true });
    await fs.writeFile(getTokenPath(), 'not json');
    await expect(loadAuth()).rejects.toThrow(/corrupted/);
  });

  it('merges refreshed tokens without dropping the refresh token', async () => {
    await saveAuth(auth);
    await updateTokens({ access_token: 'new_at', expiry_date: 9999, refresh_token: undefined });

    const loaded = await loadAuth();
    expect(loaded?.tokens).toEqual({ access_token: 'new_at', refresh_token: 'rt', expiry_date: 9999 });
    expect(loaded?.email).toBe('user@test.com');
  });

  it('updateTokens is a no-op when logged out', async () => {
    await updateTokens({ access_token: 'x' });
    expect(await loadAuth()).toBeNull();
  });

  it('clearTokens removes the file and tolerates it missing', async () => {
    await saveAuth(auth);
    await clearTokens();
    expect(await loadAuth()).toBeNull();
    await expect(clearTokens()).resolves.toBeUndefined();
  });
});
