import { createHash } from "node:crypto";

import type { JsonValue } from "~/lib/db/rows";

export type WorkflowRunStatus = "running" | "succeeded" | "failed";

export type WorkflowBoundaryInputRef = {
  corpusId: string;
  targetType: string;
  targetId: string;
  title?: string;
  summary?: string | null;
  metadataRefs?: JsonValue;
};

export type WorkflowBoundaryOutputRef = {
  reviewItemId?: string;
  suggestionId?: string;
  conversationId?: string;
  messageId?: string;
  status: WorkflowRunStatus;
};

const forbiddenBoundaryKeys = new Set(["normalizedText", "text", "content", "documents", "chunks", "corpus"]);

function assertJsonBoundary(value: JsonValue, path: string): void {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      assertJsonBoundary(entry, `${path}[${index}]`);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (forbiddenBoundaryKeys.has(key)) {
      throw new Error(`Workflow boundary payload cannot include ${path}.${key}; pass IDs or summaries instead.`);
    }

    assertJsonBoundary(nestedValue, `${path}.${key}`);
  }
}

export function assertWorkflowBoundaryRefs(refs: JsonValue): void {
  assertJsonBoundary(refs, "workflowRefs");
}

export function createDeterministicThreadId(input: { workflowKind: string; targetType: string; targetId: string }): string {
  const digest = createHash("sha256").update(`${input.workflowKind}:${input.targetType}:${input.targetId}`).digest("hex").slice(0, 16);
  return `lg-${input.workflowKind}-${digest}`;
}
