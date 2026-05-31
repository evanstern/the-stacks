import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { createExtractiveGroundedAnswerProvider, groundedAnswerPromptVersion } from "../../app/lib/conversations/grounded-answer.server.js";
import { answerGroundedQuestion, insufficientEvidenceAnswer, isChatAgentEnabled } from "../../app/lib/conversations/grounded.server.js";
import { createConversationRepository, type WorkflowRun } from "../../app/lib/conversations/repository.js";
import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import type { JsonValue } from "../../app/lib/db/rows.js";
import { markdownImportAdapter } from "../../app/lib/imports/adapters/index.js";
import { normalizeImportForReview, recordHumanReviewDecision } from "../../app/lib/review/queue.server.js";
import { assertWorkflowBoundaryRefs } from "../../app/lib/workflows/boundary.js";

let tempDir: string;
let previousDbPath: string | undefined;
let previousChatAgentEnabled: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-chat-agent-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  previousChatAgentEnabled = process.env.IKIS_CHAT_AGENT_ENABLED;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "chat-agent.sqlite");
});

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.THE_STACKS_DB_PATH;
  } else {
    process.env.THE_STACKS_DB_PATH = previousDbPath;
  }

  if (previousChatAgentEnabled === undefined) {
    delete process.env.IKIS_CHAT_AGENT_ENABLED;
  } else {
    process.env.IKIS_CHAT_AGENT_ENABLED = previousChatAgentEnabled;
  }

  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function seedApprovedMarkdown(): Promise<string> {
  const sourcePath = resolve("fixtures", "corpus", "sample.md");
  const storedPath = join(tempDir, "chat-agent-sample.md");
  const bytes = readFileSync(sourcePath);
  writeFileSync(storedPath, bytes);

  const db = openTestDatabase();

  try {
    const corpusRepo = createCorpusRepository(db);
    const corpus = corpusRepo.getOrCreateDefaultCorpus();
    const source = corpusRepo.createSource({
      corpusId: corpus.id,
      fileHash: "chat-agent-sample-hash",
      sourceKind: "upload",
      originalFilename: "chat-agent-sample.md",
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

function getSingleWorkflowRun(db: Database, conversationId: string): WorkflowRun {
  const workflowRuns = createConversationRepository(db).listWorkflowRunsForTarget({ targetType: "conversation", targetId: conversationId });
  expect(workflowRuns).toHaveLength(1);
  return workflowRuns[0];
}

function jsonRecord(value: JsonValue): Record<string, JsonValue> {
  expect(value).not.toBeNull();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, JsonValue>;
}

function workflowNodeSummaries(workflowRun: WorkflowRun): Record<string, JsonValue>[] {
  const outputRefs = jsonRecord(workflowRun.outputRefs);
  const nodeSummaries = outputRefs.nodeSummaries;

  expect(Array.isArray(nodeSummaries)).toBe(true);
  if (!Array.isArray(nodeSummaries)) {
    return [];
  }

  return nodeSummaries.filter((nodeSummary): nodeSummary is Record<string, JsonValue> => {
    return Boolean(nodeSummary) && typeof nodeSummary === "object" && !Array.isArray(nodeSummary);
  });
}

describe("local chat agent runner", () => {
  it("enables only when IKIS_CHAT_AGENT_ENABLED is exactly true", () => {
    expect(isChatAgentEnabled({ IKIS_CHAT_AGENT_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isChatAgentEnabled({ IKIS_CHAT_AGENT_ENABLED: "false" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isChatAgentEnabled({ IKIS_CHAT_AGENT_ENABLED: "TRUE" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isChatAgentEnabled({ LANGGRAPH_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("runs the enabled graph path with the same grounded turn contract and a safe workflow trace", async () => {
    process.env.IKIS_CHAT_AGENT_ENABLED = "true";
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const question = "What does the corpus say about three brass lamps and the chalk mark?";
      const turn = await answerGroundedQuestion(db, { corpusId, question, answerProvider: createExtractiveGroundedAnswerProvider() });
      const conversationRepo = createConversationRepository(db);
      const messages = conversationRepo.listMessages(turn.conversation.id);
      const citations = conversationRepo.listCitations(turn.retrievalRun.id);
      const workflowRun = getSingleWorkflowRun(db, turn.conversation.id);
      const inputRefsText = JSON.stringify(workflowRun.inputRefs);
      const outputRefsText = JSON.stringify(workflowRun.outputRefs);

      expect(turn.noEvidence).toBe(false);
      expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(turn.assistantMessage.content).toContain("[1]");
      expect(turn.retrievalRun.modelInputs).toMatchObject({
        mode: "llm-grounded-answer",
        promptVersion: groundedAnswerPromptVersion,
        validation: { accepted: true, reason: null },
      });
      expect(citations).toHaveLength(turn.sourcePreviews.length);
      expect(citations.length).toBeGreaterThan(0);
      expect(workflowRun.workflowKind).toBe("chat_agent_turn");
      expect(workflowRun.threadId).toMatch(/^lg-chat_agent_turn-/);
      expect(workflowRun.status).toBe("succeeded");
      expect(workflowRun.corpusId).toBe(corpusId);
      expect(workflowRun.targetType).toBe("conversation");
      expect(workflowRun.targetId).toBe(turn.conversation.id);
      expect(workflowRun.inputRefs).toMatchObject({
        corpusId,
        targetType: "conversation",
        targetId: turn.conversation.id,
        graphName: "local_chat_agent",
        graphVersion: "chat-agent-local-v1",
        questionLength: question.length,
        userMessageId: turn.userMessage.id,
      });
      expect(workflowRun.outputRefs).toMatchObject({
        conversationId: turn.conversation.id,
        userMessageId: turn.userMessage.id,
        assistantMessageId: turn.assistantMessage.id,
        retrievalRunId: turn.retrievalRun.id,
        citationIds: citations.map((citation) => citation.id),
        status: "succeeded",
      });
      expect(workflowNodeSummaries(workflowRun).map((nodeSummary) => nodeSummary.node)).toEqual([
        "receive_user_message",
        "retrieve_evidence",
        "synthesize_answer",
        "validate_answer",
        "persist_completed_turn",
      ]);
      expect(inputRefsText).not.toContain(question);
      expect(outputRefsText).not.toContain("three brass lamps");
      expect(outputRefsText).not.toContain("chalk mark");
      assertWorkflowBoundaryRefs(workflowRun.inputRefs);
      assertWorkflowBoundaryRefs(workflowRun.outputRefs);
    } finally {
      closeDatabase(db);
    }
  });

  it("passes prior conversation turns plus the current turn through the enabled agent path", async () => {
    process.env.IKIS_CHAT_AGENT_ENABLED = "true";
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
            answer: `The history-aware agent can answer from ${evidence[0]?.text.slice(0, 40)} [1]`,
            citedOrdinals: [1],
            model: "agent-history-test-provider",
            promptVersion: groundedAnswerPromptVersion,
          };
        },
      });
      const workflowRuns = createConversationRepository(db).listWorkflowRunsForTarget({ targetType: "conversation", targetId: firstTurn.conversation.id });
      const secondWorkflow = workflowRuns[workflowRuns.length - 1];
      const firstNodeSummary = workflowNodeSummaries(secondWorkflow)[0].summary;

      expect(secondTurn.conversation.id).toBe(firstTurn.conversation.id);
      expect(historySnapshots).toHaveLength(1);
      expect(historySnapshots[0]).toEqual([
        expect.stringContaining("user: What does the corpus say about three brass lamps?"),
        expect.stringContaining("assistant:"),
        expect.stringContaining("user: Tell me more about their chalk mark."),
      ]);
      expect(secondTurn.noEvidence).toBe(false);
      expect(jsonRecord(firstNodeSummary)).toMatchObject({
        conversationHistory: {
          messageCount: 3,
          roles: ["user", "assistant", "user"],
        },
      });
    } finally {
      closeDatabase(db);
    }
  });

  it("keeps the disabled direct path free of chat agent workflow traces", async () => {
    process.env.IKIS_CHAT_AGENT_ENABLED = "false";
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = await answerGroundedQuestion(db, {
        corpusId,
        question: "What does the corpus say about three brass lamps?",
        answerProvider: createExtractiveGroundedAnswerProvider(),
      });
      const workflowRuns = createConversationRepository(db).listWorkflowRunsForTarget({ targetType: "conversation", targetId: turn.conversation.id });

      expect(turn.noEvidence).toBe(false);
      expect(turn.assistantMessage.content).toContain("[1]");
      expect(workflowRuns).toEqual([]);
    } finally {
      closeDatabase(db);
    }
  });

  it("persists graph no-evidence turns without citations", async () => {
    process.env.IKIS_CHAT_AGENT_ENABLED = "true";
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = await answerGroundedQuestion(db, { corpusId, question: "Which submarine treaty governs astral dragons?" });
      const workflowRun = getSingleWorkflowRun(db, turn.conversation.id);

      expect(turn.noEvidence).toBe(true);
      expect(turn.assistantMessage.content).toBe(insufficientEvidenceAnswer);
      expect(turn.retrievalRun.noEvidence).toBe(true);
      expect(turn.citations).toEqual([]);
      expect(turn.sourcePreviews).toEqual([]);
      expect(workflowRun.outputRefs).toMatchObject({ noEvidence: true, citationIds: [] });
      expect(jsonRecord(workflowNodeSummaries(workflowRun)[1].summary)).toMatchObject({
        finalContextCount: 0,
        noEvidenceReason: "The corpus does not contain enough evidence for this query.",
      });
    } finally {
      closeDatabase(db);
    }
  });

  it("records a safe failed node when the provider throws after evidence retrieval", async () => {
    process.env.IKIS_CHAT_AGENT_ENABLED = "true";
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const question = "What does the corpus say about three brass lamps and the chalk mark?";
      await expect(answerGroundedQuestion(db, {
        corpusId,
        question,
        answerProvider: async () => {
          throw new Error("provider exploded after retrieval");
        },
      })).rejects.toThrow("provider exploded after retrieval");

      const conversationRepo = createConversationRepository(db);
      const userMessages = db.prepare("SELECT * FROM messages WHERE role = 'user'").all() as { id: string; conversation_id: string; content: string }[];
      const assistantMessages = db.prepare("SELECT * FROM messages WHERE role = 'assistant'").all() as { id: string }[];
      const retrievalRuns = db.prepare("SELECT * FROM retrieval_runs").all() as { id: string }[];
      const citations = db.prepare("SELECT * FROM citations").all() as { id: string }[];

      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe(question);
      expect(assistantMessages).toEqual([]);
      expect(retrievalRuns).toEqual([]);
      expect(citations).toEqual([]);

      const workflowRun = getSingleWorkflowRun(db, userMessages[0].conversation_id);
      const outputRefs = jsonRecord(workflowRun.outputRefs);
      const inputRefsText = JSON.stringify(workflowRun.inputRefs);
      const outputRefsText = JSON.stringify(workflowRun.outputRefs);
      const nodeSummaries = workflowNodeSummaries(workflowRun);

      expect(conversationRepo.listMessages(userMessages[0].conversation_id).map((message) => message.role)).toEqual(["user"]);
      expect(workflowRun.workflowKind).toBe("chat_agent_turn");
      expect(workflowRun.status).toBe("failed");
      expect(workflowRun.error).toContain("provider exploded after retrieval");
      expect(workflowRun.inputRefs).toMatchObject({
        corpusId,
        targetType: "conversation",
        targetId: userMessages[0].conversation_id,
        graphName: "local_chat_agent",
        graphVersion: "chat-agent-local-v1",
        questionLength: question.length,
        userMessageId: userMessages[0].id,
      });
      expect(outputRefs).toMatchObject({
        conversationId: userMessages[0].conversation_id,
        userMessageId: userMessages[0].id,
        status: "failed",
        failedNode: "synthesize_answer",
      });
      expect(nodeSummaries.map((nodeSummary) => ({ node: nodeSummary.node, status: nodeSummary.status }))).toEqual([
        { node: "receive_user_message", status: "succeeded" },
        { node: "retrieve_evidence", status: "succeeded" },
        { node: "synthesize_answer", status: "failed" },
      ]);
      expect(jsonRecord(nodeSummaries[1].summary)).toMatchObject({
        retrievalMode: "lexical-fts-context-v1",
        finalContextCount: expect.any(Number),
      });
      expect(inputRefsText).not.toContain(question);
      expect(outputRefsText).not.toContain(question);
      expect(outputRefsText).not.toContain("three brass lamps");
      expect(outputRefsText).not.toContain("chalk mark");
      expect(outputRefsText).not.toContain("A brass lamp");
      expect(outputRefsText).not.toContain("Text:");
      assertWorkflowBoundaryRefs(workflowRun.inputRefs);
      assertWorkflowBoundaryRefs(workflowRun.outputRefs);
    } finally {
      closeDatabase(db);
    }
  });

  it("rejects graph provider output with no citations and records validation safely", async () => {
    process.env.IKIS_CHAT_AGENT_ENABLED = "true";
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
      const workflowRun = getSingleWorkflowRun(db, turn.conversation.id);

      expect(turn.noEvidence).toBe(true);
      expect(turn.assistantMessage.content).toBe(insufficientEvidenceAnswer);
      expect(turn.citations).toEqual([]);
      expect(turn.retrievalRun.modelInputs).toMatchObject({ validation: { accepted: false, reason: "answer_missing_citations" } });
      expect(jsonRecord(workflowNodeSummaries(workflowRun)[3].summary)).toMatchObject({
        accepted: false,
        noEvidence: true,
        reason: "answer_missing_citations",
        citedOrdinals: [],
      });
    } finally {
      closeDatabase(db);
    }
  });

  it("rejects graph provider citations that reference unknown evidence ordinals", async () => {
    process.env.IKIS_CHAT_AGENT_ENABLED = "true";
    const corpusId = await seedApprovedMarkdown();
    const db = openTestDatabase();

    try {
      const turn = await answerGroundedQuestion(db, {
        corpusId,
        question: "What does the corpus say about three brass lamps?",
        answerProvider: async () => ({
          answer: "The corpus mentions lamps [99].",
          citedOrdinals: [99],
          model: "bad-ordinal-test-provider",
          promptVersion: groundedAnswerPromptVersion,
        }),
      });
      const workflowRun = getSingleWorkflowRun(db, turn.conversation.id);

      expect(turn.noEvidence).toBe(true);
      expect(turn.assistantMessage.content).toBe(insufficientEvidenceAnswer);
      expect(turn.citations).toEqual([]);
      expect(turn.retrievalRun.modelInputs).toMatchObject({ validation: { accepted: false, reason: "answer_cited_unknown_ordinal_99" } });
      expect(jsonRecord(workflowNodeSummaries(workflowRun)[3].summary)).toMatchObject({
        accepted: false,
        noEvidence: true,
        reason: "answer_cited_unknown_ordinal_99",
        citedOrdinals: [],
      });
    } finally {
      closeDatabase(db);
    }
  });
});
