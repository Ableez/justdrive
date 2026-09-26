import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/session.js', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
}));

import { loadSession, saveSession } from '../config/session.js';
import {
  ackTransfer,
  ApiError,
  createTransfer,
  fetchDriveToken,
  fetchTransfers,
  forgetSession,
  getApiUrl,
  listDevices,
  requireSession,
  revokeThisDevice,
} from './client.js';
import { AuthError } from '@juststore/shared';

const session = {
  version: 1 as const,
  apiUrl: 'https://drive.astexlabs.com',
  accessToken: 'jd_at_old',
  accessExpiresAt: Date.now() + 3_600_000,
  refreshToken: 'jd_rt_old',
  deviceId: 'device-1',
  deviceName: 'vps-1',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
  forgetSession();
  vi.mocked(loadSession).mockResolvedValue(session);
  process.env.JUSTDRIVE_API_URL = 'https://drive.astexlabs.com';
});

afterEach(() => {
  delete process.env.JUSTDRIVE_API_URL;
  vi.unstubAllGlobals();
});

describe('api url', () => {
  it('defaults to the hosted service', () => {
    delete process.env.JUSTDRIVE_API_URL;
    expect(getApiUrl()).toBe('https://drive.astexlabs.com');
  });

  it('strips a trailing slash from an override', () => {
    process.env.JUSTDRIVE_API_URL = 'http://localhost:3000/';
    expect(getApiUrl()).toBe('http://localhost:3000');
  });
});

describe('requireSession', () => {
  it('returns the stored session', async () => {
    await expect(requireSession()).resolves.toMatchObject({ deviceName: 'vps-1' });
  });

  it('tells a signed-out user what to run', async () => {
    vi.mocked(loadSession).mockResolvedValue(null);
    await expect(requireSession()).rejects.toThrow(/justdrive login/);
    await expect(requireSession()).rejects.toBeInstanceOf(AuthError);
  });
});

describe('drive token', () => {
  it('sends the device token and caches the root folder', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'ya29.google',
        expires_at: 1_800_000_000_000,
        root_folder_id: 'root-1',
        email: 'a@b.com',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDriveToken()).resolves.toEqual({
      access_token: 'ya29.google',
      expiry_date: 1_800_000_000_000,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://drive.astexlabs.com/api/cli/drive-token');
    expect(init.headers.Authorization).toBe('Bearer jd_at_old');
    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ rootFolderId: 'root-1', email: 'a@b.com' }),
    );
  });

  it('does not rewrite the session when nothing changed', async () => {
    vi.mocked(loadSession).mockResolvedValue({ ...session, rootFolderId: 'root-1', email: 'a@b.com' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ access_token: 'ya29.x', expires_at: 1, root_folder_id: 'root-1', email: 'a@b.com' }),
      ),
    );

    await fetchDriveToken();
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('rotates the device token and retries once after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'jd_at_new', refresh_token: 'jd_rt_new', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'ya29.ok', expires_at: 2, root_folder_id: 'r' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDriveToken()).resolves.toMatchObject({ access_token: 'ya29.ok' });

    expect(fetchMock.mock.calls[1][0]).toBe('https://drive.astexlabs.com/api/cli/token');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'jd_rt_old',
    });
    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'jd_at_new', refreshToken: 'jd_rt_new' }),
    );
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer jd_at_new');
  });

  it('surfaces the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'Google Drive is not connected.' }, 409)),
    );

    await expect(fetchDriveToken()).rejects.toThrow('Google Drive is not connected.');
  });

  it('gives up after one retry instead of looping', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'revoked' }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDriveToken()).rejects.toThrow(/revoked/);
    // One drive-token attempt plus one refresh attempt, then it stops.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with ApiError when the retry also fails without a message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDriveToken()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('listDevices', () => {
  it('unwraps the device list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ devices: [{ id: 'd1', name: 'vps-1', is_self: true, last_seen_at: null }] }),
      ),
    );

    await expect(listDevices()).resolves.toEqual([
      { id: 'd1', name: 'vps-1', is_self: true, last_seen_at: null },
    ]);
  });
});

describe('transfers', () => {
  it('fetches the inbox with the right query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ transfers: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchTransfers(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://drive.astexlabs.com/api/cli/transfers?inbox=1');
  });

  it('creates a transfer for a target device', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 't1' }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createTransfer({ drive_file_id: 'f1', name: 'a.tar.gz', to: 'vps-2', bytes: 5 }),
    ).resolves.toEqual({ id: 't1' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      drive_file_id: 'f1',
      name: 'a.tar.gz',
      to: 'vps-2',
      bytes: 5,
    });
  });

  it('acks a transfer by id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await ackTransfer('t 1');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://drive.astexlabs.com/api/cli/transfers/t%201/ack',
    );
  });

  it('revokes this device on logout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await revokeThisDevice();
    expect(fetchMock.mock.calls[0][0]).toBe('https://drive.astexlabs.com/api/cli/logout');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });
});
