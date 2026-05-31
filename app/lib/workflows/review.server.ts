import { createHash } from "node:crypto";

import type { Database } from "~/lib/db/connection";
import type { JsonValue } from "~/lib/db/rows";
import { createConversationRepository, type WorkflowRun } from "~/lib/conversations/repository";
import { createReviewRepository, type ReviewItem, type ReviewSuggestion } from "~/lib/review/repository";
import {
  assertWorkflowBoundaryRefs,
  createDeterministicThreadId,
  type WorkflowBoundaryInputRef,
  type WorkflowBoundaryOutputRef,
} from "~/lib/workflows/boundary";

export type ReviewWorkflowSuggestion = {
  suggestionState: ReviewSuggestion["suggestionState"];
  rationale: string;
  model: string;
  promptVersion: string;
  confidence: number | null;
  metadata: JsonValue;
};

export type ReviewWorkflowProviderInput = {
  threadId: string;
  reviewItemId: string;
  corpusId: string;
  targetType: ReviewItem["targetType"];
  targetId: string;
  title: string;
  summary: string | null;
  metadataRefs: JsonValue;
};

export type ReviewWorkflowProvider = {
  name: string;
  suggest(input: ReviewWorkflowProviderInput): Promise<ReviewWorkflowSuggestion>;
};

export type ReviewWorkflowResult = {
  workflowRun: WorkflowRun;
  suggestion: ReviewSuggestion;
};

function deterministicState(summary: string | null): ReviewSuggestion["suggestionState"] {
  const normalized = (summary ?? "").toLowerCase();

  if (normalized.includes("reject")) {
    return "suggested_reject";
  }

  if (normalized.includes("defer")) {
    return "suggested_defer";
  }

  return "suggested_approve";
}

function summaryRef(summary: string | null): JsonValue {
  if (!summary) {
    return { present: false };
  }

  return {
    present: true,
    length: summary.length,
    sha256: createHash("sha256").update(summary).digest("hex"),
  };
}

export function createFakeReviewWorkflowProvider(): ReviewWorkflowProvider {
  return {
    name: "fake-langgraph-review-v1",
    async suggest(input) {
      const suggestionState = deterministicState(input.summary);
      return {
        suggestionState,
        rationale: `Deterministic workflow suggestion for ${input.reviewItemId} using summary-only boundary input.`,
        model: "fake-langgraph-review-v1",
        promptVersion: "review-workflow-boundary-v1",
        confidence: 0.5,
        metadata: {
          provider: this.name,
          threadId: input.threadId,
          boundary: "ids-and-summary-only",
        },
      };
    },
  };
}

export function shouldUseFakeWorkflowProvider(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LANGGRAPH_ENABLED === "false" || env.IKIS_LANGGRAPH_PROVIDER === "fake";
}

export function createReviewWorkflowProvider(env: NodeJS.ProcessEnv = process.env): ReviewWorkflowProvider {
  if (shouldUseFakeWorkflowProvider(env)) {
    return createFakeReviewWorkflowProvider();
  }

  return createFakeReviewWorkflowProvider();
}

function inputRefsForReviewItem(reviewItem: ReviewItem): WorkflowBoundaryInputRef {
  return {
    corpusId: reviewItem.corpusId,
    targetType: reviewItem.targetType,
    targetId: reviewItem.targetId,
    title: reviewItem.title,
    metadataRefs: {
      reviewItemMetadata: reviewItem.metadata,
      summary: summaryRef(reviewItem.summary),
    },
  };
}

export async function runReviewSuggestionWorkflow(
  db: Database,
  input: { reviewItemId: string; provider?: ReviewWorkflowProvider },
): Promise<ReviewWorkflowResult> {
  const reviewRepo = createReviewRepository(db);
  const workflowRepo = createConversationRepository(db);
  const reviewItem = reviewRepo.getReviewItem(input.reviewItemId);

  if (!reviewItem) {
    throw new Error(`Review item ${input.reviewItemId} was not found.`);
  }

  const provider = input.provider ?? createReviewWorkflowProvider();
  const workflowKind = "review_suggestion";
  const threadId = createDeterministicThreadId({ workflowKind, targetType: reviewItem.targetType, targetId: reviewItem.id });
  const inputRefs = inputRefsForReviewItem(reviewItem);
  assertWorkflowBoundaryRefs(inputRefs as JsonValue);

  const started = workflowRepo.createWorkflowRun({
    corpusId: reviewItem.corpusId,
    workflowKind,
    threadId,
    status: "running",
    targetType: "review_item",
    targetId: reviewItem.id,
    inputRefs: inputRefs as JsonValue,
    startedAt: new Date().toISOString(),
  });

  try {
    const suggestionDraft = await provider.suggest({
      threadId,
      reviewItemId: reviewItem.id,
      corpusId: reviewItem.corpusId,
      targetType: reviewItem.targetType,
      targetId: reviewItem.targetId,
      title: reviewItem.title,
      summary: reviewItem.summary,
      metadataRefs: reviewItem.metadata,
    });
    const suggestion = reviewRepo.createSuggestion({
      reviewItemId: reviewItem.id,
      suggestionState: suggestionDraft.suggestionState,
      rationale: suggestionDraft.rationale,
      model: suggestionDraft.model,
      promptVersion: suggestionDraft.promptVersion,
      confidence: suggestionDraft.confidence,
      metadata: suggestionDraft.metadata,
    });
    const outputRefs: WorkflowBoundaryOutputRef = { reviewItemId: reviewItem.id, suggestionId: suggestion.id, status: "succeeded" };
    assertWorkflowBoundaryRefs(outputRefs as JsonValue);
    const workflowRun = workflowRepo.updateWorkflowRun({
      id: started.id,
      status: "succeeded",
      outputRefs: outputRefs as JsonValue,
      finishedAt: new Date().toISOString(),
    });

    return { workflowRun, suggestion };
  } catch (error) {
    workflowRepo.updateWorkflowRun({
      id: started.id,
      status: "failed",
      error: error instanceof Error ? error.message : "Review workflow failed.",
      finishedAt: new Date().toISOString(),
    });
    throw error;
  }
}
