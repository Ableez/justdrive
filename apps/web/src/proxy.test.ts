import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

function request(path: string, init?: { method?: string; headers?: Record<string, string> }) {
  return new NextRequest(new URL(path, 'https://justdrive.astexlabs.com'), init);
}

describe('proxy', () => {
  it('rejects a cross-origin unsafe request', () => {
    const response = proxy(
      request('/logout', { method: 'POST', headers: { origin: 'https://evil.example' } }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('lets the cli call through without an origin header', () => {
    const response = proxy(request('/api/cli/devices', { method: 'POST' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('applies the security headers to a normal page request', () => {
    const response = proxy(request('/dashboard'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });
});
