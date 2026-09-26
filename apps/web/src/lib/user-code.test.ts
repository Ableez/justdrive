import { describe, expect, it } from 'vitest';
import { generateUserCode, isValidUserCodeFormat, normalizeUserCode } from './user-code';

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
    expect(normalizeUserCode('bcdf-ghjk')).toBe('BCDF-GHJK');
  });

  it('validates the format', () => {
    expect(isValidUserCodeFormat('BCDF-GHJK')).toBe(true);
    expect(isValidUserCodeFormat('BCD-FGHJK')).toBe(false);
    expect(isValidUserCodeFormat('BCDFGHJK')).toBe(false);
    expect(isValidUserCodeFormat('BCDF-GHJ1')).toBe(false);
    expect(isValidUserCodeFormat('BCDF-GHJE')).toBe(false);
  });
});
