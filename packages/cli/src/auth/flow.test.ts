import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: vi.fn().mockReturnValue('https://auth.url'),
        getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'at', refresh_token: 'rt' } }),
        revokeToken: vi.fn().mockResolvedValue({}),
      })),
    },
  },
}));

vi.mock('open', () => ({
  default: vi.fn(),
}));

vi.mock('../drive/client.js', () => ({
  createOAuth2Client: vi.fn().mockResolvedValue({
    generateAuthUrl: vi.fn().mockReturnValue('https://auth.url'),
    getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'at', refresh_token: 'rt' } }),
    revokeToken: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock('./tokens.js', () => ({
  saveTokens: vi.fn(),
  clearTokens: vi.fn(),
  loadTokens: vi.fn(),
}));

vi.mock('../logger/index.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('@juststore/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@juststore/shared')>();
  return {
    ...actual,
    findAvailablePort: vi.fn().mockResolvedValue(4000),
  };
});

import { runAuthLogout } from './flow.js';
import { createOAuth2Client } from '../drive/client.js';
import { loadTokens, clearTokens } from './tokens.js';
import { logActivity } from '../logger/index.js';

describe('auth/flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runAuthLogout', () => {
    it('revokes token and clears storage', async () => {
      const mockRevokeToken = vi.fn().mockResolvedValue({});
      vi.mocked(loadTokens).mockResolvedValue({
        refresh_token: 'rt_123',
        access_token: 'at_123',
      });
      vi.mocked(createOAuth2Client).mockResolvedValue({
        revokeToken: mockRevokeToken,
      } as any);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runAuthLogout();

      expect(mockRevokeToken).toHaveBeenCalledWith('rt_123');
      expect(clearTokens).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'logout', status: 'success' }),
      );
      logSpy.mockRestore();
    });

    it('handles missing tokens gracefully', async () => {
      vi.mocked(loadTokens).mockResolvedValue(null);
      vi.mocked(createOAuth2Client).mockResolvedValue({
        revokeToken: vi.fn(),
      } as any);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runAuthLogout();

      expect(clearTokens).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('continues even if revoke fails', async () => {
      vi.mocked(loadTokens).mockResolvedValue({
        refresh_token: 'rt_123',
      });
      vi.mocked(createOAuth2Client).mockResolvedValue({
        revokeToken: vi.fn().mockRejectedValue(new Error('revoke failed')),
      } as any);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await runAuthLogout();

      expect(clearTokens).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});
