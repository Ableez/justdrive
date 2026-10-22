import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runLogout: vi.fn(),
  clearCache: vi.fn(),
  resetDriveClient: vi.fn(),
  pendingCount: vi.fn(),
}));

vi.mock('../api/device-login.js', () => ({ runLogout: mocks.runLogout }));
vi.mock('../api/client.js', () => ({ getApiUrl: () => 'https://justdrive.astexlabs.com' }));
vi.mock('../drive/cache.js', () => ({ clearCache: mocks.clearCache }));
vi.mock('../drive/client.js', () => ({ resetDriveClient: mocks.resetDriveClient }));
vi.mock('../logger/outbox.js', () => ({ pendingCount: mocks.pendingCount }));

import { logoutCommand } from './logout.js';

const output = () => vi.mocked(console.log).mock.calls.map((call) => call.join(' ')).join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.pendingCount.mockResolvedValue(0);
  mocks.runLogout.mockResolvedValue('');
});

afterEach(() => {
  process.exitCode = undefined;
});

describe('logoutCommand', () => {
  it('has a name and a description', () => {
    expect(logoutCommand.name()).toBe('logout');
    expect(logoutCommand.description()).toBe('Revoke this machine and delete its local session');
  });

  it('revokes the device and clears local state', async () => {
    await logoutCommand.parseAsync([], { from: 'user' });

    expect(mocks.runLogout).toHaveBeenCalled();
    expect(mocks.clearCache).toHaveBeenCalled();
    expect(mocks.resetDriveClient).toHaveBeenCalled();
    expect(output()).toContain('Signed out.');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('says so when the server could not revoke the device', async () => {
    mocks.runLogout.mockResolvedValue('fetch failed');

    await logoutCommand.parseAsync([], { from: 'user' });

    expect(output()).toContain('Signed out on this machine only.');
    expect(output()).toContain('fetch failed');
    expect(output()).toContain('justdrive.astexlabs.com/devices');
    // A machine the user believes they revoked must not exit successfully.
    expect(process.exitCode).toBe(1);
    // The local session still goes, because the user asked to be signed out here.
    expect(mocks.clearCache).toHaveBeenCalled();
    expect(mocks.resetDriveClient).toHaveBeenCalled();
  });

  it('mentions activity events it could not deliver', async () => {
    mocks.pendingCount.mockResolvedValue(3);

    await logoutCommand.parseAsync([], { from: 'user' });

    expect(output()).toContain('3 unsent activity events');
  });
});
