import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { startSignIn } from '#/lib/google';

const STATE_COOKIE = 'jd_oauth_state';
const VERIFIER_COOKIE = 'jd_oauth_verifier';
const NONCE_COOKIE = 'jd_oauth_nonce';
const NEXT_COOKIE = 'jd_oauth_next';

/** Only same-site paths, so the value can never become an open redirect. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export async function GET(request: Request) {
  const signIn = startSignIn(randomBytes(24).toString('base64url'));
  const secure = new URL(request.url).protocol === 'https:';
  const store = await cookies();
  const options = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 600 };

  store.set(STATE_COOKIE, signIn.state, options);
  store.set(VERIFIER_COOKIE, signIn.codeVerifier, options);
  store.set(NONCE_COOKIE, signIn.nonce, options);
  store.set(NEXT_COOKIE, safeNext(new URL(request.url).searchParams.get('next')), options);

  return Response.redirect(signIn.url);
}
