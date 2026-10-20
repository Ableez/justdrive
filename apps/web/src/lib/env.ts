import { resolveBaseUrl } from '@juststore/shared';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function googleClientId(): string {
  return required('GOOGLE_CLIENT_ID');
}

export function googleClientSecret(): string {
  return required('GOOGLE_CLIENT_SECRET');
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function baseUrl(): string {
  // A production deploy without the base URL would redirect OAuth callbacks
  // and device codes at localhost, so the misconfiguration must stop the app.
  if (isProduction() && !process.env.JUSTDRIVE_BASE_URL) {
    throw new Error('JUSTDRIVE_BASE_URL is not set');
  }
  const resolved = resolveBaseUrl(process.env);
  try {
    const parsed = new URL(resolved);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('JUSTDRIVE_BASE_URL must be an absolute http(s) URL');
    }
  } catch {
    throw new Error('JUSTDRIVE_BASE_URL must be an absolute http(s) URL');
  }
  return resolved;
}
