/**
 * Bounded retry for the initial request only — never for a stream already in
 * progress (research R8). Retries 429/5xx responses and network failures,
 * with exponential backoff (full jitter, capped), honoring `Retry-After`
 * (seconds or HTTP-date). The sleep is abort-aware; clock/jitter/sleep are
 * injectable so tests never really wait.
 */

/** Thrown when every attempt fails without ever getting a response. */
export class RetryExhaustedError extends Error {
  constructor(
    readonly attempts: number,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "RetryExhaustedError";
  }
}

export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  maxAttempts?: number;
  /** Base backoff delay in ms before doubling (default 500). */
  baseDelayMs?: number;
  /** Cap on the computed backoff delay in ms (default 8000). */
  maxDelayMs?: number;
  /** Cap on a `Retry-After`-derived delay in ms (default 30000). */
  maxRetryAfterMs?: number;
  signal?: AbortSignal;
  /** Injectable for tests; default sleeps for real and rejects on abort. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Injectable jitter source, `[0, 1)` (default `Math.random`). */
  random?: () => number;
}

export interface RetryOutcome {
  response: Response;
  attempts: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8000;
const DEFAULT_MAX_RETRY_AFTER_MS = 30000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/** Full-jitter exponential backoff: a random delay in `[0, cap]`. */
export function computeBackoffMs(
  attempt: number,
  opts: { baseDelayMs: number; maxDelayMs: number; random: () => number },
): number {
  const cap = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
  return Math.round(opts.random() * cap);
}

/** Parses a `Retry-After` header (seconds, or an HTTP-date) into a delay in ms. */
export function parseRetryAfterMs(
  value: string | null,
  now: () => number = Date.now,
): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now());
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Runs `doFetch` with bounded retry. Retries a network failure (thrown) or a
 * 429/5xx response; any other response (including other 4xx) is returned
 * immediately. An abort never retries — it propagates.
 */
export async function retryFetch(
  doFetch: () => Promise<Response>,
  opts: RetryOptions = {},
): Promise<RetryOutcome> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const maxRetryAfterMs = opts.maxRetryAfterMs ?? DEFAULT_MAX_RETRY_AFTER_MS;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;

  let attempt = 1;
  for (;;) {
    let response: Response;
    try {
      response = await doFetch();
    } catch (err) {
      if (opts.signal?.aborted || attempt >= maxAttempts) {
        throw opts.signal?.aborted
          ? err
          : new RetryExhaustedError(attempt, err);
      }
      await sleep(
        computeBackoffMs(attempt, { baseDelayMs, maxDelayMs, random }),
        opts.signal,
      );
      attempt++;
      continue;
    }

    if (isRetryableStatus(response.status) && attempt < maxAttempts) {
      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("retry-after"),
      );
      const delayMs =
        retryAfterMs !== null
          ? Math.min(retryAfterMs, maxRetryAfterMs)
          : computeBackoffMs(attempt, { baseDelayMs, maxDelayMs, random });
      await sleep(delayMs, opts.signal);
      attempt++;
      continue;
    }

    return { response, attempts: attempt };
  }
}
