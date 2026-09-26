import os from 'os';
import { getApiUrl, forgetSession } from './client.js';
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

const TERMINAL_ERRORS = new Set([
  'access_denied',
  'expired_token',
  'invalid_request',
  'invalid_grant',
  'server_error',
]);

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
  const deadline = Date.now() + deviceCode.expires_in * 1000;
  let intervalMs = deviceCode.interval * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
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
    if (typeof error === 'string' && TERMINAL_ERRORS.has(error)) {
      throw new Error(tokenErrorMessage(error));
    }
    if (error === 'slow_down') {
      // RFC 8628 asks the client to add five seconds per slow_down.
      intervalMs += 5000;
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

async function pollToken(
  deviceCode: string,
): Promise<Record<string, unknown> & { access_token?: string; refresh_token?: string; expires_in?: number; device?: { id: string; name: string }; error?: string }> {
  const response = await fetch(`${getApiUrl()}/api/cli/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'device_code', device_code: deviceCode }),
  });
  return (await response.json().catch(() => ({}))) as never;
}

export async function runLogout(): Promise<void> {
  const { revokeThisDevice } = await import('./client.js');  try {
    await revokeThisDevice();
  } catch {
    // The server may already consider this device gone; local state must still clear.
  }
  forgetSession();
  await clearSession();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
