import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCorpusRepository } from "../../app/lib/corpus/repository.js";
import { closeDatabase, openDatabase, type Database } from "../../app/lib/db/connection.js";
import { runMigrations } from "../../app/lib/db/migrations.js";
import { createConversationRepository } from "../../app/lib/conversations/repository.js";
import { normalizeImportForReview, recordHumanReviewDecision } from "../../app/lib/review/queue.server.js";
import { createReviewRepository } from "../../app/lib/review/repository.js";
import { assertWorkflowBoundaryRefs } from "../../app/lib/workflows/boundary.js";

let tempDir: string;
let previousDbPath: string | undefined;
let previousLangGraphEnabled: string | undefined;

function openTestDatabase(): Database {
  const db = openDatabase(process.env.THE_STACKS_DB_PATH);
  runMigrations(db);
  return db;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "the-stacks-workflow-"));
  previousDbPath = process.env.THE_STACKS_DB_PATH;
  previousLangGraphEnabled = process.env.LANGGRAPH_ENABLED;
  process.env.THE_STACKS_DB_PATH = join(tempDir, "workflow.sqlite");
});

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.THE_STACKS_DB_PATH;
  } else {
    process.env.THE_STACKS_DB_PATH = previousDbPath;
  }

  if (previousLangGraphEnabled === undefined) {
    delete process.env.LANGGRAPH_ENABLED;
  } else {
    process.env.LANGGRAPH_ENABLED = previousLangGraphEnabled;
  }

  rmSync(tempDir, { recursive: true, force: true });
});

function seedWorkflowImport(filename = "workflow-source.md"): { importJobId: string; corpusId: string } {
  const sourcePath = join(tempDir, filename);
  writeFileSync(sourcePath, "# Workflow Source\n\nThis summary-only fixture is safe for workflow orchestration.");

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
      sizeBytes: 76,
      parserAdapter: "markdown",
      parserVersion: "1.0.0",
      importStatus: "queued",
      storageUri: `file://${sourcePath}`,
    });
    const importJob = corpusRepo.createImportJob({ corpusId: corpus.id, sourceId: source.id, status: "queued", adapter: "markdown", adapterVersion: "1.0.0" });

    return { importJobId: importJob.id, corpusId: corpus.id };
  } finally {
    closeDatabase(db);
  }
}

describe("LangGraph workflow boundary", () => {
  it("records a review suggestion workflow run with IDs and summary-only refs", async () => {
    const { importJobId, corpusId } = seedWorkflowImport();

    const result = await normalizeImportForReview(importJobId, { useWorkflow: true });

    expect(result.importJob.status).toBe("review_needed");
    expect(result.reviewItemIds).toHaveLength(1);
    expect(result.suggestionErrors).toEqual([]);

    const db = openTestDatabase();
    try {
      const reviewRepo = createReviewRepository(db);
      const workflowRepo = createConversationRepository(db);
      const reviewItem = reviewRepo.getReviewItem(result.reviewItemIds[0]);
      expect(reviewItem).not.toBeNull();

      const [workflowRun] = workflowRepo.listWorkflowRunsForTarget({ targetType: "review_item", targetId: result.reviewItemIds[0] });
      expect(workflowRun.workflowKind).toBe("review_suggestion");
      expect(workflowRun.threadId).toMatch(/^lg-review_suggestion-/);
      expect(workflowRun.status).toBe("succeeded");
      expect(workflowRun.corpusId).toBe(corpusId);
      expect(workflowRun.inputRefs).toMatchObject({ corpusId, targetType: "document", targetId: reviewItem?.targetId });
      expect(JSON.stringify(workflowRun.inputRefs)).not.toContain("normalizedText");
      expect(JSON.stringify(workflowRun.inputRefs)).not.toContain("This summary-only fixture is safe for workflow orchestration.");
      expect(workflowRun.outputRefs).toMatchObject({ reviewItemId: result.reviewItemIds[0], status: "succeeded" });

      const queueItem = reviewRepo.listPendingQueue(corpusId)[0];
      expect(queueItem.latestSuggestion?.model).toBe("fake-langgraph-review-v1");

      const decision = recordHumanReviewDecision({ reviewItemId: queueItem.id, decisionState: "approved", actor: "workflow-test-human" });
      expect(decision.reviewItemId).toBe(queueItem.id);
      expect(reviewRepo.getReviewItem(queueItem.id)?.status).toBe("approved");
    } finally {
      closeDatabase(db);
    }
  });

  it("uses the deterministic fake workflow provider when LangGraph is disabled", async () => {
    process.env.LANGGRAPH_ENABLED = "false";
    const { importJobId, corpusId } = seedWorkflowImport("disabled-langgraph.md");

    const result = await normalizeImportForReview(importJobId);

    expect(result.importJob.status).toBe("review_needed");
    expect(result.suggestionErrors).toEqual([]);

    const db = openTestDatabase();
    try {
      const reviewRepo = createReviewRepository(db);
      const workflowRepo = createConversationRepository(db);
      const queueItem = reviewRepo.listPendingQueue(corpusId)[0];
      const [workflowRun] = workflowRepo.listWorkflowRunsForTarget({ targetType: "review_item", targetId: queueItem.id });

      expect(queueItem.latestSuggestion?.promptVersion).toBe("review-workflow-boundary-v1");
      expect(workflowRun.status).toBe("succeeded");
      expect(workflowRun.threadId).toMatch(/^lg-review_suggestion-/);
    } finally {
      closeDatabase(db);
    }
  });

  it("rejects workflow refs that try to carry canonical corpus text", () => {
    expect(() => assertWorkflowBoundaryRefs({ reviewItemId: "review_item_1", normalizedText: "full corpus body" })).toThrow(
      /pass IDs or summaries/,
    );
  });
});
