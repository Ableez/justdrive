import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../drive/operations.js', () => ({
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  listFiles: vi.fn(),
  createDirectory: vi.fn(),
  moveFile: vi.fn(),
  removeFile: vi.fn(),
}));

vi.mock('../output/table.js', () => ({
  formatTable: vi.fn(() => 'table-output'),
}));

vi.mock('../output/progress.js', () => ({
  withProgress: vi.fn((_text: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../output/json.js', () => ({
  formatJson: vi.fn((data: unknown) => JSON.stringify(data)),
}));

import { filesCommand } from './files.js';
import {
  uploadFile,
  downloadFile,
  listFiles,
  createDirectory,
  moveFile,
  removeFile,
} from '../drive/operations.js';

describe('filesCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and description', () => {
    expect(filesCommand.name()).toBe('files');
    expect(filesCommand.description()).toBe('File operations');
  });

  it('has all subcommands', () => {
    const subcommands = filesCommand.commands.map((c) => c.name());
    expect(subcommands).toEqual(
      expect.arrayContaining(['ls', 'upload', 'download', 'mkdir', 'mv', 'rm']),
    );
  });

  it('ls calls listFiles', async () => {
    const mockFiles = [{ id: '1', name: 'test.txt', mimeType: 'text/plain' }];
    vi.mocked(listFiles).mockResolvedValue(mockFiles as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const lsCmd = filesCommand.commands.find((c) => c.name() === 'ls')!;
    await lsCmd.parseAsync(['ls'], { from: 'user' });

    expect(listFiles).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('table-output');
    logSpy.mockRestore();
  });

  it('ls with --json outputs JSON', async () => {
    const mockFiles = [{ id: '1', name: 'test.txt', mimeType: 'text/plain' }];
    vi.mocked(listFiles).mockResolvedValue(mockFiles as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const lsCmd = filesCommand.commands.find((c) => c.name() === 'ls')!;
    await lsCmd.parseAsync(['ls', '--json'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(mockFiles));
    logSpy.mockRestore();
  });

  it('upload calls uploadFile', async () => {
    vi.mocked(uploadFile).mockResolvedValue({ id: '1', name: 'file.txt' } as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const uploadCmd = filesCommand.commands.find((c) => c.name() === 'upload')!;
    await uploadCmd.parseAsync(['upload', '/local/file.txt'], { from: 'user' });

    expect(uploadFile).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Uploaded'));
    logSpy.mockRestore();
  });

  it('download calls downloadFile', async () => {
    vi.mocked(downloadFile).mockResolvedValue('/local/file.txt' as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const downloadCmd = filesCommand.commands.find((c) => c.name() === 'download')!;
    await downloadCmd.parseAsync(['download', '/drive/file.txt'], { from: 'user' });

    expect(downloadFile).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('mkdir calls createDirectory', async () => {
    vi.mocked(createDirectory).mockResolvedValue({ id: '1', name: 'newdir' } as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mkdirCmd = filesCommand.commands.find((c) => c.name() === 'mkdir')!;
    await mkdirCmd.parseAsync(['mkdir', '/newdir'], { from: 'user' });

    expect(createDirectory).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('mv calls moveFile', async () => {
    vi.mocked(moveFile).mockResolvedValue({ id: '1', name: 'dest.txt' } as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mvCmd = filesCommand.commands.find((c) => c.name() === 'mv')!;
    await mvCmd.parseAsync(['mv', '/src', '/dest'], { from: 'user' });

    expect(moveFile).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('rm calls removeFile', async () => {
    vi.mocked(removeFile).mockResolvedValue(undefined as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const rmCmd = filesCommand.commands.find((c) => c.name() === 'rm')!;
    await rmCmd.parseAsync(['rm', '/file'], { from: 'user' });

    expect(removeFile).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
