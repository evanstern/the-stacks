import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabase, openDatabase, resolveDatabasePath, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createConversationRepository } from "../../app/lib/conversations/repository.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { createReviewRepository } from "../../app/lib/review/repository.js";

const canonicalTables = [
  "corpora",
  "sources",
  "documents",
  "document_sections",
  "chunks",
  "review_items",
  "review_suggestions",
  "review_decisions",
  "import_jobs",
  "conversations",
  "messages",
  "retrieval_runs",
  "citations",
  "workflow_runs",
];

let tempDir: string;
let db: Database;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-db-"));
  db = openDatabase(join(tempDir, "test.sqlite"));
  runMigrations(db);
});

afterEach(() => {
  closeDatabase(db);
  rmSync(tempDir, { recursive: true, force: true });
});

describe("SQLite schema", () => {
  it("creates the canonical tables and core indexes", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name);

    for (const table of canonicalTables) {
      expect(tables).toContain(table);
    }

    expect(indexes).toContain("idx_sources_corpus_status");
    expect(indexes).toContain("idx_review_items_corpus_status");
    expect(indexes).toContain("idx_retrieval_runs_corpus");
  });

  it("resolves DB path from DATABASE_URL or THE_STACKS_DB_PATH", () => {
    expect(resolveDatabasePath({ DATABASE_URL: "file:./data/url.sqlite" })).toMatch(/data\/url\.sqlite$/);
    expect(resolveDatabasePath({ THE_STACKS_DB_PATH: "./data/path.sqlite" })).toMatch(/data\/path\.sqlite$/);
  });
});

describe("repository round trips", () => {
  it("persists corpus, source, document, section, chunk, review, conversation, retrieval, citation, and workflow rows", () => {
    const corpusRepo = createCorpusRepository(db);
    const reviewRepo = createReviewRepository(db);
    const conversationRepo = createConversationRepository(db);

    const corpus = corpusRepo.createCorpus({ name: "Forgotten Realms", description: "approved demo corpus" });
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: "sha256-demo",
      sourceKind: "upload",
      originalFilename: "waterdeep.md",
      mimeType: "text/markdown",
      sizeBytes: 42,
      parserAdapter: "markdown",
      parserVersion: "1.0.0",
      importStatus: "uploaded",
      metadata: { sourceUrl: "file://waterdeep.md" },
    });
    const duplicateLookup = corpusRepo.findSourceByIdempotencyKey({
      corpusId: corpus.id,
      fileHash: "sha256-demo",
      parserAdapter: "markdown",
    });

    const importJob = corpusRepo.createImportJob({
      corpusId: corpus.id,
      sourceId: source.id,
      status: "queued",
      adapter: "markdown",
      adapterVersion: "1.0.0",
      warnings: ["frontmatter ignored"],
      stats: { documents: 1 },
    });
    const finishedJob = corpusRepo.updateImportJob({ id: importJob.id, status: "review_needed", finishedAt: "2026-05-29T00:00:00.000Z" });

    const document = corpusRepo.createDocument({
      corpusId: corpus.id,
      sourceId: source.id,
      title: "Waterdeep",
      authors: ["demo"],
      language: "en",
      sourceFormat: "markdown",
      provenance: { sourcePageId: "waterdeep" },
      rawMetadata: { categories: ["Cities"] },
      normalizedText: "Waterdeep is a city in the Forgotten Realms.",
      status: "review_needed",
      contentHash: "content-sha",
    });
    const section = corpusRepo.createSection({
      documentId: document.id,
      ordinal: 0,
      heading: "Overview",
      headingPath: ["Overview"],
      startOffset: 0,
      endOffset: document.normalizedText.length,
      text: document.normalizedText,
    });
    const chunk = corpusRepo.createChunk({
      corpusId: corpus.id,
      documentId: document.id,
      sectionId: section.id,
      ordinal: 0,
      stableId: "waterdeep:0",
      startOffset: 0,
      endOffset: document.normalizedText.length,
      headingPath: ["Overview"],
      text: document.normalizedText,
      contentHash: "chunk-sha",
    });

    const reviewItem = reviewRepo.createReviewItem({
      corpusId: corpus.id,
      targetType: "document",
      targetId: document.id,
      title: document.title,
    });
    const suggestion = reviewRepo.createSuggestion({
      reviewItemId: reviewItem.id,
      suggestionState: "suggested_approve",
      rationale: "The document matches the corpus boundary.",
      model: "test-model",
      promptVersion: "review-v1",
      confidence: 0.9,
    });
    const decision = reviewRepo.createDecision({
      reviewItemId: reviewItem.id,
      suggestionId: suggestion.id,
      decisionState: "approved",
      rationale: "Human approved.",
      actor: "local-admin",
    });

    const conversation = conversationRepo.createConversation({ corpusId: corpus.id, title: "Waterdeep questions" });
    const userMessage = conversationRepo.addMessage({ conversationId: conversation.id, role: "user", content: "What is Waterdeep?" });
    const assistantMessage = conversationRepo.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "Waterdeep is a city in the Forgotten Realms.",
      model: "test-model",
    });
    const retrievalRun = conversationRepo.createRetrievalRun({
      conversationId: conversation.id,
      messageId: userMessage.id,
      corpusId: corpus.id,
      query: userMessage.content,
      retrievalMode: "lexical",
      retrievedChunks: [chunk.id],
      scores: { [chunk.id]: 1 },
      modelInputs: { chunkIds: [chunk.id] },
      promptContextHash: "prompt-sha",
      finalAnswer: assistantMessage.content,
    });
    const citation = conversationRepo.createCitation({
      retrievalRunId: retrievalRun.id,
      messageId: assistantMessage.id,
      chunkId: chunk.id,
      documentId: document.id,
      sourceId: source.id,
      ordinal: 0,
      quote: "Waterdeep is a city",
    });
    const workflowRun = conversationRepo.createWorkflowRun({
      corpusId: corpus.id,
      workflowKind: "review_suggestion",
      threadId: "thread-123",
      status: "completed",
      targetType: "review_item",
      targetId: reviewItem.id,
      inputRefs: [{ reviewItemId: reviewItem.id }],
      outputRefs: [{ suggestionId: suggestion.id }],
    });

    expect(duplicateLookup?.id).toBe(source.id);
    expect(corpusRepo.listSourcesForCorpus(corpus.id)[0]?.id).toBe(source.id);
    expect(corpusRepo.listImportJobsForCorpus(corpus.id)[0]?.id).toBe(importJob.id);
    expect(corpusRepo.listImportJobsForSource(source.id)[0]?.id).toBe(importJob.id);
    expect(finishedJob.status).toBe("review_needed");
    expect(corpusRepo.listDocumentsForCorpus(corpus.id)).toHaveLength(1);
    expect(corpusRepo.listSectionsForDocument(document.id)[0]?.headingPath).toEqual(["Overview"]);
    expect(corpusRepo.listChunksForDocument(document.id)[0]?.stableId).toBe("waterdeep:0");
    expect(reviewRepo.getReviewItem(reviewItem.id)?.status).toBe("approved");
    expect(reviewRepo.listSuggestions(reviewItem.id)[0]?.id).toBe(suggestion.id);
    expect(reviewRepo.listDecisions(reviewItem.id)[0]?.id).toBe(decision.id);
    expect(conversationRepo.listMessages(conversation.id)).toHaveLength(2);
    expect(conversationRepo.getRetrievalRun(retrievalRun.id)?.retrievedChunks).toEqual([chunk.id]);
    expect(conversationRepo.listCitations(retrievalRun.id)[0]?.id).toBe(citation.id);
    expect(conversationRepo.getWorkflowRun(workflowRun.id)?.inputRefs).toEqual([{ reviewItemId: reviewItem.id }]);
  });

  it("enforces review state and source idempotency constraints", () => {
    const corpusRepo = createCorpusRepository(db);
    const reviewRepo = createReviewRepository(db);
    const corpus = corpusRepo.createCorpus({ name: "Constraint corpus" });

    corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: "same-hash",
      sourceKind: "upload",
      originalFilename: "one.txt",
      sizeBytes: 1,
      parserAdapter: "text",
      parserVersion: "1",
      importStatus: "uploaded",
    });

    expect(() =>
      corpusRepo.createSource({
        corpusId: corpus.id,
        fileHash: "same-hash",
        sourceKind: "upload",
        originalFilename: "two.txt",
        sizeBytes: 2,
        parserAdapter: "text",
        parserVersion: "1",
        importStatus: "uploaded",
      }),
    ).toThrowError();

    const reviewItem = reviewRepo.createReviewItem({ corpusId: corpus.id, targetType: "source", targetId: "source-1", title: "Source" });
    expect(() =>
      reviewRepo.createDecision({
        reviewItemId: reviewItem.id,
        decisionState: "suggested_approve" as "approved",
        actor: "local-admin",
      }),
    ).toThrowError();
  });
});
