import { type ChildProcess, fork } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inArray, sql } from "drizzle-orm";
import { createGateway } from "../../ai/gateway.js";
import { createDb } from "../../db.js";
import { enqueueIngest } from "../../library/ingest/jobs.js";
import { startIngestWorker } from "../../library/ingest/worker.js";
import { jobs } from "../../schema/jobs.js";
import { libraryDocuments } from "../../schema/library.js";
import type { RunContext } from "./cases.js";
import { preloadHistory, recreateLoadDb, resolveLoadUrl } from "./db.js";
import type { Profile } from "./profile.js";
import type { CaseOutcome, IngestStep, Verdict } from "./results.js";
import { ingestVerdict, percentile } from "./stats.js";
import { synthDoc } from "./synth.js";

/**
 * The ingest-scaling measurement (specs/021-load-bench research R4): drives
 * `enqueueIngest` directly against a freshly reset load database, one
 * series per worker count, and computes each step's metrics from the
 * `jobs` rows themselves.
 */

const WORKER_PROC_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "worker-proc.js",
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface StartedWorkers {
  nudge?(): void;
  stop(): Promise<void>;
}

/** One in-process worker (commit-tier smoke; vitest runs TS sources, not `dist/`). */
function startInProcessWorker(
  loadUrl: string,
  uploadDir: string,
): StartedWorkers {
  const db = createDb(loadUrl);
  const gateway = createGateway({
    config: {
      providers: { fake: { kind: "fake", baseUrl: "http://fake/load-bench" } },
      purposes: {
        "load-embed": { provider: "fake", model: "fake-embed-1", op: "embed" },
      },
      prices: {},
    },
    sink: { record: () => {} },
  });
  const worker = startIngestWorker({
    db,
    gateway,
    embedPurpose: "load-embed",
    uploadDir,
  });
  return {
    nudge: () => worker.nudge(),
    async stop() {
      await worker.stop();
      await db.$client.end();
    },
  };
}

/** N forked `worker-proc.js` children (research R4), each its own upload dir. */
async function startForkedWorkers(
  loadUrl: string,
  n: number,
  runDir: string,
): Promise<StartedWorkers> {
  const children: ChildProcess[] = [];
  const readies: Promise<void>[] = [];
  for (let i = 0; i < n; i++) {
    const uploadDir = path.join(runDir, `worker-${i}`);
    mkdirSync(uploadDir, { recursive: true });
    const child = fork(WORKER_PROC_PATH, [], {
      env: {
        ...process.env,
        LOAD_DATABASE_URL: loadUrl,
        LOAD_UPLOAD_DIR: uploadDir,
      },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    children.push(child);
    readies.push(
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`worker ${i} did not become ready in 15s`)),
          15_000,
        );
        child.once("message", (msg: unknown) => {
          if ((msg as { type?: string } | null)?.type === "ready") {
            clearTimeout(timer);
            resolve();
          }
        });
        child.once("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`worker ${i} exited early (code ${code})`));
        });
      }),
    );
  }
  await Promise.all(readies);
  return {
    async stop() {
      await Promise.all(
        children.map(
          (child) =>
            new Promise<void>((resolve) => {
              const timer = setTimeout(() => {
                child.kill("SIGKILL");
                resolve();
              }, 5000);
              child.once("exit", () => {
                clearTimeout(timer);
                resolve();
              });
              child.send({ type: "stop" });
            }),
        ),
      );
    },
  };
}

interface JobRow {
  id: string;
  book: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

async function pollTerminal(
  db: ReturnType<typeof createDb>,
  ids: string[],
  deadline: number,
): Promise<{ rows: JobRow[]; timedOut: boolean }> {
  for (;;) {
    const rows = (await db
      .select({
        id: jobs.id,
        book: jobs.book,
        status: jobs.status,
        createdAt: jobs.createdAt,
        startedAt: jobs.startedAt,
        finishedAt: jobs.finishedAt,
      })
      .from(jobs)
      .where(inArray(jobs.id, ids))) as JobRow[];
    if (rows.every((r) => r.status === "succeeded" || r.status === "failed")) {
      return { rows, timedOut: false };
    }
    if (Date.now() > deadline) {
      return { rows, timedOut: true };
    }
    await sleep(200);
  }
}

/** One ingest step: enqueues `volume` new jobs, waits them out, and measures. */
async function runStep(
  db: ReturnType<typeof createDb>,
  docDir: string,
  workers: number,
  volume: number,
  docBytes: number,
  runId8: string,
  bookCounter: { n: number },
  stepTimeoutMs: number,
  nudge: (() => void) | undefined,
): Promise<{ step: IngestStep; succeededBooks: string[] }> {
  const ids: string[] = [];
  const enqueueLatencies: number[] = [];
  for (let i = 0; i < volume; i++) {
    const n = bookCounter.n++;
    const doc = synthDoc(n, docBytes);
    const filePath = path.join(docDir, `doc-${n}.md`);
    writeFileSync(filePath, doc);
    const t0 = performance.now();
    const status = await enqueueIngest(db, {
      book: `load-${runId8}-${n}`,
      format: "markdown",
      filename: `doc-${n}.md`,
      bytes: Buffer.byteLength(doc, "utf8"),
      uploadPath: filePath,
    });
    enqueueLatencies.push(performance.now() - t0);
    ids.push(status.id);
    nudge?.();
  }

  const { rows, timedOut } = await pollTerminal(
    db,
    ids,
    Date.now() + stepTimeoutMs,
  );
  const [{ n: tableRows }] = (
    await db.execute(sql`SELECT count(*)::int AS n FROM jobs`)
  ).rows as { n: number }[];

  const failed = rows.filter((r) => r.status !== "succeeded").length;
  const started = rows.filter(
    (r): r is JobRow & { startedAt: Date } => r.startedAt !== null,
  );
  const finished = started.filter(
    (r): r is JobRow & { startedAt: Date; finishedAt: Date } =>
      r.finishedAt !== null,
  );
  const queueWaits = started
    .map((r) => r.startedAt.getTime() - r.createdAt.getTime())
    .sort((a, b) => a - b);
  const services = finished
    .map((r) => r.finishedAt.getTime() - r.startedAt.getTime())
    .sort((a, b) => a - b);
  const finishedTimes = finished.map((r) => r.finishedAt.getTime());
  const createdTimes = rows.map((r) => r.createdAt.getTime());
  const wallMs =
    finishedTimes.length > 0
      ? Math.max(...finishedTimes) - Math.min(...createdTimes)
      : Date.now() - Math.min(...createdTimes);
  const throughputPerSec = wallMs > 0 ? (rows.length / wallMs) * 1000 : 0;
  const sortedEnqueue = [...enqueueLatencies].sort((a, b) => a - b);

  return {
    step: {
      workers,
      volume,
      stepJobs: rows.length,
      tableRows,
      wallMs,
      throughputPerSec,
      queueWaitP50Ms: queueWaits.length ? percentile(queueWaits, 50) : 0,
      queueWaitP95Ms: queueWaits.length ? percentile(queueWaits, 95) : 0,
      serviceP50Ms: services.length ? percentile(services, 50) : 0,
      serviceP95Ms: services.length ? percentile(services, 95) : 0,
      enqueueP95Ms: sortedEnqueue.length ? percentile(sortedEnqueue, 95) : 0,
      failed,
      timedOut,
    },
    succeededBooks: rows
      .filter((r) => r.status === "succeeded")
      .map((r) => r.book),
  };
}

export interface RunIngestOptions {
  id: string;
  tier: Profile["tier"];
  inProcess: boolean;
  /** ingest-smoke only: every succeeded book must have exactly one library_documents row. */
  verifyOneDocPerBook?: boolean;
}

/**
 * Runs one full ingest series per `profile.ingest.workers` entry — fresh
 * load database, preloaded history, N workers, then each of
 * `profile.ingest.volumes` as a step — and returns the case outcome
 * (contracts/bench-cli.md; research R4/R5).
 */
export async function runIngestSeries(
  ctx: RunContext,
  profile: Profile,
  opts: RunIngestOptions,
): Promise<CaseOutcome> {
  const start = Date.now();
  const base = { id: opts.id, tier: opts.tier, target: "local" as const };
  if (!profile.ingest) {
    return {
      ...base,
      status: "fail",
      reason: "profile has no ingest config",
      durationMs: Date.now() - start,
    };
  }
  const ingest = profile.ingest;
  const runId8 = ctx.runId.slice(0, 8);
  const { baseUrl, loadUrl } = resolveLoadUrl(process.env);
  const docDir = mkdtempSync(path.join(os.tmpdir(), "load-bench-docs-"));
  const workerRunDir = mkdtempSync(
    path.join(os.tmpdir(), "load-bench-workers-"),
  );
  const allSteps: IngestStep[] = [];
  const verdicts: Verdict[] = [];
  const failReasons: string[] = [];

  try {
    for (const workerCount of ingest.workers) {
      await recreateLoadDb(baseUrl, loadUrl);
      const db = createDb(loadUrl);
      const seriesSteps: IngestStep[] = [];
      try {
        await preloadHistory(db, ingest.historyRows);
        const bookCounter = { n: 0 };
        const startedWorkers = opts.inProcess
          ? startInProcessWorker(loadUrl, path.join(workerRunDir, "in-process"))
          : await startForkedWorkers(loadUrl, workerCount, workerRunDir);
        const succeededBooks: string[] = [];
        try {
          for (const volume of ingest.volumes) {
            const { step, succeededBooks: stepBooks } = await runStep(
              db,
              docDir,
              workerCount,
              volume,
              ingest.docBytes,
              runId8,
              bookCounter,
              ingest.stepTimeoutMs,
              startedWorkers.nudge,
            );
            seriesSteps.push(step);
            succeededBooks.push(...stepBooks);
            if (step.failed > 0) {
              failReasons.push(
                `${step.failed} job(s) failed at workers=${workerCount} volume=${volume}`,
              );
            }
            if (step.timedOut) {
              failReasons.push(
                `step timed out at workers=${workerCount} volume=${volume}`,
              );
            }
          }
        } finally {
          await startedWorkers.stop();
        }

        if (opts.verifyOneDocPerBook && succeededBooks.length > 0) {
          const rows = await db
            .select({ book: libraryDocuments.book })
            .from(libraryDocuments)
            .where(inArray(libraryDocuments.book, succeededBooks));
          const found = new Set(rows.map((r) => r.book));
          const missing = succeededBooks.filter((b) => !found.has(b));
          if (missing.length > 0) {
            failReasons.push(
              `${missing.length} succeeded book(s) missing a library_documents row`,
            );
          }
        }
      } finally {
        await db.$client.end();
      }
      allSteps.push(...seriesSteps);
      verdicts.push(ingestVerdict(seriesSteps, ingest.thresholds));
    }

    return {
      ...base,
      status: failReasons.length > 0 ? "fail" : "pass",
      reason: failReasons.length > 0 ? failReasons.join("; ") : undefined,
      durationMs: Date.now() - start,
      steps: allSteps,
      verdicts,
    };
  } catch (err) {
    return {
      ...base,
      status: "fail",
      reason: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
      steps: allSteps.length > 0 ? allSteps : undefined,
    };
  } finally {
    rmSync(docDir, { recursive: true, force: true });
    rmSync(workerRunDir, { recursive: true, force: true });
  }
}

function pad(value: string, width: number): string {
  return value.length >= width
    ? value
    : value + " ".repeat(width - value.length);
}

const INGEST_COLUMNS: [string, number][] = [
  ["workers", 8],
  ["volume", 8],
  ["stepJobs", 9],
  ["tableRows", 10],
  ["wallMs", 10],
  ["jobs/s", 8],
  ["qwP50", 8],
  ["qwP95", 8],
  ["svcP50", 8],
  ["svcP95", 8],
  ["enqP95", 8],
  ["failed", 7],
  ["timedOut", 9],
];

function formatIngestRow(step: IngestStep): string {
  const cells = [
    String(step.workers),
    String(step.volume),
    String(step.stepJobs),
    String(step.tableRows),
    step.wallMs.toFixed(1),
    step.throughputPerSec.toFixed(2),
    step.queueWaitP50Ms.toFixed(1),
    step.queueWaitP95Ms.toFixed(1),
    step.serviceP50Ms.toFixed(1),
    step.serviceP95Ms.toFixed(1),
    step.enqueueP95Ms.toFixed(1),
    String(step.failed),
    String(step.timedOut),
  ];
  return cells.map((c, i) => pad(c, INGEST_COLUMNS[i][1])).join("");
}

function formatIngestVerdict(
  caseId: string,
  workers: number,
  verdict: Verdict,
): string {
  const prefix = `VERDICT ${caseId} workers=${workers}:`;
  return verdict.degraded
    ? `${prefix} degraded at volume ${verdict.at} (${verdict.rules.join(", ")})`
    : `${prefix} no degradation up to ${verdict.through} jobs`;
}

/** Prints the ingest step table and a VERDICT line per worker count (contracts/bench-cli.md). */
export function printIngest(
  caseId: string,
  steps: IngestStep[],
  verdicts: Verdict[],
): void {
  console.log(INGEST_COLUMNS.map(([name, width]) => pad(name, width)).join(""));
  const byWorkers = new Map<number, IngestStep[]>();
  for (const step of steps) {
    const list = byWorkers.get(step.workers) ?? [];
    list.push(step);
    byWorkers.set(step.workers, list);
  }
  let verdictIndex = 0;
  for (const [workers, seriesSteps] of byWorkers) {
    for (const step of seriesSteps) console.log(formatIngestRow(step));
    console.log(formatIngestVerdict(caseId, workers, verdicts[verdictIndex]));
    verdictIndex += 1;
  }
}
