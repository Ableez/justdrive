import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { CryptoError, hashToken, open, seal } from './crypto';

function setKeys(keys: Record<string, string>) {
  process.env.TOKEN_ENCRYPTION_KEYS = JSON.stringify(keys);
}

describe('crypto', () => {
  it('round-trips a value', () => {
    const sealed = seal('refresh-token-value', 'user-1');
    expect(sealed).not.toContain('refresh-token-value');
    expect(open(sealed, 'user-1')).toBe('refresh-token-value');
  });

  it('produces different ciphertext each time', () => {
    expect(seal('same', 'user-1')).not.toBe(seal('same', 'user-1'));
  });

  it('refuses ciphertext claimed for another owner', () => {
    const sealed = seal('secret', 'user-1');
    expect(() => open(sealed, 'user-2')).toThrow(CryptoError);
  });

  it('refuses a tampered ciphertext', () => {
    const sealed = seal('secret', 'user-1');
    const tampered = sealed.replace(/.$/, sealed.endsWith('A') ? 'B' : 'A');
    expect(() => open(tampered, 'user-1')).toThrow(CryptoError);
  });

  it('still reads older key versions after rotation', () => {
    const old = crypto.randomBytes(32).toString('base64');
    const fresh = crypto.randomBytes(32).toString('base64');
    setKeys({ 1: old });
    const sealed = seal('legacy', 'user-1');
    expect(sealed.startsWith('v1.')).toBe(true);

    setKeys({ 1: old, 2: fresh });
    expect(open(sealed, 'user-1')).toBe('legacy');
    expect(seal('new', 'user-1').startsWith('v2.')).toBe(true);
  });

  it('rejects unusable key configuration', () => {
    setKeys({ 1: 'not-base64-32-bytes' });
    expect(() => seal('x', 'user-1')).toThrow(/32 bytes/);
  });

  it('hashes tokens deterministically without exposing them', () => {
    const hash = hashToken('jd_at_secret');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashToken('jd_at_secret'));
    expect(hash).not.toContain('secret');
  });
});
