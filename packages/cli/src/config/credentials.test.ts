import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  loadCredentials,
  importCredentialsFile,
  parseClientJson,
  resetCredentialsCache,
  getClientFilePath,
} from './credentials.js';

const ENV_KEYS = [
  'JUSTDRIVE_CLIENT_ID',
  'JUSTDRIVE_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'JUSTDRIVE_CREDENTIALS_FILE',
];

const desktopClient = JSON.stringify({
  installed: { client_id: 'file-id.apps.googleusercontent.com', client_secret: 'file-secret' },
});

describe('config/credentials', () => {
  let home: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'justdrive-creds-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    resetCredentialsCache();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    await fs.rm(home, { recursive: true, force: true });
  });

  it('prefers environment variables', async () => {
    process.env.JUSTDRIVE_CLIENT_ID = 'env-id';
    process.env.JUSTDRIVE_CLIENT_SECRET = 'env-secret';
    await expect(loadCredentials()).resolves.toEqual({
      clientId: 'env-id',
      clientSecret: 'env-secret',
      source: 'env',
    });
  });

  it('accepts legacy GOOGLE_* variables', async () => {
    process.env.GOOGLE_CLIENT_ID = 'g-id';
    await expect(loadCredentials()).resolves.toMatchObject({ clientId: 'g-id', source: 'env' });
  });

  it('imports a Desktop client file and loads it owner-only', async () => {
    const downloaded = path.join(home, 'client_secret_x.json');
    await fs.writeFile(downloaded, desktopClient);

    await importCredentialsFile(downloaded);

    await expect(loadCredentials()).resolves.toEqual({
      clientId: 'file-id.apps.googleusercontent.com',
      clientSecret: 'file-secret',
      source: 'file',
    });
    if (process.platform !== 'win32') {
      expect((await fs.stat(getClientFilePath())).mode & 0o777).toBe(0o600);
    }
  });

  it('errors when an explicit credentials file is missing', async () => {
    process.env.JUSTDRIVE_CREDENTIALS_FILE = path.join(home, 'nope.json');
    await expect(loadCredentials()).rejects.toThrow(/Could not read OAuth client file/);
  });

  it('explains setup when nothing is configured, pointing at a downloaded file', async () => {
    await fs.mkdir(path.join(home, 'Downloads'));
    await fs.writeFile(path.join(home, 'Downloads', 'client_secret_abc.json'), desktopClient);

    const error = await loadCredentials().catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/No Google OAuth client configured/);
    expect((error as Error).message).toMatch(/justdrive auth setup ".*client_secret_abc\.json"/);
  });

  it('does not silently use a client file from Downloads', async () => {
    await fs.mkdir(path.join(home, 'Downloads'));
    await fs.writeFile(path.join(home, 'Downloads', 'client_secret_abc.json'), desktopClient);
    await expect(loadCredentials()).rejects.toThrow();
  });

  describe('parseClientJson', () => {
    it('rejects Web application clients with guidance', () => {
      expect(() => parseClientJson(JSON.stringify({ web: { client_id: 'x' } }), 'f.json')).toThrow(
        /Desktop app/,
      );
    });

    it('rejects invalid JSON and unrelated files', () => {
      expect(() => parseClientJson('{', 'f.json')).toThrow(/not valid JSON/);
      expect(() => parseClientJson('{"foo":1}', 'f.json')).toThrow(/missing installed.client_id/);
    });

    it('allows a client without a secret', () => {
      expect(parseClientJson(JSON.stringify({ installed: { client_id: 'id' } }), 'f')).toEqual({
        clientId: 'id',
        clientSecret: undefined,
      });
    });
  });
});
