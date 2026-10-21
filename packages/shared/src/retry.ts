import { Effect, Schedule } from "effect";

export interface RetryOptions {
  /** Retries after the first attempt. Defaults to 3. */
  readonly times?: number;
  /** Base delay in ms for exponential backoff. Defaults to 200. */
  readonly baseDelayMs?: number;
  /** Return false to fail fast on errors that retrying cannot fix. Defaults to always retry. */
  readonly shouldRetry?: (error: unknown) => boolean;
}

/** HTTP statuses worth retrying: rate limited or a server-side failure. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Runs an async attempt with capped exponential backoff and jitter. The
 * attempt stays a plain Promise, so call sites keep their existing error
 * types and signatures; only transient failures are retried.
 */
export function withRetry<T>(attempt: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const times = options?.times ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 200;
  const shouldRetry = options?.shouldRetry ?? (() => true);
  const policy = Schedule.max([
    Schedule.jittered(Schedule.exponential(baseDelayMs)),
    Schedule.recurs(times),
  ]);
  return Effect.runPromise(
    Effect.retry(Effect.tryPromise({ try: attempt, catch: (cause) => cause }), {
      schedule: policy,
      while: (error) => shouldRetry(error),
    }),
  );
}
