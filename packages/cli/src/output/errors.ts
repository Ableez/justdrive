import { AuthError } from '@juststore/shared';
import { ApiError } from '../api/client.js';

export { ApiError, AuthError };

/** Turns a failure into something worth reading in a terminal. */
export function describeError(error: unknown): string {
  if (error instanceof AuthError || error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
