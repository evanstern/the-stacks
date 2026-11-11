import type { EngineEvent } from "@the-stacks/dnd5e-engine";
import type { GateRefusal } from "./refusals.js";

export interface PlannedRow {
  actor: string;
  /** A catalog type. */
  type: string;
  /** A valid payload for that type at its current version. */
  payload: unknown;
  visibility: string;
}

export interface PlanIds {
  batchId: string;
}

export type PlanResult =
  | { ok: true; rows: PlannedRow[]; batchId: string | null }
  | { ok: false; refusal: GateRefusal };

/** Wraps one engine result in mechanics envelopes (one batch). */
export function mechanicsRows(input: {
  actor: string;
  batchId: string;
  events: readonly EngineEvent[];
  actionId: string | null;
  proposalId: string | null;
  visibility: string;
}): PlannedRow[] {
  return input.events.map((event, index) => ({
    actor: input.actor,
    type: event.type,
    visibility: input.visibility,
    payload: {
      batchId: input.batchId,
      index,
      count: input.events.length,
      actionId: input.actionId,
      proposalId: input.proposalId,
      event,
    },
  }));
}

export function refuse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): PlanResult {
  return {
    ok: false,
    refusal: {
      source: "gate",
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}
