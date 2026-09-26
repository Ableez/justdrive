import { describe, it, expect, vi, beforeEach } from 'vitest';

const aboutGet = vi.fn();

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: vi.fn() },
    drive: vi.fn(() => ({ about: { get: aboutGet } })),
  },
}));

vi.mock('../auth/tokens.js', () => ({
  loadAuth: vi.fn(),
  updateTokens: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/credentials.js', () => ({
  loadCredentials: vi.fn().mockResolvedValue({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    source: 'env',
  }),
}));

import { google } from 'googleapis';
import {
  createOAuth2Client,
  getAuthenticatedClient,
  getDriveClient,
  getUserEmail,
  resetDriveClient,
} from './client.js';
import { loadAuth, updateTokens } from '../auth/tokens.js';
import { AuthError, StoredAuth } from '@juststore/shared';

function storedAuth(tokens: StoredAuth['tokens'], clientId = 'test-client-id'): StoredAuth {
  return { version: 1, clientId, scopes: [], tokens };
}

function mockOAuthClient(overrides: Record<string, unknown> = {}) {
  const client = {
    setCredentials: vi.fn(),
    on: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue({ token: 'new_at' }),
    credentials: { access_token: 'new_at', expiry_date: 42 },
    ...overrides,
  };
  vi.mocked(google.auth.OAuth2).mockImplementation(() => client as any);
  return client;
}

describe('drive/client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDriveClient();
  });

  describe('createOAuth2Client', () => {
    it('creates OAuth2 client with configured credentials', async () => {
      mockOAuthClient();
      await createOAuth2Client('http://127.0.0.1:5000/oauth2callback');
      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'test-client-id',
        'test-client-secret',
        'http://127.0.0.1:5000/oauth2callback',
      );
    });
  });

  describe('getAuthenticatedClient', () => {
    it('returns a client with the saved tokens and persists future refreshes', async () => {
      const tokens = { access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3600000 };
      vi.mocked(loadAuth).mockResolvedValue(storedAuth(tokens));
      const client = mockOAuthClient();

      await getAuthenticatedClient();

      expect(client.setCredentials).toHaveBeenCalledWith(tokens);
      expect(client.getAccessToken).not.toHaveBeenCalled();

      const [event, listener] = client.on.mock.calls[0];
      expect(event).toBe('tokens');
      listener({ access_token: 'refreshed' });
      expect(updateTokens).toHaveBeenCalledWith({ access_token: 'refreshed' });
    });

    it('throws AuthError when not logged in', async () => {
      vi.mocked(loadAuth).mockResolvedValue(null);
      await expect(getAuthenticatedClient()).rejects.toThrow(AuthError);
    });

    it('rejects a login issued to a different OAuth client', async () => {
      vi.mocked(loadAuth).mockResolvedValue(storedAuth({ access_token: 'at' }, 'other-client'));
      mockOAuthClient();
      await expect(getAuthenticatedClient()).rejects.toThrow(/different OAuth client/);
    });

    it('accepts legacy logins that have no recorded client', async () => {
      vi.mocked(loadAuth).mockResolvedValue(
        storedAuth({ access_token: 'at', expiry_date: Date.now() + 3600000 }, ''),
      );
      mockOAuthClient();
      await expect(getAuthenticatedClient()).resolves.toBeDefined();
    });

    it('refreshes an expired token and saves it', async () => {
      vi.mocked(loadAuth).mockResolvedValue(
        storedAuth({ access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() - 1000 }),
      );
      const client = mockOAuthClient();

      await getAuthenticatedClient();

      expect(client.getAccessToken).toHaveBeenCalled();
      expect(updateTokens).toHaveBeenCalledWith({ access_token: 'new_at', expiry_date: 42 });
    });

    it('turns a revoked refresh token into a re-login message', async () => {
      vi.mocked(loadAuth).mockResolvedValue(
        storedAuth({ access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() - 1000 }),
      );
      mockOAuthClient({
        getAccessToken: vi.fn().mockRejectedValue(
          Object.assign(new Error('invalid_grant'), { response: { data: { error: 'invalid_grant' } } }),
        ),
      });

      await expect(getAuthenticatedClient()).rejects.toThrow(/expired or was revoked/);
    });

    it('requires login when expired without a refresh token', async () => {
      vi.mocked(loadAuth).mockResolvedValue(storedAuth({ access_token: 'at', expiry_date: 1 }));
      mockOAuthClient();
      await expect(getAuthenticatedClient()).rejects.toThrow(/no refresh token/);
    });
  });

  describe('getDriveClient', () => {
    it('creates the drive client once', async () => {
      vi.mocked(loadAuth).mockResolvedValue(
        storedAuth({ access_token: 'at', expiry_date: Date.now() + 3600000 }),
      );
      mockOAuthClient();

      const first = await getDriveClient();
      const second = await getDriveClient();

      expect(first).toBe(second);
      expect(google.drive).toHaveBeenCalledTimes(1);
      expect(google.drive).toHaveBeenCalledWith({ version: 'v3', auth: expect.anything() });
    });
  });

  describe('getUserEmail', () => {
    it('reads the account email from Drive about', async () => {
      vi.mocked(loadAuth).mockResolvedValue(
        storedAuth({ access_token: 'at', expiry_date: Date.now() + 3600000 }),
      );
      mockOAuthClient();
      aboutGet.mockResolvedValue({ data: { user: { emailAddress: 'me@test.com' } } });

      await expect(getUserEmail()).resolves.toBe('me@test.com');
      expect(aboutGet).toHaveBeenCalledWith({ fields: 'user(emailAddress)' });
    });

    it('returns null on failure', async () => {
      vi.mocked(loadAuth).mockResolvedValue(null);
      await expect(getUserEmail()).resolves.toBeNull();
    });
  });
});
