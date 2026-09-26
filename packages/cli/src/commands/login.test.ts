import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestDeviceCode: vi.fn(),
  completeDeviceLogin: vi.fn(),
  clearCache: vi.fn(),
  resetDriveClient: vi.fn(),
  runLogout: vi.fn(),
  pendingCount: vi.fn(),
}));

vi.mock('../api/device-login.js', () => ({
  requestDeviceCode: mocks.requestDeviceCode,
  completeDeviceLogin: mocks.completeDeviceLogin,
  runLogout: mocks.runLogout,
}));

vi.mock('../drive/cache.js', () => ({ clearCache: mocks.clearCache }));
vi.mock('../drive/client.js', () => ({ resetDriveClient: mocks.resetDriveClient }));
vi.mock('../logger/outbox.js', () => ({ pendingCount: mocks.pendingCount }));

import { loginCommand } from './login.js';
import { logoutCommand } from './logout.js';

const code = {
  device_code: 'd',
  user_code: 'BCDF-GHJK',
  verification_uri: 'https://drive.astexlabs.com/device',
  verification_uri_complete: 'https://drive.astexlabs.com/device?user_code=BCDF-GHJK',
  expires_in: 600,
  interval: 5,
};

const output = () => vi.mocked(console.log).mock.calls.map((call) => call.join(' ')).join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.pendingCount.mockResolvedValue(0);
});

describe('loginCommand', () => {
  it('prints the code and waits for approval', async () => {
    mocks.requestDeviceCode.mockResolvedValue(code);
    mocks.completeDeviceLogin.mockResolvedValue({ deviceName: 'vps-2' });

    await loginCommand.parseAsync(['--name', 'vps-2'], { from: 'user' });

    expect(output()).toContain('BCDF-GHJK');
    expect(mocks.completeDeviceLogin).toHaveBeenCalledWith(
      code,
      expect.objectContaining({ name: 'vps-2' }),
    );
    expect(output()).toContain('Signed in as vps-2');
  });

  it('clears cached folder ids on sign-in, since another account may own them', async () => {
    mocks.requestDeviceCode.mockResolvedValue(code);
    mocks.completeDeviceLogin.mockResolvedValue({ deviceName: 'vps-2' });

    await loginCommand.parseAsync([], { from: 'user' });

    expect(mocks.clearCache).toHaveBeenCalled();
    expect(mocks.resetDriveClient).toHaveBeenCalled();
  });
});

describe('logoutCommand', () => {
  it('revokes the device and clears local state', async () => {
    mocks.runLogout.mockResolvedValue('');

    await logoutCommand.parseAsync([], { from: 'user' });

    expect(mocks.runLogout).toHaveBeenCalled();
    expect(mocks.clearCache).toHaveBeenCalled();
    expect(output()).toContain('Signed out.');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('says so when the server could not revoke the device', async () => {
    mocks.runLogout.mockResolvedValue('fetch failed');

    await logoutCommand.parseAsync([], { from: 'user' });

    expect(output()).toContain('Signed out on this machine only.');
    expect(output()).toContain('fetch failed');
    expect(output()).toContain('drive.astexlabs.com/devices');
    // A machine the user believes they revoked must not exit successfully.
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it('mentions activity events it could not deliver', async () => {
    mocks.pendingCount.mockResolvedValue(3);
    mocks.runLogout.mockResolvedValue('');

    await logoutCommand.parseAsync([], { from: 'user' });

    expect(output()).toContain('3 unsent activity events');
  });
});
