import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestDeviceCode: vi.fn(),
  completeDeviceLogin: vi.fn(),
  clearCache: vi.fn(),
  resetDriveClient: vi.fn(),
}));

vi.mock('../api/device-login.js', () => ({
  requestDeviceCode: mocks.requestDeviceCode,
  completeDeviceLogin: mocks.completeDeviceLogin,
}));

vi.mock('../drive/cache.js', () => ({ clearCache: mocks.clearCache }));
vi.mock('../drive/client.js', () => ({ resetDriveClient: mocks.resetDriveClient }));

import { loginCommand } from './login.js';

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
