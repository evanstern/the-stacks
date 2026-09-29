import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { createApp } from "../../app.js";
import { createValidateSession } from "../../auth/session.js";
import { createDb } from "../../db.js";
import { createGateway as createWsGateway } from "../../ws/gateway.js";
import { type StartedApp, startApp } from "./app-proc.js";
import type { RunContext } from "./cases.js";
import { recreateLoadDb, resolveLoadUrl, seedUsers } from "./db.js";
import type { Profile } from "./profile.js";
import type { CaseOutcome, ConcurrencyStep, Verdict } from "./results.js";
import { concurrencyVerdict } from "./stats.js";
import { runUsers } from "./users.js";

/**
 * Concurrency cases (specs/021-load-bench research R8/R9/R11): HTTP and
 * WebSocket load against a real running app, by simulated user count.
 */

function gitCommitShort(): string {
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

/** In-process app + WS gateway on port 0 (pattern of test/ws.integration.test.ts). 3 users, 2s, wsSend true. */
export async function runConcurrencySmoke(): Promise<CaseOutcome> {
  const start = Date.now();
  const { baseUrl, loadUrl } = resolveLoadUrl(process.env);
  await recreateLoadDb(baseUrl, loadUrl);
  const db = createDb(loadUrl);
  let server: ServerType | undefined;
  try {
    const app = createApp({
      databaseProbe: { reachable: async () => true },
      db,
    });
    const wsGateway = createWsGateway({
      db,
      validateSession: createValidateSession(db),
    });
    let resolvePort!: (port: number) => void;
    const portPromise = new Promise<number>((resolve) => {
      resolvePort = resolve;
    });
    server = serve({ fetch: app.fetch, port: 0 }, (info) =>
      resolvePort(info.port),
    );
    wsGateway.attach(server);
    const port = await portPromise;

    const seeded = await seedUsers(db, 3);
    const step = await runUsers({
      baseUrl: `http://127.0.0.1:${port}`,
      cookies: seeded.map((s) => s.token),
      users: 3,
      durationMs: 2000,
      thinkMs: 250,
      wsSend: true,
      wsSessionId: randomUUID(),
    });

    const pass = step.errors === 0;
    return {
      id: "concurrency-smoke",
      tier: "commit",
      target: "local",
      status: pass ? "pass" : "fail",
      reason: pass
        ? undefined
        : `${step.errors} error(s) across ${step.requests} requests`,
      durationMs: Date.now() - start,
      steps: [step],
    };
  } finally {
    await new Promise<void>((resolve) =>
      server ? server.close(() => resolve()) : resolve(),
    );
    await db.$client.end();
  }
}

/** The demand-tier measurement: users 1-100 against the built app on the load database. */
export async function runConcurrencyLocal(
  _ctx: RunContext,
  profile: Profile,
): Promise<CaseOutcome> {
  const start = Date.now();
  const base = {
    id: "concurrency-local",
    tier: profile.tier,
    target: "local" as const,
  };
  if (!profile.concurrency) {
    return {
      ...base,
      status: "fail",
      reason: "profile has no concurrency config",
      durationMs: Date.now() - start,
    };
  }
  const concurrency = profile.concurrency;
  const { baseUrl, loadUrl } = resolveLoadUrl(process.env);
  await recreateLoadDb(baseUrl, loadUrl);
  const db = createDb(loadUrl);
  let app: StartedApp | undefined;
  try {
    const maxUsers = Math.max(...concurrency.users);
    const seeded = await seedUsers(db, maxUsers);
    app = await startApp({ databaseUrl: loadUrl });

    const steps: ConcurrencyStep[] = [];
    for (const userCount of concurrency.users) {
      steps.push(
        await runUsers({
          baseUrl: app.url,
          cookies: seeded.map((s) => s.token),
          users: userCount,
          durationMs: concurrency.durationMs,
          thinkMs: concurrency.thinkMs,
          wsSend: concurrency.wsSend,
          wsSessionId: randomUUID(),
        }),
      );
    }

    return {
      ...base,
      status: "pass",
      durationMs: Date.now() - start,
      steps,
      verdicts: [concurrencyVerdict(steps, concurrency.thresholds)],
    };
  } catch (err) {
    return {
      ...base,
      status: "fail",
      reason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  } finally {
    await app?.stop();
    await db.$client.end();
  }
}

function parseSessionCookie(setCookie: string | null): string | undefined {
  return setCookie?.match(/(?:^|,\s*)session=([^;]+)/)?.[1];
}

async function endDevSession(
  devUrl: string,
  cookie: string,
  userAgent: string,
): Promise<boolean> {
  try {
    await fetch(`${devUrl}/auth/sign-out`, {
      method: "POST",
      headers: { Cookie: `session=${cookie}`, "user-agent": userAgent },
      signal: AbortSignal.timeout(10_000),
    });
    const check = await fetch(`${devUrl}/auth/me`, {
      headers: { Cookie: `session=${cookie}`, "user-agent": userAgent },
      signal: AbortSignal.timeout(10_000),
    });
    return check.status === 401;
  } catch {
    return false;
  }
}

/**
 * The read-only dev-tier probe (research R11) — never invoked outside an
 * operator-approved run (T026). One sign-in, steps of increasing users with
 * `wsSend` forced false, sign-out and a 401 check in a `finally`.
 */
export async function runConcurrencyDev(
  _ctx: RunContext,
  profile: Profile,
): Promise<CaseOutcome> {
  const start = Date.now();
  const base = {
    id: "concurrency-dev",
    tier: "dev" as const,
    target: "dev" as const,
  };
  if (!profile.concurrency) {
    return {
      ...base,
      status: "fail",
      reason: "profile has no concurrency config",
      durationMs: Date.now() - start,
    };
  }
  const devUrl = process.env.LOAD_DEV_URL;
  if (!devUrl) {
    return {
      ...base,
      status: "skipped",
      reason: "dev target not configured (LOAD_DEV_URL unset)",
      durationMs: Date.now() - start,
    };
  }
  const username = process.env.LOAD_DEV_USERNAME;
  const password = process.env.LOAD_DEV_PASSWORD;
  if (!username)
    throw new Error("LOAD_DEV_USERNAME is required for the dev tier");
  if (!password)
    throw new Error("LOAD_DEV_PASSWORD is required for the dev tier");

  const userAgent = `the-stacks-load-bench/${gitCommitShort()}`;
  const concurrency = profile.concurrency;
  let cookie: string | undefined;
  let outcome: CaseOutcome;

  try {
    const healthRes = await fetch(`${devUrl}/health`, {
      headers: { "user-agent": userAgent },
      signal: AbortSignal.timeout(45_000),
    });
    const health = (await healthRes.json()) as {
      status?: string;
      commit?: string;
    };
    if (health.status !== "ok") {
      throw new Error(
        `dev target /health status "${health.status}"; refusing to proceed`,
      );
    }

    const signInRes = await fetch(`${devUrl}/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": userAgent },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!signInRes.ok)
      throw new Error(`dev sign-in failed: HTTP ${signInRes.status}`);
    cookie = parseSessionCookie(signInRes.headers.get("set-cookie"));
    if (!cookie)
      throw new Error("dev sign-in response carried no session cookie");

    const steps: ConcurrencyStep[] = [];
    for (const userCount of concurrency.users) {
      steps.push(
        await runUsers({
          baseUrl: devUrl,
          cookies: [cookie],
          users: userCount,
          durationMs: concurrency.durationMs,
          thinkMs: concurrency.thinkMs,
          wsSend: false,
          wsSessionId: randomUUID(),
          userAgent,
        }),
      );
    }

    outcome = {
      ...base,
      status: "pass",
      durationMs: Date.now() - start,
      steps,
      verdicts: [concurrencyVerdict(steps, concurrency.thresholds)],
      observed: { sessionEnded: 1, appCommit: health.commit ? 1 : 0 },
    };
  } catch (err) {
    outcome = {
      ...base,
      status: "fail",
      reason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }

  if (cookie) {
    const sessionEnded = await endDevSession(devUrl, cookie, userAgent);
    if (!sessionEnded) {
      console.error(
        "dev session not ended; it expires in 30 days; ask the operator before any removal",
      );
      outcome = {
        ...base,
        status: "fail",
        reason: "dev session not ended; ask the operator before any removal",
        durationMs: Date.now() - start,
      };
    } else if (outcome.status === "pass") {
      outcome = {
        ...outcome,
        observed: { ...outcome.observed, sessionEnded: 1 },
      };
    }
  }

  return outcome;
}

function pad(value: string, width: number): string {
  return value.length >= width
    ? value
    : value + " ".repeat(width - value.length);
}

const CONCURRENCY_COLUMNS: [string, number][] = [
  ["users", 7],
  ["reqs", 8],
  ["errors", 8],
  ["errRate", 9],
  ["httpP50", 9],
  ["httpP95", 9],
  ["httpP99", 9],
  ["wsConnP95", 11],
  ["wsSubP95", 10],
  ["wsRtP95", 9],
];

function formatConcurrencyRow(step: ConcurrencyStep): string {
  const cells = [
    String(step.users),
    String(step.requests),
    String(step.errors),
    step.errorRate.toFixed(3),
    step.httpP50Ms.toFixed(1),
    step.httpP95Ms.toFixed(1),
    step.httpP99Ms.toFixed(1),
    step.wsConnectP95Ms.toFixed(1),
    step.wsSubscribeP95Ms.toFixed(1),
    step.wsRoundTripP95Ms === null ? "-" : step.wsRoundTripP95Ms.toFixed(1),
  ];
  return cells.map((c, i) => pad(c, CONCURRENCY_COLUMNS[i][1])).join("");
}

function formatConcurrencyVerdict(caseId: string, verdict: Verdict): string {
  const prefix = `VERDICT ${caseId}:`;
  return verdict.degraded
    ? `${prefix} degraded at ${verdict.at} users (${verdict.rules.join(", ")})`
    : `${prefix} no degradation up to ${verdict.through} users`;
}

/** Prints the concurrency step table and its VERDICT line (contracts/bench-cli.md). */
export function printConcurrency(
  caseId: string,
  steps: ConcurrencyStep[],
  verdict: Verdict,
): void {
  console.log(
    CONCURRENCY_COLUMNS.map(([name, width]) => pad(name, width)).join(""),
  );
  for (const step of steps) console.log(formatConcurrencyRow(step));
  console.log(formatConcurrencyVerdict(caseId, verdict));
}
