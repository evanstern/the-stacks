import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { indexApprovedDocument } from "../../app/lib/chunks/indexer.js";
import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { markdownImportAdapter, textImportAdapter } from "../../app/lib/imports/adapters/index.js";
import type { ImportAdapter } from "../../app/lib/imports/adapters/types.js";
import { normalizeImportForReview, recordHumanReviewDecision } from "../../app/lib/review/queue.server.js";
import { createReviewRepository } from "../../app/lib/review/repository.js";
import { retrieveLexicalChunks } from "../../app/lib/retrieval/lexical.js";

let tempDir: string;
let previousDbPath: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-retrieval-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "retrieval.sqlite");
});

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.THE_STACKS_DB_PATH;
  } else {
    process.env.THE_STACKS_DB_PATH = previousDbPath;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

async function importFixtureForReview(input: { fixture: string; adapter: ImportAdapter; filename: string }): Promise<{ corpusId: string; reviewItemId: string }> {
  const sourcePath = resolve("fixtures", "corpus", input.fixture);
  const storedPath = join(tempDir, input.filename);
  const bytes = readFileSync(sourcePath);
  writeFileSync(storedPath, bytes);

  const db = openTestDatabase();

  try {
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: `${input.filename}-hash`,
      sourceKind: "upload",
      originalFilename: input.filename,
      mimeType: input.adapter.name === "markdown" ? "text/markdown" : "text/plain",
      sizeBytes: bytes.length,
      parserAdapter: input.adapter.name,
      parserVersion: input.adapter.version,
      importStatus: "queued",
      storageUri: `file://${storedPath}`,
    });
    const importJob = corpusRepo.createImportJob({
      corpusId: corpus.id,
      sourceId: source.id,
      status: "queued",
      adapter: input.adapter.name,
      adapterVersion: input.adapter.version,
    });

    const result = await normalizeImportForReview(importJob.id, {
      suggest: async () => ({
        suggestionState: "suggested_approve",
        rationale: "Fixture content is inside the test corpus boundary.",
        model: "test-review-model",
        promptVersion: "review-import-v1",
        confidence: 0.9,
        metadata: { fixture: input.fixture },
      }),
    });

    return { corpusId: corpus.id, reviewItemId: result.reviewItemIds[0] };
  } finally {
    closeDatabase(db);
  }
}

describe("lexical retrieval baseline", () => {
  it("indexes approved fixture documents into stable offset chunks and retrieves known facts", async () => {
    const { corpusId, reviewItemId } = await importFixtureForReview({ fixture: "sample.md", adapter: markdownImportAdapter, filename: "sample.md" });

    recordHumanReviewDecision({ reviewItemId, decisionState: "approved", actor: "test-human" });

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const reviewItem = createReviewRepository(db).getReviewItem(reviewItemId)!;
      const chunks = corpusRepo.listChunksForDocument(reviewItem.targetId);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.map((chunk) => chunk.stableId)).toEqual(chunks.map((chunk) => chunk.stableId));
      expect(chunks[0].startOffset).toBeGreaterThanOrEqual(0);
      expect(chunks[0].endOffset).toBeGreaterThan(chunks[0].startOffset);
      expect(chunks.some((chunk) => chunk.headingPath.includes("First Landing"))).toBe(true);

      const secondIndex = indexApprovedDocument(db, reviewItem.targetId);
      expect(secondIndex.chunks.map((chunk) => chunk.stableId)).toEqual(chunks.map((chunk) => chunk.stableId));

      const retrieval = retrieveLexicalChunks(db, { corpusId, query: "three brass lamps chalk mark" });

      expect(retrieval.classification).toBe("evidence");
      expect(retrieval.results[0]?.chunk.id).toBeTruthy();
      expect(retrieval.results[0]?.document.title).toBe("Synthetic Field Notes");
      expect(retrieval.results[0]?.chunk.text).toContain("three brass lamps");
    } finally {
      closeDatabase(db);
    }
  });

  it("approves duplicate source imports without duplicating stable chunks", async () => {
    const first = await importFixtureForReview({ fixture: "sample.md", adapter: markdownImportAdapter, filename: "sample.md" });

    const dbForDuplicateImport = openTestDatabase();
    let secondReviewItemId: string;
    try {
      const corpusRepo = createCorpusRepository(dbForDuplicateImport);
      const firstReviewItem = createReviewRepository(dbForDuplicateImport).getReviewItem(first.reviewItemId)!;
      const firstDocument = corpusRepo.getDocument(firstReviewItem.targetId)!;
      const importJob = corpusRepo.createImportJob({
        corpusId: first.corpusId,
        sourceId: firstDocument.sourceId,
        status: "queued",
        adapter: markdownImportAdapter.name,
        adapterVersion: markdownImportAdapter.version,
      });
      const second = await normalizeImportForReview(importJob.id, {
        suggest: async () => ({
          suggestionState: "suggested_approve",
          rationale: "Duplicate source remains reviewable without duplicating canonical chunks.",
          model: "test-review-model",
          promptVersion: "review-import-v1",
          confidence: 0.9,
          metadata: { fixture: "sample.md" },
        }),
      });
      secondReviewItemId = second.reviewItemIds[0];
    } finally {
      closeDatabase(dbForDuplicateImport);
    }

    expect(() => recordHumanReviewDecision({ reviewItemId: first.reviewItemId, decisionState: "approved", actor: "test-human" })).not.toThrow();
    expect(() => recordHumanReviewDecision({ reviewItemId: secondReviewItemId, decisionState: "approved", actor: "test-human" })).not.toThrow();

    const db = openTestDatabase();
    try {
      const corpusRepo = createCorpusRepository(db);
      const firstReviewItem = createReviewRepository(db).getReviewItem(first.reviewItemId)!;
      const secondReviewItem = createReviewRepository(db).getReviewItem(secondReviewItemId)!;
      const firstChunks = corpusRepo.listChunksForDocument(firstReviewItem.targetId);
      const secondChunks = corpusRepo.listChunksForDocument(secondReviewItem.targetId);
      const retrieval = retrieveLexicalChunks(db, { corpusId: first.corpusId, query: "three brass lamps chalk mark" });

      expect(firstChunks).toEqual([]);
      expect(secondChunks.length).toBeGreaterThan(0);
      expect(new Set(secondChunks.map((chunk) => chunk.stableId)).size).toBe(secondChunks.length);
      expect(retrieval.classification).toBe("evidence");
      expect(retrieval.results.every((result) => result.document.id === secondReviewItem.targetId)).toBe(true);
    } finally {
      closeDatabase(db);
    }
  });

  it("excludes rejected and deferred documents from retrieval", async () => {
    const rejected = await importFixtureForReview({ fixture: "sample.txt", adapter: textImportAdapter, filename: "rejected.txt" });
    recordHumanReviewDecision({ reviewItemId: rejected.reviewItemId, decisionState: "rejected", actor: "test-human" });

    const deferred = await importFixtureForReview({ fixture: "sample.md", adapter: markdownImportAdapter, filename: "deferred.md" });
    recordHumanReviewDecision({ reviewItemId: deferred.reviewItemId, decisionState: "deferred", actor: "test-human" });

    const db = openTestDatabase();
    try {
      const rejectedRetrieval = retrieveLexicalChunks(db, { corpusId: rejected.corpusId, query: "public domain style intentionally brief" });
      const deferredRetrieval = retrieveLexicalChunks(db, { corpusId: deferred.corpusId, query: "Duplicate heading content appears twice" });

      expect(rejectedRetrieval.classification).toBe("no_evidence");
      expect(rejectedRetrieval.results).toEqual([]);
      expect(deferredRetrieval.classification).toBe("no_evidence");
      expect(deferredRetrieval.results).toEqual([]);
    } finally {
      closeDatabase(db);
    }
  });

  it("returns a clear no-evidence classification for unsupported queries", async () => {
    const { corpusId, reviewItemId } = await importFixtureForReview({ fixture: "sample.md", adapter: markdownImportAdapter, filename: "approved-no-evidence.md" });
    recordHumanReviewDecision({ reviewItemId, decisionState: "approved", actor: "test-human" });

    const db = openTestDatabase();
    try {
      const retrieval = retrieveLexicalChunks(db, { corpusId, query: "astral dragon submarine treaty" });

      expect(retrieval.classification).toBe("no_evidence");
      expect(retrieval.noEvidenceReason).toBe("The corpus does not contain enough evidence for this query.");
      expect(retrieval.results).toEqual([]);
    } finally {
      closeDatabase(db);
    }
  });
});
