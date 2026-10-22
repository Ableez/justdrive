import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listDevices: vi.fn(),
  requireSession: vi.fn(),
  fetchDriveToken: vi.fn(),
}));

vi.mock('../api/client.js', () => ({
  listDevices: mocks.listDevices,
  requireSession: mocks.requireSession,
  fetchDriveToken: mocks.fetchDriveToken,
  getApiUrl: () => 'https://justdrive.astexlabs.com',
}));

vi.mock('../output/table.js', () => ({ formatRows: () => 'rows' }));

import { devicesCommand } from './devices.js';

const output = () => vi.mocked(console.log).mock.calls.map((call) => call.join(' ')).join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('devicesCommand', () => {
  it('is named and described', () => {
    expect(devicesCommand.name()).toBe('devices');
    expect(devicesCommand.description()).toContain('machines');
  });

  it('lists machines', async () => {
    mocks.listDevices.mockResolvedValue([
      { id: 'd1', name: 'vps-1', is_self: true, last_seen_at: '2026-09-26T10:00:00.000Z' },
      { id: 'd2', name: 'vps-2', is_self: false, last_seen_at: null },
    ]);

    await devicesCommand.parseAsync([], { from: 'user' });

    expect(mocks.listDevices).toHaveBeenCalled();
    expect(output()).toContain('Revoke a machine');
  });

  it('says so when there are none', async () => {
    mocks.listDevices.mockResolvedValue([]);

    await devicesCommand.parseAsync([], { from: 'user' });

    expect(output()).toContain('No machines yet');
  });
});
