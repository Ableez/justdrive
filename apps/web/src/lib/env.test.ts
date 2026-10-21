import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseUrl, isProduction } from './env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('baseUrl', () => {
  it('uses the configured base url', () => {
    vi.stubEnv('JUSTDRIVE_BASE_URL', 'https://drive.astexlabs.com');
    expect(baseUrl()).toBe('https://drive.astexlabs.com');
  });

  it('falls back to localhost outside production', () => {
    vi.stubEnv('JUSTDRIVE_BASE_URL', undefined);
    vi.stubEnv('NODE_ENV', 'development');
    expect(baseUrl()).toBe('http://localhost:3000');
  });

  it('throws in production when the base url is missing', () => {
    vi.stubEnv('JUSTDRIVE_BASE_URL', undefined);
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => baseUrl()).toThrow('JUSTDRIVE_BASE_URL is not set');
  });

  it('throws for a malformed base url', () => {
    vi.stubEnv('JUSTDRIVE_BASE_URL', 'not a url');
    expect(() => baseUrl()).toThrow('JUSTDRIVE_BASE_URL must be an absolute http(s) URL');
  });
});

describe('isProduction', () => {
  it('follows NODE_ENV', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isProduction()).toBe(true);
    vi.stubEnv('NODE_ENV', 'test');
    expect(isProduction()).toBe(false);
  });
});
