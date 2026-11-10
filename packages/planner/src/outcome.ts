// FR-006: the outcome of one executed command, read from its events.
import type { EngineEvent } from "@the-stacks/dnd5e-engine";
import type { StepOutcome } from "./types.js";

export function stepOutcome(
  events: readonly EngineEvent[],
): StepOutcome | null {
  for (const e of events) if (e.type === "attack.resolved") return e.outcome;
  for (const e of events) {
    if (e.type === "check.resolved") return e.band ?? e.outcome;
  }
  return null;
}
