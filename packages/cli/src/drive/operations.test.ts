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

vi.mock('fs', () => ({
  default: {
    createReadStream: vi.fn(() => 'mock-stream'),
    createWriteStream: vi.fn(() => ({
      on: vi.fn(),
    })),
  },
}));

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
    it('deletes file and logs activity', async () => {
      mockDrive.delete.mockResolvedValue({});

      await removeFile('/file.txt');

      expect(mockDrive.delete).toHaveBeenCalledWith({ fileId: 'resolved_id' });
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'rm', status: 'success' }),
      );
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
  });
});
