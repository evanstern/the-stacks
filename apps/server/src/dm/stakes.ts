import type { OutcomeBand } from "@the-stacks/dnd5e-engine";
import type { LedgerRow } from "@the-stacks/session-model";
import type { Effect, Stakes, Step } from "./nodes/schemas.js";

type CheckStep = Extract<Step, { step: "check" }>;

/** FR-013: the ordered effect list for the band. An unknown band reads as a plain failure. */
export function effectsForBand(
  step: Pick<CheckStep, "onSuccess" | "onFailure" | "onCost" | "onSevere">,
  band: OutcomeBand | string | null,
): Effect[] {
  switch (band) {
    case "success":
      return [...step.onSuccess];
    case "success-at-cost":
      return [...step.onSuccess, ...step.onCost];
    case "severe-failure":
      return [...step.onFailure, ...step.onSevere];
    default:
      return [...step.onFailure];
  }
}

/**
 * FR-014: an ability check is a free retry when the current scene's ledger
 * holds a failed ability check with the same combatant, ability and skill and
 * the step adds no new risk and no auto-fail. A saving throw never is.
 */
export function isFreeRetry(
  step: Pick<
    CheckStep,
    "kind" | "combatantId" | "ability" | "skill" | "newRisk" | "autoFail"
  >,
  ledger: readonly LedgerRow[],
): boolean {
  if (
    step.kind !== "ability-check" ||
    step.combatantId === null ||
    step.newRisk !== null ||
    step.autoFail !== null
  ) {
    return false;
  }
  let from = 0;
  ledger.forEach((r, i) => {
    if (r.kind === "change" && r.type === "scene.changed") from = i + 1;
  });
  return ledger.slice(from).some((r) => {
    if (r.kind !== "outcome") return false;
    const o = r.outcome;
    return (
      o.type === "check.resolved" &&
      o.kind === "ability-check" &&
      o.outcome === "failure" &&
      o.combatantId === step.combatantId &&
      o.ability === step.ability &&
      o.skill === step.skill
    );
  });
}

/** The declared text for a non-success band, else null. */
export function consequenceFor(
  stakes: Stakes | null | undefined,
  band: OutcomeBand | string | null,
): string | null {
  if (!stakes) return null;
  switch (band) {
    case "success-at-cost":
      return stakes.cost;
    case "failure":
      return stakes.failure;
    case "severe-failure":
      return stakes.severe;
    default:
      return null;
  }
}
