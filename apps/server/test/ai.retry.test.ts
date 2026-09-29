import { describe, expect, it, vi } from "vitest";
import {
  computeBackoffMs,
  parseRetryAfterMs,
  RetryExhaustedError,
  retryFetch,
} from "../src/ai/retry.js";

describe("computeBackoffMs", () => {
  it("doubles the base delay per attempt, capped, under full jitter", () => {
    const opts = { baseDelayMs: 500, maxDelayMs: 8000, random: () => 1 };
    expect(computeBackoffMs(1, opts)).toBe(500);
    expect(computeBackoffMs(2, opts)).toBe(1000);
    expect(computeBackoffMs(4, opts)).toBe(4000);
    expect(computeBackoffMs(10, opts)).toBe(8000); // capped
  });

  it("is 0 at the jitter floor", () => {
    expect(
      computeBackoffMs(3, {
        baseDelayMs: 500,
        maxDelayMs: 8000,
        random: () => 0,
      }),
    ).toBe(0);
  });
});

describe("parseRetryAfterMs", () => {
  it("reads a seconds value", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
  });

  it("reads an HTTP-date relative to now", () => {
    const now = () => Date.parse("2026-01-01T00:00:00Z");
    expect(parseRetryAfterMs("Thu, 01 Jan 2026 00:00:05 GMT", now)).toBe(5000);
  });

  it("returns null for a missing or unparseable header", () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs("not-a-date")).toBeNull();
  });
});

const noSleep = vi.fn(async () => {});

describe("retryFetch", () => {
  it("returns the first successful response without sleeping", async () => {
    const doFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const outcome = await retryFetch(doFetch, { sleep: noSleep });
    expect(outcome).toMatchObject({ attempts: 1 });
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it("retries 429 and 5xx up to the bound, then returns the last response", async () => {
    const sleep = vi.fn(async () => {});
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const outcome = await retryFetch(doFetch, { sleep, maxAttempts: 3 });
    expect(doFetch).toHaveBeenCalledTimes(3);
    expect(outcome).toMatchObject({ attempts: 3 });
    expect(outcome.response.status).toBe(500);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("retries a network failure and succeeds", async () => {
    const sleep = vi.fn(async () => {});
    const doFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const outcome = await retryFetch(doFetch, { sleep });
    expect(outcome).toMatchObject({ attempts: 2 });
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("throws RetryExhaustedError carrying the attempt count when a network failure never succeeds", async () => {
    const sleep = vi.fn(async () => {});
    const doFetch = vi.fn().mockRejectedValue(new TypeError("still failing"));
    const rejection = await retryFetch(doFetch, {
      sleep,
      maxAttempts: 2,
    }).catch((err) => err);
    expect(rejection).toBeInstanceOf(RetryExhaustedError);
    expect(rejection).toMatchObject({ attempts: 2 });
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404, 422])(
    "never retries a %i response",
    async (status) => {
      const sleep = vi.fn(async () => {});
      const doFetch = vi.fn().mockResolvedValue(new Response(null, { status }));
      const outcome = await retryFetch(doFetch, { sleep });
      expect(outcome).toMatchObject({ attempts: 1 });
      expect(doFetch).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    },
  );

  it("honors a Retry-After (seconds) header, overriding the computed backoff", async () => {
    const sleep = vi.fn(async () => {});
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "retry-after": "2" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await retryFetch(doFetch, { sleep, random: () => 1 });
    expect(sleep).toHaveBeenCalledWith(2000, undefined);
  });

  it("caps a Retry-After delay at maxRetryAfterMs", async () => {
    const sleep = vi.fn(async () => {});
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 503, headers: { "retry-after": "9999" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await retryFetch(doFetch, { sleep, maxRetryAfterMs: 30_000 });
    expect(sleep).toHaveBeenCalledWith(30_000, undefined);
  });

  it("stops retrying once the signal aborts during backoff", async () => {
    const controller = new AbortController();
    const sleepCalls: number[] = [];
    const sleep = vi.fn(async (ms: number, signal?: AbortSignal) => {
      sleepCalls.push(ms);
      controller.abort();
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    });
    const doFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429 }));

    await expect(
      retryFetch(doFetch, { signal: controller.signal, sleep, maxAttempts: 5 }),
    ).rejects.toThrow(/aborted/i);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(sleepCalls).toHaveLength(1);
  });

  it("rethrows immediately, without sleeping, when a network failure races an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const networkError = new TypeError("fetch failed");
    const doFetch = vi.fn().mockRejectedValue(networkError);

    await expect(
      retryFetch(doFetch, {
        signal: controller.signal,
        sleep: noSleep,
        maxAttempts: 5,
      }),
    ).rejects.toBe(networkError);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });
});
