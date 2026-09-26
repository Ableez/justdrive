import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../server/index.js', () => ({
  startDashboard: vi.fn(),
}));

import { dashboardCommand } from './dashboard.js';
import { startDashboard } from '../server/index.js';

describe('dashboardCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and description', () => {
    expect(dashboardCommand.name()).toBe('dashboard');
    expect(dashboardCommand.description()).toBe('Start the companion dashboard');
  });

  it('calls startDashboard with no port by default', async () => {
    vi.mocked(startDashboard).mockResolvedValue(undefined as never);
    await dashboardCommand.parseAsync(['dashboard'], { from: 'user' });
    expect(startDashboard).toHaveBeenCalledWith({ port: undefined, openBrowser: undefined });
  });

  it('passes custom port', async () => {
    vi.mocked(startDashboard).mockResolvedValue(undefined as never);
    await dashboardCommand.parseAsync(['dashboard', '--port', '5000', '--open'], { from: 'user' });
    expect(startDashboard).toHaveBeenCalledWith({ port: 5000, openBrowser: true });
  });

  it('exits with code 1 on error', async () => {
    vi.mocked(startDashboard).mockRejectedValue(new Error('server failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await dashboardCommand.parseAsync(['dashboard'], { from: 'user' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
