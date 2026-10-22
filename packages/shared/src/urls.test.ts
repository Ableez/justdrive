import { describe, expect, it } from 'vitest';
import { resolveApiUrl, resolveBaseUrl } from './urls.js';

describe('resolveApiUrl', () => {
  it('falls back to the hosted service', () => {
    expect(resolveApiUrl({})).toBe('https://justdrive.astexlabs.com');
  });

  it('uses JUSTDRIVE_API_URL when it is set', () => {
    expect(resolveApiUrl({ JUSTDRIVE_API_URL: 'http://localhost:3000' })).toBe(
      'http://localhost:3000',
    );
  });

  it('strips a trailing slash from an override', () => {
    expect(resolveApiUrl({ JUSTDRIVE_API_URL: 'http://localhost:3000//' })).toBe(
      'http://localhost:3000',
    );
  });

  it('ignores an empty override', () => {
    expect(resolveApiUrl({ JUSTDRIVE_API_URL: '' })).toBe('https://justdrive.astexlabs.com');
  });
});

describe('resolveBaseUrl', () => {
  it('uses JUSTDRIVE_BASE_URL when it is set', () => {
    expect(resolveBaseUrl({ JUSTDRIVE_BASE_URL: 'https://drive.example' })).toBe(
      'https://drive.example',
    );
  });

  it('falls back to the local origin', () => {
    expect(resolveBaseUrl({})).toBe('http://localhost:3000');
  });

  it('strips a trailing slash from an override', () => {
    expect(resolveBaseUrl({ JUSTDRIVE_BASE_URL: 'https://drive.example/' })).toBe(
      'https://drive.example',
    );
  });
});
