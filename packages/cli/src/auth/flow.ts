import http from 'http';
import crypto from 'crypto';
import open from 'open';
import { loadAuth, saveAuth, clearTokens } from './tokens.js';
import { describeError } from './errors.js';
import {
  AUTH_TIMEOUT_MS,
  AuthError,
  DEFAULT_PORT,
  DRIVE_FILE_SCOPE,
  DRIVE_SCOPE,
  LOOPBACK_HOST,
  OAuthTokens,
  findAvailablePort,
} from '@juststore/shared';
import { logActivity } from '../logger/index.js';
import { createOAuth2Client, fetchAccountEmail, resetDriveClient, OAuth2Client } from '../drive/client.js';
import { clearCache } from '../drive/cache.js';
import { CONSOLE_AUDIENCE_URL, loadCredentials } from '../config/credentials.js';

const CALLBACK_PATH = '/oauth2callback';

type AuthUrlOptions = NonNullable<Parameters<OAuth2Client['generateAuthUrl']>[0]>;

export interface LoginOptions {
  /** Request the restricted full-Drive scope instead of drive.file. */
  fullAccess?: boolean;
  /** Launch the system browser. When false, only print the URL. */
  openBrowser?: boolean;
  port?: number;
  timeoutMs?: number;
}

export async function runAuthLogin(options: LoginOptions = {}): Promise<void> {
  const scope = options.fullAccess ? DRIVE_SCOPE : DRIVE_FILE_SCOPE;
  const creds = await loadCredentials();
  const port = await findAvailablePort(options.port ?? DEFAULT_PORT);
  const redirectUri = `http://${LOOPBACK_HOST}:${port}${CALLBACK_PATH}`;
  const client = await createOAuth2Client(redirectUri);

  const state = crypto.randomBytes(32).toString('base64url');
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [scope],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256' as AuthUrlOptions['code_challenge_method'],
  });

  let email: string | null = null;

  await receiveCallback({
    port,
    expectedState: state,
    timeoutMs: options.timeoutMs ?? AUTH_TIMEOUT_MS,
    onListening: () => {
      console.log('Sign in with Google to continue.');
      console.log(`If your browser doesn't open, visit:\n\n  ${authUrl}\n`);
      if (options.openBrowser !== false) {
        open(authUrl).catch(() => {});
      }
    },
    onCode: async (code) => {
      const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: redirectUri });
      const granted = tokens.scope ? tokens.scope.split(' ') : [scope];
      if (!granted.includes(scope) && !granted.includes(DRIVE_SCOPE)) {
        throw new AuthError(
          'Google Drive access was not granted. Run login again and allow Drive access on the consent screen.',
        );
      }

      client.setCredentials(tokens);
      email = await fetchAccountEmail(client).catch(() => null);

      // Cached folder IDs belong to whichever account was signed in before.
      await clearCache();
      resetDriveClient();
      await saveAuth({
        version: 1,
        clientId: creds.clientId,
        scopes: granted,
        email,
        tokens: tokens as OAuthTokens,
      });

      if (!tokens.refresh_token) {
        console.warn(
          'Warning: Google did not return a refresh token; you will need to log in again when this session expires.',
        );
      }
    },
  });

  await logActivity({
    timestamp: new Date().toISOString(),
    operation: 'login',
    path: '/',
    status: 'success',
    detail: email ?? undefined,
  });
  console.log(email ? `Authenticated as ${email}` : 'Authentication successful!');
}

interface CallbackOptions {
  port: number;
  expectedState: string;
  timeoutMs: number;
  onListening: () => void;
  onCode: (code: string) => Promise<void>;
}

/**
 * Serve a single OAuth redirect on the loopback interface. Requests with a
 * missing or wrong `state` are rejected without ending the flow, so a stray or
 * forged request can't abort or hijack the login.
 */
function receiveCallback(options: CallbackOptions): Promise<void> {
  const { port, expectedState, timeoutMs, onListening, onCode } = options;

  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://${LOOPBACK_HOST}:${port}`);
      if (req.method !== 'GET' || url.pathname !== CALLBACK_PATH) {
        sendPage(res, 404, 'Not found', '');
        return;
      }
      if (!safeEqual(url.searchParams.get('state') ?? '', expectedState)) {
        sendPage(res, 400, 'Invalid request', 'This sign-in link is invalid or has expired. Return to the terminal and try again.');
        return;
      }
      if (settled) {
        sendPage(res, 409, 'Already signed in', 'This sign-in has already completed. You can close this tab.');
        return;
      }
      settled = true;

      try {
        const oauthError = url.searchParams.get('error');
        if (oauthError) throw authorizationError(oauthError);

        const code = url.searchParams.get('code');
        if (!code) throw new AuthError('No authorization code received.');

        await onCode(code);
        sendPage(res, 200, 'Authenticated', 'You can close this tab and return to the terminal.');
        finish();
      } catch (error) {
        sendPage(res, 400, 'Authentication failed', describeError(error));
        finish(error);
      }
    });

    const timer = setTimeout(() => {
      settled = true;
      finish(new AuthError('Timed out waiting for Google sign-in. Run: justdrive auth login'));
    }, timeoutMs);

    function finish(error?: unknown) {
      clearTimeout(timer);
      server.close();
      if (error) reject(error);
      else resolve();
    }

    server.once('error', finish);
    server.listen(port, LOOPBACK_HOST, onListening);
  });
}

function authorizationError(code: string): AuthError {
  if (code === 'access_denied') {
    return new AuthError(
      'Access was denied.\n' +
        'If you cancelled, run login again. If Google said this app is in testing or unverified,\n' +
        `the OAuth client's owner must add your account as a test user at:\n  ${CONSOLE_AUDIENCE_URL}\n` +
        'or you can use your own client: justdrive auth setup <client_secret.json>',
    );
  }
  return new AuthError(`Google returned an error: ${code}`);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sendPage(res: http.ServerResponse, status: number, title: string, body: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    Connection: 'close',
  });
  res.end(
    `<!doctype html><meta charset="utf-8"><title>justdrive</title>` +
      `<body style="font-family:system-ui;max-width:40rem;margin:4rem auto;padding:0 1rem">` +
      `<h1>${escapeHtml(title)}</h1><p style="white-space:pre-wrap">${escapeHtml(body)}</p></body>`,
  );
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export async function runAuthLogout(): Promise<void> {
  const auth = await loadAuth().catch(() => null);
  // Revoking the refresh token revokes the whole grant, including access tokens.
  const token = auth?.tokens.refresh_token ?? auth?.tokens.access_token;

  let revoked = false;
  if (token) {
    try {
      const oauth2Client = await createOAuth2Client();
      await oauth2Client.revokeToken(token);
      revoked = true;
    } catch {
      // Token may already be invalid, or credentials are no longer configured.
    }
  }

  await clearTokens();
  await clearCache();
  resetDriveClient();
  await logActivity({
    timestamp: new Date().toISOString(),
    operation: 'logout',
    path: '/',
    status: 'success',
  });

  console.log(
    revoked || !token
      ? 'Logged out successfully.'
      : 'Logged out locally. Could not revoke access with Google; remove it at https://myaccount.google.com/permissions',
  );
}
