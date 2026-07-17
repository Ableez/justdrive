import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
  },
}));

import fs from 'fs/promises';
import { saveTokens, loadTokens, clearTokens } from './tokens.js';

describe('auth/tokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveTokens', () => {
    it('writes tokens to file', async () => {
      const tokens = { access_token: 'at', refresh_token: 'rt' };
      await saveTokens(tokens);

      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(tokens, null, 2),
      );
    });

    it('handles partial tokens', async () => {
      const tokens = { refresh_token: 'rt' };
      await saveTokens(tokens);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"refresh_token": "rt"'),
      );
    });
  });

  describe('loadTokens', () => {
    it('reads and parses tokens from file', async () => {
      const tokens = {
        access_token: 'at',
        refresh_token: 'rt',
        expiry_date: 1234567890,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(tokens));

      const result = await loadTokens();

      expect(result).toEqual(tokens);
      expect(fs.readFile).toHaveBeenCalledWith(expect.any(String), 'utf-8');
    });

    it('returns null when file does not exist', async () => {
      const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await loadTokens();

      expect(result).toBeNull();
    });

    it('throws for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('not json');

      await expect(loadTokens()).rejects.toThrow();
    });
  });

  describe('clearTokens', () => {
    it('deletes token file', async () => {
      await clearTokens();

      expect(fs.unlink).toHaveBeenCalledWith(expect.any(String));
    });

    it('does not throw when file does not exist', async () => {
      vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'));

      await expect(clearTokens()).resolves.not.toThrow();
    });
  });
});
