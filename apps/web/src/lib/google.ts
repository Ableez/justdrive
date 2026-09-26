import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { googleConnections, users } from '../db/schema';
import { open, seal } from './crypto';
import {
  ACCESS_TOKEN_REFRESH_SKEW_MS,
  DRIVE_FILE_SCOPE,
  ROOT_FOLDER_NAME,
  SIGN_IN_SCOPES,
} from './constants';
import { googleClientId, googleClientSecret } from './env';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export class GoogleError extends Error {}

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
  url.searchParams.set('redirect_uri', `${process.env.JUSTDRIVE_BASE_URL}/auth/google/callback`);
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

async function postForm(url: string, body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new GoogleError(`Google token request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as TokenResponse;
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  return postForm(TOKEN_ENDPOINT, {
    code,
    code_verifier: codeVerifier,
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    redirect_uri: `${process.env.JUSTDRIVE_BASE_URL}/auth/google/callback`,
    grant_type: 'authorization_code',
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return postForm(TOKEN_ENDPOINT, {
    refresh_token: refreshToken,
    client_id: googleClientId(),
    client_secret: googleClientSecret(),
    grant_type: 'refresh_token',
  });
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  });
}

export interface GoogleIdentity {
  sub: string;
  email: string;
}

export function verifyIdToken(idToken: string, nonce: string): GoogleIdentity {
  const [headerPart, payloadPart, signaturePart] = idToken.split('.');
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new GoogleError('Google did not return an id_token');
  }

  const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    nonce?: string;
    iss?: string;
    aud?: string;
    exp?: number;
  };

  if (claims.nonce !== nonce) throw new GoogleError('Sign-in response did not match this request');
  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') {
    throw new GoogleError('Sign-in response came from an unexpected issuer');
  }
  if (claims.aud !== googleClientId()) throw new GoogleError('Sign-in response was for another app');
  if (!claims.exp || claims.exp * 1000 <= Date.now()) throw new GoogleError('Sign-in response expired');
  if (claims.email_verified === false) throw new GoogleError('Google account email is unverified');
  if (!claims.sub || !claims.email) throw new GoogleError('Google did not identify the account');

  return { sub: claims.sub, email: claims.email };
}

export interface VendedToken {
  accessToken: string;
  expiresAt: Date;
  rootFolderId: string;
}

export async function getAccessToken(db: Database, userId: string): Promise<string> {
  const connection = await db.query.googleConnections.findFirst({
    where: eq(googleConnections.userId, userId),
  });
  if (!connection || connection.status !== 'active') {
    throw new GoogleError('Google Drive is not connected. Reconnect it on the justdrive website.');
  }

  const cached = connection.accessTokenEnc && connection.accessTokenExpiresAt;
  if (cached && connection.accessTokenExpiresAt!.getTime() - ACCESS_TOKEN_REFRESH_SKEW_MS > Date.now()) {
    return open(connection.accessTokenEnc!, userId);
  }

  return refreshAndStore(db, userId, connection.refreshTokenEnc);
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
): Promise<string> {
  const refreshToken = open(encryptedRefreshToken, userId);

  return db.transaction(async (tx) => {    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const current = await tx.query.googleConnections.findFirst({
      where: eq(googleConnections.userId, userId),
    });
    if (
      current?.accessTokenEnc &&
      current.accessTokenExpiresAt &&
      current.accessTokenExpiresAt.getTime() - ACCESS_TOKEN_REFRESH_SKEW_MS > Date.now()
    ) {
      return open(current.accessTokenEnc, userId);
    }

    let tokens: TokenResponse;
    try {
      tokens = await refreshAccessToken(refreshToken);
    } catch (error) {
      await tx
        .update(googleConnections)
        .set({ status: 'error', lastError: (error as Error).message.slice(0, 500) })
        .where(eq(googleConnections.userId, userId));
      throw error;
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await tx
      .update(googleConnections)
      .set({
        accessTokenEnc: seal(tokens.access_token, userId),
        accessTokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
        lastError: null,
        status: 'active',
      })
      .where(eq(googleConnections.userId, userId));

    return tokens.access_token;
  });
}

async function driveRequest(
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
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new GoogleError(`Drive request failed (${response.status}): ${detail.slice(0, 300)}`);
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

  const listed = await driveRequest(
    accessToken,
    `?q=${encodeURIComponent(
      `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`,
    )}&fields=files(id)&spaces=drive`,
  );
  const files = listed.files as { id: string }[] | undefined;
  const folderId =
    files && files.length > 0
      ? files[0].id
      : ((await driveRequest(accessToken, '', {
          method: 'POST',
          body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: FOLDER_MIME }),
        })).id as string);

  await db.update(users).set({ driveRootFolderId: folderId }).where(eq(users.id, userId));
  return folderId;
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
