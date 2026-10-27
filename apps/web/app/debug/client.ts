import type {
  CallsPage,
  DebugError,
  EventsPage,
  JobsPage,
  SeedResult,
} from "./api-types.ts";

/** Result of one debug call: a value, or a typed error. Never throws. */
export type DebugResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: DebugError };

export type FetchLike = (
  input: string,
  init?: { method?: string; credentials?: "same-origin" },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface DebugClient {
  events(after: number, limit: number): Promise<DebugResult<EventsPage>>;
  jobs(limit: number, before?: string): Promise<DebugResult<JobsPage>>;
  calls(after: number, limit: number): Promise<DebugResult<CallsPage>>;
  seed(): Promise<DebugResult<SeedResult>>;
  retry(): Promise<DebugResult<{ jobId: string }>>;
  /** Loops `events` while `hasMore` (limit 1000); returns every event after `after`. */
  loadAllEvents(after: number): Promise<DebugResult<EventsPage>>;
  /** Loops `calls` while `hasMore` (limit 1000); the last page's totals win. */
  loadAllCalls(after: number): Promise<DebugResult<CallsPage>>;
}

const PAGE = 1000;

async function messageOf(res: {
  json(): Promise<unknown>;
}): Promise<string | undefined> {
  try {
    const body = (await res.json()) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    } | null;
    const e = body?.error;
    if (typeof e === "object" && e !== null && typeof e.message === "string")
      return e.message;
    if (typeof e === "string") return e;
    if (typeof body?.message === "string") return body.message;
  } catch {
    /* no body */
  }
  return undefined;
}

export function createDebugClient(
  sessionId: string,
  fetchImpl: FetchLike,
): DebugClient {
  const base = `/dm/sessions/${sessionId}`;

  async function call<T>(
    path: string,
    method: "GET" | "POST",
    onStatus?: (status: number) => DebugResult<T> | null,
  ): Promise<DebugResult<T>> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        credentials: "same-origin",
      });
    } catch {
      return { ok: false, error: { kind: "network" } };
    }
    const special = onStatus?.(res.status);
    if (special) return special;
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: { kind: "auth", status: res.status } };
    }
    if (!res.ok) {
      const message = await messageOf(res);
      return {
        ok: false,
        error:
          message === undefined
            ? { kind: "http", status: res.status }
            : { kind: "http", status: res.status, message },
      };
    }
    try {
      return { ok: true, value: (await res.json()) as T };
    } catch {
      return { ok: false, error: { kind: "network" } };
    }
  }

  const client: DebugClient = {
    events: (after, limit) =>
      call<EventsPage>(`/events?after=${after}&limit=${limit}`, "GET"),
    jobs: (limit, before) =>
      call<JobsPage>(
        `/jobs?limit=${limit}${before === undefined ? "" : `&before=${before}`}`,
        "GET",
      ),
    calls: (after, limit) =>
      call<CallsPage>(`/calls?after=${after}&limit=${limit}`, "GET"),
    seed: () =>
      call<SeedResult>("/seed", "GET", (status) =>
        status === 404
          ? { ok: true, value: { kind: "none" } }
          : status === 409
            ? { ok: true, value: { kind: "failed" } }
            : null,
      ).then((r) =>
        r.ok && r.value.kind === undefined
          ? {
              ok: true as const,
              value: {
                kind: "ok" as const,
                ...(r.value as object),
              } as SeedResult,
            }
          : r,
      ),
    retry: () => call<{ jobId: string }>("/turn", "POST"),
    async loadAllEvents(after) {
      let cursor = after;
      const events: EventsPage["events"] = [];
      for (;;) {
        const page = await client.events(cursor, PAGE);
        if (!page.ok) return page;
        events.push(...page.value.events);
        cursor = page.value.nextAfter;
        if (!page.value.hasMore) {
          return {
            ok: true,
            value: { ...page.value, events, nextAfter: cursor, hasMore: false },
          };
        }
      }
    },
    async loadAllCalls(after) {
      let cursor = after;
      const calls: CallsPage["calls"] = [];
      for (;;) {
        const page = await client.calls(cursor, PAGE);
        if (!page.ok) return page;
        calls.push(...page.value.calls);
        cursor = page.value.nextAfter;
        if (!page.value.hasMore) {
          return {
            ok: true,
            value: { ...page.value, calls, nextAfter: cursor, hasMore: false },
          };
        }
      }
    },
  };
  return client;
}
