import type { DirectorNodeOutput } from "../nodes/director.js";
import type { Effect, InterpretReading, Step } from "../nodes/schemas.js";
import type { SceneSeed } from "../seed/schema.js";
import type { ActorSnapshot } from "../snapshot/index.js";

/**
 * The plan gate (specs/046-downed-hero-gate plan D3, decision-0025 §3.2).
 * Pure: it checks every actor and target id a plan names against the S0
 * actors' `combatantId`s, before any step of the group runs. It never maps an
 * alias: an alias only tells the verdict which reason to give.
 */

export type PlanFailureReason =
  | "not-a-combatant"
  | "not-in-snapshot"
  | "absent";

export interface PlanFailure {
  stepIndex: number;
  /** The step field that named the id, e.g. `targetId` or `onHit[0].targetId`. */
  field: string;
  id: string;
  reason: PlanFailureReason;
}

export type PlanVerdict =
  | { actionId: string | null; ok: true }
  | {
      actionId: string | null;
      ok: false;
      code: "UNKNOWN_COMBATANT";
      failure: PlanFailure;
    };

export interface PlanInput {
  /** S0. */
  snapshot: ActorSnapshot;
  readings: readonly InterpretReading[];
  rulings: readonly { actionId: string | null; steps: readonly Step[] }[];
  /** The combatant ids this turn's Director opening moves add. */
  joining: readonly string[];
}

type EncounterSeed = SceneSeed["encounters"][number];

/**
 * The seed encounter the Director opening starts: a `turn` decision on a job
 * that is not a scene start. One definition, shared by `directorOpening` and
 * the plan gate.
 */
export function encounterToStart(
  seed: SceneSeed,
  director: Pick<DirectorNodeOutput, "tableMode">,
  trigger: string,
): EncounterSeed | undefined {
  if (trigger === "scene-start") return undefined;
  const tm = director.tableMode;
  if (tm.to !== "turn") return undefined;
  return seed.encounters.find((e) => e.id === tm.encounterId);
}

/** The ids an encounter start adds to the engine: its monsters not yet there. */
export function joiningCombatants(
  enc: EncounterSeed | undefined,
  existing: Readonly<Record<string, unknown>>,
): string[] {
  if (!enc) return [];
  return enc.monsters
    .map((m) => m.combatantId)
    .filter((id) => !(id in existing));
}

interface NamedId {
  field: string;
  id: string;
  /** Set on a presence effect's target: the effect's reason. */
  presenceReason?: string;
}

/**
 * A presence effect (specs/048-scene-presence plan D5). Phase 4 adds it to
 * `EffectSchema`; until then this guard reads the discriminant alone.
 */
function presenceReasonOf(e: Effect): string | null {
  const x = e as { effect: string; reason?: unknown };
  return x.effect === "presence" && typeof x.reason === "string"
    ? x.reason
    : null;
}

function effectIds(effects: readonly Effect[], list: string): NamedId[] {
  return effects.map((e, j) => {
    const presenceReason = presenceReasonOf(e);
    return {
      field: `${list}[${j}].targetId`,
      id: e.targetId,
      ...(presenceReason !== null ? { presenceReason } : {}),
    };
  });
}

/** Every id a step names, in the order the step runs them. */
function stepIds(step: Step): NamedId[] {
  switch (step.step) {
    case "none":
    case "roll":
      return [];
    case "effect":
      return effectIds(step.effects, "effects");
    case "check":
      return [
        ...(step.combatantId
          ? [{ field: "combatantId", id: step.combatantId }]
          : []),
        ...effectIds(step.onSuccess, "onSuccess"),
        ...effectIds(step.onFailure, "onFailure"),
      ];
    case "attack":
      return [
        ...(step.attackerId
          ? [{ field: "attackerId", id: step.attackerId }]
          : []),
        { field: "targetId", id: step.targetId },
        ...effectIds(step.onHit, "onHit"),
      ];
  }
}

export function checkPlan(input: PlanInput): PlanVerdict[] {
  const { snapshot } = input;
  const valid = new Set<string>(input.joining);
  const noCombatant = new Set<string>();
  const actorIds = new Set<string>(input.joining);
  const absentIds = new Set<string>();
  for (const a of snapshot.actors) {
    actorIds.add(a.id);
    if (a.presence === "absent") {
      absentIds.add(a.id);
      if (a.combatantId) absentIds.add(a.combatantId);
    }
    if (a.combatantId) valid.add(a.combatantId);
    else {
      noCombatant.add(a.id);
      for (const alias of a.aliases) noCombatant.add(alias);
    }
  }

  const groups = new Map<string | null, readonly Step[]>();
  for (const r of input.readings) {
    // A clarify reading runs no step: nothing to gate.
    groups.set(r.actionId, r.clarify !== null ? [] : r.steps);
  }
  for (const r of input.rulings) groups.set(r.actionId, r.steps);

  const verdicts: PlanVerdict[] = [];
  for (const [actionId, steps] of groups) {
    let failure: PlanFailure | null = null;
    for (const [stepIndex, step] of steps.entries()) {
      for (const { field, id, presenceReason } of stepIds(step)) {
        if (presenceReason !== undefined) {
          // A presence effect targets any S0 actor, combatant or not.
          const reason: PlanFailureReason | null = !actorIds.has(id)
            ? "not-in-snapshot"
            : absentIds.has(id) && presenceReason !== "arrived"
              ? "absent"
              : null;
          if (reason === null) continue;
          failure = { stepIndex, field, id, reason };
          break;
        }
        if (!valid.has(id)) {
          failure = {
            stepIndex,
            field,
            id,
            reason: noCombatant.has(id) ? "not-a-combatant" : "not-in-snapshot",
          };
          break;
        }
        if (absentIds.has(id)) {
          failure = { stepIndex, field, id, reason: "absent" };
          break;
        }
      }
      if (failure) break;
    }
    verdicts.push(
      failure
        ? { actionId, ok: false, code: "UNKNOWN_COMBATANT", failure }
        : { actionId, ok: true },
    );
  }
  return verdicts;
}
