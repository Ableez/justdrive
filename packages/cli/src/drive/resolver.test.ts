import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSession = vi.fn();
vi.mock('../api/client.js', () => ({ requireSession: () => requireSession() }));

const getCachedPath = vi.fn();
const setCachedPath = vi.fn();
vi.mock('./cache.js', () => ({
  getCachedPath: (p: string) => getCachedPath(p),
  setCachedPath: (p: string, id: string) => setCachedPath(p, id),
}));

const filesList = vi.fn();
const filesGet = vi.fn();
vi.mock('./client.js', () => ({
  getDriveClient: async () => ({ files: { list: filesList, get: filesGet } }),
}));

import { getFileById, getRootFolderId, resolvePath } from './resolver.js';
import { PathNotFoundError } from '@juststore/shared';

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ rootFolderId: 'root_id' });
  getCachedPath.mockResolvedValue(null);
});

describe('root folder', () => {
  it('comes from the server session, not a Drive search', async () => {
    await expect(getRootFolderId()).resolves.toBe('root_id');
    expect(filesList).not.toHaveBeenCalled();
  });

  it('explains itself when the server has not told us yet', async () => {
    requireSession.mockResolvedValue({});
    await expect(getRootFolderId()).rejects.toThrow(/Root folder/);
  });
});

describe('resolvePath', () => {
  it('returns the root for an empty path', async () => {
    await expect(resolvePath('')).resolves.toBe('root_id');
    await expect(resolvePath('/')).resolves.toBe('root_id');
  });

  it('uses the cache when it has an answer', async () => {
    getCachedPath.mockResolvedValue('cached_id');
    await expect(resolvePath('photos')).resolves.toBe('cached_id');
    expect(filesList).not.toHaveBeenCalled();
  });

  it('walks one segment at a time and caches the result', async () => {
    filesList
      .mockResolvedValueOnce({ data: { files: [{ id: 'photos_id' }] } })
      .mockResolvedValueOnce({ data: { files: [{ id: 'y2024_id' }] } });

    await expect(resolvePath('photos/2024')).resolves.toBe('y2024_id');

    expect(filesList).toHaveBeenCalledTimes(2);
    expect(filesList.mock.calls[0][0].q).toContain("'root_id' in parents");
    expect(filesList.mock.calls[1][0].q).toContain("'photos_id' in parents");
    expect(setCachedPath).toHaveBeenCalledWith('photos/2024', 'y2024_id');
  });

  it('reports a missing folder', async () => {
    filesList.mockResolvedValue({ data: {} });
    await expect(resolvePath('nope')).rejects.toBeInstanceOf(PathNotFoundError);
  });

  it('escapes quotes and backslashes in a folder name', async () => {
    filesList.mockResolvedValue({ data: { files: [{ id: 'id' }] } });

    await resolvePath("we'ird");

    expect(filesList.mock.calls[0][0].q).toContain("name='we\\'ird'");
  });
});

describe('getFileById', () => {
  it('reads metadata for a transfer without path resolution', async () => {
    filesGet.mockResolvedValue({ data: { id: 'f1', name: 'db.tar.gz', size: '2048' } });

    await expect(getFileById('f1')).resolves.toMatchObject({ name: 'db.tar.gz' });
    expect(filesGet).toHaveBeenCalledWith({ fileId: 'f1', fields: 'id, name, size, mimeType' });
    expect(filesList).not.toHaveBeenCalled();
  });
});
