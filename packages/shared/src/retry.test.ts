import { describe, expect, it } from "vitest";
import { isRetryableStatus, withRetry } from "./retry.js";

describe("isRetryableStatus", () => {
  it("retries rate limits and server failures", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });

  it("fails fast on client errors", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns the first success without retrying", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        return "ok";
      },
      { baseDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries transient failures and returns the recovery", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("boom");
        return "recovered";
      },
      { times: 3, baseDelayMs: 1 },
    );
    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("throws the last error after the policy is exhausted", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error(`failure ${calls}`);
        },
        { times: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("failure 3");
    expect(calls).toBe(3);
  });

  it("fails fast when shouldRetry refuses the error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw Object.assign(new Error("fatal"), { status: 401 });
        },
        { times: 3, baseDelayMs: 1, shouldRetry: (error) => (error as { status: number }).status !== 401 },
      ),
    ).rejects.toThrow("fatal");
    expect(calls).toBe(1);
  });

  it("attempts exactly once when times is 0", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("nope");
        },
        { times: 0, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("nope");
    expect(calls).toBe(1);
  });

  it("uses defaults when no options are given", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      return "defaulted";
    });
    expect(result).toBe("defaulted");
    expect(calls).toBe(1);
  });

  it("preserves the thrown error object", async () => {
    const thrown = new Error("same object");
    let caught: unknown;
    await withRetry(
      async () => {
        throw thrown;
      },
      { times: 1, baseDelayMs: 1 },
    ).catch((error) => {
      caught = error;
    });
    expect(caught).toBe(thrown);
  });
});
