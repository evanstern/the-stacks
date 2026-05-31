import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { createConversationRepository } from "../../app/lib/conversations/repository.js";
import { answerGroundedQuestion, insufficientEvidenceAnswer } from "../../app/lib/conversations/grounded.server.js";
import { markdownImportAdapter } from "../../app/lib/imports/adapters/index.js";
import { getRetrievalTraceInspection } from "../../app/lib/inspection.server.js";
import { normalizeImportForReview, recordHumanReviewDecision } from "../../app/lib/review/queue.server.js";

let tempDir: string;
let previousDbPath: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-conversation-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "conversation.sqlite");
});

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.THE_STACKS_DB_PATH;
  } else {
    process.env.THE_STACKS_DB_PATH = previousDbPath;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

async function seedApprovedMarkdown(): Promise<string> {
  const sourcePath = resolve("fixtures", "corpus", "sample.md");
  const storedPath = join(tempDir, "conversation-sample.md");
  const bytes = readFileSync(sourcePath);
  writeFileSync(storedPath, bytes);

  const db = openTestDatabase();

  try {
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: "conversation-sample-hash",
      sourceKind: "upload",
      originalFilename: "conversation-sample.md",
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
        rationale: "Fixture content is inside the test corpus boundary.",
        model: "test-review-model",
        promptVersion: "review-import-v1",
        confidence: 0.9,
      }),
    });

    recordHumanReviewDecision({ reviewItemId: result.reviewItemIds[0], decisionState: "approved", actor: "test-human" });

    return corpus.id;
  } finally {
    closeDatabase(db);
  }
}

describe("grounded corpus conversation", () => {
  it("persists messages, retrieval runs, and resolvable citations for evidence-backed answers", async () => {
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = answerGroundedQuestion(db, { corpusId, question: "What does the corpus say about three brass lamps and the chalk mark?" });
      const conversationRepo = createConversationRepository(db);
      const messages = conversationRepo.listMessages(turn.conversation.id);
      const citations = conversationRepo.listCitations(turn.retrievalRun.id);

      expect(turn.noEvidence).toBe(false);
      expect(turn.assistantMessage.content).toContain("[1]");
      expect(turn.assistantMessage.content).toContain("three brass lamps");
      expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(turn.retrievalRun.retrievedChunks.length).toBeGreaterThan(0);
      expect(turn.retrievalRun.noEvidence).toBe(false);
      expect(turn.retrievalRun.modelInputs).toMatchObject({
        answerModel: "ikis-grounded-extractive-v1",
        promptVersion: "grounded-answer-v1",
      });
      expect(turn.retrievalRun.modelInputs).toHaveProperty("sourceIds");
      expect(turn.assistantMessage.metadata).toMatchObject({
        promptVersion: "grounded-answer-v1",
      });
      expect(citations).toHaveLength(turn.retrievalRun.retrievedChunks.length);
      expect(turn.sourcePreviews[0]?.previewUrl).toContain(`/chat/${encodeURIComponent(turn.conversation.id)}/sources/`);
      expect(turn.sourcePreviews[0]?.quote).toContain("three brass lamps");

      const trace = getRetrievalTraceInspection(turn.retrievalRun.id);

      expect(trace?.message?.model).toBe("ikis-grounded-extractive-v1");
      expect(trace?.run.modelInputs).toMatchObject({
        promptVersion: "grounded-answer-v1",
        sourceIds: turn.sourcePreviews.map((preview) => preview.sourceId),
      });
      expect(trace?.run.retrievedChunks).toEqual(turn.sourcePreviews.map((preview) => preview.chunkId));
      expect(trace?.run.scores).toEqual(turn.retrievalRun.scores);
      expect(trace?.citations.map((citation) => citation.id)).toEqual(citations.map((citation) => citation.id));
      expect(trace?.citations[0]?.chunk?.stableId).toBeTruthy();
      expect(trace?.citations[0]?.document?.title).toBe(turn.sourcePreviews[0]?.documentTitle);
      expect(trace?.citations[0]?.source?.fileHash).toBe("conversation-sample-hash");
    } finally {
      closeDatabase(db);
    }
  });

  it("persists an explicit no-evidence answer without fabricated citations", async () => {
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = answerGroundedQuestion(db, { corpusId, question: "Which submarine treaty governs astral dragons?" });
      const conversationRepo = createConversationRepository(db);

      expect(turn.noEvidence).toBe(true);
      expect(turn.assistantMessage.content).toBe(insufficientEvidenceAnswer);
      expect(turn.retrievalRun.noEvidence).toBe(true);
      expect(turn.retrievalRun.retrievedChunks).toEqual([]);
      expect(conversationRepo.listCitations(turn.retrievalRun.id)).toEqual([]);
      expect(turn.sourcePreviews).toEqual([]);
    } finally {
      closeDatabase(db);
    }
  });
});
