import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '#/test/db';
import type { Database } from '#/db/client';
import { users } from '#/db/schema';
import { seal } from './crypto';
import {
  GoogleError,
  ensureRootFolder,
  exchangeCode,
  getAccessTokenWithExpiry,
  refreshAccessToken,
} from './google';

function tokenJson(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ access_token: 'ya29.new', expires_in: 3600, ...overrides }),
    { status: 200 },
  );
}

beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
  vi.stubEnv('JUSTDRIVE_BASE_URL', 'http://localhost:3000');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('exchangeCode', () => {
  it('retries transient Google failures and returns the token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockImplementation(() => Promise.resolve(tokenJson()));
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeCode('code-1', 'verifier-1')).resolves.toMatchObject({
      access_token: 'ya29.new',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails fast on an invalid grant without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Bad Request' }), {
        status: 400,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeCode('used-code', 'verifier-1')).rejects.toBeInstanceOf(GoogleError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('recovers from rate limiting', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockImplementation(() => Promise.resolve(tokenJson()));
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeCode('code-1', 'verifier-1')).resolves.toMatchObject({
      access_token: 'ya29.new',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a well-formed response with no token instead of retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ unexpected: 'shape' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeCode('code-1', 'verifier-1')).rejects.toThrow(/unexpected response/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an unreadable success body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html>proxy</html>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeCode('code-1', 'verifier-1')).rejects.toThrow(/unexpected response/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('refreshAccessToken', () => {
  it('honors a tighter retry budget for the refresh transaction window', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('', { status: 500 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(refreshAccessToken('rt', { times: 1 })).rejects.toBeInstanceOf(GoogleError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('sign-in persistence', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
    await db.insert(users).values({ id: 'user-1', googleSub: 'sub-1', email: 'a@b.com' });
  });

  it('reuses a fresh access token without touching Google', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await db.insert(users).values({ id: 'user-2', googleSub: 'sub-2', email: 'b@c.com' });
    const { googleConnections } = await import('#/db/schema');
    await db.insert(googleConnections).values({
      userId: 'user-2',
      refreshTokenEnc: seal('rt-2', 'user-2'),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      status: 'active',
      accessTokenEnc: seal('ya29.fresh', 'user-2'),
      accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
    });

    await expect(getAccessTokenWithExpiry(db, 'user-2')).resolves.toMatchObject({
      accessToken: 'ya29.fresh',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes a stale token and stores the replacement', async () => {
    const { googleConnections } = await import('#/db/schema');
    await db.insert(googleConnections).values({
      userId: 'user-1',
      refreshTokenEnc: seal('rt-1', 'user-1'),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      status: 'active',
      accessTokenEnc: seal('ya29.stale', 'user-1'),
      accessTokenExpiresAt: new Date(Date.now() - 1_000),
    });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(tokenJson())));

    const result = await getAccessTokenWithExpiry(db, 'user-1');
    expect(result.accessToken).toBe('ya29.new');
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('finds an existing Drive folder without creating one', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ files: [{ id: 'folder-1' }] }), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureRootFolder(db, 'ya29.x', 'user-1')).resolves.toBe('folder-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('creates the folder once when the list is empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ id: 'folder-new' }), { status: 200 })),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureRootFolder(db, 'ya29.x', 'user-1')).resolves.toBe('folder-new');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a folder create that may have committed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockImplementation(() => Promise.resolve(new Response('', { status: 500 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureRootFolder(db, 'ya29.x', 'user-1')).rejects.toBeInstanceOf(GoogleError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('creates when the list response has no usable files', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: 'garbage' }), { status: 200 }))
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ id: 'folder-new' }), { status: 200 })),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureRootFolder(db, 'ya29.x', 'user-1')).resolves.toBe('folder-new');
  });
});
