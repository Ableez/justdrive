import { describe, it, expect } from 'vitest';
import { normalizePath, isAbsolutePath } from './utils.js';

describe('normalizePath', () => {
  it('leaves a plain relative path alone', () => {
    expect(normalizePath('photos/vacation')).toBe('photos/vacation');
    expect(normalizePath('./photos/vacation')).toBe('photos/vacation');
  });

  it('strips a leading justdrive folder', () => {
    expect(normalizePath('justdrive/photos/vacation')).toBe('photos/vacation');
  });

  it('keeps dotfile names intact', () => {
    expect(normalizePath('.env')).toBe('.env');
  });

  it('does not treat justdrive as a name prefix', () => {
    expect(normalizePath('justdrive-backups/a.txt')).toBe('justdrive-backups/a.txt');
  });

  it('strips leading and duplicate slashes', () => {
    expect(normalizePath('/photos//2024/')).toBe('photos/2024');
  });

  it('reduces the root to an empty path', () => {
    expect(normalizePath('')).toBe('');
    expect(normalizePath('/')).toBe('');
    expect(normalizePath('juststore')).toBe('');
  });
});

describe('isAbsolutePath', () => {
  it('detects a leading slash', () => {
    expect(isAbsolutePath('/photos')).toBe(true);
    expect(isAbsolutePath('photos')).toBe(false);
  });
});
