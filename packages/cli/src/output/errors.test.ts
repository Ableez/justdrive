import { describe, expect, it } from 'vitest';
import { AuthError } from '@juststore/shared';
import { ApiError } from '../api/client.js';
import { describeError } from './errors.js';

describe('describeError', () => {
  it('passes through an auth error message', () => {
    expect(describeError(new AuthError('Not signed in. Run: justdrive login'))).toBe(
      'Not signed in. Run: justdrive login',
    );
  });

  it('passes through an api error message', () => {
    expect(describeError(new ApiError('Request failed (500)', 500, 'BOOM'))).toBe(
      'Request failed (500)',
    );
  });

  it('passes through a plain error message', () => {
    expect(describeError(new Error('Drive is unavailable'))).toBe('Drive is unavailable');
  });

  it('turns a thrown non-error into text', () => {
    expect(describeError('boom')).toBe('boom');
    expect(describeError(42)).toBe('42');
  });
});
