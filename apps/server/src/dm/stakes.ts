import type { OutcomeBand } from "@the-stacks/dnd5e-engine";
import type { LedgerRow } from "@the-stacks/session-model";
import type { Effect, Stakes, Step } from "./nodes/schemas.js";
import type { SceneSeed } from "./seed/schema.js";

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

/** Spec 080 D3: the declared text for the applied band, success included; null when none. */
export function consequenceFor(
  stakes: Stakes | null | undefined,
  band: OutcomeBand | string | null,
): string | null {
  if (!stakes) return null;
  switch (band) {
    case "success":
      return stakes.success ?? null; // null on a checkpoint saved under spec 070
    case "success-at-cost":
      return stakes.cost;
    case "failure":
      return stakes.failure;
    case "severe-failure":
      return stakes.severe ?? stakes.failure;
    default:
      return null;
  }
}

/** Spec 080 D3: the text of clue `<beatId>#<n>`, or null for a null, malformed or unknown reference. */
export function clueFor(seed: SceneSeed, ref: string | null): string | null {
  const m = ref ? /^(.+)#([1-8])$/.exec(ref) : null;
  if (!m) return null;
  const beat = seed.beats.find((b) => b.id === m[1]);
  return beat?.clues[Number(m[2]) - 1]?.text ?? null;
}
