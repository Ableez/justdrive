import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client.js', () => ({
  getDriveClient: vi.fn(),
}));

vi.mock('./cache.js', () => ({
  getCachedPath: vi.fn(),
  setCachedPath: vi.fn(),
}));

import { resolvePath, getRootFolderId } from './resolver.js';
import { getDriveClient } from './client.js';
import { getCachedPath, setCachedPath } from './cache.js';

describe('drive/resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRootFolderId', () => {
    it('returns cached root folder ID', async () => {
      vi.mocked(getCachedPath).mockImplementation(async (key: string) => {
        if (key === '__root__') return 'cached_root_id';
        return null;
      });

      const result = await getRootFolderId();
      expect(result).toBe('cached_root_id');
    });

    it('finds existing root folder on Drive', async () => {
      vi.mocked(getCachedPath).mockResolvedValue(null);
      const mockList = vi.fn().mockResolvedValue({
        data: { files: [{ id: 'drive_root_id' }] },
      });
      vi.mocked(getDriveClient).mockResolvedValue({
        files: { list: mockList, create: vi.fn() },
      } as never);

      const result = await getRootFolderId();
      expect(result).toBe('drive_root_id');
      expect(setCachedPath).toHaveBeenCalledWith('__root__', 'drive_root_id');
    });

    it('creates root folder when not found', async () => {
      vi.mocked(getCachedPath).mockResolvedValue(null);
      const mockList = vi.fn().mockResolvedValue({
        data: { files: [] },
      });
      const mockCreate = vi.fn().mockResolvedValue({
        data: { id: 'new_root_id' },
      });
      vi.mocked(getDriveClient).mockResolvedValue({
        files: { list: mockList, create: mockCreate },
      } as never);

      const result = await getRootFolderId();
      expect(result).toBe('new_root_id');
      expect(mockCreate).toHaveBeenCalledWith({
        requestBody: {
          name: 'juststore',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
    });
  });

  describe('resolvePath', () => {
    it('returns root folder ID for empty path', async () => {
      vi.mocked(getCachedPath).mockImplementation(async (key: string) => {
        if (key === '__root__') return 'root_id';
        return null;
      });

      const result = await resolvePath('');
      expect(result).toBe('root_id');
    });

    it('resolves single segment path', async () => {
      vi.mocked(getCachedPath).mockImplementation(async (key: string) => {
        if (key === '__root__') return 'root_id';
        if (key === 'photos/subfolder') return 'subfolder_id';
        return null;
      });

      const result = await resolvePath('photos/subfolder');
      expect(result).toBe('subfolder_id');
    });

    it('resolves multi-segment path via API', async () => {
      vi.mocked(getCachedPath).mockImplementation(async (key: string) => {
        if (key === '__root__') return 'root_id';
        return null;
      });

      const mockList = vi.fn()
        .mockResolvedValueOnce({ data: { files: [{ id: 'photos_id' }] } })
        .mockResolvedValueOnce({ data: { files: [{ id: '2024_id' }] } });

      vi.mocked(getDriveClient).mockResolvedValue({
        files: { list: mockList },
      } as never);

      const result = await resolvePath('photos/2024');
      expect(result).toBe('2024_id');
      expect(setCachedPath).toHaveBeenCalled();
    });

    it('strips ./ prefix before resolving', async () => {
      vi.mocked(getCachedPath).mockImplementation(async (key: string) => {
        if (key === '__root__') return 'root_id';
        if (key === 'photos') return 'photos_id';
        return null;
      });

      const result = await resolvePath('./photos');
      expect(result).toBe('photos_id');
    });
  });
});
