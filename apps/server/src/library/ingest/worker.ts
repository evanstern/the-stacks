import { mkdir, readdir, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { asc, eq, inArray } from "drizzle-orm";
import type { Gateway } from "../../ai/gateway.js";
import { ValidationError } from "../../errors.js";
import { jobs as jobsTable } from "../../schema/jobs.js";
import { libraryChunks } from "../../schema/library.js";
import { parseDdbExport } from "../ddb/index.js";
import { attachEmbeddings, type DbClient, storeParsedBook } from "../store.js";
import { chunkBook } from "./chunk.js";
import { collectPages } from "./collect.js";
import {
  type ClaimedJob,
  claimJob,
  finishJob,
  HEARTBEAT_MS,
  heartbeat,
  type JobInput,
  type JobResult,
  type JobStage,
  POLL_MS,
  setStage,
} from "./jobs.js";
import { parseMarkdown } from "./markdown.js";
import { ZipError } from "./zip.js";

/**
 * The ingest worker (specs/017-ingestion-pipeline contracts/ingest-modules.md,
 * research R6/R8/R10). `runJob` drives one claimed job through
 * extract → parse → store → embed and never throws a message that could
 * contain book text: only `ValidationError`/`ZipError` messages (which name
 * the problem, not the content) and its own fixed strings ever reach
 * `finishJob`'s `error` field.
 */

export interface IngestWorkerDeps {
  db: DbClient;
  gateway: Pick<Gateway, "embed">;
  /** `null` = embedding not configured; the job succeeds with a skip reason. */
  embedPurpose: string | null;
  uploadDir: string;
}

const EMBED_BATCH_SIZE = 256;
const ORPHAN_MAX_AGE_MS = 10 * 60 * 1000;
/** research R4: the D&D Beyond content-root class, sniffed in raw page text. */
const DDB_CONTENT_MARKER = "p-article-content";

/** Thrown when a stage write is fenced out (research R6): another worker reclaimed the job. */
class FencedOutError extends Error {}

/** A hand-thrown message already safe to store verbatim (R8: "upload file missing"). */
class KnownIngestError extends Error {}

function jobDir(uploadDir: string, jobId: string): string {
  return path.join(uploadDir, `job-${jobId}`);
}

async function requireStage(
  db: DbClient,
  job: ClaimedJob,
  stage: JobStage,
): Promise<void> {
  if (!(await setStage(db, job, stage))) throw new FencedOutError();
}

/**
 * A message safe to store verbatim in `jobs.error` (never book text):
 * `ValidationError`'s issue text (its own `.message` is the generic
 * "Request validation failed."), a `ZipError`/`KnownIngestError`'s message
 * (both already name the problem, never entry/book content), or the fixed
 * per-stage fallback for anything unexpected.
 */
function safeErrorMessage(err: unknown, stage: JobStage): string {
  if (err instanceof ValidationError) {
    return err.issues.map((issue) => issue.message).join(" ");
  }
  if (err instanceof ZipError || err instanceof KnownIngestError) {
    return err.message;
  }
  return `Ingestion failed at stage ${stage}.`;
}

/**
 * Runs one claimed job through the full pipeline. Exported for tests
 * (contracts/ingest-modules.md). Throws `FencedOutError` when a later
 * `setStage`/`finishJob` write loses the lease race; the caller (below)
 * treats that as "another worker owns this now", not a failure to record.
 */
export async function runJob(
  deps: IngestWorkerDeps,
  job: ClaimedJob,
  signal: AbortSignal,
): Promise<JobResult> {
  const { db, gateway } = deps;
  const dir = jobDir(deps.uploadDir, job.id);
  let stage: JobStage = "extract";

  try {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    try {
      await stat(job.input.uploadPath);
    } catch {
      throw new KnownIngestError("upload file missing");
    }

    await requireStage(db, job, "extract");
    const collected = await collectPages(
      job.input.uploadPath,
      job.input.format,
      job.input.filename,
      { tmpDir: dir },
    );

    stage = "parse";
    await requireStage(db, job, "parse");
    const isDdb = collected.pages.some((p) =>
      p.text.includes(DDB_CONTENT_MARKER),
    );
    // Route by format/markup (specs/017-ingestion-pipeline research R4):
    // Markdown -> parseMarkdown; DDB markup -> parseDdbExport as today;
    // any other HTML -> parseDdbExport with every h1-h6 as a heading.
    const parser: JobResult["parser"] =
      job.input.format === "markdown" ? "markdown" : isDdb ? "ddb" : "html";
    const parsed =
      parser === "markdown"
        ? parseMarkdown({ book: job.book, text: collected.pages[0].text })
        : parseDdbExport(
            { book: job.book, pages: collected.pages.map((p) => p.text) },
            parser === "html" ? { headings: "all" } : undefined,
          );

    stage = "store";
    await requireStage(db, job, "store");
    const chunked = chunkBook(parsed);
    const stored = await storeParsedBook(db, chunked, {
      source: {
        files: collected.pages.map((p) => p.path),
        bytes: job.input.bytes,
      },
    });

    stage = "embed";
    await requireStage(db, job, "embed");
    const embedding = await embedChunks(
      db,
      gateway,
      deps.embedPurpose,
      stored.documentId,
      signal,
    );

    return {
      pages: collected.pages.length,
      duplicatePages: collected.duplicatePages,
      ignoredEntries: collected.ignoredEntries,
      skippedEntries: collected.skippedEntries,
      parser,
      documentId: stored.documentId,
      chunkCount: stored.chunkCount,
      replaced: stored.replaced,
      embedding,
    };
  } catch (err) {
    if (err instanceof FencedOutError) throw err;
    console.error(`Ingestion failed at stage ${stage}:`, err);
    throw new Error(safeErrorMessage(err, stage));
  }
}

async function embedChunks(
  db: DbClient,
  gateway: Pick<Gateway, "embed">,
  embedPurpose: string | null,
  documentId: string,
  signal: AbortSignal,
): Promise<JobResult["embedding"]> {
  if (!embedPurpose) {
    return { status: "skipped", reason: "no embedding purpose configured" };
  }

  const chunkRows = await db
    .select({ id: libraryChunks.id, text: libraryChunks.text })
    .from(libraryChunks)
    .where(eq(libraryChunks.documentId, documentId))
    .orderBy(asc(libraryChunks.ordinal));

  let model = "";
  let count = 0;
  for (let i = 0; i < chunkRows.length; i += EMBED_BATCH_SIZE) {
    const batch = chunkRows.slice(i, i + EMBED_BATCH_SIZE);
    const result = await gateway.embed({
      purpose: embedPurpose,
      texts: batch.map((row) => row.text),
      signal,
    });
    await attachEmbeddings(
      db,
      batch.map((row, idx) => ({
        chunkId: row.id,
        model: result.vectors[idx].model,
        dim: result.vectors[idx].dim,
        vector: result.vectors[idx].vector,
      })),
    );
    model = result.vectors[0]?.model ?? model;
    count += result.vectors.length;
  }
  return { status: "embedded", model, count };
}

/** research R8: files/dirs no active job references, untouched for 10+ minutes. */
async function sweepOrphans(db: DbClient, uploadDir: string): Promise<void> {
  const active = await db
    .select({ id: jobsTable.id, input: jobsTable.input })
    .from(jobsTable)
    .where(inArray(jobsTable.status, ["queued", "running"]));
  const keep = new Set<string>();
  for (const row of active) {
    keep.add((row.input as JobInput).uploadPath);
    keep.add(jobDir(uploadDir, row.id));
  }

  const names = await readdir(uploadDir).catch(() => []);
  const cutoff = Date.now() - ORPHAN_MAX_AGE_MS;
  for (const name of names) {
    const full = path.join(uploadDir, name);
    if (keep.has(full)) continue;
    const info = await stat(full).catch(() => undefined);
    if (!info || info.mtimeMs >= cutoff) continue;
    await rm(full, { recursive: true, force: true }).catch(() => {});
  }
}

function wait(ms: number): { promise: Promise<void>; wake: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  const timer = setTimeout(resolve, ms);
  return {
    promise,
    wake: () => {
      clearTimeout(timer);
      resolve();
    },
  };
}

/**
 * Starts the polling loop: claims and runs one job at a time, heartbeating
 * every `HEARTBEAT_MS` and aborting the job's `AbortController` if a
 * heartbeat is fenced out. Never throws out of its loop.
 */
export function startIngestWorker(deps: IngestWorkerDeps): {
  nudge(): void;
  stop(): Promise<void>;
} {
  let stopped = false;
  let wakeSleep: (() => void) | undefined;

  async function cleanupTerminal(job: ClaimedJob): Promise<void> {
    await unlink(job.input.uploadPath).catch(() => {});
    await rm(jobDir(deps.uploadDir, job.id), {
      recursive: true,
      force: true,
    }).catch(() => {});
  }

  async function processOne(): Promise<boolean> {
    const job = await claimJob(deps.db);
    if (!job) return false;

    const controller = new AbortController();
    const heartbeatTimer = setInterval(() => {
      heartbeat(deps.db, job)
        .then((ok) => {
          if (!ok) controller.abort();
        })
        .catch(() => controller.abort());
    }, HEARTBEAT_MS);

    try {
      const result = await runJob(deps, job, controller.signal);
      await finishJob(deps.db, job, { result });
      await cleanupTerminal(job);
    } catch (err) {
      if (err instanceof FencedOutError) {
        await rm(jobDir(deps.uploadDir, job.id), {
          recursive: true,
          force: true,
        }).catch(() => {});
      } else {
        const message = err instanceof Error ? err.message : String(err);
        await finishJob(deps.db, job, { error: message });
        await cleanupTerminal(job);
      }
    } finally {
      clearInterval(heartbeatTimer);
    }
    return true;
  }

  const loopDone = (async () => {
    await sweepOrphans(deps.db, deps.uploadDir).catch((err) => {
      console.error("ingest worker: orphan sweep failed", err);
    });
    while (!stopped) {
      try {
        const did = await processOne();
        if (!did && !stopped) {
          const { promise, wake } = wait(POLL_MS);
          wakeSleep = wake;
          await promise;
          wakeSleep = undefined;
        }
      } catch (err) {
        console.error("ingest worker: loop iteration failed", err);
      }
    }
  })();

  return {
    nudge() {
      wakeSleep?.();
    },
    async stop() {
      stopped = true;
      wakeSleep?.();
      await loopDone;
    },
  };
}
