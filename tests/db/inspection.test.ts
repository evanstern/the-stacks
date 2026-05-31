import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { createConversationRepository } from "../../app/lib/conversations/repository.js";
import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import {
  getDocumentInspection,
  getImportInspection,
  getRetrievalTraceInspection,
  getReviewInspection,
  getSourceInspection,
} from "../../app/lib/inspection.server.js";
import { createReviewRepository } from "../../app/lib/review/repository.js";

let tempDir: string;
let previousDbPath: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-inspection-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "inspection.sqlite");
});

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.THE_STACKS_DB_PATH;
  } else {
    process.env.THE_STACKS_DB_PATH = previousDbPath;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

function seedInspectionRecords() {
  const db = openTestDatabase();
  const rawSourcePath = join(tempDir, "inspection.md");
  writeFileSync(rawSourcePath, "# Inspection Fixture\n\nA brass key opens the archive door.");

  try {
    const corpusRepo = createCorpusRepository(db);
    const reviewRepo = createReviewRepository(db);
    const conversationRepo = createConversationRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: "inspection-source-hash",
      sourceKind: "upload",
      originalFilename: "inspection.md",
      mimeType: "text/markdown",
      sizeBytes: 128,
      parserAdapter: "markdown",
      parserVersion: "1.0.0",
      importStatus: "review_needed",
      storageUri: `file://${rawSourcePath}`,
      metadata: { sourceId: "fixture-source" },
    });
    const importJob = corpusRepo.createImportJob({
      corpusId: corpus.id,
      sourceId: source.id,
      status: "review_needed",
      adapter: "markdown",
      adapterVersion: "1.0.0",
      warnings: ["frontmatter author missing"],
      errors: [],
      stats: { documents: 1, chunks: 1 },
      startedAt: "2026-05-30T00:00:00.000Z",
      finishedAt: "2026-05-30T00:00:01.000Z",
    });
    const importEvent = corpusRepo.createImportJobEvent({
      importJobId: importJob.id,
      eventType: "review_item_created",
      message: "Created review item for Inspection Fixture.",
      progressPct: 75,
      payload: { sourceId: source.id },
    });
    const document = corpusRepo.createDocument({
      corpusId: corpus.id,
      sourceId: source.id,
      title: "Inspection Fixture",
      authors: ["Ikis"],
      language: "en",
      sourceFormat: "markdown",
      provenance: { adapter: "markdown", importJobId: importJob.id },
      rawMetadata: { frontmatter: false },
      normalizedText: "A brass key opens the archive door.",
      status: "approved",
      contentHash: "document-content-hash",
    });
    const section = corpusRepo.createSection({
      documentId: document.id,
      ordinal: 0,
      heading: "Archive",
      headingPath: ["Archive"],
      startOffset: 0,
      endOffset: document.normalizedText.length,
      text: document.normalizedText,
    });
    const chunk = corpusRepo.createChunk({
      corpusId: corpus.id,
      documentId: document.id,
      sectionId: section.id,
      ordinal: 0,
      stableId: "inspection-fixture:0",
      startOffset: 0,
      endOffset: document.normalizedText.length,
      headingPath: ["Archive"],
      text: document.normalizedText,
      contentHash: "chunk-content-hash",
    });
    const reviewItem = reviewRepo.createReviewItem({
      corpusId: corpus.id,
      targetType: "document",
      targetId: document.id,
      status: "pending",
      title: document.title,
      summary: "Fixture summary",
      metadata: { importJobId: importJob.id },
    });
    const suggestion = reviewRepo.createSuggestion({
      reviewItemId: reviewItem.id,
      suggestionState: "suggested_approve",
      rationale: "Relevant fixture material.",
      model: "inspection-review-model",
      promptVersion: "review-inspection-v1",
      confidence: 0.88,
      metadata: { sourceIds: [source.id] },
    });
    const decision = reviewRepo.createDecision({
      reviewItemId: reviewItem.id,
      suggestionId: suggestion.id,
      decisionState: "approved",
      rationale: "Human accepted fixture.",
      actor: "inspection-human",
      metadata: { canonical: true },
    });
    const conversation = conversationRepo.createConversation({ corpusId: corpus.id, title: "Inspection trace" });
    const message = conversationRepo.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "[1] A brass key opens the archive door.",
      model: "ikis-grounded-extractive-v1",
      metadata: { promptVersion: "grounded-answer-v1" },
    });
    const retrievalRun = conversationRepo.createRetrievalRun({
      conversationId: conversation.id,
      messageId: message.id,
      corpusId: corpus.id,
      query: "What opens the archive door?",
      retrievalMode: "lexical-fts-v1",
      retrievedChunks: [chunk.id],
      scores: [{ chunkId: chunk.id, score: 3, rank: 1 }],
      modelInputs: {
        answerModel: "ikis-grounded-extractive-v1",
        promptVersion: "grounded-answer-v1",
        sourceIds: [source.id],
      },
      promptContextHash: "prompt-context-hash",
      finalAnswer: message.content,
    });
    const citation = conversationRepo.createCitation({
      retrievalRunId: retrievalRun.id,
      messageId: message.id,
      chunkId: chunk.id,
      documentId: document.id,
      sourceId: source.id,
      ordinal: 0,
      quote: "A brass key opens the archive door.",
      rationale: "Retrieved approved chunk used as answer evidence.",
      metadata: { score: 3, rank: 1, stableChunkId: chunk.stableId },
    });
    conversationRepo.createWorkflowRun({
      corpusId: corpus.id,
      workflowKind: "review_suggestion",
      threadId: "lg-review_suggestion-inspection",
      status: "succeeded",
      targetType: "review_item",
      targetId: reviewItem.id,
      inputRefs: { corpusId: corpus.id, targetId: document.id },
      outputRefs: { reviewItemId: reviewItem.id, suggestionId: suggestion.id },
    });

    return { importJob, importEvent, source, document, section, chunk, reviewItem, suggestion, decision, retrievalRun, citation };
  } finally {
    closeDatabase(db);
  }
}

describe("audit and inspection data surfaces", () => {
  it("resolves import details with adapter, warnings, source hash, and canonical records", () => {
    const seeded = seedInspectionRecords();

    const inspection = getImportInspection(seeded.importJob.id);

    expect(inspection?.job.adapter).toBe("markdown");
    expect(inspection?.job.warnings).toEqual(["frontmatter author missing"]);
    expect(inspection?.source?.fileHash).toBe("inspection-source-hash");
    expect(inspection?.source?.parserVersion).toBe("1.0.0");
    expect(inspection?.documents.map((document) => document.id)).toEqual([seeded.document.id]);
    expect(inspection?.reviewItems.map((item) => item.id)).toEqual([seeded.reviewItem.id]);
    expect(inspection?.events.map((event) => event.id)).toEqual([seeded.importEvent.id]);
  });

  it("resolves review history with suggestions separated from human decisions and workflow IDs", () => {
    const seeded = seedInspectionRecords();

    const inspection = getReviewInspection(seeded.reviewItem.id);

    expect(inspection?.suggestions).toHaveLength(1);
    expect(inspection?.suggestions[0]).toMatchObject({
      id: seeded.suggestion.id,
      model: "inspection-review-model",
      promptVersion: "review-inspection-v1",
    });
    expect(inspection?.decisions).toHaveLength(1);
    expect(inspection?.decisions[0]).toMatchObject({
      id: seeded.decision.id,
      actor: "inspection-human",
      suggestionId: seeded.suggestion.id,
    });
    expect(inspection?.workflowRuns[0]?.threadId).toBe("lg-review_suggestion-inspection");
  });

  it("resolves document previews with sections, chunks, and source provenance", () => {
    const seeded = seedInspectionRecords();

    const inspection = getDocumentInspection(seeded.document.id);

    expect(inspection?.source?.id).toBe(seeded.source.id);
    expect(inspection?.document.provenance).toMatchObject({ importJobId: seeded.importJob.id });
    expect(inspection?.sections.map((section) => section.id)).toEqual([seeded.section.id]);
    expect(inspection?.chunks.map((chunk) => chunk.stableId)).toEqual(["inspection-fixture:0"]);
  });

  it("resolves source inspection with raw preview, import jobs, documents, sections, chunks, and review items", () => {
    const seeded = seedInspectionRecords();

    const inspection = getSourceInspection(seeded.source.id);

    expect(inspection?.source.id).toBe(seeded.source.id);
    expect(inspection?.rawFile.previewText).toContain("A brass key opens the archive door.");
    expect(inspection?.importJobs.map((job) => job.id)).toEqual([seeded.importJob.id]);
    expect(inspection?.importJobs[0]?.events.map((event) => event.eventType)).toEqual(["review_item_created"]);
    expect(inspection?.documents.map((document) => document.id)).toEqual([seeded.document.id]);
    expect(inspection?.documents[0]?.sections.map((section) => section.id)).toEqual([seeded.section.id]);
    expect(inspection?.documents[0]?.chunks.map((chunk) => chunk.id)).toEqual([seeded.chunk.id]);
    expect(inspection?.reviewItems.map((item) => item.id)).toEqual([seeded.reviewItem.id]);
  });

  it("resolves retrieval trace with query, chunk scores, answer model, source IDs, and final citations", () => {
    const seeded = seedInspectionRecords();

    const inspection = getRetrievalTraceInspection(seeded.retrievalRun.id);

    expect(inspection?.run.query).toBe("What opens the archive door?");
    expect(inspection?.run.retrievedChunks).toEqual([seeded.chunk.id]);
    expect(inspection?.run.scores).toEqual([{ chunkId: seeded.chunk.id, score: 3, rank: 1 }]);
    expect(inspection?.run.modelInputs).toMatchObject({
      answerModel: "ikis-grounded-extractive-v1",
      promptVersion: "grounded-answer-v1",
      sourceIds: [seeded.source.id],
    });
    expect(inspection?.message?.model).toBe("ikis-grounded-extractive-v1");
    expect(inspection?.citations).toHaveLength(1);
    expect(inspection?.citations[0]).toMatchObject({
      id: seeded.citation.id,
      chunk: { id: seeded.chunk.id },
      document: { id: seeded.document.id },
      source: { id: seeded.source.id },
    });
  });
});
