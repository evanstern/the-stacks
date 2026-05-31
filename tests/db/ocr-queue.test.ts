import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { enqueueOcrJob, type OcrQueuePayload, type OcrQueueTransport } from "../../app/lib/imports/ocr-queue.server.js";
import { processOcrQueuePayload } from "../../app/lib/imports/ocr-worker.server.js";

class MemoryOcrQueueTransport implements OcrQueueTransport {
  readonly payloads: OcrQueuePayload[] = [];

  async enqueue(payload: OcrQueuePayload): Promise<void> {
    this.payloads.push(payload);
  }

  async dequeue(): Promise<OcrQueuePayload | null> {
    return this.payloads.shift() ?? null;
  }
}

let tempDir: string;
let previousDbPath: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

function createQueuedOcrJob(): { jobId: string; sourceId: string } {
  const db = openTestDatabase();

  try {
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: crypto.randomUUID(),
      sourceKind: "upload",
      originalFilename: "scan.pdf",
      sizeBytes: 10,
      parserAdapter: "pdf",
      parserVersion: "upload-v1",
      importStatus: "review_needed",
      storageUri: "file:///tmp/scan.pdf",
    });
    const importJob = corpusRepo.createImportJob({
      corpusId: corpus.id,
      sourceId: source.id,
      status: "ocr_queued",
      adapter: "pdf-ocr",
      adapterVersion: "pdf-ocr-v1",
    });

    return { jobId: importJob.id, sourceId: source.id };
  } finally {
    closeDatabase(db);
  }
}

function createQueuedDoclingJob(): { jobId: string; sourceId: string } {
  const db = openTestDatabase();

  try {
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: crypto.randomUUID(),
      sourceKind: "upload",
      originalFilename: "layout.pdf",
      sizeBytes: 10,
      parserAdapter: "pdf-docling",
      parserVersion: "upload-v1",
      importStatus: "queued",
      storageUri: "file:///tmp/layout.pdf",
    });
    const importJob = corpusRepo.createImportJob({
      corpusId: corpus.id,
      sourceId: source.id,
      status: "queued",
      adapter: "pdf-docling",
      adapterVersion: "upload-v1",
    });

    return { jobId: importJob.id, sourceId: source.id };
  } finally {
    closeDatabase(db);
  }
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-ocr-queue-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "ocr-queue.sqlite");
});

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.THE_STACKS_DB_PATH;
  } else {
    process.env.THE_STACKS_DB_PATH = previousDbPath;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

describe("OCR queue transport", () => {
  it("enqueues only DB-visible OCR jobs that are still queued", async () => {
    const { jobId, sourceId } = createQueuedOcrJob();
    const transport = new MemoryOcrQueueTransport();

    await expect(enqueueOcrJob(jobId, transport)).resolves.toEqual({ enqueued: true });
    expect(transport.payloads).toMatchObject([{ jobId, sourceId, attempts: 0 }]);

    const db = openTestDatabase();
    try {
      createCorpusRepository(db).updateImportJob({ id: jobId, status: "ocr_running" });
    } finally {
      closeDatabase(db);
    }

    await expect(enqueueOcrJob(jobId, transport)).resolves.toEqual({ enqueued: false, skippedReason: "status-ocr_running" });
    expect(transport.payloads).toHaveLength(1);
  });

  it("enqueues queued Docling imports for background processing", async () => {
    const { jobId, sourceId } = createQueuedDoclingJob();
    const transport = new MemoryOcrQueueTransport();

    await expect(enqueueOcrJob(jobId, transport)).resolves.toEqual({ enqueued: true });
    expect(transport.payloads).toMatchObject([{ jobId, sourceId, attempts: 0 }]);
  });

  it("worker dispatches queued Docling imports through the import normalizer", async () => {
    const { jobId, sourceId } = createQueuedDoclingJob();

    const result = await processOcrQueuePayload(
      { jobId, sourceId, attempts: 0, enqueuedAt: new Date().toISOString() },
      {
        runImportJob: async (importJobId: string) => {
          const db = openTestDatabase();

          try {
            db.exec("BEGIN EXCLUSIVE");
            db.exec("ROLLBACK");
          } finally {
            closeDatabase(db);
          }

          return {
            importJob: { id: importJobId, status: "review_needed" } as Awaited<ReturnType<NonNullable<Parameters<typeof processOcrQueuePayload>[1]>["runImportJob"]>>["importJob"],
            reviewItemIds: ["review-item-docling"],
            suggestionErrors: [],
            ocrJobIds: [],
          };
        },
      },
    );

    expect(result).toEqual({ processed: true, requeued: false, terminalFailure: false });
  });

  it("worker drops stale payloads before invoking OCR", async () => {
    const { jobId, sourceId } = createQueuedOcrJob();
    const db = openTestDatabase();
    try {
      createCorpusRepository(db).updateImportJob({ id: jobId, status: "ocr_succeeded" });
    } finally {
      closeDatabase(db);
    }

    const result = await processOcrQueuePayload(
      { jobId, sourceId, attempts: 0, enqueuedAt: new Date().toISOString() },
      {
        runJob: async () => {
          throw new Error("stale jobs must not run");
        },
      },
    );

    expect(result).toEqual({ processed: false, requeued: false, terminalFailure: false, skippedReason: "status-ocr_succeeded" });
  });

  it("worker retries bounded transport-level failures", async () => {
    const { jobId, sourceId } = createQueuedOcrJob();
    const transport = new MemoryOcrQueueTransport();
    const payload = { jobId, sourceId, attempts: 0, enqueuedAt: new Date().toISOString() };

    const retry = await processOcrQueuePayload(payload, {
      transport,
      maxAttempts: 2,
      runJob: async () => {
        throw new Error("database was locked before OCR persisted a result");
      },
    });

    expect(retry).toEqual({ processed: false, requeued: true, terminalFailure: false });
    expect(transport.payloads).toMatchObject([{ jobId, sourceId, attempts: 1 }]);

    const terminal = await processOcrQueuePayload(transport.payloads[0], {
      transport,
      maxAttempts: 2,
      runJob: async () => {
        throw new Error("database was locked before OCR persisted a result");
      },
    });
    const failedJob = createCorpusRepository(openTestDatabase()).getImportJob(jobId);

    expect(terminal).toEqual({ processed: false, requeued: false, terminalFailure: true });
    expect(failedJob).toMatchObject({
      status: "ocr_failed",
      errors: ["database was locked before OCR persisted a result"],
    });
    expect(failedJob?.stats).toMatchObject({ workerFailure: "database was locked before OCR persisted a result" });
  });
});
