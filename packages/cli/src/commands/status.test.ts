import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth/tokens.js', () => ({
  loadTokens: vi.fn(),
}));

vi.mock('../drive/cache.js', () => ({
  loadConfig: vi.fn(),
}));

import { statusCommand } from './status.js';
import { loadTokens } from '../auth/tokens.js';
import { loadConfig } from '../drive/cache.js';

describe('statusCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and description', () => {
    expect(statusCommand.name()).toBe('status');
    expect(statusCommand.description()).toBe('Show current status');
  });

  it('shows not authenticated when no tokens', async () => {
    vi.mocked(loadTokens).mockResolvedValue(null);
    vi.mocked(loadConfig).mockResolvedValue({});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await statusCommand.parseAsync(['status'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Not authenticated'));
    logSpy.mockRestore();
  });

  it('shows authenticated status with tokens', async () => {
    vi.mocked(loadTokens).mockResolvedValue({
      access_token: 'at',
      refresh_token: 'rt',
      expiry_date: Date.now() + 3600000,
    });
    vi.mocked(loadConfig).mockResolvedValue({
      rootFolderId: 'folder_123',
      userEmail: 'user@test.com',
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await statusCommand.parseAsync(['status'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Authenticated'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('user@test.com'));
    logSpy.mockRestore();
  });

  it('shows expired token status', async () => {
    vi.mocked(loadTokens).mockResolvedValue({
      access_token: 'at',
      refresh_token: 'rt',
      expiry_date: Date.now() - 3600000,
    });
    vi.mocked(loadConfig).mockResolvedValue({});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await statusCommand.parseAsync(['status'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('EXPIRED'));
    logSpy.mockRestore();
  });
});
