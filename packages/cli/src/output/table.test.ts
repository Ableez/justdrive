import { describe, it, expect } from 'vitest';
import { formatTable } from './table.js';
import type { DriveFile } from '@juststore/shared';

describe('output/table', () => {
  it('returns "No files found" for empty array', () => {
    const result = formatTable([]);
    expect(result).toBe('No files found.');
  });

  it('formats files into table', () => {
    const files: DriveFile[] = [
      {
        id: '1',
        name: 'test.txt',
        mimeType: 'text/plain',
        size: '1024',
        modifiedTime: '2024-06-15T10:00:00Z',
      },
    ];

    const result = formatTable(files);

    expect(result).toContain('test.txt');
    expect(result).toContain('plain');
    expect(result).toContain('1.0 KB');
  });

  it('formats folder type correctly', () => {
    const files: DriveFile[] = [
      {
        id: '1',
        name: 'my-folder',
        mimeType: 'application/vnd.google-apps.folder',
      },
    ];

    const result = formatTable(files);

    expect(result).toContain('folder');
  });

  it('handles missing size and date', () => {
    const files: DriveFile[] = [
      {
        id: '1',
        name: 'test.txt',
        mimeType: 'text/plain',
      },
    ];

    const result = formatTable(files);

    expect(result).toContain('-');
  });

  it('formats large sizes correctly', () => {
    const files: DriveFile[] = [
      {
        id: '1',
        name: 'big.bin',
        mimeType: 'application/octet-stream',
        size: String(1024 * 1024 * 1024),
      },
    ];

    const result = formatTable(files);

    expect(result).toContain('1.0 GB');
  });
});
