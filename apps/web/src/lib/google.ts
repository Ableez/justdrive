import crypto from 'node:crypto';
import { isRetryableStatus, withRetry, type RetryOptions } from '@juststore/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { googleConnections, users } from '../db/schema';
import { open, seal } from './crypto';
import {
  ACCESS_TOKEN_REFRESH_SKEW_MS,
  DRIVE_FILE_SCOPE,
  ROOT_FOLDER_NAME,
  SIGN_IN_SCOPES,
} from './constants';
import { baseUrl, googleClientId, googleClientSecret } from './env';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
// A stalled Google call inside the refresh transaction would hold the advisory
// lock and the single pooled connection for as long as it stalled.
const GOOGLE_TIMEOUT_MS = 10_000;

export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = 'GoogleError';
  }
}

// Only 5xx/429 and network failures are worth retrying. A 4xx means the
// grant or request itself is bad, so retrying would just fail the same way.
function shouldRetryGoogle(error: unknown): boolean {
  return error instanceof GoogleError ? isRetryableStatus(error.status) : true;
}

export interface SignInRequest {
  url: string;
  state: string;
  codeVerifier: string;
  nonce: string;
}

export function startSignIn(state: string): SignInRequest {
  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  const nonce = crypto.randomBytes(16).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', googleClientId());
  url.searchParams.set('redirect_uri', `${baseUrl()}/auth/google/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SIGN_IN_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return { url: url.toString(), state, codeVerifier, nonce };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

async function postForm(
  url: string,
  body: Record<string, string>,
  retryOptions?: RetryOptions,
): Promise<TokenResponse> {
  const raw = await withRetry(() => postFormOnce(url, body), {
    shouldRetry: shouldRetryGoogle,
    ...retryOptions,
  });
  // The token endpoint is untyped JSON; the guard below is what makes the
  // cast safe, and it runs outside the retry so a malformed 200 fails fast.
  if (!raw || typeof raw.access_token !== 'string' || typeof raw.expires_in !== 'number') {
    throw new GoogleError('Google returned an unexpected response. Try again shortly.', 502);
  }
  return raw;
}

async function postFormOnce(url: string, body: Record<string, string>): Promise<TokenResponse | null> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error_description?: string } | null;
    if (response.status >= 500) {
      throw new GoogleError('Google is not responding. Try again shortly.', 503);
    }
    if (response.status === 429) {
      throw new GoogleError('Google is rate limiting requests. Try again shortly.', 429);
    }
    if (detail?.error_description) {
      throw new GoogleError('Google rejected the request. Reconnect Drive and try again.', 403);
    }
    throw new GoogleError('Google rejected the request. Reconnect Drive and try again.', 403);
  }
  return (await response.json().catch(() => null)) as TokenResponse | null;
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  return postForm(TOKEN_ENDPOINT, {
    code,
    code_verifier: codeVerifier,
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    redirect_uri: `${baseUrl()}/auth/google/callback`,
    grant_type: 'authorization_code',
  });
}

export async function refreshAccessToken(
  refreshToken: string,
  retryOptions?: RetryOptions,
): Promise<TokenResponse> {
  return postForm(
    TOKEN_ENDPOINT,
    {
      refresh_token: refreshToken,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      grant_type: 'refresh_token',
    },
    retryOptions,
  );
}

export async function revokeToken(token: string): Promise<void> {
  return withRetry(() => revokeTokenOnce(token), { shouldRetry: shouldRetryGoogle });
}

async function revokeTokenOnce(token: string): Promise<void> {
  const response = await fetch(REVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new GoogleError(
      'Google did not revoke the grant. It may already be gone.',
      isRetryableStatus(response.status) ? 502 : 400,
    );
  }
}

export interface GoogleIdentity {
  sub: string;
  email: string;
}

export function verifyIdToken(idToken: string, nonce: string): GoogleIdentity {
  // The id_token arrives over TLS from the token endpoint in exchange for a
  // client_secret-authenticated code, not as direct user input; claims are
  // still bound to this request via nonce/aud/exp before use.
  const [headerPart, payloadPart, signaturePart] = idToken.split('.');
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new GoogleError('Google did not return an id_token');
  }

  let claims: {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    nonce?: string;
    iss?: string;
    aud?: string;
    exp?: number;
  };
  try {
    claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    throw new GoogleError('Sign-in response was not readable');
  }

  if (claims.nonce !== nonce) throw new GoogleError('Sign-in response did not match this request');
  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') {
    throw new GoogleError('Sign-in response came from an unexpected issuer');
  }
  if (claims.aud !== googleClientId()) throw new GoogleError('Sign-in response was for another app');
  if (!claims.exp || claims.exp * 1000 <= Date.now()) throw new GoogleError('Sign-in response expired');
  if (claims.email_verified !== true) throw new GoogleError('Google account email is unverified');
  if (!claims.sub || !claims.email) throw new GoogleError('Google did not identify the account');

  return { sub: claims.sub, email: claims.email };
}

export interface VendedToken {
  accessToken: string;
  expiresAt: Date;
  rootFolderId: string;
}

export async function getAccessToken(db: Database, userId: string): Promise<string> {
  return (await getAccessTokenWithExpiry(db, userId)).accessToken;
}

export async function getAccessTokenWithExpiry(
  db: Database,
  userId: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const connection = await db.query.googleConnections.findFirst({
    where: eq(googleConnections.userId, userId),
  });
  if (!connection || connection.status !== 'active') {
    throw new GoogleError('Google Drive is not connected. Reconnect it on the website.', 409);
  }

  const fresh =
    connection.accessTokenEnc &&
    connection.accessTokenExpiresAt &&
    connection.accessTokenExpiresAt.getTime() - ACCESS_TOKEN_REFRESH_SKEW_MS > Date.now();

  if (fresh) {
    return {
      accessToken: open(connection.accessTokenEnc!, userId),
      expiresAt: connection.accessTokenExpiresAt!,
    };
  }

  try {
    return await refreshAndStore(db, userId, connection.refreshTokenEnc);
  } catch (error) {
    // Written outside the transaction, which rolls back anything done inside it.
    await db
      .update(googleConnections)
      .set({ status: 'error', lastError: (error as Error).message.slice(0, 500) })
      .where(eq(googleConnections.userId, userId));
    throw error;
  }
}

/**
 * Two machines polling at once would otherwise both refresh the Google grant,
 * and Google invalidates the previous refresh token on rotation. The advisory
 * lock makes refresh a single-flight operation per user.
 */
async function refreshAndStore(
  db: Database,
  userId: string,
  encryptedRefreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const refreshToken = open(encryptedRefreshToken, userId);

  return db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '5s'`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const current = await tx.query.googleConnections.findFirst({
      where: eq(googleConnections.userId, userId),
    });
    if (!current || current.status !== 'active') {
      throw new GoogleError('Google Drive is not connected. Reconnect it on the website.', 409);
    }

    if (
      current.accessTokenEnc &&
      current.accessTokenExpiresAt &&
      current.accessTokenExpiresAt.getTime() - ACCESS_TOKEN_REFRESH_SKEW_MS > Date.now()
    ) {
      return {
        accessToken: open(current.accessTokenEnc, userId),
        expiresAt: current.accessTokenExpiresAt,
      };
    }

    const tokens = await refreshAccessToken(refreshToken, { times: 1 });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Guarded so a disconnect landing mid-refresh cannot be undone.
    const updated = await tx
      .update(googleConnections)
      .set({
        accessTokenEnc: seal(tokens.access_token, userId),
        accessTokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
        lastError: null,
        status: 'active',
      })
      .where(and(eq(googleConnections.userId, userId), eq(googleConnections.status, 'active')))
      .returning({ userId: googleConnections.userId });

    if (updated.length === 0) {
      throw new GoogleError('Google Drive was disconnected. Reconnect it on the website.', 409);
    }

    return { accessToken: tokens.access_token, expiresAt };
  });
}

async function driveRequest(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  retryOptions?: RetryOptions,
): Promise<Record<string, unknown>> {
  return withRetry(() => driveRequestOnce(accessToken, path, init), {
    shouldRetry: shouldRetryGoogle,
    ...retryOptions,
  });
}

async function driveRequestOnce(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const response = await fetch(`${DRIVE_FILES_ENDPOINT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });

  if (!response.ok) {
    // A 404 names a missing folder. A 429 is rate limiting and stays a 429 so
    // callers can honor it; anything else is a transient Drive failure.
    const status = response.status === 404 ? 404 : response.status === 429 ? 429 : 502;
    throw new GoogleError(
      response.status === 404
        ? 'That folder no longer exists in Drive.'
        : response.status === 429
          ? 'Drive is rate limiting requests. Try again shortly.'
          : 'Drive is not responding. Try again shortly.',
      status,
    );
  }
  return (await response.json()) as Record<string, unknown>;
}

export async function ensureRootFolder(
  db: Database,
  accessToken: string,
  userId: string,
): Promise<string> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.driveRootFolderId) return user.driveRootFolderId;

  // Without a lock two machines signing in together each create a juststore
  // folder, and the last write to the column wins.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const current = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (current?.driveRootFolderId) return current.driveRootFolderId;

    const listed = await driveRequest(
      accessToken,
      `?q=${encodeURIComponent(
        `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`,
      )}&fields=files(id)&spaces=drive`,
    );
    const files = Array.isArray(listed.files)
      ? (listed.files as { id?: unknown }[]).filter((file) => typeof file?.id === 'string')
      : [];
    // The create is not retried: a response lost after Drive committed would
    // retry into a duplicate folder. A failure here surfaces and the next
    // sign-in lists first, so it self-heals without littering Drive.
    const folderId =
      files.length > 0
        ? (files[0].id as string)
        : await driveCreateRootFolder(accessToken);

    await tx
      .update(users)
      .set({ driveRootFolderId: folderId })
      .where(and(eq(users.id, userId), isNull(users.driveRootFolderId)));
    return folderId;
  });
}

async function driveCreateRootFolder(accessToken: string): Promise<string> {
  const created = await driveRequest(
    accessToken,
    '',
    {
      method: 'POST',
      body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: FOLDER_MIME }),
    },
    { times: 0 },
  );
  if (typeof created?.id !== 'string') {
    throw new GoogleError('Drive did not return a folder. Try again shortly.', 502);
  }
  return created.id;
}

export function hasScope(scopes: string[]): boolean {
  return scopes.includes(DRIVE_FILE_SCOPE);
}

export async function markConnectionRevoked(db: Database, userId: string): Promise<void> {
  await db
    .update(googleConnections)
    .set({ status: 'revoked', accessTokenEnc: null, accessTokenExpiresAt: null })
    .where(eq(googleConnections.userId, userId));
}
