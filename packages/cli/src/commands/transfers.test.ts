import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ackTransfer: vi.fn(),
  createTransfer: vi.fn(),
  fetchTransfers: vi.fn(),
  uploadFile: vi.fn(),
  ensureDirectory: vi.fn(),
  getFileById: vi.fn(),
  logActivity: vi.fn(),
  existsSync: vi.fn(),
  filesGet: vi.fn(),
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
vi.mock('../drive/resolver.js', () => ({ getFileById: mocks.getFileById }));
vi.mock('../drive/client.js', () => ({
  getDriveClient: async () => ({ files: { get: mocks.filesGet } }),
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
  },
}));

import { inboxCommand, receiveCommand, sendCommand } from './transfers.js';

const output = () => vi.mocked(console.log).mock.calls.map((call) => call.join(' ')).join('\n');

const transfer = {
  id: 'transfer-1',
  drive_file_id: 'file-1',
  name: 'db.tar.gz',
  bytes: 2048,
  status: 'pending',
  direction: 'in' as const,
  created_at: '2026-09-26T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.existsSync.mockReturnValue(true);
  mocks.fetchTransfers.mockResolvedValue([]);
  mocks.ensureDirectory.mockResolvedValue('transfers_id');
  mocks.uploadFile.mockResolvedValue({ id: 'file-1', name: 'db.tar.gz', size: '2048' });
  mocks.createTransfer.mockResolvedValue({ id: 'transfer-1' });
  mocks.getFileById.mockResolvedValue({ id: 'file-1', name: 'db.tar.gz' });
  mocks.filesGet.mockResolvedValue({ data: { pipe: () => undefined, on: () => undefined } });
});

describe('sendCommand', () => {
  it('uploads to Drive then registers the transfer', async () => {
    await sendCommand.parseAsync(['./db.tar.gz', '--to', 'vps-2'], { from: 'user' });

    expect(mocks.ensureDirectory).toHaveBeenCalledWith('transfers');
    expect(mocks.uploadFile).toHaveBeenCalledWith('./db.tar.gz', undefined, 'db.tar.gz', 'transfers_id');
    expect(mocks.createTransfer).toHaveBeenCalledWith({
      drive_file_id: 'file-1',
      name: 'db.tar.gz',
      to: 'vps-2',
      bytes: 2048,
    });
    expect(output()).toContain('Sent db.tar.gz to vps-2');
  });

  it('refuses a file that is not there', async () => {
    mocks.existsSync.mockReturnValue(false);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await sendCommand.parseAsync(['./missing', '--to', 'vps-2'], { from: 'user' });

    expect(errorSpy).toHaveBeenCalledWith('No such file: ./missing');
    expect(process.exitCode).toBe(1);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    errorSpy.mockRestore();
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

  it('acks a transfer once it is downloaded', async () => {
    mocks.fetchTransfers.mockResolvedValue([transfer]);
    const { Readable, Writable } = await import('stream');
    mocks.filesGet.mockResolvedValue({ data: Readable.from(['bytes']) });

    await receiveCommand.parseAsync(['transfer-1', '/tmp'], { from: 'user' });

    expect(mocks.ackTransfer).toHaveBeenCalledWith('transfer-1');
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'receive', path: 'transfers/db.tar.gz' }),
    );
    expect(output()).toContain('Received db.tar.gz -> /tmp/db.tar.gz');
  });

  it('takes everything in the inbox with "all"', async () => {
    mocks.fetchTransfers.mockResolvedValue([transfer]);
    const { Readable } = await import('stream');
    mocks.filesGet.mockResolvedValue({ data: Readable.from(['bytes']) });

    await receiveCommand.parseAsync(['all'], { from: 'user' });

    expect(mocks.ackTransfer).toHaveBeenCalledWith('transfer-1');
  });
});
