import { AuthError } from '@juststore/shared';
import { loadSession, saveSession, type DeviceSession } from '../config/session.js';

const DEFAULT_API_URL = 'https://drive.astexlabs.com';

// Kept in memory so a token rotated moments ago is the one the next call uses.
let cachedSession: DeviceSession | null = null;

export function getApiUrl(): string {
  return (process.env.JUSTDRIVE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
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

export async function refreshSession(): Promise<DeviceSession> {
  const session = await requireSession();
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

  const updated: DeviceSession = {
    ...session,
    accessToken: body.access_token as string,
    accessExpiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000,
    refreshToken: (body.refresh_token as string) ?? session.refreshToken,
  };
  cachedSession = updated;
  await saveSession(updated);
  return updated;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = await requireSession();
  const response = await fetch(`${getApiUrl()}${path}`, {
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
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : `Request failed (${response.status})`,
      response.status,
      typeof body.error_code === 'string' ? body.error_code : undefined,
    );
  }
  return body as T;
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
  const session = await requireSession();
  const token = await request<{
    access_token: string;
    expires_at: number;
    root_folder_id: string;
    email?: string;
  }>('/api/cli/drive-token', { method: 'POST' });

  if (session.rootFolderId !== token.root_folder_id || session.email !== token.email) {
    const updated = {
      ...session,
      rootFolderId: token.root_folder_id,
      email: token.email ?? session.email,
    };
    cachedSession = updated;
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
