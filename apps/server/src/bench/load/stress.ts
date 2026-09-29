import { type ChildProcess, fork } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { createDb } from "../../db.js";
import { enqueueIngest, getJob } from "../../library/ingest/jobs.js";
import { libraryDocuments } from "../../schema/library.js";
import WebSocket from "ws";
import { type StartedApp, startApp } from "./app-proc.js";
import type { RunContext } from "./cases.js";
import { recreateLoadDb, resolveLoadUrl, seedUsers } from "./db.js";
import type { Profile } from "./profile.js";
import type { CaseOutcome, Expectation } from "./results.js";
import { synthDoc } from "./synth.js";

/**
 * The stress cases (specs/021-load-bench research R6/R7): both refuse to
 * run under vitest or touch anything but the isolated load database and a
 * throwaway app process this file starts itself.
 */

const WORKER_PROC_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "worker-proc.js",
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTooManyConnections(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "53300";
}

/** Polls `probe()` until it reports pass, or `timeoutMs` elapses. Returns elapsed ms on pass, else null. */
async function pollUntil(
  timeoutMs: number,
  probe: () => Promise<boolean>,
): Promise<number | null> {
  const start = Date.now();
  for (;;) {
    if (await probe().catch(() => false)) return Date.now() - start;
    if (Date.now() - start >= timeoutMs) return null;
    await sleep(250);
  }
}

/**
 * Like `pollUntil`, but each round fires `burst` concurrent attempts and
 * passes if any one of them does. The app's own `db` pool always keeps one
 * connection warm (the ingest worker polls `jobs` every 2s on the very pool
 * `/auth/me` and the WS gateway use), so a single sequential probe almost
 * always reuses that idle connection and never observes the outage. A
 * concurrent burst forces the pool to open more connections than it has
 * warm, so at least one attempt needs a new one — which is what's actually
 * exhausted.
 */
async function pollUntilBurst(
  timeoutMs: number,
  burst: number,
  probe: () => Promise<boolean>,
): Promise<number | null> {
  const start = Date.now();
  for (;;) {
    const results = await Promise.all(
      Array.from({ length: burst }, () => probe().catch(() => false)),
    );
    if (results.some(Boolean)) return Date.now() - start;
    if (Date.now() - start >= timeoutMs) return null;
    await sleep(250);
  }
}

/** A single WebSocket upgrade attempt; resolves the HTTP status code the server refused with, or null. */
function probeWsStatus(wsUrl: string, cookie: string): Promise<number | null> {
  return new Promise((resolve) => {
    const socket = new WebSocket(wsUrl, { headers: { Cookie: `session=${cookie}` } });
    const timer = setTimeout(() => {
      socket.terminate();
      resolve(null);
    }, 4000);
    socket.once("unexpected-response", (_req, res) => {
      clearTimeout(timer);
      resolve(res.statusCode ?? null);
      res.resume();
      socket.terminate();
    });
    socket.once("open", () => {
      clearTimeout(timer);
      resolve(200);
      socket.close();
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

/**
 * `db-exhaustion` (research R7): opens raw `pg` clients against the load
 * database until Postgres refuses, then probes the running app for bounded
 * degradation, then releases every held client in a `finally` and measures
 * recovery.
 */
export async function runDbExhaustion(
  _ctx: RunContext,
  profile: Profile,
): Promise<CaseOutcome> {
  const start = Date.now();
  const base = {
    id: "db-exhaustion",
    tier: "demand" as const,
    target: "local" as const,
  };
  if (process.env.VITEST) {
    return {
      ...base,
      status: "skipped",
      reason:
        "refuses to run under vitest (research R7): it disrupts every connection to the test stack",
      durationMs: Date.now() - start,
    };
  }
  if (!profile.exhaustion) {
    return {
      ...base,
      status: "fail",
      reason: "profile has no exhaustion config",
      durationMs: Date.now() - start,
    };
  }
  const { holdMs, recoverTimeoutMs } = profile.exhaustion;
  const { baseUrl, loadUrl } = resolveLoadUrl(process.env);
  await recreateLoadDb(baseUrl, loadUrl);
  const db = createDb(loadUrl);
  let app: StartedApp | undefined;
  const held: Client[] = [];
  const expectations: Expectation[] = [];

  try {
    const [seeded] = await seedUsers(db, 1);
    app = await startApp({ databaseUrl: loadUrl });
    await fetch(`${app.url}/auth/me`, {
      headers: { Cookie: `session=${seeded.token}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
    await sleep(11_000); // pg's default idle timeout (10s) closes the app pool's idle clients

    const { rows } = await db.execute(sql`SHOW max_connections`);
    const maxConnections = Number(
      (rows[0] as { max_connections: string }).max_connections,
    );

    let heldConnections = 0;
    while (heldConnections < maxConnections) {
      const client = new Client({
        connectionString: loadUrl,
        connectionTimeoutMillis: 2000,
      });
      try {
        await client.connect();
        held.push(client);
        heldConnections += 1;
      } catch (err) {
        if (isTooManyConnections(err)) break;
        throw err;
      }
    }

    const healthMs = await pollUntil(5000, async () => {
      const res = await fetch(`${app!.url}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const body = (await res.json()) as { status?: string };
      return res.status === 200 && body.status === "degraded";
    });
    const BURST = 8; // ponytail: see the Deviation note in tasks.md (R7's single-request probe never observes the outage)
    const authMs = await pollUntilBurst(10_000, BURST, async () => {
      const res = await fetch(`${app!.url}/auth/me`, {
        headers: { Cookie: `session=${seeded.token}` },
        signal: AbortSignal.timeout(3000),
      });
      return res.status >= 500;
    });
    const wsUrl = `${app.url.replace(/^http/, "ws")}/ws`;
    const wsStatuses = await Promise.all(
      Array.from({ length: BURST }, () => probeWsStatus(wsUrl, seeded.token)),
    );
    const wsStatus = wsStatuses.includes(503) ? 503 : (wsStatuses.find((s) => s !== null) ?? null);
    const processAlive = app.alive();

    expectations.push(
      { name: "health-degraded", pass: healthMs !== null, observed: healthMs },
      { name: "request-bounded", pass: authMs !== null, observed: authMs },
      { name: "ws-503-not-401", pass: wsStatus === 503, observed: wsStatus },
      { name: "process-alive", pass: processAlive, observed: processAlive ? 1 : 0 },
    );

    for (const c of held) await c.end().catch(() => {});
    held.length = 0;

    const recoverySec = await pollUntil(recoverTimeoutMs, async () => {
      const [h, m] = await Promise.all([
        fetch(`${app!.url}/health`, { signal: AbortSignal.timeout(3000) }),
        fetch(`${app!.url}/auth/me`, {
          headers: { Cookie: `session=${seeded.token}` },
          signal: AbortSignal.timeout(3000),
        }),
      ]);
      const hb = (await h.json()) as { status?: string };
      return hb.status === "ok" && m.status === 200;
    }).then((ms) => (ms === null ? null : ms / 1000));
    expectations.push({ name: "recovered", pass: recoverySec !== null, observed: recoverySec });

    const pass = expectations.every((e) => e.pass);
    return {
      ...base,
      status: pass ? "pass" : "fail",
      reason: pass
        ? undefined
        : `failed: ${expectations.filter((e) => !e.pass).map((e) => e.name).join(", ")}`,
      durationMs: Date.now() - start,
      expectations,
      observed: {
        heldConnections,
        maxConnections,
        ...(recoverySec !== null ? { recoverySec } : {}),
      },
    };
  } catch (err) {
    return {
      ...base,
      status: "fail",
      reason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
      expectations: expectations.length > 0 ? expectations : undefined,
    };
  } finally {
    for (const c of held) await c.end().catch(() => {});
    await app?.stop();
    await db.$client.end();
  }
}

async function forkWorker(
  loadUrl: string,
  uploadDir: string,
  holdEmbed: boolean,
  waitFor: "ready" | "embed-held",
  timeoutMs: number,
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER_PROC_PATH, [], {
      env: {
        ...process.env,
        LOAD_DATABASE_URL: loadUrl,
        LOAD_UPLOAD_DIR: uploadDir,
        ...(holdEmbed ? { LOAD_HOLD_EMBED: "1" } : {}),
      },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    // A timeout or early-exit rejection still leaves this child running (or
    // exited) — kill it here so the caller's reference isn't the only way
    // to reach it: a rejected promise carries no handle to clean up later.
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`worker did not reach "${waitFor}" within ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("message", (msg: unknown) => {
      if ((msg as { type?: string } | null)?.type === waitFor) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`worker exited early (code ${code})`));
    });
    child.once("error", (err) => {
      clearTimeout(timer);
      child.kill("SIGKILL");
      reject(err);
    });
  });
}

async function stopWorker(child: ChildProcess): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.send({ type: "stop" });
  });
}

/**
 * `restart-mid-ingest` (research R6): holds a forked worker mid-embed,
 * `SIGKILL`s it, forks a normal worker, and measures lease-reclaim recovery.
 * Kills only the two worker children this function itself forks.
 */
export async function runRestartMidIngest(
  ctx: RunContext,
  profile: Profile,
): Promise<CaseOutcome> {
  const start = Date.now();
  const base = {
    id: "restart-mid-ingest",
    tier: "demand" as const,
    target: "local" as const,
  };
  if (process.env.VITEST) {
    return {
      ...base,
      status: "skipped",
      reason: "refuses to run under vitest (research R6): it forks and kills real worker processes",
      durationMs: Date.now() - start,
    };
  }
  if (!profile.restart) {
    return {
      ...base,
      status: "fail",
      reason: "profile has no restart config",
      durationMs: Date.now() - start,
    };
  }
  const { followers, reclaimTimeoutMs } = profile.restart;
  const { baseUrl, loadUrl } = resolveLoadUrl(process.env);
  await recreateLoadDb(baseUrl, loadUrl);
  const db = createDb(loadUrl);
  const runId8 = ctx.runId.slice(0, 8);
  const docDir = mkdtempSync(path.join(os.tmpdir(), "load-bench-restart-docs-"));
  const heldUploadDir = mkdtempSync(path.join(os.tmpdir(), "load-bench-restart-held-"));
  const normalUploadDir = mkdtempSync(path.join(os.tmpdir(), "load-bench-restart-normal-"));
  let heldChild: ChildProcess | undefined;
  let normalChild: ChildProcess | undefined;
  const expectations: Expectation[] = [];

  try {
    const targetBook = `load-${runId8}-target`;
    const targetDoc = synthDoc(0, 8192);
    const targetPath = path.join(docDir, "target.md");
    writeFileSync(targetPath, targetDoc);
    const targetStatus = await enqueueIngest(db, {
      book: targetBook,
      format: "markdown",
      filename: "target.md",
      bytes: Buffer.byteLength(targetDoc, "utf8"),
      uploadPath: targetPath,
    });

    const followerIds: string[] = [];
    for (let i = 0; i < followers; i++) {
      const doc = synthDoc(i + 1, 8192);
      const filePath = path.join(docDir, `follower-${i}.md`);
      writeFileSync(filePath, doc);
      const status = await enqueueIngest(db, {
        book: `load-${runId8}-follower-${i}`,
        format: "markdown",
        filename: `follower-${i}.md`,
        bytes: Buffer.byteLength(doc, "utf8"),
        uploadPath: filePath,
      });
      followerIds.push(status.id);
    }

    // FORK_TIMEOUT_MS: the held worker must fork, connect, and run the target
    // job through extract/parse/store before embed holds — real I/O whose
    // cold-start cost varies with host load (15s was observed to flake under
    // load; see the Deviation note in tasks.md).
    const FORK_TIMEOUT_MS = 30_000;
    heldChild = await forkWorker(loadUrl, heldUploadDir, true, "embed-held", FORK_TIMEOUT_MS);
    heldChild.kill("SIGKILL");
    const killedChild = heldChild;
    heldChild = undefined;
    await new Promise<void>((resolve) => killedChild.once("exit", () => resolve()));

    normalChild = await forkWorker(loadUrl, normalUploadDir, false, "ready", FORK_TIMEOUT_MS);

    const ids = [targetStatus.id, ...followerIds];
    const reclaimStart = Date.now();
    const deadline = reclaimStart + reclaimTimeoutMs;
    let targetReclaimedAt: number | null = null;
    let allTerminal = false;
    for (;;) {
      const statuses = await Promise.all(ids.map((id) => getJob(db, id)));
      if (targetReclaimedAt === null && (statuses[0]?.attempts ?? 0) >= 2) {
        targetReclaimedAt = Date.now();
      }
      if (statuses.every((s) => s?.status === "succeeded" || s?.status === "failed")) {
        allTerminal = true;
        break;
      }
      if (Date.now() > deadline) break;
      await sleep(1000);
    }

    const [targetFinal, ...followerFinals] = await Promise.all(
      ids.map((id) => getJob(db, id)),
    );
    const reclaimSec =
      targetReclaimedAt !== null ? (targetReclaimedAt - reclaimStart) / 1000 : null;
    const followersSucceeded = followerFinals.every((f) => f?.status === "succeeded");
    const targetSucceeded = targetFinal?.status === "succeeded";
    const targetAttempts2 = targetFinal?.attempts === 2;

    let oneDocPerBook = false;
    if (targetSucceeded) {
      const rows = await db
        .select({ book: libraryDocuments.book })
        .from(libraryDocuments)
        .where(eq(libraryDocuments.book, targetBook));
      oneDocPerBook = rows.length === 1;
    }

    expectations.push(
      {
        name: "followers-succeeded",
        pass: followersSucceeded,
        observed: followerFinals.filter((f) => f?.status === "succeeded").length,
      },
      {
        name: "target-attempts-2",
        pass: targetAttempts2,
        observed: targetFinal?.attempts ?? null,
      },
      {
        name: "target-succeeded",
        pass: targetSucceeded,
        observed: targetFinal?.status ?? null,
      },
      { name: "one-document-per-book", pass: oneDocPerBook, observed: oneDocPerBook ? 1 : 0 },
    );

    const pass = allTerminal && expectations.every((e) => e.pass);
    return {
      ...base,
      status: pass ? "pass" : "fail",
      reason: pass
        ? undefined
        : !allTerminal
          ? "jobs did not reach a terminal state before reclaimTimeoutMs"
          : `failed: ${expectations.filter((e) => !e.pass).map((e) => e.name).join(", ")}`,
      durationMs: Date.now() - start,
      expectations,
      observed: reclaimSec !== null ? { reclaimSec } : {},
    };
  } catch (err) {
    return {
      ...base,
      status: "fail",
      reason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
      expectations: expectations.length > 0 ? expectations : undefined,
    };
  } finally {
    if (heldChild) heldChild.kill("SIGKILL");
    if (normalChild) await stopWorker(normalChild);
    rmSync(docDir, { recursive: true, force: true });
    rmSync(heldUploadDir, { recursive: true, force: true });
    rmSync(normalUploadDir, { recursive: true, force: true });
    await db.$client.end();
  }
}

/** Prints one pass/fail line per expectation (contracts/bench-cli.md). */
export function printExpectations(caseId: string, expectations: Expectation[]): void {
  for (const e of expectations) {
    console.log(
      `${e.pass ? "PASS" : "FAIL"} ${caseId} ${e.name}: ${e.observed ?? "-"}`,
    );
  }
}
