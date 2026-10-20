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
});
