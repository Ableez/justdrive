import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { googleConnections, users } from '#/db/schema';
import { seal } from '#/lib/crypto';
import { DRIVE_FILE_SCOPE } from '#/lib/constants';
import { exchangeCode, ensureRootFolder, GoogleError, verifyIdToken } from '#/lib/google';
import { createWebSession } from '#/lib/session';
import { recordServerEvent } from '#/lib/record-event';

const STATE_COOKIE = 'jd_oauth_state';
const VERIFIER_COOKIE = 'jd_oauth_verifier';
const NONCE_COOKIE = 'jd_oauth_nonce';

function fail(message: string): Response {
  return Response.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, process.env.JUSTDRIVE_BASE_URL ?? 'http://localhost:3000'));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (url.searchParams.get('error')) return fail('Sign-in was cancelled');
  if (!code) return fail('Google did not return an authorization code');

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const codeVerifier = store.get(VERIFIER_COOKIE)?.value;
  const nonce = store.get(NONCE_COOKIE)?.value;
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, NONCE_COOKIE]) store.delete(name);

  if (!expectedState || expectedState !== returnedState) return fail('Sign-in request expired. Try again.');
  if (!codeVerifier || !nonce) return fail('Sign-in request expired. Try again.');

  const db = getDb();

  try {
    const tokens = await exchangeCode(code, codeVerifier);
    if (!tokens.id_token) return fail('Google did not identify the account');
    if (!tokens.refresh_token) {
      return fail('Google did not return a refresh token. Disconnect and reconnect Drive.');
    }

    const identity = verifyIdToken(tokens.id_token, nonce);
    const scopes = (tokens.scope ?? '').split(' ').filter(Boolean);
    if (!scopes.includes(DRIVE_FILE_SCOPE)) {
      return fail('Drive access was not granted. Reconnect and allow Drive access.');
    }

    const userId = await upsertUser(identity.sub, identity.email);
    await db
      .insert(googleConnections)
      .values({
        userId,
        refreshTokenEnc: seal(tokens.refresh_token, userId),
        scopes,
        accessTokenEnc: seal(tokens.access_token, userId),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        lastRefreshedAt: new Date(),
        status: 'active',
      })
      .onConflictDoUpdate({
        target: googleConnections.userId,
        set: {
          refreshTokenEnc: seal(tokens.refresh_token, userId),
          accessTokenEnc: seal(tokens.access_token, userId),
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          scopes,
          status: 'active',
          lastError: null,
        },
      });

    await ensureRootFolder(db, tokens.access_token, userId);
    await createWebSession(db, userId, request);
    await recordServerEvent(db, { userId, deviceId: null, type: 'google_connected' });

    return Response.redirect(new URL('/dashboard', url.origin));
  } catch (error) {
    if (error instanceof GoogleError) return fail(error.message);
    throw error;
  }
}

async function upsertUser(sub: string, email: string): Promise<string> {
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.googleSub, sub) });
  if (existing) return existing.id;

  const id = randomUUID();
  await db.insert(users).values({ id, googleSub: sub, email });
  return id;
}
