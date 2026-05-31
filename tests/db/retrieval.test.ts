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
import { buildGroundedRetrievalContext } from "../../app/lib/retrieval/context.js";
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

async function importMarkdownTextForReview(input: { text: string; filename: string; fileHash: string }): Promise<{ corpusId: string; reviewItemId: string }> {
  const storedPath = join(tempDir, input.filename);
  const bytes = Buffer.from(input.text, "utf8");
  writeFileSync(storedPath, bytes);

  const db = openTestDatabase();

  try {
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: input.fileHash,
      sourceKind: "upload",
      originalFilename: input.filename,
      mimeType: "text/markdown",
      sizeBytes: bytes.length,
      parserAdapter: markdownImportAdapter.name,
      parserVersion: markdownImportAdapter.version,
      importStatus: "queued",
      storageUri: `file://${storedPath}`,
    });
    const importJob = corpusRepo.createImportJob({
      corpusId: corpus.id,
      sourceId: source.id,
      status: "queued",
      adapter: markdownImportAdapter.name,
      adapterVersion: markdownImportAdapter.version,
    });

    const result = await normalizeImportForReview(importJob.id, {
      suggest: async () => ({
        suggestionState: "suggested_approve",
        rationale: "Inline fixture content is inside the test corpus boundary.",
        model: "test-review-model",
        promptVersion: "review-import-v1",
        confidence: 0.9,
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

  it("builds bounded evidence context records with stable citation ordinals", async () => {
    const { corpusId, reviewItemId } = await importFixtureForReview({ fixture: "sample.md", adapter: markdownImportAdapter, filename: "context.md" });
    recordHumanReviewDecision({ reviewItemId, decisionState: "approved", actor: "test-human" });

    const db = openTestDatabase();
    try {
      const context = buildGroundedRetrievalContext(db, {
        corpusId,
        query: "three brass lamps chalk mark duplicate heading",
        candidateLimit: 20,
        maxContextRecords: 2,
      });

      expect(context.trace.retrievalMode).toBe("lexical-fts-context-v1");
      expect(context.trace.candidateLimit).toBe(20);
      expect(context.trace.candidateCount).toBeGreaterThanOrEqual(context.evidence.length);
      expect(context.evidence).toHaveLength(2);
      expect(context.evidence.map((record) => record.ordinal)).toEqual([1, 2]);
      expect(context.evidence[0]).toMatchObject({
        documentTitle: "Synthetic Field Notes",
        sourceLabel: "context.md",
      });
      expect(context.evidence[0]?.chunkId).toBeTruthy();
      expect(context.evidence[0]?.documentId).toBeTruthy();
      expect(context.evidence[0]?.sourceId).toBeTruthy();
    } finally {
      closeDatabase(db);
    }
  });

  it("ignores conversational stopwords so noun terms still retrieve evidence", async () => {
    const { corpusId, reviewItemId } = await importMarkdownTextForReview({
      filename: "goblin-field-guide.md",
      fileHash: "goblin-field-guide-hash",
      text: [
        "---",
        "title: Goblin Field Guide",
        "---",
        "# Goblin Field Guide",
        "",
        "Goblins mark narrow tunnels with blue chalk and trade brass buttons at dusk.",
      ].join("\n"),
    });
    recordHumanReviewDecision({ reviewItemId, decisionState: "approved", actor: "test-human" });

    const db = openTestDatabase();
    try {
      const context = buildGroundedRetrievalContext(db, {
        corpusId,
        query: "tell me about goblins",
        candidateLimit: 10,
        maxContextRecords: 3,
      });

      expect(context.trace).toMatchObject({
        candidateLimit: 10,
        candidateCount: 1,
        finalContextCount: 1,
      });
      expect(context.evidence).toHaveLength(1);
      expect(context.evidence[0]).toMatchObject({
        ordinal: 1,
        documentTitle: "Goblin Field Guide",
        sourceLabel: "goblin-field-guide.md",
      });
      expect(context.evidence[0]?.text).toContain("Goblins mark narrow tunnels");
    } finally {
      closeDatabase(db);
    }
  });

  it("retrieves goblin stat-block hit point evidence for hitpoints questions", async () => {
    const { corpusId, reviewItemId } = await importMarkdownTextForReview({
      filename: "goblin-stat-block.md",
      fileHash: "goblin-stat-block-hash",
      text: [
        "---",
        "title: Skirmisher Notes",
        "---",
        "# Skirmisher Notes",
        "",
        "## Tunnel Watch",
        "",
        "Goblins gather near the east tunnel. A goblin scout taps the wall while another goblin counts buttons.",
        "The goblin patrol notes are noisy field observations without any combat statistics.",
        "",
        "## Stat Block",
        "",
        "A goblin skirmisher watches the mushroom gate and keeps a bent copper horn nearby.",
        "",
        "Goblin",
        "Small humanoid, nimble and wary",
        "Armor Class 14",
        "Hit Points 7 (2d6)",
        "Speed 30 ft.",
        "Nimble Escape. The goblin can duck behind crates after striking.",
      ].join("\n"),
    });
    recordHumanReviewDecision({ reviewItemId, decisionState: "approved", actor: "test-human" });

    const db = openTestDatabase();
    try {
      const context = buildGroundedRetrievalContext(db, {
        corpusId,
        query: "tell me what the goblin's hitpoints are",
        candidateLimit: 10,
        maxContextRecords: 1,
      });

      expect(context.evidence).toHaveLength(1);
      expect(context.evidence[0]?.text).toContain("Hit Points 7 (2d6)");
    } finally {
      closeDatabase(db);
    }
  });
});
