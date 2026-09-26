import { describe, expect, it } from 'vitest';
import { isValidUserCodeFormat, normalizeUserCode, generateUserCode } from './user-code';
import { isSameOrigin } from './request-security';

describe('user code', () => {
  it('generates codes in the grouped format', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateUserCode()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });

  it('never uses characters that are easy to misread', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateUserCode()).not.toMatch(/[AEIOU01]/);
    }
  });

  it('normalizes what a person might type', () => {
    expect(normalizeUserCode('abcd-2345')).toBe('ABCD-2345');
    expect(normalizeUserCode(' abcd2345 ')).toBe('ABCD-2345');
  });

  it('validates the format', () => {
    expect(isValidUserCodeFormat('BCDF-GHJK')).toBe(true);
    expect(isValidUserCodeFormat('BCD-FGHJK')).toBe(false);
    expect(isValidUserCodeFormat('BCDFGHJK')).toBe(false);
    expect(isValidUserCodeFormat('BCDF-GHJ1')).toBe(false);
    expect(isValidUserCodeFormat('BCDF-GHJE')).toBe(false);
  });
});

function post(origin: string | null, host = 'drive.astexlabs.com') {
  const headers = new Headers({ host });
  if (origin) headers.set('origin', origin);
  return new Request(`https://${host}/api/devices/1`, { method: 'POST', headers });
}

describe('same-origin check', () => {
  it('accepts a matching origin', () => {
    expect(isSameOrigin(post('https://drive.astexlabs.com'))).toBe(true);
  });

  it('rejects another site', () => {
    expect(isSameOrigin(post('https://evil.example'))).toBe(false);
  });

  it('rejects a request with no origin, which a browser form cannot forge', () => {
    expect(isSameOrigin(post(null))).toBe(false);
  });

  it('ignores the check for safe methods', () => {
    const request = new Request('https://drive.astexlabs.com/devices', { method: 'GET' });
    expect(isSameOrigin(request)).toBe(true);
  });
});
