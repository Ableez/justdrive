import { AuthError, isRetryableStatus, resolveApiUrl, withRetry } from '@juststore/shared';
import { loadSession, saveSession, type DeviceSession } from '../config/session.js';
import { clearCache } from '../drive/cache.js';

// Kept in memory so a token rotated moments ago is the one the next call uses.
let cachedSession: DeviceSession | null = null;

export function getApiUrl(): string {
  return resolveApiUrl(process.env);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function requireSession(): Promise<DeviceSession> {
  if (!cachedSession) {
    cachedSession = await loadSession();
    if (!cachedSession) throw new AuthError('Not signed in. Run: justdrive login');
  }
  return cachedSession;
}

export function forgetSession(): void {
  cachedSession = null;
}

let inflightRefresh: Promise<DeviceSession> | null = null;

async function performRefresh(): Promise<DeviceSession> {
  const session = await requireSession();
  // One attempt on purpose: the server rotates refresh tokens with
  // reuse detection, so replaying a spent token after a lost response would
  // revoke the whole family. A failure here surfaces; the next command tries
  // again with the still-valid token.
  const response = await fetch(`${getApiUrl()}/api/cli/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: session.refreshToken }),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    forgetSession();
    throw new AuthError(
      typeof body.error === 'string' ? body.error : 'Your session expired. Run: justdrive login',
    );
  }
  if (typeof body.access_token !== 'string' || !body.access_token) {
    throw new ApiError('The server did not return a session token.', 502);
  }

  const updated: DeviceSession = {
    ...session,
    accessToken: body.access_token,
    accessExpiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000,
    refreshToken:
      typeof body.refresh_token === 'string' && body.refresh_token
        ? body.refresh_token
        : session.refreshToken,
  };
  cachedSession = updated;
  await saveSession(updated);
  return updated;
}

/**
 * Single-flight on purpose: the server treats a replayed refresh token as
 * theft and revokes the whole family, so two overlapping 401s must not both
 * present the same token.
 */
export function refreshSession(): Promise<DeviceSession> {
  inflightRefresh ??= performRefresh().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = await requireSession();
  const response = await fetchWithRetry(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401 && retry) {
    await refreshSession();
    return request<T>(path, init, false);
  }

  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // A proxy or gateway error page, which must not become a parse error.
  }

  if (!response.ok) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : `Request failed (${response.status})`,
      response.status,
      typeof body.error_code === 'string' ? body.error_code : undefined,
    );
  }
  return body as T;
}

/**
 * Retries one HTTP attempt on network failures and retryable statuses, then
 * hands back the final response for the caller to interpret. Only idempotent
 * methods are retried: a POST committed server-side but lost on the way back
 * must not run twice. Refresh-step failures are deliberately out of scope: a
 * spent grant or a malformed token response must surface immediately, not
 * burn retries.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const idempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  // A POST committed server-side but lost on the way back must not run
  // twice, and a network failure is indistinguishable from that case.
  if (!idempotent) return fetch(url, init);
  let lastResponse: Response | null = null;
  try {
    return await withRetry(
      async () => {
        const response = await fetch(url, init);
        lastResponse = response;
        if (isRetryableStatus(response.status)) {
          await honorRetryAfter(response);
          throw new ApiError(`Request failed (${response.status})`, response.status);
        }
        return response;
      },
      {
        times: 2,
        baseDelayMs: 300,
        shouldRetry: (error) =>
          error instanceof ApiError ? isRetryableStatus(error.status) : true,
      },
    );
  } catch (error) {
    // A retried failure threw before the body was read, so the last response
    // is still unread: surface the server's message instead of a bare status.
    const failed = lastResponse as Response | null;
    if (failed && error instanceof ApiError) {
      const detail = (await failed.json().catch(() => null)) as {
        error?: unknown;
        error_code?: unknown;
      } | null;
      if (typeof detail?.error === 'string') {
        throw new ApiError(
          detail.error,
          error.status,
          typeof detail?.error_code === 'string' ? detail.error_code : undefined,
        );
      }
    }
    throw error;
  }
}

/** Waits out a server-provided Retry-After on 429s, capped at a minute. */
async function honorRetryAfter(response: Response): Promise<void> {
  const header = response.headers.get('retry-after');
  if (header === null) return;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(seconds, 60) * 1000));
  }
}

export interface DriveToken {
  access_token: string;
  expiry_date: number;
}

/**
 * The server owns the root folder, so its id is cached in the session instead of
 * being rediscovered by each machine.
 */
export async function fetchDriveToken(): Promise<DriveToken> {
  const token = await request<{
    access_token: string;
    expires_at: number;
    root_folder_id: string;
    email?: string;
  }>('/api/cli/drive-token', { method: 'POST' });

  // Read after the request, not before: the request may have rotated the
  // session, and writing back a pre-rotation copy would restore a spent
  // refresh token and get the family revoked on the next command.
  const current = await requireSession();
  if (current.rootFolderId !== token.root_folder_id || current.email !== token.email) {
    const updated = {
      ...current,
      rootFolderId: token.root_folder_id,
      email: token.email ?? current.email,
    };
    cachedSession = updated;
    await clearCache();
    await saveSession(updated);
  }
  return { access_token: token.access_token, expiry_date: token.expires_at };
}

export interface RemoteDevice {
  id: string;
  name: string;
  is_self: boolean;
  last_seen_at: string | null;
}

export async function listDevices(): Promise<RemoteDevice[]> {
  const body = await request<{ devices: RemoteDevice[] }>('/api/cli/devices');
  return body.devices;
}

export async function revokeThisDevice(): Promise<void> {
  await request('/api/cli/logout', { method: 'POST' });
}

export interface RemoteTransfer {
  id: string;
  drive_file_id: string;
  name: string;
  bytes: number | null;
  status: string;
  direction: 'in' | 'out';
  created_at: string;
}

export async function fetchTransfers(inbox: boolean): Promise<RemoteTransfer[]> {
  const body = await request<{ transfers: RemoteTransfer[] }>(
    `/api/cli/transfers${inbox ? '?inbox=1' : ''}`,
  );
  return body.transfers;
}

export async function createTransfer(input: {
  drive_file_id: string;
  name: string;
  to: string;
  bytes?: number;
}): Promise<{ id: string }> {
  return request('/api/cli/transfers', { method: 'POST', body: JSON.stringify(input) });
}

export async function ackTransfer(id: string): Promise<void> {
  await request(`/api/cli/transfers/${encodeURIComponent(id)}/ack`, { method: 'POST' });
}
