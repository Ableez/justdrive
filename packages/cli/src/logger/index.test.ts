import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const mocks = vi.hoisted(() => ({ sendEvents: vi.fn() }));
vi.mock('../api/events.js', () => ({ sendEvents: mocks.sendEvents }));

import { logActivity } from './index.js';
import { pendingCount } from './outbox.js';

let home: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'justdrive-logger-'));
  process.env.JUSTDRIVE_CONFIG_DIR = home;
  mocks.sendEvents.mockReset();
  mocks.sendEvents.mockResolvedValue(1);
});

afterEach(async () => {
  delete process.env.JUSTDRIVE_CONFIG_DIR;
  await fs.rm(home, { recursive: true, force: true });
});

/** logActivity delivers in the background, so let the microtasks drain. */
async function settle() {
  for (let i = 0; i < 500; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

describe('logActivity', () => {
  it('queues the event and delivers it', async () => {
    await logActivity({
      operation: 'upload',
      path: 'docs/a.txt',
      driveFileId: 'f1',
      status: 'success',
    });
    await settle();

    expect(mocks.sendEvents).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'upload', path: 'docs/a.txt', drive_file_id: 'f1' }),
    ]);
    expect(await pendingCount()).toBe(0);
  });

  it('normalises the path before sending', async () => {
    await logActivity({ operation: 'rm', path: '/juststore/a/b.txt', status: 'success' });
    await settle();

    expect(mocks.sendEvents.mock.calls[0][0][0].path).toBe('a/b.txt');
  });

  it('keeps the event queued when the server cannot be reached', async () => {
    mocks.sendEvents.mockRejectedValue(new Error('network down'));

    await logActivity({ operation: 'download', path: 'a.txt', status: 'success' });
    await settle();

    expect(await pendingCount()).toBe(1);
  });

  it('never rejects when the queue cannot be written to disk', async () => {
    // The file operation has already gone to Drive, so a local failure must
    // not surface as a failed upload.
    await fs.writeFile(path.join(home, 'outbox.json'), 'corrupt');
    await fs.chmod(home, 0o500);

    try {
      await expect(
        logActivity({ operation: 'upload', path: 'a.txt', status: 'success' }),
      ).resolves.toBeUndefined();
    } finally {
      await fs.chmod(home, 0o700);
    }
  });
});
