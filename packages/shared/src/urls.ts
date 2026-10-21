import { CLIENT_URL } from './constants.js';

export type EnvSource = Record<string, string | undefined>;

/** Origin of a local development run. */
export const LOCAL_BASE_URL = 'http://localhost:3000';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Base URL of the justdrive API. JUSTDRIVE_API_URL points a machine at a
 * staging or local server instead of the hosted service.
 */
export function resolveApiUrl(env: EnvSource): string {
  return trimTrailingSlash(env.JUSTDRIVE_API_URL || CLIENT_URL);
}

/**
 * Public origin of the web app. JUSTDRIVE_BASE_URL is the setting it reads;
 * without it a local run uses its own port.
 */
export function resolveBaseUrl(env: EnvSource): string {
  return trimTrailingSlash(env.JUSTDRIVE_BASE_URL || LOCAL_BASE_URL);
}
