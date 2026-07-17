import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth/flow.js', () => ({
  runAuthLogin: vi.fn(),
  runAuthLogout: vi.fn(),
}));

import { authCommand } from './auth.js';
import { runAuthLogin, runAuthLogout } from '../auth/flow.js';

describe('authCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name and description', () => {
    expect(authCommand.name()).toBe('auth');
    expect(authCommand.description()).toBe('Authentication commands');
  });

  it('has login subcommand', () => {
    const subcommands = authCommand.commands.map((c) => c.name());
    expect(subcommands).toContain('login');
  });

  it('has logout subcommand', () => {
    const subcommands = authCommand.commands.map((c) => c.name());
    expect(subcommands).toContain('logout');
  });

  it('login calls runAuthLogin', async () => {
    vi.mocked(runAuthLogin).mockResolvedValue(undefined);
    const loginCmd = authCommand.commands.find((c) => c.name())!;
    await loginCmd.parseAsync(['login'], { from: 'user' });
    expect(runAuthLogin).toHaveBeenCalled();
  });

  it('logout calls runAuthLogout', async () => {
    vi.mocked(runAuthLogout).mockResolvedValue(undefined);
    const logoutCmd = authCommand.commands.find((c) => c.name() === 'logout')!;
    await logoutCmd.parseAsync(['logout'], { from: 'user' });
    expect(runAuthLogout).toHaveBeenCalled();
  });

  it('login exits with code 1 on error', async () => {
    vi.mocked(runAuthLogin).mockRejectedValue(new Error('auth failed'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const loginCmd = authCommand.commands.find((c) => c.name() === 'login')!;
    await loginCmd.parseAsync(['login'], { from: 'user' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
