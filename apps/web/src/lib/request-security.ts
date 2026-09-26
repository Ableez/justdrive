import { DEVICE_CODE_POLL_INTERVAL_SECONDS } from './constants';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * A same-origin check on every state-changing request. Browsers attach `Origin`
 * to all of these, and a form post from another site cannot forge it, which is
 * what stops a third-party page from approving a device or deleting an account.
 */
export function isSameOrigin(request: Request): boolean {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function securityHeaders(response: Response): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self' https://accounts.google.com",
    ].join('; '),
  );
  return response;
}

export const pollInterval = DEVICE_CODE_POLL_INTERVAL_SECONDS;
