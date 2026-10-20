import { baseUrl, isProduction } from './env';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const url = baseUrl();
  try {
    origins.add(new URL(url).origin);
  } catch {
    // A malformed base URL leaves the list empty, so unsafe requests are
    // rejected rather than compared against nothing.
  }
  if (!isProduction()) {
    // Local development and `justdrive` on the same machine.
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return origins;
}

/**
 * A same-origin check on every state-changing request. Browsers attach `Origin`
 * to all of these, and a cross-site form post cannot forge it.
 *
 * The origin is compared against the configured app origin rather than
 * `request.url`, because Next builds that from its own bind hostname on some
 * deployments and from the Host header on others.
 */
export function isSameOrigin(request: Request): boolean {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return true;

  const origin = request.headers.get('origin');
  if (!origin) return false;

  // The origin list is built outside the try, so a broken configuration fails
  // loudly instead of looking like a rejected origin.
  const origins = allowedOrigins();
  try {
    return origins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export function securityHeaders(response: Response): Response {
  // A response from Response.redirect() has immutable headers.
  const mutable =
    response.headers.get('location') && response.status >= 300 && response.status < 400
      ? new Response(response.body, { status: response.status, headers: response.headers })
      : response;

  mutable.headers.set('X-Content-Type-Options', 'nosniff');
  mutable.headers.set('X-Frame-Options', 'DENY');
  mutable.headers.set('Referrer-Policy', 'no-referrer');
  mutable.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  mutable.headers.set(
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
  return mutable;
}
