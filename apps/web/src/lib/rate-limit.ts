import { DEVICE_CODE_POLL_INTERVAL_SECONDS } from './constants';

const DEFAULT_WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Per-instance sliding counter. Vercel runs many instances, so this caps one
 * caller's burst rate rather than setting a global quota; the token endpoints
 * additionally enforce Google's mandated polling interval, which is what
 * actually bounds the expensive work.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // Keys come from client-supplied addresses, so expired windows are dropped
    // rather than left to accumulate for the life of the instance.
    if (existing) buckets.delete(key);
    if (buckets.size > 10_000) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function pollingIntervalSeconds(): number {
  return DEVICE_CODE_POLL_INTERVAL_SECONDS;
}
