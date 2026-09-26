import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  fetchDriveToken: vi.fn(),
  pendingCount: vi.fn(),
  flush: vi.fn(),
}));

vi.mock('../api/client.js', () => ({
  requireSession: mocks.requireSession,
  fetchDriveToken: mocks.fetchDriveToken,
}));
vi.mock('../logger/outbox.js', () => ({
  pendingCount: mocks.pendingCount,
  flush: mocks.flush,
}));

import { statusCommand } from './status.js';

const output = () => vi.mocked(console.log).mock.calls.map((call) => call.join(' ')).join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.requireSession.mockResolvedValue({
    deviceName: 'vps-1',
    email: 'a@b.com',
    apiUrl: 'https://drive.astexlabs.com',
  });
  mocks.pendingCount.mockResolvedValue(0);
  mocks.flush.mockResolvedValue({ sent: 0, remaining: 0 });
});

describe('statusCommand', () => {
  it('shows the machine, account and server', async () => {
    await statusCommand.parseAsync([], { from: 'user' });

    expect(output()).toContain('Machine: vps-1');
    expect(output()).toContain('Account: a@b.com');
    expect(output()).toContain('Server: https://drive.astexlabs.com');
  });

  it('reports a live Drive token and syncs the queue', async () => {
    mocks.fetchDriveToken.mockResolvedValue({ expiry_date: Date.now() + 3_600_000 });

    await statusCommand.parseAsync([], { from: 'user' });

    expect(output()).toMatch(/Drive reachable/);
    expect(mocks.flush).toHaveBeenCalled();
  });

  it('flags unsent activity', async () => {
    mocks.pendingCount.mockResolvedValue(5);
    mocks.fetchDriveToken.mockResolvedValue({ expiry_date: Date.now() + 3_600_000 });

    await statusCommand.parseAsync([], { from: 'user' });

    expect(output()).toContain('5 activity events waiting to sync');
  });

  it('does not fail the whole command when Drive is unreachable', async () => {
    mocks.fetchDriveToken.mockRejectedValue(new Error('Google Drive is not connected.'));

    await statusCommand.parseAsync([], { from: 'user' });

    expect(output()).toContain('Drive unavailable: Google Drive is not connected.');
    expect(output()).toContain('Machine: vps-1');
  });
});
