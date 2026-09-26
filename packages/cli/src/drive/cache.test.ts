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
import { getCachedPath, setCachedPath, clearCache, loadConfig, invalidateCachedPath } from './cache.js';

describe('drive/cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCachedPath', () => {
    it('returns cached file ID', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ paths: { photos: 'id_123' } }),
      );

      const result = await getCachedPath('photos');
      expect(result).toBe('id_123');
    });

    it('returns null for uncached path', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ paths: {} }),
      );

      const result = await getCachedPath('unknown');
      expect(result).toBeNull();
    });

    it('returns null when cache file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await getCachedPath('any');
      expect(result).toBeNull();
    });
  });

  describe('setCachedPath', () => {
    it('writes path to cache', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ paths: {} }),
      );

      await setCachedPath('photos', 'id_456');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"photos": "id_456"'),
      );
    });

    it('creates cache directory if needed', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await setCachedPath('test', 'id_789');

      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('clearCache', () => {
    it('empties the cache', async () => {
      await clearCache();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ paths: {} }, null, 2),
      );
    });
  });

  describe('loadConfig', () => {
    it('returns rootFolderId from cache', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ paths: { __root__: 'root_123' } }),
      );

      const config = await loadConfig();
      expect(config.rootFolderId).toBe('root_123');
    });

    it('returns empty object when cache missing', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const config = await loadConfig();
      expect(config).toEqual({});
    });
  });

  describe('invalidateCachedPath', () => {
    it('drops the path, its descendants, and segment keys under the removed ID', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          paths: {
            __root__: 'root',
            'root/photos': 'photos_id',
            photos: 'photos_id',
            'photos/2024': 'y2024_id',
            'photos_id/2024': 'y2024_id',
            'photos-old': 'other_id',
          },
        }),
      );

      await invalidateCachedPath('photos', 'photos_id');

      const written = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string);
      expect(written.paths).toEqual({ __root__: 'root', 'photos-old': 'other_id' });
    });
  });
});
