import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'net';

const oauthClient = {
  generateCodeVerifierAsync: vi.fn(),
  generateAuthUrl: vi.fn(),
  getToken: vi.fn(),
  setCredentials: vi.fn(),
  revokeToken: vi.fn(),
};

vi.mock('open', () => ({ default: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../drive/client.js', () => ({
  createOAuth2Client: vi.fn(async () => oauthClient),
  fetchAccountEmail: vi.fn(),
  resetDriveClient: vi.fn(),
}));

vi.mock('../drive/cache.js', () => ({ clearCache: vi.fn() }));

vi.mock('../config/credentials.js', () => ({
  loadCredentials: vi.fn().mockResolvedValue({ clientId: 'client-1', source: 'env' }),
  CONSOLE_AUDIENCE_URL: 'https://console.example/audience',
}));

vi.mock('./tokens.js', () => ({
  saveAuth: vi.fn(),
  clearTokens: vi.fn(),
  loadAuth: vi.fn(),
}));

vi.mock('../logger/index.js', () => ({ logActivity: vi.fn() }));

vi.mock('@juststore/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@juststore/shared')>();
  return { ...actual, findAvailablePort: vi.fn() };
});

import open from 'open';
import { findAvailablePort, DRIVE_FILE_SCOPE, DRIVE_SCOPE } from '@juststore/shared';
import { runAuthLogin, runAuthLogout, escapeHtml } from './flow.js';
import { createOAuth2Client, fetchAccountEmail, resetDriveClient } from '../drive/client.js';
import { clearCache } from '../drive/cache.js';
import { loadAuth, saveAuth, clearTokens } from './tokens.js';
import { logActivity } from '../logger/index.js';

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

/** Start a login and return the auth URL params once the callback server is up. */
async function startLogin(options: Parameters<typeof runAuthLogin>[0] = {}) {
  const port = await freePort();
  vi.mocked(findAvailablePort).mockResolvedValue(port);

  let authParams!: Record<string, unknown>;
  const listening = new Promise<void>((resolve) => {
    oauthClient.generateAuthUrl.mockImplementation((params) => {
      authParams = params;
      return 'https://accounts.google.com/o/oauth2/auth?fake';
    });
    vi.mocked(console.log).mockImplementation((msg?: unknown) => {
      if (String(msg).includes("browser doesn't open")) resolve();
    });
  });

  const login = runAuthLogin(options);
  login.catch(() => {});
  await listening;

  const callback = (query: Record<string, string>) =>
    fetch(`http://127.0.0.1:${port}/oauth2callback?${new URLSearchParams(query)}`);

  return { login, authParams, callback, port };
}

describe('auth/flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    oauthClient.generateCodeVerifierAsync.mockResolvedValue({
      codeVerifier: 'verifier',
      codeChallenge: 'challenge',
    });
    oauthClient.getToken.mockResolvedValue({
      tokens: { access_token: 'at', refresh_token: 'rt', scope: DRIVE_FILE_SCOPE },
    });
    vi.mocked(fetchAccountEmail).mockResolvedValue('me@test.com');
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
    vi.mocked(console.warn).mockRestore();
  });

  describe('runAuthLogin', () => {
    it('requests drive.file with PKCE and state on a loopback redirect', async () => {
      const { login, authParams, callback, port } = await startLogin();

      expect(createOAuth2Client).toHaveBeenCalledWith(`http://127.0.0.1:${port}/oauth2callback`);
      expect(authParams).toMatchObject({
        access_type: 'offline',
        scope: [DRIVE_FILE_SCOPE],
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
      });
      expect(String(authParams.state)).toMatch(/^[\w-]{43}$/);
      expect(open).toHaveBeenCalled();

      const res = await callback({ code: 'the-code', state: String(authParams.state) });
      expect(res.status).toBe(200);
      await login;

      expect(oauthClient.getToken).toHaveBeenCalledWith({
        code: 'the-code',
        codeVerifier: 'verifier',
        redirect_uri: `http://127.0.0.1:${port}/oauth2callback`,
      });
      expect(clearCache).toHaveBeenCalled();
      expect(resetDriveClient).toHaveBeenCalled();
      expect(saveAuth).toHaveBeenCalledWith({
        version: 1,
        clientId: 'client-1',
        scopes: [DRIVE_FILE_SCOPE],
        email: 'me@test.com',
        tokens: expect.objectContaining({ refresh_token: 'rt' }),
      });
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ operation: 'login' }));
    });

    it('requests the full drive scope with --full-access and skips the browser with --no-browser', async () => {
      oauthClient.getToken.mockResolvedValue({ tokens: { access_token: 'at', scope: DRIVE_SCOPE } });
      const { login, authParams, callback } = await startLogin({ fullAccess: true, openBrowser: false });

      expect(authParams.scope).toEqual([DRIVE_SCOPE]);
      expect(open).not.toHaveBeenCalled();

      await callback({ code: 'c', state: String(authParams.state) });
      await login;
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('refresh token'));
    });

    it('ignores callbacks with a wrong state and keeps waiting', async () => {
      const { login, authParams, callback } = await startLogin();

      const forged = await callback({ code: 'attacker-code', state: 'forged' });
      expect(forged.status).toBe(400);
      expect(oauthClient.getToken).not.toHaveBeenCalled();

      await callback({ code: 'real', state: String(authParams.state) });
      await login;
      expect(oauthClient.getToken).toHaveBeenCalledWith(expect.objectContaining({ code: 'real' }));
    });

    it('fails when the user denies access, with test-user guidance', async () => {
      const { login, authParams, callback } = await startLogin();

      const res = await callback({ error: 'access_denied', state: String(authParams.state) });
      expect(res.status).toBe(400);
      await expect(login).rejects.toThrow(/test user[\s\S]*console\.example/);
      expect(saveAuth).not.toHaveBeenCalled();
    });

    it('fails when Drive access was unticked on the consent screen', async () => {
      oauthClient.getToken.mockResolvedValue({
        tokens: { access_token: 'at', refresh_token: 'rt', scope: 'openid' },
      });
      const { login, authParams, callback } = await startLogin();

      await callback({ code: 'c', state: String(authParams.state) });
      await expect(login).rejects.toThrow(/Drive access was not granted/);
      expect(saveAuth).not.toHaveBeenCalled();
    });

    it('escapes error details in the browser page', async () => {
      oauthClient.getToken.mockRejectedValue(new Error('<script>alert(1)</script>'));
      const { login, authParams, callback } = await startLogin();

      const res = await callback({ code: 'c', state: String(authParams.state) });
      const html = await res.text();
      expect(html).not.toContain('<script>');
      expect(html).toContain('&#60;script&#62;');
      await expect(login).rejects.toThrow();
    });

    it('404s unrelated requests without ending the flow', async () => {
      const { login, authParams, callback, port } = await startLogin();

      expect((await fetch(`http://127.0.0.1:${port}/favicon.ico`)).status).toBe(404);

      await callback({ code: 'c', state: String(authParams.state) });
      await login;
    });

    it('reports other OAuth errors and a missing code', async () => {
      const first = await startLogin();
      await first.callback({ error: 'invalid_scope', state: String(first.authParams.state) });
      await expect(first.login).rejects.toThrow('Google returned an error: invalid_scope');

      const second = await startLogin();
      await second.callback({ state: String(second.authParams.state) });
      await expect(second.login).rejects.toThrow('No authorization code received.');
    });

    it('falls back to the requested scope when Google omits it', async () => {
      oauthClient.getToken.mockResolvedValue({ tokens: { access_token: 'at', refresh_token: 'rt' } });
      vi.mocked(fetchAccountEmail).mockRejectedValue(new Error('offline'));
      const { login, authParams, callback } = await startLogin();

      await callback({ code: 'c', state: String(authParams.state) });
      await login;

      expect(saveAuth).toHaveBeenCalledWith(
        expect.objectContaining({ scopes: [DRIVE_FILE_SCOPE], email: null }),
      );
      expect(console.log).toHaveBeenCalledWith('Authentication successful!');
    });

    it('times out if the user never finishes', async () => {
      const { login } = await startLogin({ timeoutMs: 50 });
      await expect(login).rejects.toThrow(/Timed out/);
    });
  });

  describe('runAuthLogout', () => {
    const saved = { version: 1 as const, clientId: 'c', scopes: [], tokens: { refresh_token: 'rt_123', access_token: 'at' } };

    it('revokes the grant and clears tokens and cache', async () => {
      vi.mocked(loadAuth).mockResolvedValue(saved);
      oauthClient.revokeToken.mockResolvedValue({});

      await runAuthLogout();

      expect(oauthClient.revokeToken).toHaveBeenCalledWith('rt_123');
      expect(clearTokens).toHaveBeenCalled();
      expect(clearCache).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'logout', status: 'success' }),
      );
      expect(console.log).toHaveBeenCalledWith('Logged out successfully.');
    });

    it('handles missing tokens gracefully', async () => {
      vi.mocked(loadAuth).mockResolvedValue(null);
      await runAuthLogout();
      expect(oauthClient.revokeToken).not.toHaveBeenCalled();
      expect(clearTokens).toHaveBeenCalled();
    });

    it('still logs out locally when the token file is corrupted', async () => {
      vi.mocked(loadAuth).mockRejectedValue(new Error('corrupted'));
      await runAuthLogout();
      expect(clearTokens).toHaveBeenCalled();
    });

    it('tells the user when revocation failed', async () => {
      vi.mocked(loadAuth).mockResolvedValue(saved);
      oauthClient.revokeToken.mockRejectedValue(new Error('revoke failed'));

      await runAuthLogout();

      expect(clearTokens).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('myaccount.google.com/permissions'));
    });
  });

  it('escapeHtml escapes markup characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&#60;a href=&#34;x&#34;&#62;&#39;&#38;&#39;&#60;/a&#62;');
  });
});
