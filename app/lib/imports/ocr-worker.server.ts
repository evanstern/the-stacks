import { closeDatabase, openDatabase } from "~/lib/db/connection";
import type { JsonValue } from "~/lib/db/rows";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository } from "~/lib/corpus/repository";
import { runOcrJob } from "~/lib/imports/ocr.server";
import { createOcrQueueTransport, type OcrQueuePayload, type OcrQueueTransport } from "~/lib/imports/ocr-queue.server";
import { normalizeImportForReview } from "~/lib/review/queue.server";

export type OcrWorkerOptions = {
  transport?: OcrQueueTransport;
  maxAttempts?: number;
  dequeueTimeoutSeconds?: number;
  once?: boolean;
  runJob?: typeof runOcrJob;
  runImportJob?: typeof normalizeImportForReview;
};

export type OcrWorkerProcessResult = {
  processed: boolean;
  requeued: boolean;
  terminalFailure: boolean;
  skippedReason?: string;
};

const DEFAULT_MAX_ATTEMPTS = 3;

function configuredMaxAttempts(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number(env.IKIS_OCR_WORKER_MAX_ATTEMPTS ?? DEFAULT_MAX_ATTEMPTS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ATTEMPTS;
}


function recordWorkerEvent(importJobId: string, input: { eventType: string; message: string; progressPct?: number | null; payload?: JsonValue }): void {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);

    if (!corpusRepo.getImportJob(importJobId)) {
      return;
    }

    corpusRepo.createImportJobEvent({ importJobId, ...input });
  } finally {
    closeDatabase(db);
  }
}

function isEligibleOcrJob(payload: OcrQueuePayload): { eligible: boolean; reason?: string } {
  const db = openDatabase();

  try {
    runMigrations(db);
    const importJob = createCorpusRepository(db).getImportJob(payload.jobId);

    if (!importJob) {
      return { eligible: false, reason: "missing-import-job" };
    }

    if (importJob.sourceId !== payload.sourceId) {
      return { eligible: false, reason: "source-mismatch" };
    }

    if (importJob.adapter !== "pdf-ocr" && importJob.adapter !== "pdf-docling") {
      return { eligible: false, reason: "not-background-pdf-job" };
    }

    const expectedStatus = importJob.adapter === "pdf-ocr" ? "ocr_queued" : "queued";

    if (importJob.status !== expectedStatus) {
      return { eligible: false, reason: `status-${importJob.status}` };
    }

    return { eligible: true };
  } finally {
    closeDatabase(db);
  }
}

export async function processOcrQueuePayload(payload: OcrQueuePayload, options: OcrWorkerOptions = {}): Promise<OcrWorkerProcessResult> {
  let eligibility: { eligible: boolean; reason?: string };

  try {
    eligibility = isEligibleOcrJob(payload);
  } catch (error) {
    return await requeueOrFail(payload, options, error);
  }

  if (!eligibility.eligible) {
    recordWorkerEvent(payload.jobId, {
      eventType: "worker_skipped",
      message: `Worker skipped payload: ${eligibility.reason ?? "not eligible"}.`,
      payload: { sourceId: payload.sourceId, attempts: payload.attempts, reason: eligibility.reason ?? null },
    });
    console.info("[ocr-worker] skipped stale job", { jobId: payload.jobId, sourceId: payload.sourceId, reason: eligibility.reason });
    return { processed: false, requeued: false, terminalFailure: false, skippedReason: eligibility.reason };
  }

  try {
    recordWorkerEvent(payload.jobId, {
      eventType: "worker_dequeued",
      message: "Background worker dequeued the import job.",
      progressPct: 35,
      payload: { sourceId: payload.sourceId, attempts: payload.attempts },
    });
    console.info("[ocr-worker] dequeued", { jobId: payload.jobId, sourceId: payload.sourceId, attempts: payload.attempts });
    const result = await runBackgroundPdfJob(payload.jobId, options);
    recordWorkerEvent(payload.jobId, {
      eventType: "worker_completed",
      message: `Background worker completed with status ${result.importJob.status}.`,
      progressPct: 100,
      payload: { sourceId: payload.sourceId, status: result.importJob.status, reviewItemIds: result.reviewItemIds.length },
    });
    console.info("[ocr-worker] completed", { jobId: payload.jobId, status: result.importJob.status, reviewItemIds: result.reviewItemIds.length });
    return { processed: true, requeued: false, terminalFailure: false };
  } catch (error) {
    return await requeueOrFail(payload, options, error);
  }
}

async function requeueOrFail(payload: OcrQueuePayload, options: OcrWorkerOptions, error: unknown): Promise<OcrWorkerProcessResult> {
  const maxAttempts = options.maxAttempts ?? configuredMaxAttempts();
  const nextAttempt = payload.attempts + 1;
  const message = error instanceof Error ? error.message : "OCR worker failed before job persistence completed.";

  if (nextAttempt < maxAttempts) {
    await options.transport?.enqueue({ ...payload, attempts: nextAttempt, enqueuedAt: new Date().toISOString() });
    recordWorkerEvent(payload.jobId, {
      eventType: "worker_requeued",
      message: `Worker attempt ${nextAttempt} failed and requeued: ${message}`,
      payload: { sourceId: payload.sourceId, attempts: nextAttempt, error: message },
    });
    console.warn("[ocr-worker] requeued", { jobId: payload.jobId, sourceId: payload.sourceId, attempts: nextAttempt, error: message });
    return { processed: false, requeued: true, terminalFailure: false };
  }

  persistTerminalFailure(payload.jobId, message);
  recordWorkerEvent(payload.jobId, {
    eventType: "worker_terminal_failure",
    message: `Worker reached terminal failure: ${message}`,
    progressPct: 100,
    payload: { sourceId: payload.sourceId, attempts: nextAttempt, error: message },
  });
  console.error("[ocr-worker] terminal failure", { jobId: payload.jobId, sourceId: payload.sourceId, attempts: nextAttempt, error: message });
  return { processed: false, requeued: false, terminalFailure: true };
}

function persistTerminalFailure(importJobId: string, message: string): void {
  const db = openDatabase();

  try {
    runMigrations(db);
    const corpusRepo = createCorpusRepository(db);
    const importJob = corpusRepo.getImportJob(importJobId);

    if (!importJob) {
      return;
    }

    const status = importJob.adapter === "pdf-ocr" ? "ocr_failed" : "failed_parse";
    corpusRepo.updateImportJob({
      id: importJob.id,
      status,
      errors: [message],
      stats: { ...(importJob.stats && typeof importJob.stats === "object" && !Array.isArray(importJob.stats) ? importJob.stats : {}), workerFailure: message },
      finishedAt: new Date().toISOString(),
    });
  } finally {
    closeDatabase(db);
  }
}

async function runBackgroundPdfJob(importJobId: string, options: OcrWorkerOptions): Promise<{ importJob: { status: string }; reviewItemIds: string[] }> {
  const db = openDatabase();
  let adapter: string | undefined;

  try {
    runMigrations(db);
    const importJob = createCorpusRepository(db).getImportJob(importJobId);
    adapter = importJob?.adapter;
  } finally {
    closeDatabase(db);
  }

  if (adapter === "pdf-docling") {
    return await (options.runImportJob ?? normalizeImportForReview)(importJobId);
  }

  return await (options.runJob ?? runOcrJob)(importJobId);
}

export async function runOcrWorker(options: OcrWorkerOptions = {}): Promise<void> {
  const transport = options.transport ?? createOcrQueueTransport();
  const dequeueTimeoutSeconds = options.dequeueTimeoutSeconds ?? 5;

  try {
    do {
      const payload = await transport.dequeue(dequeueTimeoutSeconds);

      if (!payload) {
        if (options.once) {
          return;
        }

        continue;
      }

      await processOcrQueuePayload(payload, { ...options, transport });
    } while (!options.once);
  } finally {
    await transport.close?.();
  }
}
