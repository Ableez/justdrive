import { AuthError } from '@juststore/shared';

interface GoogleErrorShape {
  message?: string;
  status?: number;
  code?: number | string;
  response?: { status?: number; data?: { error?: string | { message?: string } } };
}

const RELOGIN = 'Run: justdrive auth login';

/** Translate Google OAuth/API failures into actionable AuthErrors. */
export function toAuthError(error: unknown): AuthError | null {
  if (error instanceof AuthError) return error;
  if (!error || typeof error !== 'object') return null;

  const e = error as GoogleErrorShape;
  const oauthCode = typeof e.response?.data?.error === 'string' ? e.response.data.error : e.message;
  const status = e.response?.status ?? e.status ?? (typeof e.code === 'number' ? e.code : undefined);

  if (oauthCode === 'invalid_grant') {
    return new AuthError(
      'Your Google session has expired or was revoked.\n' +
        '(Apps in "Testing" mode on the OAuth consent screen get 7-day sessions.)\n' +
        RELOGIN,
    );
  }
  if (oauthCode === 'invalid_client' || oauthCode === 'unauthorized_client') {
    return new AuthError(
      'Google rejected the OAuth client. It may have been deleted, or your saved login ' +
        `belongs to a different client.\n${RELOGIN}`,
    );
  }
  if (status === 401) {
    return new AuthError(`Google rejected the saved credentials. ${RELOGIN}`);
  }
  if (status === 403 && /insufficient.*scope|insufficientPermissions/i.test(e.message ?? '')) {
    return new AuthError(`Your login is missing Google Drive permission. ${RELOGIN}`);
  }
  return null;
}

export function describeError(error: unknown): string {
  const authError = toAuthError(error);
  if (authError) return authError.message;
  return error instanceof Error ? error.message : String(error);
}
