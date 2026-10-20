import os from 'os';
import { getApiUrl, forgetSession } from './client.js';
import { withRetry } from '@juststore/shared';
import { clearSession, saveSession, type DeviceSession } from '../config/session.js';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface LoginOptions {
  name?: string;
  hostname?: string;
  os?: string;
  cliVersion?: string;
  onPrompt?: (info: { url: string; code: string }) => void;
}

export async function requestDeviceCode(options: LoginOptions): Promise<DeviceCodeResponse> {
  const response = await fetch(`${getApiUrl()}/api/cli/device-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hostname: options.hostname ?? os.hostname(),
      os: options.os ?? `${os.platform()} ${os.release()}`,
      cli_version: options.cliVersion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not start sign-in (${response.status}). Try again shortly.`);
  }
  return (await response.json()) as DeviceCodeResponse;
}

export async function completeDeviceLogin(
  deviceCode: DeviceCodeResponse,
  options: LoginOptions,
): Promise<DeviceSession> {
  // Validated and clamped, because a NaN interval turns the wait into a
  // request flood against the user's own server.
  const intervalMs = Math.max(1, Number(deviceCode.interval) || 5) * 1000;
  const expiresIn = Number(deviceCode.expires_in) || 600;
  const deadline = Date.now() + expiresIn * 1000;
  let waitMs = intervalMs;

  while (Date.now() < deadline) {
    await sleep(waitMs);
    const body = await pollToken(deviceCode.device_code);

    if (body.device && body.access_token) {
      const session: DeviceSession = {
        version: 1,
        apiUrl: getApiUrl(),
        accessToken: body.access_token,
        accessExpiresAt: Date.now() + Number(body.expires_in ?? 3600) * 1000,
        refreshToken: body.refresh_token as string,
        deviceId: body.device.id,
        deviceName: body.device.name,
      };
      await saveSession(session);
      return session;
    }

    const error = body.error;
    if (error === 'slow_down') {
      waitMs += 5000;
      continue;
    }
    if (typeof error === 'string' && error !== 'authorization_pending') {
      throw new Error(tokenErrorMessage(error));
    }
  }

  throw new Error('Timed out waiting for approval. Run: justdrive login');
}

function tokenErrorMessage(error: string): string {
  if (error === 'access_denied') return 'The sign-in request was denied.';
  if (error === 'expired_token') return 'The code expired. Run: justdrive login';
  if (error === 'invalid_grant') return 'That session is no longer valid. Run: justdrive login';
  return `Sign-in failed (${error}). Try again.`;
}

async function pollToken(deviceCode: string): Promise<PollResponse> {
  // A 5xx here used to kill the whole login. Retry with backoff first; only
  // protocol errors (denied, expired) fail the sign-in immediately.
  return withRetry(() => pollTokenOnce(deviceCode), { baseDelayMs: 500 });
}

async function pollTokenOnce(deviceCode: string): Promise<PollResponse> {
  const response = await fetch(`${getApiUrl()}/api/cli/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'device_code', device_code: deviceCode }),
  });

  // Distinguishing "the server is down" from "the user has not approved yet"
  // matters, or the user is told to retry when nothing is wrong their end.
  if (response.status >= 500) {
    throw new Error(`The sign-in server is unavailable (${response.status}). Try again shortly.`);
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'));
    return { error: 'slow_down', interval: Number.isFinite(retryAfter) ? retryAfter : undefined };
  }

  return (await response.json().catch(() => ({}))) as PollResponse;
}

interface PollResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  device?: { id: string; name: string };
  error?: string;
  interval?: number;
}

export async function runLogout(): Promise<string> {
  const { revokeThisDevice } = await import('./client.js');
  let warning: string | null = null;

  try {
    await revokeThisDevice();
  } catch (error) {
    // Local state is cleared either way, but the user asked to cut this machine
    // off and must not be told that worked when the server never heard about it.
    warning = (error as Error).message;
  }

  forgetSession();
  await clearSession();
  return warning ?? '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
