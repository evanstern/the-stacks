import type { StoredEvent } from "@the-stacks/session-model";

/**
 * Type-only mirrors of the operator debug API
 * (specs/037-debug-api/contracts/debug-api.md). The web app cannot import
 * apps/server, so the wire shapes are copied by hand.
 */

export type DebugJobKind = "turn" | "companion" | "chronicle";
export type DebugJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface DebugJob {
  id: string;
  kind: DebugJobKind;
  status: DebugJobStatus;
  stage: string | null;
  attempts: number;
  /** TurnJobInput | CompanionJobInput | ChronicleJobInput, as stored. */
  input: unknown;
  /** As stored; `null` while queued. Narrow with the readers in read-result.ts. */
  result: unknown;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
}

export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unpricedCalls: number;
  durationMs: number;
}

export interface CallTotals {
  all: UsageTotals;
  byPurpose: Record<string, UsageTotals>;
  byModel: Record<string, UsageTotals>;
}

export interface DebugCall {
  id: number;
  jobId: string;
  jobKind: DebugJobKind;
  jobAttempt: number;
  purpose: string;
  promptVersion: string;
  callAttempt: number;
  outcome: "ok" | "invalid-json" | "error" | "aborted";
  errorKind: string | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  httpAttempts: number | null;
  at: string;
}

export interface EventsPage {
  events: StoredEvent[];
  nextAfter: number;
  hasMore: boolean;
  headSeq: number;
}

export interface JobsPage {
  jobs: DebugJob[];
  nextBefore: string | null;
}

export interface CallsPage {
  calls: DebugCall[];
  nextAfter: number;
  hasMore: boolean;
  totals: CallTotals;
}

export type SeedResult =
  | { kind: "ok"; seedId: string; seed: unknown; dmOnlyPaths: string[] }
  | { kind: "none" }
  | { kind: "failed" };

export type DebugError =
  | { kind: "auth"; status: 401 | 403 }
  | { kind: "http"; status: number; message?: string }
  | { kind: "network" };
