import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import {
  createExtractiveGroundedAnswerProvider,
  createOpenAiGroundedAnswerProvider,
  groundedAnswerPromptVersion,
  validateGroundedAnswer,
} from "../../app/lib/conversations/grounded-answer.server.js";
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
  vi.restoreAllMocks();
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
  it("rejects model citations that reference unknown evidence ordinals", () => {
    const validation = validateGroundedAnswer({
      result: {
        answer: "The corpus mentions a chalk mark [1] and an unsupported second source [2].",
        citedOrdinals: [1, 2],
        model: "bad-ordinal-test-provider",
        promptVersion: groundedAnswerPromptVersion,
      },
      evidence: [
        {
          ordinal: 1,
          chunkId: "chunk-1",
          documentId: "document-1",
          sourceId: "source-1",
          documentTitle: "Synthetic Field Notes",
          sourceLabel: "conversation-sample.md",
          headingPath: ["First Landing"],
          score: 1,
          rank: 1,
          text: "The first landing contains three brass lamps and a chalk mark.",
        },
      ],
    });

    expect(validation).toEqual({
      accepted: false,
      noEvidence: true,
      answer: insufficientEvidenceAnswer,
      citedOrdinals: [],
      reason: "answer_cited_unknown_ordinal_2",
    });
  });

  it("returns insufficient evidence without calling the network when the provider key is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = createOpenAiGroundedAnswerProvider({ providerKey: "", model: "test-openai-model" });

    const result = await provider({
      question: "What does the corpus say about three brass lamps?",
      evidence: [
        {
          ordinal: 1,
          chunkId: "chunk-1",
          documentId: "document-1",
          sourceId: "source-1",
          documentTitle: "Synthetic Field Notes",
          sourceLabel: "conversation-sample.md",
          headingPath: ["First Landing"],
          score: 1,
          rank: 1,
          text: "The first landing contains three brass lamps and a chalk mark.",
        },
      ],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      answer: insufficientEvidenceAnswer,
      citedOrdinals: [],
      model: "test-openai-model",
      promptVersion: groundedAnswerPromptVersion,
      metadata: { provider: "openai", skipped: "missing_provider_key" },
    });
  });

  it("persists messages, retrieval runs, and resolvable citations for evidence-backed answers", async () => {
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = await answerGroundedQuestion(db, {
        corpusId,
        question: "What does the corpus say about three brass lamps and the chalk mark?",
        answerProvider: createExtractiveGroundedAnswerProvider(),
      });
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
        answerModel: "ikis-grounded-fake-v1",
        promptVersion: groundedAnswerPromptVersion,
        mode: "llm-grounded-answer",
        retrievalTrace: {
          candidateCount: expect.any(Number),
          finalContextCount: expect.any(Number),
        },
        validation: {
          accepted: true,
          reason: null,
        },
        provider: {
          provider: "extractive-test-fallback",
        },
      });
      expect(turn.retrievalRun.modelInputs).toHaveProperty("sourceIds");
      expect(turn.retrievalRun.modelInputs).toHaveProperty("retrievalTrace");
      expect(turn.retrievalRun.modelInputs).toHaveProperty("citedOrdinals");
      expect(turn.retrievalRun.modelInputs.citedOrdinals).toEqual([1]);
      expect(turn.retrievalRun.modelInputs.retrievalTrace.candidateCount).toBeGreaterThanOrEqual(1);
      expect(turn.retrievalRun.modelInputs.retrievalTrace.finalContextCount).toBe(turn.retrievalRun.retrievedChunks.length);
      expect(turn.assistantMessage.metadata).toMatchObject({
        promptVersion: groundedAnswerPromptVersion,
      });
      expect(citations).toHaveLength(turn.sourcePreviews.length);
      expect(citations.length).toBeGreaterThan(0);
      expect(turn.sourcePreviews[0]?.previewUrl).toContain(`/chat/${encodeURIComponent(turn.conversation.id)}/sources/`);
      expect(turn.sourcePreviews[0]?.quote).toContain("three brass lamps");

      const trace = getRetrievalTraceInspection(turn.retrievalRun.id);

      expect(trace?.message?.model).toBe("ikis-grounded-fake-v1");
      expect(trace?.run.modelInputs).toMatchObject({
        promptVersion: groundedAnswerPromptVersion,
        sourceIds: turn.sourcePreviews.map((preview) => preview.sourceId),
        citedOrdinals: [1],
        retrievalTrace: {
          candidateCount: expect.any(Number),
          finalContextCount: turn.retrievalRun.retrievedChunks.length,
        },
        validation: {
          accepted: true,
          reason: null,
        },
        provider: {
          provider: "extractive-test-fallback",
        },
      });
      expect(trace?.run.retrievedChunks).toContain(turn.sourcePreviews[0]?.chunkId);
      expect(trace?.run.scores).toEqual(turn.retrievalRun.scores);
      expect(trace?.citations.map((citation) => citation.id)).toEqual(citations.map((citation) => citation.id));
      expect(trace?.citations[0]?.chunk?.stableId).toBeTruthy();
      expect(trace?.citations[0]?.document?.title).toBe(turn.sourcePreviews[0]?.documentTitle);
      expect(trace?.citations[0]?.source?.fileHash).toBe("conversation-sample-hash");
    } finally {
      closeDatabase(db);
    }
  });

  it("passes previous turns plus the current question into the grounded answer provider", async () => {
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const firstTurn = await answerGroundedQuestion(db, {
        corpusId,
        question: "What does the corpus say about three brass lamps?",
        answerProvider: createExtractiveGroundedAnswerProvider(),
      });
      const historySnapshots: string[][] = [];
      const secondTurn = await answerGroundedQuestion(db, {
        corpusId,
        conversationId: firstTurn.conversation.id,
        question: "Tell me more about their chalk mark.",
        answerProvider: async ({ conversationHistory, evidence }) => {
          historySnapshots.push((conversationHistory ?? []).map((message) => `${message.role}: ${message.content}`));
          return {
            answer: `The follow-up can see the prior turn and current question: ${evidence[0]?.text.slice(0, 40)} [1]`,
            citedOrdinals: [1],
            model: "history-aware-test-provider",
            promptVersion: groundedAnswerPromptVersion,
          };
        },
      });

      expect(secondTurn.conversation.id).toBe(firstTurn.conversation.id);
      expect(historySnapshots).toHaveLength(1);
      expect(historySnapshots[0]).toEqual([
        expect.stringContaining("user: What does the corpus say about three brass lamps?"),
        expect.stringContaining("assistant:"),
        expect.stringContaining("user: Tell me more about their chalk mark."),
      ]);
      expect(secondTurn.noEvidence).toBe(false);
      expect(secondTurn.assistantMessage.content).toContain("[1]");
    } finally {
      closeDatabase(db);
    }
  });

  it("persists an explicit no-evidence answer without fabricated citations", async () => {
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = await answerGroundedQuestion(db, { corpusId, question: "Which submarine treaty governs astral dragons?" });
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

  it("downgrades uncited provider output to no evidence without citations", async () => {
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = await answerGroundedQuestion(db, {
        corpusId,
        question: "What does the corpus say about three brass lamps?",
        answerProvider: async () => ({
          answer: "The corpus discusses three brass lamps but this sentence has no citation marker.",
          citedOrdinals: [],
          model: "bad-test-provider",
          promptVersion: groundedAnswerPromptVersion,
        }),
      });
      const conversationRepo = createConversationRepository(db);

      expect(turn.noEvidence).toBe(true);
      expect(turn.assistantMessage.content).toBe(insufficientEvidenceAnswer);
      expect(turn.retrievalRun.noEvidence).toBe(true);
      expect(conversationRepo.listCitations(turn.retrievalRun.id)).toEqual([]);
      expect(turn.retrievalRun.modelInputs).toMatchObject({
        validation: {
          accepted: false,
          reason: "answer_missing_citations",
        },
      });
    } finally {
      closeDatabase(db);
    }
  });

  it("persists only the cited evidence records", async () => {
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = await answerGroundedQuestion(db, {
        corpusId,
        question: "What does the corpus say about three brass lamps and duplicate headings?",
        answerProvider: async ({ evidence }) => ({
          answer: `The first useful record says ${evidence[0]?.text.slice(0, 48)} [1]`,
          citedOrdinals: [1],
          model: "single-citation-test-provider",
          promptVersion: groundedAnswerPromptVersion,
        }),
      });
      const conversationRepo = createConversationRepository(db);
      const citations = conversationRepo.listCitations(turn.retrievalRun.id);

      expect(turn.noEvidence).toBe(false);
      expect(turn.retrievalRun.retrievedChunks.length).toBeGreaterThanOrEqual(1);
      expect(citations).toHaveLength(1);
      expect(citations.map((citation) => citation.chunkId)).toEqual([turn.retrievalRun.retrievedChunks[0]]);
      expect(citations.map((citation) => citation.documentId)).toEqual([turn.sourcePreviews[0]?.documentId]);
      expect(citations.map((citation) => citation.sourceId)).toEqual([turn.sourcePreviews[0]?.sourceId]);
      expect(citations[0]?.ordinal).toBe(0);
      expect(citations[0]?.metadata).toMatchObject({ contextOrdinal: 1 });
      expect(turn.retrievalRun.modelInputs.citedOrdinals).toEqual([1]);
      expect(turn.retrievalRun.modelInputs.sourceIds).toEqual([turn.sourcePreviews[0]?.sourceId]);
      expect(turn.sourcePreviews).toHaveLength(1);
    } finally {
      closeDatabase(db);
    }
  });
});
