import { describe, expect, it } from 'vitest';
import { AuthError, JustStoreError, PathNotFoundError } from './errors.js';

describe('errors', () => {
  it('carries a code', () => {
    expect(new AuthError('nope').code).toBe('AUTH_ERROR');
    expect(new JustStoreError('nope', 'CUSTOM').code).toBe('CUSTOM');
  });

  it('names the path in a missing-path error', () => {
    const error = new PathNotFoundError('photos/2024');
    expect(error.message).toBe('Path not found: photos/2024');
    expect(error.code).toBe('PATH_NOT_FOUND');
  });

  it('is catchable as the base class', () => {
    expect(new AuthError('nope')).toBeInstanceOf(JustStoreError);
    expect(new AuthError('nope')).toBeInstanceOf(Error);
  });
});
