import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refreshHandler: { current: (() => Promise<unknown>) | null } = { current: null };
const setCredentials = vi.fn();
const oauthClient = {
  credentials: {} as Record<string, unknown>,
  setCredentials,
  options: {} as Record<string, unknown>,
  set refreshHandler(value: () => Promise<unknown>) {
    refreshHandler.current = value;
  },
  get refreshHandler(): (() => Promise<unknown>) | null {
    return refreshHandler.current;
  },
};

const googleDrive = vi.fn(() => ({}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn((options: Record<string, unknown> = {}) => {
        oauthClient.options = options;
        return oauthClient;
      }),
    },
    drive: (...args: unknown[]) => googleDrive(...(args as [])),
  },
}));

const fetchDriveToken = vi.fn();
const clearCache = vi.fn();
vi.mock('../api/client.js', () => ({ fetchDriveToken: () => fetchDriveToken() }));
vi.mock('./cache.js', () => ({ clearCache: () => clearCache() }));

import { google } from 'googleapis';
import { getDriveClient, resetDriveClient } from './client.js';

beforeEach(() => {
  vi.clearAllMocks();
  resetDriveClient();
  refreshHandler.current = null;
});

afterEach(() => {
  resetDriveClient();
});

describe('drive client', () => {
  it('builds an OAuth client with no client id or secret', async () => {
    await getDriveClient();
    expect(google.auth.OAuth2).toHaveBeenCalledWith({ forceRefreshOnFailure: true });
  });

  it('arms the library 401 recovery, which needs forceRefreshOnFailure', async () => {
    // Without it googleapis will not re-vend a token that Google rejected,
    // because the credentials carry no refresh_token.
    await getDriveClient();
    expect(oauthClient.options.forceRefreshOnFailure).toBe(true);
  });

  it('reuses the same client', async () => {
    const first = await getDriveClient();
    const second = await getDriveClient();

    expect(first).toBe(second);
    expect(googleDrive).toHaveBeenCalledTimes(1);
  });

  it('takes Google tokens from the justdrive server', async () => {
    await getDriveClient();
    fetchDriveToken.mockResolvedValue({ access_token: 'ya29.x', expiry_date: 1_800_000_000_000 });

    const result = await refreshHandler.current!();

    expect(fetchDriveToken).toHaveBeenCalled();
    expect(result).toEqual({ access_token: 'ya29.x', expiry_date: 1_800_000_000_000 });
  });
});
