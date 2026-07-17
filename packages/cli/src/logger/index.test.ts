import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

import fs from 'fs/promises';
import { logActivity, getActivityLog } from './index.js';
import type { ActivityLogEntry } from '@juststore/shared';

describe('logger/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logActivity', () => {
    it('appends entry to existing log', async () => {
      const existing: ActivityLogEntry[] = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          operation: 'login',
          path: '/',
          status: 'success',
        },
      ];
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existing));

      const newEntry: ActivityLogEntry = {
        timestamp: '2024-01-02T00:00:00Z',
        operation: 'upload',
        path: '/test.txt',
        status: 'success',
      };

      await logActivity(newEntry);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"upload"'),
      );
      const written = JSON.parse(
        vi.mocked(fs.writeFile).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(2);
      expect(written[1]).toEqual(newEntry);
    });

    it('creates new log file when none exists', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const entry: ActivityLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        operation: 'login',
        path: '/',
        status: 'success',
      };

      await logActivity(entry);

      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      const written = JSON.parse(
        vi.mocked(fs.writeFile).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(1);
      expect(written[0]).toEqual(entry);
    });
  });

  describe('getActivityLog', () => {
    it('returns parsed log entries', async () => {
      const entries: ActivityLogEntry[] = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          operation: 'login',
          path: '/',
          status: 'success',
        },
      ];
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(entries));

      const result = await getActivityLog();

      expect(result).toEqual(entries);
    });

    it('returns empty array when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await getActivityLog();

      expect(result).toEqual([]);
    });
  });
});
