import { createHash } from "node:crypto";

/** Small fixed synthetic text shipped as a repo fixture (Principle I) — the
 * skeleton check never downloads or embeds operator/game content. */
export const SKELETON_CHECK_INPUT_TEXT =
  "the Stacks v3 walking skeleton: a fixed sentence crossing every seam.";

export const SEAMS = [
  "queued",
  "claimed",
  "inference",
  "vector_write",
  "vector_readback",
  "completed",
] as const;

export type Seam = (typeof SEAMS)[number];

export type SkeletonCheckStatus = "accepted" | "running" | "succeeded" | "failed";

export interface SkeletonCheckOutcome {
  class: "dependency_down" | "internal_fault";
  seam: Seam;
  message: string;
}

export interface DeriveVectorIdInput {
  inputText: string;
  provider: string;
  model: string;
  dimensions: number;
}

/**
 * Deterministic vector identity (FR-012): identical input+config always
 * derives the same id, making re-runs idempotent (data-model.md).
 */
export function deriveVectorId(input: DeriveVectorIdInput): string {
  const material = `${input.inputText}\n${input.provider}/${input.model}/${input.dimensions}`;
  return createHash("sha256").update(material).digest("hex");
}
