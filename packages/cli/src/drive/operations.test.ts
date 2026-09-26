import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable, Writable } from 'stream';

const mocks = vi.hoisted(() => ({
  filesCreate: vi.fn(),
  filesGet: vi.fn(),
  filesUpdate: vi.fn(),
  filesDelete: vi.fn(),
  filesList: vi.fn(),
  permissionsCreate: vi.fn(),
  resolvePath: vi.fn(),
  invalidateCachedPath: vi.fn(),
  logActivity: vi.fn(),
  createWriteStream: vi.fn(),
}));

vi.mock('./client.js', () => ({
  getDriveClient: async () => ({
    files: {
      create: mocks.filesCreate,
      get: mocks.filesGet,
      update: mocks.filesUpdate,
      delete: mocks.filesDelete,
      list: mocks.filesList,
    },
    permissions: { create: mocks.permissionsCreate },
  }),
}));

vi.mock('./resolver.js', () => ({ resolvePath: (p: string) => mocks.resolvePath(p) }));
vi.mock('./cache.js', () => ({ invalidateCachedPath: mocks.invalidateCachedPath }));
vi.mock('../logger/index.js', () => ({ logActivity: mocks.logActivity }));

vi.mock('fs', async () => {
  const actual = (await vi.importActual<typeof import('fs')>('fs')) as unknown as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    default: {
      ...(actual.default as Record<string, unknown>),
      createReadStream: () => Readable.from(['data']),
      createWriteStream: (...args: unknown[]) => mocks.createWriteStream(...args),
    },
  };
});

import {
  createDirectory,
  downloadFile,
  listFiles,
  moveFile,
  removeFile,
  shareFile,
  uploadFile,
} from './operations.js';
import { JustStoreError } from '@juststore/shared';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolvePath.mockImplementation(async (p: string) => `id:${p}`);
  mocks.filesGet.mockResolvedValue({ data: { webViewLink: 'https://link' } });
  mocks.createWriteStream.mockImplementation(
    () => new Writable({ write: (_chunk, _encoding, callback) => callback() }),
  );
});

describe('listFiles', () => {
  it('lists the resolved folder', async () => {
    mocks.filesList.mockResolvedValue({ data: { files: [{ id: '1', name: 'a' }] } });

    await expect(listFiles('photos')).resolves.toEqual([{ id: '1', name: 'a' }]);
    expect(mocks.filesList.mock.calls[0][0].q).toBe("'id:photos' in parents and trashed=false");
  });

  it('handles an empty folder', async () => {
    mocks.filesList.mockResolvedValue({ data: {} });
    await expect(listFiles('')).resolves.toEqual([]);
  });
});

describe('uploadFile', () => {
  it('uploads under the requested name and records the event', async () => {
    mocks.filesCreate.mockResolvedValue({ data: { id: 'f1', name: 'report.pdf', size: '10' } });

    const file = await uploadFile('/tmp/local.bin', 'docs', 'report.pdf');

    expect(file.id).toBe('f1');
    expect(mocks.filesCreate.mock.calls[0][0].requestBody).toEqual({
      name: 'report.pdf',
      parents: ['id:docs'],
    });
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'upload', path: 'docs/report.pdf', driveFileId: 'f1' }),
    );
  });

  it('falls back to the local file name', async () => {
    mocks.filesCreate.mockResolvedValue({ data: { id: 'f1', name: 'local.bin' } });
    await uploadFile('/tmp/local.bin');
    expect(mocks.filesCreate.mock.calls[0][0].requestBody.name).toBe('local.bin');
  });

  it('records a root upload without a leading slash', async () => {
    mocks.filesCreate.mockResolvedValue({ data: { id: 'f1', name: 'a.txt' } });
    await uploadFile('/tmp/a.txt', undefined, 'a.txt');
    expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({ path: 'a.txt' }));
  });
});

describe('downloadFile', () => {
  it('waits for the stream to finish before reporting success', async () => {
    mocks.filesGet.mockResolvedValue({ data: Readable.from(['chunk']) });

    await expect(downloadFile('a/b.txt', '/tmp/out.txt')).resolves.toBe('/tmp/out.txt');
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'download', path: 'a/b.txt' }),
    );
  });

  it('fails when the destination cannot be written', async () => {
    mocks.filesGet.mockResolvedValue({ data: Readable.from(['chunk']) });
    mocks.createWriteStream.mockImplementation(
      () => new Writable({ write: (_c, _e, callback) => callback(new Error('disk full')) }),
    );

    await expect(downloadFile('a/b.txt', '/tmp/out.txt')).rejects.toThrow('disk full');
  });
});

describe('createDirectory', () => {
  it('creates a folder under its parent', async () => {
    mocks.filesCreate.mockResolvedValue({ data: { id: 'd1', name: 'photos' } });

    await createDirectory('photos/2024');

    expect(mocks.filesCreate.mock.calls[0][0].requestBody).toMatchObject({
      name: '2024',
      parents: ['id:photos'],
    });
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'mkdir', path: 'photos/2024' }),
    );
  });
});

describe('moveFile', () => {
  it('moves between folders and invalidates the cache', async () => {
    mocks.filesGet.mockResolvedValueOnce({ data: { parents: ['id:photos'] } });
    mocks.filesUpdate.mockResolvedValue({ data: { id: 'f1', name: 'new.txt' } });

    await moveFile('photos/a.txt', 'archive/new.txt');

    expect(mocks.filesUpdate.mock.calls[0][0]).toMatchObject({
      addParents: 'id:archive',
      removeParents: 'id:photos',
    });
    expect(mocks.invalidateCachedPath).toHaveBeenCalledWith('photos/a.txt', 'id:photos/a.txt');
  });
});

describe('removeFile', () => {
  it('moves to trash by default', async () => {
    await removeFile('a.txt');

    expect(mocks.filesUpdate).toHaveBeenCalledWith({
      fileId: 'id:a.txt',
      requestBody: { trashed: true },
    });
    expect(mocks.filesDelete).not.toHaveBeenCalled();
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'rm', detail: 'Moved to trash' }),
    );
  });

  it('deletes permanently when asked', async () => {
    await removeFile('a.txt', { permanent: true });
    expect(mocks.filesDelete).toHaveBeenCalledWith({ fileId: 'id:a.txt' });
  });

  it('refuses to remove the root', async () => {
    await expect(removeFile('')).rejects.toBeInstanceOf(JustStoreError);
    await expect(removeFile('/')).rejects.toThrow(/root folder/);
  });
});

describe('shareFile', () => {
  it('shares a link and returns it', async () => {
    await expect(shareFile('a.txt')).resolves.toBe('https://link');
    expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({ operation: 'share' }));
  });

  it('grants a role to an email', async () => {
    await shareFile('a.txt', 'x@y.com', 'writer');
    expect(mocks.permissionsCreate).toHaveBeenCalledWith({
      fileId: 'id:a.txt',
      requestBody: { type: 'user', role: 'writer', emailAddress: 'x@y.com' },
    });
  });

  it('transfers ownership only when an email is given', async () => {
    await shareFile('a.txt', 'x@y.com', 'owner');
    expect(mocks.permissionsCreate.mock.calls[0][0].transferOwnership).toBe(true);
    await expect(shareFile('a.txt', undefined, 'owner')).rejects.toThrow(/--email/);
  });

  it('rejects an unknown role', async () => {
    await expect(shareFile('a.txt', 'x@y.com', 'superuser')).rejects.toThrow(/Invalid role/);
  });
});
