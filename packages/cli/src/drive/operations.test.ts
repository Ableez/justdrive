import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client.js', () => ({
  getDriveClient: vi.fn(),
}));

vi.mock('./resolver.js', () => ({
  resolvePath: vi.fn(),
}));

vi.mock('../logger/index.js', () => ({
  logActivity: vi.fn(),
}));

vi.mock('./cache.js', () => ({
  invalidateCachedPath: vi.fn(),
}));

vi.mock('fs', async () => {
  const { Writable } = await import('stream');
  return {
    default: {
      createReadStream: vi.fn(() => 'mock-stream'),
      createWriteStream: vi.fn(
        () => new Writable({ write: (_chunk, _enc, cb) => cb() }),
      ),
      promises: { rm: vi.fn() },
    },
  };
});

import {
  listFiles,
  uploadFile,
  downloadFile,
  createDirectory,
  moveFile,
  removeFile,
  shareFile,
} from './operations.js';
import { getDriveClient } from './client.js';
import { resolvePath } from './resolver.js';
import { logActivity } from '../logger/index.js';
import { invalidateCachedPath } from './cache.js';
import { Readable } from 'stream';
import fs from 'fs';

describe('drive/operations', () => {
  let mockDrive: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDrive = {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      permissions: {
        create: vi.fn(),
      },
    };

    vi.mocked(getDriveClient).mockResolvedValue({
      files: mockDrive,
      permissions: mockDrive.permissions,
    } as any);

    vi.mocked(resolvePath).mockResolvedValue('resolved_id');
  });

  describe('listFiles', () => {
    it('lists files in directory', async () => {
      const mockFiles = [
        { id: '1', name: 'file1.txt', mimeType: 'text/plain' },
        { id: '2', name: 'file2.txt', mimeType: 'text/plain' },
      ];
      mockDrive.list.mockResolvedValue({ data: { files: mockFiles } });

      const result = await listFiles('/test');

      expect(result).toEqual(mockFiles);
      expect(mockDrive.list).toHaveBeenCalledWith({
        q: "'resolved_id' in parents and trashed=false",
        fields: expect.stringContaining('files('),
        spaces: 'drive',
        orderBy: 'name',
      });
    });

    it('returns empty array when no files', async () => {
      mockDrive.list.mockResolvedValue({ data: { files: [] } });
      const result = await listFiles('/empty');
      expect(result).toEqual([]);
    });
  });

  describe('uploadFile', () => {
    it('uploads file and logs activity', async () => {
      const mockFile = { id: '1', name: 'test.txt', mimeType: 'text/plain' };
      mockDrive.create.mockResolvedValue({ data: mockFile });

      const result = await uploadFile('/local/test.txt', '/drive/dir');

      expect(result).toEqual(mockFile);
      expect(mockDrive.create).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'upload', status: 'success' }),
      );
    });

    it('uses the given name instead of the temp file name', async () => {
      mockDrive.create.mockResolvedValue({ data: { id: '1', name: 'report.pdf' } });

      await uploadFile('/tmp/uploads/3f9a1c', undefined, 'report.pdf');

      expect(mockDrive.create).toHaveBeenCalledWith(
        expect.objectContaining({ requestBody: expect.objectContaining({ name: 'report.pdf' }) }),
      );
    });
  });

  describe('createDirectory', () => {
    it('creates directory and logs activity', async () => {
      const mockFolder = { id: '1', name: 'newdir', mimeType: 'application/vnd.google-apps.folder' };
      mockDrive.create.mockResolvedValue({ data: mockFolder });

      const result = await createDirectory('/parent/newdir');

      expect(result).toEqual(mockFolder);
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'mkdir', status: 'success' }),
      );
    });
  });

  describe('moveFile', () => {
    it('moves file to new location', async () => {
      const mockFile = { id: '1', name: 'dest.txt' };
      mockDrive.get.mockResolvedValue({ data: { parents: ['old_parent'] } });
      mockDrive.update.mockResolvedValue({ data: mockFile });

      const result = await moveFile('/src/file.txt', '/dest/dest.txt');

      expect(result).toEqual(mockFile);
      expect(mockDrive.update).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'resolved_id',
          addParents: 'resolved_id',
          removeParents: 'old_parent',
        }),
      );
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'mv' }),
      );
    });
  });

  describe('removeFile', () => {
    it('moves file to trash by default and invalidates the cache', async () => {
      mockDrive.update.mockResolvedValue({});

      await removeFile('/file.txt');

      expect(mockDrive.update).toHaveBeenCalledWith({
        fileId: 'resolved_id',
        requestBody: { trashed: true },
      });
      expect(mockDrive.delete).not.toHaveBeenCalled();
      expect(invalidateCachedPath).toHaveBeenCalledWith('file.txt', 'resolved_id');
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'rm', status: 'success' }),
      );
    });

    it('deletes permanently when asked', async () => {
      mockDrive.delete.mockResolvedValue({});

      await removeFile('file.txt', { permanent: true });

      expect(mockDrive.delete).toHaveBeenCalledWith({ fileId: 'resolved_id' });
    });

    it('refuses to remove the root folder', async () => {
      await expect(removeFile('/')).rejects.toThrow(/root folder/);
      expect(mockDrive.update).not.toHaveBeenCalled();
    });
  });

  describe('downloadFile', () => {
    it('resolves after the stream is fully written', async () => {
      mockDrive.get.mockResolvedValue({ data: Readable.from(['hello']) });

      const result = await downloadFile('docs/a.txt', '/tmp/a.txt');

      expect(result).toBe('/tmp/a.txt');
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'download', path: 'docs/a.txt' }),
      );
    });

    it('removes the partial file when the download fails', async () => {
      const failing = new Readable({
        read() {
          this.destroy(new Error('network down'));
        },
      });
      mockDrive.get.mockResolvedValue({ data: failing });

      await expect(downloadFile('a.txt', '/tmp/a.txt')).rejects.toThrow('network down');
      expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/a.txt', { force: true });
      expect(logActivity).not.toHaveBeenCalled();
    });
  });

  describe('shareFile', () => {
    it('shares file with email and returns link', async () => {
      mockDrive.permissions.create.mockResolvedValue({});
      mockDrive.get.mockResolvedValue({
        data: { webViewLink: 'https://drive.google.com/link' },
      });

      const result = await shareFile('/file.txt', 'user@test.com', 'reader');

      expect(result).toBe('https://drive.google.com/link');
      expect(mockDrive.permissions.create).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'share', status: 'success' }),
      );
    });

    it('shares file without email (link only)', async () => {
      mockDrive.get.mockResolvedValue({
        data: { webViewLink: 'https://drive.google.com/link' },
      });

      const result = await shareFile('/file.txt');

      expect(result).toBe('https://drive.google.com/link');
    });

    it('rejects unknown roles', async () => {
      await expect(shareFile('/file.txt', 'a@b.com', 'admin')).rejects.toThrow(/Invalid role/);
      expect(mockDrive.permissions.create).not.toHaveBeenCalled();
    });

    it('sets transferOwnership for owner role', async () => {
      mockDrive.permissions.create.mockResolvedValue({});
      mockDrive.get.mockResolvedValue({ data: { webViewLink: 'link' } });

      await shareFile('/file.txt', 'a@b.com', 'owner');

      expect(mockDrive.permissions.create).toHaveBeenCalledWith(
        expect.objectContaining({ transferOwnership: true }),
      );
    });
  });
});
