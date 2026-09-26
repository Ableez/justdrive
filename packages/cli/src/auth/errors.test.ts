import { describe, it, expect } from 'vitest';
import { AuthError } from '@juststore/shared';
import { toAuthError, describeError } from './errors.js';

describe('auth/errors', () => {
  it('passes AuthErrors through', () => {
    const error = new AuthError('nope');
    expect(toAuthError(error)).toBe(error);
  });

  it('explains invalid_grant, including the 7-day testing limit', () => {
    const error = Object.assign(new Error('invalid_grant'), {
      response: { status: 400, data: { error: 'invalid_grant' } },
    });
    expect(describeError(error)).toMatch(/expired or was revoked[\s\S]*7-day[\s\S]*auth login/);
  });

  it('explains a rejected client', () => {
    expect(describeError(new Error('invalid_client'))).toMatch(/rejected the OAuth client/);
  });

  it('maps 401 and insufficient-scope 403 responses', () => {
    expect(toAuthError({ message: 'x', response: { status: 401 } })).toBeInstanceOf(AuthError);
    expect(
      toAuthError({ message: 'Request had insufficient authentication scopes.', code: 403 }),
    ).toBeInstanceOf(AuthError);
  });

  it('leaves unrelated errors alone', () => {
    expect(toAuthError(new Error('File not found'))).toBeNull();
    expect(toAuthError({ message: 'Forbidden', code: 403 })).toBeNull();
    expect(describeError(new Error('File not found'))).toBe('File not found');
    expect(describeError('boom')).toBe('boom');
  });
});
