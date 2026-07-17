import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../drive/operations.js', () => ({
  shareFile: vi.fn(),
}));

import { shareCommand } from './share.js';
import { shareFile } from '../drive/operations.js';

describe('shareCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and description', () => {
    expect(shareCommand.name()).toBe('share');
    expect(shareCommand.description()).toBe('Share a file');
  });

  it('calls shareFile', async () => {
    vi.mocked(shareFile).mockResolvedValue('https://drive.google.com/link' as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await shareCommand.parseAsync(['share', '/file.txt'], { from: 'user' });

    expect(shareFile).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Shared'));
    logSpy.mockRestore();
  });

  it('passes email and role options', async () => {
    vi.mocked(shareFile).mockResolvedValue('https://drive.google.com/link' as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await shareCommand.parseAsync(['share', '/file.txt', '--email', 'user@test.com', '--role', 'writer'], {
      from: 'user',
    });

    expect(shareFile).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('exits with code 1 on error', async () => {
    vi.mocked(shareFile).mockRejectedValue(new Error('share failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await shareCommand.parseAsync(['share', '/file.txt'], { from: 'user' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
