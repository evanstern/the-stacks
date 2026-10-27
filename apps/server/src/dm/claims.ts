/**
 * The output claim gate (specs/051-output-claim-gate/contracts/claim-gate.md,
 * decision-0025 section 3.4). This file is the typed seam only: Phase 2
 * implements `checkClaims`. Until then it passes every text.
 */
import type { ActorSnapshot, SnapshotDiff } from "./snapshot/types.js";

/** The state a claim is checked against. `diff` is null with no prior state. */
export interface ClaimState {
  snapshot: ActorSnapshot;
  diff: SnapshotDiff | null;
}

export type ClaimKind =
  | "act"
  | "speech"
  | "death"
  | "down"
  | "omission"
  | "count";

export interface ClaimIssue {
  claim: ClaimKind;
  /** The referenced actors; empty for an unattributed claim. */
  actorIds: string[];
  /** The matched text, at most 60 characters. */
  matched: string;
  /** One sentence naming the actor, its state and the matched text. */
  detail: string;
}

export interface ClaimResult {
  pass: boolean;
  issues: ClaimIssue[];
}

export function checkClaims(_state: ClaimState, _text: string): ClaimResult {
  return { pass: true, issues: [] };
}
