import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        refreshAccessToken: vi.fn().mockResolvedValue({
          credentials: { access_token: 'new_at' },
        }),
      })),
    },
    drive: vi.fn(),
  },
}));

vi.mock('../auth/tokens.js', () => ({
  loadTokens: vi.fn(),
  saveTokens: vi.fn(),
}));

vi.mock('../config/credentials.js', () => ({
  loadCredentials: vi.fn().mockResolvedValue({
    installed: {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      redirect_uris: ['http://localhost'],
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
  }),
  getClientId: vi.fn().mockReturnValue('test-client-id'),
  getClientSecret: vi.fn().mockReturnValue('test-client-secret'),
  getDefaultRedirectUri: vi.fn().mockReturnValue('http://localhost'),
}));

import { google } from 'googleapis';
import {
  createOAuth2Client,
  getAuthenticatedClient,
  getDriveClient,
  resetDriveClient,
} from './client.js';
import { loadTokens } from '../auth/tokens.js';
import { AuthError } from '@juststore/shared';

describe('drive/client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDriveClient();
  });

  describe('createOAuth2Client', () => {
    it('creates OAuth2 client with credentials from config', async () => {
      await createOAuth2Client();
      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'test-client-id',
        'test-client-secret',
        'http://localhost',
      );
    });

    it('uses custom redirect URI when provided', async () => {
      await createOAuth2Client('http://localhost:5000/oauth2callback');
      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        'test-client-id',
        'test-client-secret',
        'http://localhost:5000/oauth2callback',
      );
    });
  });

  describe('getAuthenticatedClient', () => {
    it('returns authenticated client with valid tokens', async () => {
      const mockTokens = {
        access_token: 'at',
        refresh_token: 'rt',
        expiry_date: Date.now() + 3600000,
      };
      vi.mocked(loadTokens).mockResolvedValue(mockTokens);

      const mockSetCredentials = vi.fn();
      vi.mocked(google.auth.OAuth2).mockImplementation(
        () =>
          ({
            setCredentials: mockSetCredentials,
          }) as any,
      );

      const client = await getAuthenticatedClient();
      expect(mockSetCredentials).toHaveBeenCalledWith(mockTokens);
      expect(client).toBeDefined();
    });

    it('throws AuthError when no tokens', async () => {
      vi.mocked(loadTokens).mockResolvedValue(null);
      await expect(getAuthenticatedClient()).rejects.toThrow(AuthError);
    });

    it('refreshes expired token and saves new credentials', async () => {
      const mockTokens = {
        access_token: 'at',
        refresh_token: 'rt',
        expiry_date: Date.now() - 3600000,
      };
      vi.mocked(loadTokens).mockResolvedValue(mockTokens);

      const mockSetCredentials = vi.fn();
      const mockRefreshAccessToken = vi.fn().mockResolvedValue({
        credentials: { access_token: 'new_at' },
      });

      vi.mocked(google.auth.OAuth2).mockImplementation(
        () =>
          ({
            setCredentials: mockSetCredentials,
            refreshAccessToken: mockRefreshAccessToken,
          }) as any,
      );

      const { saveTokens } = await import('../auth/tokens.js');
      await getAuthenticatedClient();
      expect(mockRefreshAccessToken).toHaveBeenCalled();
      expect(saveTokens).toHaveBeenCalledWith({ access_token: 'new_at' });
    });
  });

  describe('getDriveClient', () => {
    it('creates drive client', async () => {
      vi.mocked(loadTokens).mockResolvedValue({
        access_token: 'at',
        refresh_token: 'rt',
        expiry_date: Date.now() + 3600000,
      });
      vi.mocked(google.auth.OAuth2).mockImplementation(
        () =>
          ({
            setCredentials: vi.fn(),
          }) as any,
      );

      await getDriveClient();
      expect(google.drive).toHaveBeenCalledWith({
        version: 'v3',
        auth: expect.anything(),
      });
    });
  });
});
