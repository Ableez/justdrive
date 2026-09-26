import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth/tokens.js', () => ({
  loadAuth: vi.fn(),
  saveAuth: vi.fn(),
}));

vi.mock('../drive/cache.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('../drive/client.js', () => ({
  getAuthenticatedClient: vi.fn().mockResolvedValue({}),
  fetchAccountEmail: vi.fn(),
}));

import { statusCommand } from './status.js';
import { loadAuth, saveAuth } from '../auth/tokens.js';
import { loadConfig } from '../drive/cache.js';
import { fetchAccountEmail } from '../drive/client.js';
import { DRIVE_FILE_SCOPE, DRIVE_SCOPE, StoredAuth } from '@juststore/shared';

const auth: StoredAuth = {
  version: 1,
  clientId: 'c',
  scopes: [DRIVE_FILE_SCOPE],
  email: 'user@test.com',
  tokens: { access_token: 'at', refresh_token: 'rt' },
};

describe('statusCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  const output = () => logSpy.mock.calls.map((c) => c.join(' ')).join('\n');

  it('has correct name and description', () => {
    expect(statusCommand.name()).toBe('status');
    expect(statusCommand.description()).toBe('Show current status');
  });

  it('shows not authenticated when logged out', async () => {
    vi.mocked(loadAuth).mockResolvedValue(null);
    await statusCommand.parseAsync(['status'], { from: 'user' });
    expect(output()).toContain('Not authenticated');
  });

  it('verifies the session live and shows account and access level', async () => {
    vi.mocked(loadAuth).mockResolvedValue(auth);
    vi.mocked(fetchAccountEmail).mockResolvedValue('user@test.com');
    vi.mocked(loadConfig).mockResolvedValue({ rootFolderId: 'folder_123' });

    await statusCommand.parseAsync(['status'], { from: 'user' });

    expect(output()).toContain('Authenticated');
    expect(output()).toContain('User: user@test.com');
    expect(output()).toContain('files created by justdrive');
    expect(output()).toContain('folder_123');
    expect(saveAuth).not.toHaveBeenCalled();
  });

  it('reports full access and backfills a missing email', async () => {
    vi.mocked(loadAuth).mockResolvedValue({ ...auth, email: undefined, scopes: [DRIVE_SCOPE] });
    vi.mocked(fetchAccountEmail).mockResolvedValue('new@test.com');

    await statusCommand.parseAsync(['status'], { from: 'user' });

    expect(output()).toContain('entire Google Drive');
    expect(saveAuth).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@test.com' }));
  });

  it('reports an invalid session instead of a stale expiry time', async () => {
    vi.mocked(loadAuth).mockResolvedValue(auth);
    vi.mocked(fetchAccountEmail).mockRejectedValue(new Error('invalid_grant'));

    await statusCommand.parseAsync(['status'], { from: 'user' });

    expect(output()).toContain('Session invalid');
    expect(output()).toContain('expired or was revoked');
  });

  it('warns when no refresh token is saved', async () => {
    vi.mocked(loadAuth).mockResolvedValue({ ...auth, tokens: { access_token: 'at' } });
    vi.mocked(fetchAccountEmail).mockResolvedValue('user@test.com');

    await statusCommand.parseAsync(['status'], { from: 'user' });

    expect(output()).toContain('No refresh token');
  });

  it('exits 1 with a readable message when the saved login is unreadable', async () => {
    vi.mocked(loadAuth).mockRejectedValue(new Error('Saved login is corrupted'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await statusCommand.parseAsync(['status'], { from: 'user' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Status check failed:', 'Saved login is corrupted');
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
