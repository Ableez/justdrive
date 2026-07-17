import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchActivity, fetchFiles, uploadFile, fetchStatus } from './client';

describe('api/client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('fetchActivity', () => {
    it('returns activity entries on success', async () => {
      const mockEntries = [
        { timestamp: '2024-01-01', operation: 'upload', path: '/test', status: 'success' },
      ];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockEntries),
      } as Response);

      const result = await fetchActivity();
      expect(result).toEqual(mockEntries);
      expect(fetch).toHaveBeenCalledWith('/api/activity');
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      } as Response);

      await expect(fetchActivity()).rejects.toThrow('Server error');
    });
  });

  describe('fetchFiles', () => {
    it('returns files on success', async () => {
      const mockFiles = [{ id: '1', name: 'test.txt', mimeType: 'text/plain' }];
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFiles),
      } as Response);

      const result = await fetchFiles();
      expect(result).toEqual(mockFiles);
      expect(fetch).toHaveBeenCalledWith('/api/files');
    });

    it('encodes path in URL', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      await fetchFiles('photos/2024');
      expect(fetch).toHaveBeenCalledWith('/api/files?path=photos%2F2024');
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);

      await expect(fetchFiles()).rejects.toThrow('Not found');
    });
  });

  describe('uploadFile', () => {
    it('sends file via FormData', async () => {
      const mockFile = { id: '1', name: 'test.txt' };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFile),
      } as Response);

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = await uploadFile(file);

      expect(result).toEqual(mockFile);
      expect(fetch).toHaveBeenCalledWith(
        '/api/upload',
        expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
      );
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Upload failed' }),
      } as Response);

      const file = new File(['content'], 'test.txt');
      await expect(uploadFile(file)).rejects.toThrow('Upload failed');
    });
  });

  describe('fetchStatus', () => {
    it('returns auth status', async () => {
      const mockStatus = { authenticated: true, email: 'user@test.com' };
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      } as Response);

      const result = await fetchStatus();
      expect(result).toEqual(mockStatus);
    });

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(fetchStatus()).rejects.toThrow('Failed to fetch status');
    });
  });
});
