import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth/flow.js', () => ({
  runAuthLogin: vi.fn(),
  runAuthLogout: vi.fn(),
}));

vi.mock('../config/credentials.js', () => ({
  importCredentialsFile: vi.fn(),
  getClientFilePath: vi.fn(() => '/home/u/.juststore/client.json'),
}));

import { authCommand } from './auth.js';
import { importCredentialsFile } from '../config/credentials.js';
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
    const loginCmd = authCommand.commands.find((c) => c.name() === 'login')!;
    await loginCmd.parseAsync(['--full-access', '--no-browser', '--port', '5050'], { from: 'user' });
    expect(runAuthLogin).toHaveBeenCalledWith({ fullAccess: true, openBrowser: false, port: 5050 });
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

  it('setup imports the client file', async () => {
    vi.mocked(importCredentialsFile).mockResolvedValue({ clientId: 'id', source: 'file' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const setupCmd = authCommand.commands.find((c) => c.name() === 'setup')!;
    await setupCmd.parseAsync(['/tmp/client_secret.json'], { from: 'user' });

    expect(importCredentialsFile).toHaveBeenCalledWith('/tmp/client_secret.json');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('client.json'));
    logSpy.mockRestore();
  });

  it.each(['logout', 'setup'])('%s exits with code 1 on error', async (name) => {
    vi.mocked(runAuthLogout).mockRejectedValue(new Error('boom'));
    vi.mocked(importCredentialsFile).mockRejectedValue(new Error('boom'));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const cmd = authCommand.commands.find((c) => c.name() === name)!;
    await cmd.parseAsync(name === 'setup' ? ['f.json'] : [], { from: 'user' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), 'boom');
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
