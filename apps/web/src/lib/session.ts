import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import type { Database } from '../db/client';
import { webSessions } from '../db/schema';
import { hashToken } from './crypto';
import { WEB_SESSION_TTL_DAYS } from './constants';

const TTL_MS = WEB_SESSION_TTL_DAYS * 86_400_000;
const SLIDING_WINDOW_MS = 15 * 86_400_000;

// `__Host-` needs Secure, which browsers reject on plain http, so local dev
// uses the bare name.
export function sessionCookieName(): string {
  return process.env.NODE_ENV === 'production' ? '__Host-jd_session' : 'jd_session';
}

export async function createWebSession(db: Database, userId: string, request: Request): Promise<void> {
  const id = randomBytes(32).toString('base64url');
  await db.insert(webSessions).values({
    idHash: hashToken(id),
    userId,
    expiresAt: new Date(Date.now() + TTL_MS),
    ip: clientIp(request),
    userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  });

  (await cookies()).set(sessionCookieName(), id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: WEB_SESSION_TTL_DAYS * 86_400,
  });
}

export async function destroyWebSession(): Promise<void> {
  const store = await cookies();
  const id = store.get(sessionCookieName())?.value;
  store.delete(sessionCookieName());
  if (id) await deleteSessionByToken(id);
}

export async function getSessionUserId(): Promise<string | null> {
  const id = (await cookies()).get(sessionCookieName())?.value;
  if (!id) return null;

  const { getDb } = await import('../db/client');
  const db = getDb();
  const session = await db.query.webSessions.findFirst({
    where: and(eq(webSessions.idHash, hashToken(id)), gt(webSessions.expiresAt, new Date())),
  });
  if (!session) return null;

  const expiresAt =
    session.expiresAt.getTime() - Date.now() < SLIDING_WINDOW_MS
      ? new Date(Date.now() + TTL_MS)
      : session.expiresAt;

  await db
    .update(webSessions)
    .set({ lastSeenAt: new Date(), expiresAt })
    .where(eq(webSessions.idHash, session.idHash));

  return session.userId;
}

export async function deleteSessionByToken(id: string): Promise<void> {
  const { getDb } = await import('../db/client');
  await getDb().delete(webSessions).where(eq(webSessions.idHash, hashToken(id)));
}

export async function deleteAllSessions(db: Database, userId: string): Promise<void> {
  await db.delete(webSessions).where(eq(webSessions.userId, userId));
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 64);
  return request.headers.get('x-real-ip')?.slice(0, 64) ?? null;
}
