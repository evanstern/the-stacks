import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { normalizeImportForReview, recordHumanReviewDecision } from "../../app/lib/review/queue.server.js";
import { createReviewRepository } from "../../app/lib/review/repository.js";

let tempDir: string;
let previousDbPath: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-review-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "review.sqlite");
});

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.THE_STACKS_DB_PATH;
  } else {
    process.env.THE_STACKS_DB_PATH = previousDbPath;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

function seedImportJob(filename = "queue-source.md"): { importJobId: string; corpusId: string } {
  const sourcePath = join(tempDir, filename);
  writeFileSync(sourcePath, "# Queue Source\n\nThis source is normalized for human-final review.");

  const db = openTestDatabase();

  try {
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: `${filename}-hash`,
      sourceKind: "upload",
      originalFilename: filename,
      mimeType: "text/markdown",
      sizeBytes: 64,
      parserAdapter: "markdown",
      parserVersion: "1.0.0",
      importStatus: "queued",
      storageUri: `file://${sourcePath}`,
    });
    const importJob = corpusRepo.createImportJob({
      corpusId: corpus.id,
      sourceId: source.id,
      status: "queued",
      adapter: "markdown",
      adapterVersion: "1.0.0",
    });

    return { importJobId: importJob.id, corpusId: corpus.id };
  } finally {
    closeDatabase(db);
  }
}

describe("review queue path", () => {
  it("creates review items after normalization and stores LLM suggestions separately from human decisions", async () => {
    const { importJobId, corpusId } = seedImportJob();

    const result = await normalizeImportForReview(importJobId, {
      suggest: async () => ({
        suggestionState: "suggested_approve",
        rationale: "The normalized document is inside the corpus boundary.",
        model: "test-review-model",
        promptVersion: "review-import-v1",
        confidence: 0.82,
        metadata: { test: true },
      }),
    });

    expect(result.importJob.status).toBe("review_needed");
    expect(result.reviewItemIds).toHaveLength(1);
    expect(result.suggestionErrors).toEqual([]);

    const db = openTestDatabase();
    try {
      const reviewRepo = createReviewRepository(db);
      const [queueItem] = reviewRepo.listPendingQueue(corpusId);

      expect(queueItem.status).toBe("suggested");
      expect(queueItem.latestSuggestion?.suggestionState).toBe("suggested_approve");
      expect(queueItem.latestDecision).toBeNull();

      const decision = recordHumanReviewDecision({ reviewItemId: queueItem.id, decisionState: "approved", actor: "test-human" });

      expect(decision.suggestionId).toBe(queueItem.latestSuggestion?.id);
      expect(reviewRepo.getReviewItem(queueItem.id)?.status).toBe("approved");
      expect(reviewRepo.listSuggestions(queueItem.id)).toHaveLength(1);
      expect(reviewRepo.listDecisions(queueItem.id)).toHaveLength(1);
    } finally {
      closeDatabase(db);
    }
  });

  it("keeps manual review available when the LLM suggestion fails", async () => {
    const { importJobId, corpusId } = seedImportJob("manual-fallback.md");

    const result = await normalizeImportForReview(importJobId, {
      suggest: async () => {
        throw new Error("synthetic provider outage");
      },
    });

    expect(result.importJob.status).toBe("failed_review_suggestion");
    expect(result.suggestionErrors).toEqual(["synthetic provider outage"]);

    const db = openTestDatabase();
    try {
      const reviewRepo = createReviewRepository(db);
      const [queueItem] = reviewRepo.listPendingQueue(corpusId);

      expect(queueItem.status).toBe("pending");
      expect(queueItem.latestSuggestion).toBeNull();

      const deferred = recordHumanReviewDecision({ reviewItemId: queueItem.id, decisionState: "deferred" });

      expect(deferred.suggestionId).toBeNull();
      expect(reviewRepo.getReviewItem(queueItem.id)?.status).toBe("deferred");
    } finally {
      closeDatabase(db);
    }
  });
});
