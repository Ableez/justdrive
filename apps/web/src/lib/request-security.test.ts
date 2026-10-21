import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSameOrigin, securityHeaders } from './request-security';

const PREVIOUS = process.env.JUSTDRIVE_BASE_URL;

beforeEach(() => {
  process.env.JUSTDRIVE_BASE_URL = 'https://drive.astexlabs.com';
});

afterEach(() => {
  process.env.JUSTDRIVE_BASE_URL = PREVIOUS;
});

function post(origin: string | null, url = 'https://drive.astexlabs.com/logout') {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  return new Request(url, { method: 'POST', headers });
}

describe('same-origin check', () => {
  it('accepts the configured app host', () => {
    expect(isSameOrigin(post('https://drive.astexlabs.com'))).toBe(true);
  });

  it('accepts loopback in local development', () => {
    process.env.JUSTDRIVE_BASE_URL = 'http://localhost:3000';
    expect(isSameOrigin(post('http://localhost:3000', 'http://localhost:3000/logout'))).toBe(true);
  });

  it('ignores how Next built request.url, which differs by deployment', () => {
    // On some deployments request.url is the internal bind host, on others it
    // is the Host header. The check must not depend on either.
    expect(isSameOrigin(post('https://drive.astexlabs.com', 'http://0.0.0.0:3000/logout'))).toBe(true);
  });

  it('rejects another site', () => {
    expect(isSameOrigin(post('https://evil.example'))).toBe(false);
    expect(isSameOrigin(post('https://drive.astexlabs.com.evil.example'))).toBe(false);
    expect(isSameOrigin(post('https://evil.example', 'https://drive.astexlabs.com/logout'))).toBe(false);
  });

  it('rejects http when the app runs on https', () => {
    expect(isSameOrigin(post('http://drive.astexlabs.com'))).toBe(false);
  });

  it('rejects a request with no origin, which a browser form cannot forge', () => {
    expect(isSameOrigin(post(null))).toBe(false);
  });

  it('rejects a malformed origin', () => {
    expect(isSameOrigin(post('not a url'))).toBe(false);
  });

  it('ignores the check for safe methods', () => {
    expect(isSameOrigin(new Request('https://drive.astexlabs.com/devices'))).toBe(true);
  });
});

describe('production hosts', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects loopback once the app runs in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isSameOrigin(post('http://localhost:3000', 'http://localhost:3000/logout'))).toBe(false);
  });

  it('still accepts the configured host in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isSameOrigin(post('https://drive.astexlabs.com'))).toBe(true);
  });

  it('fails closed when production has no base url', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JUSTDRIVE_BASE_URL', undefined);
    expect(() => isSameOrigin(post('https://drive.astexlabs.com'))).toThrow(
      'JUSTDRIVE_BASE_URL is not set',
    );
  });
});

describe('security headers', () => {
  it('sets the hardening headers on a normal response', () => {
    const response = securityHeaders(Response.json({ ok: true }));

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('can add headers to a redirect, whose headers are otherwise immutable', () => {
    const response = securityHeaders(Response.redirect('https://drive.astexlabs.com/', 303));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://drive.astexlabs.com/');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
