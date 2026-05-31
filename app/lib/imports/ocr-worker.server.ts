import { closeDatabase, openDatabase } from "~/lib/db/connection";
import { runMigrations } from "~/lib/db/migrations";
import { createCorpusRepository } from "~/lib/corpus/repository";
import { runOcrJob } from "~/lib/imports/ocr.server";
import { createOcrQueueTransport, type OcrQueuePayload, type OcrQueueTransport } from "~/lib/imports/ocr-queue.server";

export type OcrWorkerOptions = {
  transport?: OcrQueueTransport;
  maxAttempts?: number;
  dequeueTimeoutSeconds?: number;
  once?: boolean;
  runJob?: typeof runOcrJob;
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

    if (importJob.adapter !== "pdf-ocr") {
      return { eligible: false, reason: "not-pdf-ocr" };
    }

    if (importJob.status !== "ocr_queued") {
      return { eligible: false, reason: `status-${importJob.status}` };
    }

    return { eligible: true };
  } finally {
    closeDatabase(db);
  }
}

export async function processOcrQueuePayload(payload: OcrQueuePayload, options: OcrWorkerOptions = {}): Promise<OcrWorkerProcessResult> {
  const eligibility = isEligibleOcrJob(payload);

  if (!eligibility.eligible) {
    console.info("[ocr-worker] skipped stale job", { jobId: payload.jobId, sourceId: payload.sourceId, reason: eligibility.reason });
    return { processed: false, requeued: false, terminalFailure: false, skippedReason: eligibility.reason };
  }

  try {
    console.info("[ocr-worker] dequeued", { jobId: payload.jobId, sourceId: payload.sourceId, attempts: payload.attempts });
    const result = await (options.runJob ?? runOcrJob)(payload.jobId);
    console.info("[ocr-worker] completed", { jobId: payload.jobId, status: result.importJob.status, reviewItemIds: result.reviewItemIds.length });
    return { processed: true, requeued: false, terminalFailure: false };
  } catch (error) {
    const maxAttempts = options.maxAttempts ?? configuredMaxAttempts();
    const nextAttempt = payload.attempts + 1;
    const message = error instanceof Error ? error.message : "OCR worker failed before job persistence completed.";

    if (nextAttempt < maxAttempts) {
      await options.transport?.enqueue({ ...payload, attempts: nextAttempt, enqueuedAt: new Date().toISOString() });
      console.warn("[ocr-worker] requeued", { jobId: payload.jobId, sourceId: payload.sourceId, attempts: nextAttempt, error: message });
      return { processed: false, requeued: true, terminalFailure: false };
    }

    console.error("[ocr-worker] terminal failure", { jobId: payload.jobId, sourceId: payload.sourceId, attempts: nextAttempt, error: message });
    return { processed: false, requeued: false, terminalFailure: true };
  }
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
