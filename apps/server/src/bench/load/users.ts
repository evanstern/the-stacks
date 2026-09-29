import WebSocket, { type RawData } from "ws";
import type { ConcurrencyStep } from "./results.js";
import { percentile } from "./stats.js";

/**
 * Simulated concurrent users, HTTP and WebSocket (specs/021-load-bench
 * research R8). Node's global `fetch` and the already-installed `ws`
 * client — no new dependency. One async loop per user for `durationMs`.
 */

const ERROR_KINDS = [
  "http_4xx",
  "http_5xx",
  "timeout",
  "network",
  "ws_refused",
  "ws_closed",
] as const;
type ErrorKind = (typeof ERROR_KINDS)[number];

export interface RunUsersInput {
  baseUrl: string;
  /** One session token per simulated user (research R9); cycles if shorter than `users` (the dev case shares one cookie — R11). */
  cookies: string[];
  users: number;
  durationMs: number;
  thinkMs: number;
  wsSend: boolean;
  wsSessionId: string;
  userAgent?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** Resolves with the first message matching `pred`, parsed as JSON. */
function waitForFrame(
  ws: WebSocket,
  pred: (frame: { type?: string }) => boolean,
  timeoutMs: number,
): Promise<{ type?: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("timed out waiting for frame"));
    }, timeoutMs);
    function onMessage(data: RawData) {
      let frame: { type?: string };
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (pred(frame)) {
        clearTimeout(timer);
        ws.off("message", onMessage);
        resolve(frame);
      }
    }
    ws.on("message", onMessage);
  });
}

/** Runs one simulated user's step and reports its samples into the shared collectors. */
async function runUser(
  input: RunUsersInput,
  cookie: string,
  deadline: number,
  collect: {
    httpLatencies: number[];
    wsConnectLatencies: number[];
    wsSubscribeLatencies: number[];
    wsRoundTripLatencies: number[];
    errorKinds: Record<string, number>;
    incRequests(): void;
  },
): Promise<void> {
  const { baseUrl, wsSend, wsSessionId, userAgent } = input;
  const headers: Record<string, string> = { Cookie: `session=${cookie}` };
  if (userAgent) headers["user-agent"] = userAgent;

  function recordError(kind: ErrorKind): void {
    collect.errorKinds[kind] = (collect.errorKinds[kind] ?? 0) + 1;
  }

  async function httpLoop(): Promise<void> {
    while (Date.now() < deadline) {
      for (const p of ["/auth/me", "/health"]) {
        collect.incRequests();
        const t0 = performance.now();
        try {
          const res = await fetch(`${baseUrl}${p}`, {
            headers,
            signal: AbortSignal.timeout(10_000),
          });
          collect.httpLatencies.push(performance.now() - t0);
          if (res.status >= 500) recordError("http_5xx");
          else if (res.status >= 400) recordError("http_4xx");
        } catch (err) {
          if (err instanceof DOMException && err.name === "TimeoutError") {
            recordError("timeout");
          } else {
            recordError("network");
          }
        }
        if (Date.now() >= deadline) return;
        await sleep(input.thinkMs);
      }
    }
  }

  async function wsLoop(): Promise<void> {
    const wsUrl = `${baseUrl.replace(/^http/, "ws")}/ws`;
    const ws = new WebSocket(wsUrl, { headers });
    ws.on("error", () => {});
    let closed = false;
    ws.once("close", () => {
      closed = true;
    });

    const connectStart = performance.now();
    try {
      await new Promise<void>((resolve, reject) => {
        ws.once("open", () => resolve());
        ws.once("unexpected-response", (_req, res) =>
          reject(new Error(`ws refused: ${res.statusCode}`)),
        );
        ws.once("error", reject);
      });
    } catch {
      recordError("ws_refused");
      return;
    }
    collect.wsConnectLatencies.push(performance.now() - connectStart);

    const subscribeStart = performance.now();
    ws.send(JSON.stringify({ type: "subscribe", sessionId: wsSessionId }));
    try {
      await waitForFrame(ws, (f) => f.type === "replay-complete", 10_000);
      collect.wsSubscribeLatencies.push(performance.now() - subscribeStart);
    } catch {
      recordError("network");
    }

    while (!closed && Date.now() < deadline) {
      if (wsSend) {
        const t0 = performance.now();
        ws.send(
          JSON.stringify({
            type: "send",
            sessionId: wsSessionId,
            eventType: "load-bench-ping",
            payload: {},
            payloadVersion: 1,
          }),
        );
        try {
          await waitForFrame(ws, (f) => f.type === "event", 5000);
          collect.wsRoundTripLatencies.push(performance.now() - t0);
        } catch {
          recordError("timeout");
        }
        await sleep(Math.max(0, 1000 - (performance.now() - t0)));
      } else {
        await sleep(Math.min(1000, Math.max(0, deadline - Date.now())));
      }
    }

    if (closed) {
      recordError("ws_closed");
    } else {
      ws.close();
    }
  }

  await Promise.all([httpLoop(), wsLoop()]);
}

/** Drives `users` concurrent simulated users for `durationMs` and returns one concurrency step. */
export async function runUsers(input: RunUsersInput): Promise<ConcurrencyStep> {
  const collect = {
    httpLatencies: [] as number[],
    wsConnectLatencies: [] as number[],
    wsSubscribeLatencies: [] as number[],
    wsRoundTripLatencies: [] as number[],
    errorKinds: {} as Record<string, number>,
    requests: 0,
    incRequests() {
      this.requests += 1;
    },
  };

  const deadline = Date.now() + input.durationMs;
  const tasks: Promise<void>[] = [];
  for (let i = 0; i < input.users; i++) {
    const cookie = input.cookies[i % input.cookies.length];
    tasks.push(runUser(input, cookie, deadline, collect));
  }
  await Promise.all(tasks);

  const errors = Object.values(collect.errorKinds).reduce((a, b) => a + b, 0);
  const httpP = sorted(collect.httpLatencies);
  const wsConnectP = sorted(collect.wsConnectLatencies);
  const wsSubscribeP = sorted(collect.wsSubscribeLatencies);
  const wsRoundTripP = sorted(collect.wsRoundTripLatencies);

  return {
    users: input.users,
    requests: collect.requests,
    errors,
    errorRate: collect.requests > 0 ? errors / collect.requests : 0,
    httpP50Ms: httpP.length ? percentile(httpP, 50) : 0,
    httpP95Ms: httpP.length ? percentile(httpP, 95) : 0,
    httpP99Ms: httpP.length ? percentile(httpP, 99) : 0,
    wsConnectP95Ms: wsConnectP.length ? percentile(wsConnectP, 95) : 0,
    wsSubscribeP95Ms: wsSubscribeP.length ? percentile(wsSubscribeP, 95) : 0,
    wsRoundTripP95Ms:
      input.wsSend && wsRoundTripP.length ? percentile(wsRoundTripP, 95) : null,
    errorKinds: collect.errorKinds,
  };
}
