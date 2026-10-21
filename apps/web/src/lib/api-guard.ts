import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { devices } from '../db/schema';
import { getSessionUserId } from './session';
import { DeviceTokenError, touchDevice, verifyAccessToken } from './device-tokens';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  // The CLI honors the Retry-After header on 429s, so a body-only retry_after
  // would leave it polling through the rate limit on local backoff.
  const headers: Record<string, string> = {};
  if (typeof extra.retry_after === 'number' && Number.isFinite(extra.retry_after)) {
    headers['Retry-After'] = String(Math.max(0, Math.floor(extra.retry_after)));
  }
  return Response.json({ error: message, ...extra }, { status, headers });
}

export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw new ApiError('Sign in required', 401);
  return userId;
}

export interface AuthenticatedDevice {
  userId: string;
  deviceId: string;
  deviceName: string;
  ip: string | null;
}

export async function requireDevice(request: Request, db: Database): Promise<AuthenticatedDevice> {
  const header = request.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!presented) throw new ApiError('Missing device token', 401);

  const verified = await verifyAccessToken(db, presented);
  if (!verified) throw new ApiError('This device session is no longer valid. Run: justdrive login', 401);

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim().slice(0, 64) : null;
  await touchDevice(db, verified.deviceId, ip);

  return { ...verified, ip };
}

export async function requireOwnedDevice(
  db: Database,
  userId: string,
  deviceId: string,
) {
  const device = await db.query.devices.findFirst({
    where: and(eq(devices.id, deviceId), eq(devices.userId, userId)),
  });
  if (!device) throw new ApiError('No such device', 404);
  return device;
}

export function toApiError(error: unknown): Response {
  if (error instanceof ApiError) return jsonError(error.message, error.status);
  if (error instanceof DeviceTokenError) {
    const status = error.code === 'reuse' || error.code === 'revoked' ? 401 : 400;
    return jsonError(error.message, status, { error_code: error.code });
  }
  return jsonError('Request failed', 500);
}

export function unauthorized(status = 401): Response {
  return jsonError('This device session is no longer valid. Run: justdrive login', status);
}
