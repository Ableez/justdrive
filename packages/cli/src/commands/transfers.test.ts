import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ackTransfer: vi.fn(),
  createTransfer: vi.fn(),
  fetchTransfers: vi.fn(),
  uploadFile: vi.fn(),
  ensureDirectory: vi.fn(),
  logActivity: vi.fn(),
  existsSync: vi.fn(),
  filesGet: vi.fn(),
  filesDelete: vi.fn(),
  promises: {
    mkdir: vi.fn(),
    rename: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock('../api/client.js', () => ({
  ackTransfer: mocks.ackTransfer,
  createTransfer: mocks.createTransfer,
  fetchTransfers: mocks.fetchTransfers,
}));

vi.mock('../drive/operations.js', () => ({
  uploadFile: mocks.uploadFile,
  ensureDirectory: mocks.ensureDirectory,
}));

vi.mock('../drive/client.js', () => ({
  getDriveClient: async () => ({
    files: { get: mocks.filesGet, delete: mocks.filesDelete },
  }),
}));

vi.mock('../logger/index.js', () => ({ logActivity: mocks.logActivity }));
vi.mock('../output/table.js', () => ({ formatRows: () => 'rows' }));
vi.mock('fs', () => ({
  default: {
    existsSync: mocks.existsSync,
    createWriteStream: () => {
      const { Writable } = require('stream');
      return new Writable({ write: (_c: unknown, _e: unknown, cb: () => void) => cb() });
    },
    promises: mocks.promises,
  },
}));

import { inboxCommand, receiveCommand, sendCommand } from './transfers.js';

const output = () => vi.mocked(console.log).mock.calls.map((call) => call.join(' ')).join('\n');
const errors = () => vi.mocked(console.error).mock.calls.map((call) => call.join(' ')).join('\n');

const transfer = {
  id: 'transfer-1',
  drive_file_id: 'file-1',
  name: 'db.tar.gz',
  bytes: 2048,
  status: 'pending' as const,
  direction: 'in' as const,
  created_at: '2026-09-26T10:00:00.000Z',
};

function streamOf(chunks: string[] = ['bytes']) {
  const { Readable } = require('stream');
  return Readable.from(chunks);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.existsSync.mockReturnValue(true);
  mocks.fetchTransfers.mockResolvedValue([]);
  mocks.ensureDirectory.mockResolvedValue('transfers_id');
  mocks.uploadFile.mockResolvedValue({ id: 'file-1', name: 'db.tar.gz', size: '2048' });
  mocks.createTransfer.mockResolvedValue({ id: 'transfer-1' });
  mocks.promises.mkdir.mockResolvedValue(undefined);
  mocks.promises.rename.mockResolvedValue(undefined);
  mocks.promises.rm.mockResolvedValue(undefined);
});

describe('sendCommand', () => {
  it('uploads to Drive then registers the transfer', async () => {
    await sendCommand.parseAsync(['./db.tar.gz', '--to', 'vps-2'], { from: 'user' });

    expect(mocks.ensureDirectory).toHaveBeenCalledWith('transfers');
    expect(mocks.uploadFile).toHaveBeenCalledWith(
      './db.tar.gz',
      undefined,
      'db.tar.gz',
      'transfers_id',
    );
    expect(mocks.createTransfer).toHaveBeenCalledWith({
      drive_file_id: 'file-1',
      name: 'db.tar.gz',
      to: 'vps-2',
      bytes: 2048,
    });
    expect(output()).toContain('Sent db.tar.gz to vps-2');
  });

  it('removes the uploaded file when registration fails', async () => {
    mocks.createTransfer.mockRejectedValue(new Error('No active device named "nope"'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      sendCommand.parseAsync(['./db.tar.gz', '--to', 'nope'], { from: 'user' }),
    ).rejects.toThrow('No active device');

    expect(mocks.filesDelete).toHaveBeenCalledWith({ fileId: 'file-1' });
    exitSpy.mockRestore();
  });

  it('refuses a file that is not there', async () => {
    mocks.existsSync.mockReturnValue(false);

    await sendCommand.parseAsync(['./missing', '--to', 'vps-2'], { from: 'user' });

    expect(errors()).toContain('No such file: ./missing');
    expect(process.exitCode).toBe(1);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    process.exitCode = 0;
  });
});

describe('inboxCommand', () => {
  it('says so when empty', async () => {
    await inboxCommand.parseAsync([], { from: 'user' });
    expect(output()).toContain('Inbox is empty');
  });

  it('lists what was sent to this machine', async () => {
    mocks.fetchTransfers.mockResolvedValue([transfer]);

    await inboxCommand.parseAsync([], { from: 'user' });

    expect(mocks.fetchTransfers).toHaveBeenCalledWith(true);
    expect(output()).toContain('justdrive receive');
  });
});

describe('receiveCommand', () => {
  it('says so when nothing matches', async () => {
    mocks.fetchTransfers.mockResolvedValue([transfer]);

    await receiveCommand.parseAsync(['nope'], { from: 'user' });

    expect(output()).toContain('No pending transfer matching');
  });

  it('refuses an ambiguous prefix instead of downloading several files', async () => {
    mocks.fetchTransfers.mockResolvedValue([
      transfer,
      { ...transfer, id: 'transfer-2', name: 'other.tar.gz' },
    ]);

    await receiveCommand.parseAsync(['transfer'], { from: 'user' });

    expect(errors()).toContain('matches 2 transfers');
    expect(mocks.filesGet).not.toHaveBeenCalled();
  });

  it('downloads through a temp file and acks', async () => {
    mocks.fetchTransfers.mockResolvedValue([transfer]);
    mocks.filesGet.mockResolvedValue({ data: streamOf() });

    await receiveCommand.parseAsync(['transfer-1', '/tmp/dest'], { from: 'user' });

    expect(mocks.promises.rename).toHaveBeenCalledWith('/tmp/dest/db.tar.gz.part', '/tmp/dest/db.tar.gz');
    expect(mocks.ackTransfer).toHaveBeenCalledWith('transfer-1');
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'receive', path: 'transfers/db.tar.gz' }),
    );
    expect(output()).toContain('Received db.tar.gz -> /tmp/dest/db.tar.gz');
  });

  it('refuses a name that would escape the destination', async () => {
    mocks.fetchTransfers.mockResolvedValue([
      { ...transfer, name: '../../../../home/vps/.ssh/authorized_keys' },
    ]);
    mocks.filesGet.mockResolvedValue({ data: streamOf() });

    await receiveCommand.parseAsync(['transfer-1', '/tmp/dest'], { from: 'user' });

    expect(errors()).toContain('Unsafe transfer name');
    expect(mocks.promises.rename).not.toHaveBeenCalled();
  });

  it('keeps going when the ack fails, since the file is already on disk', async () => {
    mocks.fetchTransfers.mockResolvedValue([transfer, { ...transfer, id: 'transfer-2', name: 'b.txt' }]);
    mocks.filesGet.mockResolvedValue({ data: streamOf() });
    mocks.ackTransfer.mockRejectedValueOnce(new Error('offline'));

    await receiveCommand.parseAsync(['all', '/tmp/dest'], { from: 'user' });

    expect(output()).toContain('Received db.tar.gz');
    expect(output()).toContain('Received b.txt');
    expect(output()).toContain('not acknowledged');
  });

  it('cleans up a partial download and moves on', async () => {
    mocks.fetchTransfers.mockResolvedValue([transfer, { ...transfer, id: 'transfer-2', name: 'b.txt' }]);
    const { Readable } = await import('stream');
    mocks.filesGet
      .mockResolvedValueOnce({ data: new Readable({ read() { this.destroy(new Error('dropped')); } }) })
      .mockResolvedValueOnce({ data: Readable.from(['ok']) });

    await receiveCommand.parseAsync(['all', '/tmp/dest'], { from: 'user' });

    expect(errors()).toContain('Skipped db.tar.gz: dropped');
    expect(mocks.promises.rm).toHaveBeenCalledWith('/tmp/dest/db.tar.gz.part', { force: true });
    expect(output()).toContain('Received b.txt');
  });
});
