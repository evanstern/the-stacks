import type { RefusalCode } from "@the-stacks/dnd5e-engine";
import {
  REASON_TO_PRESENCE,
  type ScenePresence,
  type SessionProjections,
} from "@the-stacks/session-model";
import { type ClaimIssue, checkClaims } from "../claims.js";
import type { DirectorNodeOutput } from "../nodes/director.js";
import type { Effect, InterpretReading, Step } from "../nodes/schemas.js";
import type { SceneSeed } from "../seed/schema.js";
import type {
  ActorChange,
  ActorSnapshot,
  SnapshotDiff,
} from "../snapshot/index.js";

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

/**
 * The refusal code of a reason-refused group (spec 058, OQ-2 (a)). The engine
 * enum carries it; `satisfies` ties the literal to that enum.
 */
export const REASON_REFUSAL_CODE =
  "REASON_CONTRADICTS_STATE" as const satisfies RefusalCode;
export type ReasonRefusalCode = typeof REASON_REFUSAL_CODE;

/** A model text (step reason or condition source) the claim gate refused. */
export interface ReasonFailure {
  stepIndex: number;
  /** `reason`, `autoFail.reason`, or a condition `source` path such as `onHit[0].source`. */
  field: string;
  /** The refused model text, as written. */
  text: string;
  issues: ClaimIssue[];
}

export type PlanVerdict =
  | { actionId: string | null; ok: true; pull?: string[] }
  | {
      actionId: string | null;
      ok: false;
      code: "UNKNOWN_COMBATANT";
      failure: PlanFailure;
    }
  | {
      actionId: string | null;
      ok: false;
      code: ReasonRefusalCode;
      failure: ReasonFailure;
    };

export interface PlanInput {
  /** S0. */
  snapshot: ActorSnapshot;
  readings: readonly InterpretReading[];
  rulings: readonly { actionId: string | null; steps: readonly Step[] }[];
  /** The combatant ids this turn's Director opening moves add. */
  joining: readonly string[];
  /** Seed NPC ids the encounter start marks `arrived` (spec 058) and the Director's legal arrivals (spec 078). An arriving id is not absent. */
  arriving: readonly string[];
  /** Action ids with a resumed plan (spec 057): they skip the reason check. */
  resumed: readonly string[];
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

/**
 * The seed NPC ids an encounter start marks `arrived`: the encounter beat
 * declares them `present` and the logged presence is not `present`. Mirrors
 * the encounter-start branch of `seedPresence` (nodes/resolve.ts).
 */
export function arrivingNpcs(
  seed: SceneSeed,
  enc: EncounterSeed | undefined,
  scenePresence: SessionProjections["scenePresence"],
): string[] {
  if (!enc) return [];
  const beat = seed.beats.find((b) => b.encounterId === enc.id);
  if (!beat) return [];
  const out: string[] = [];
  for (const npc of seed.npcs) {
    if (beat.presence[npc.id] !== "present") continue;
    const logged = scenePresence[npc.id]?.presence ?? "present";
    if (logged !== REASON_TO_PRESENCE.arrived) out.push(npc.id);
  }
  return out;
}

interface NamedId {
  field: string;
  id: string;
  /** Set on a presence effect's target: the effect's reason. */
  presenceReason?: string;
}

function effectIds(effects: readonly Effect[], list: string): NamedId[] {
  return effects.map((e, j) => {
    return {
      field: `${list}[${j}].targetId`,
      id: e.targetId,
      ...(e.effect === "presence" ? { presenceReason: e.reason } : {}),
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

interface NamedText {
  field: string;
  text: string;
}

function effectSources(effects: readonly Effect[], list: string): NamedText[] {
  const out: NamedText[] = [];
  for (const [j, e] of effects.entries()) {
    if (e.effect === "condition") {
      out.push({ field: `${list}[${j}].source`, text: e.source });
    }
  }
  return out;
}

/** Every model-written text a step carries, in the order checked. */
function stepTexts(step: Step): NamedText[] {
  switch (step.step) {
    case "none":
    case "roll":
      return [{ field: "reason", text: step.reason }];
    case "effect":
      return [
        { field: "reason", text: step.reason },
        ...effectSources(step.effects, "effects"),
      ];
    case "check":
      return [
        { field: "reason", text: step.reason },
        ...(step.autoFail
          ? [{ field: "autoFail.reason", text: step.autoFail.reason }]
          : []),
        ...effectSources(step.onSuccess, "onSuccess"),
        ...effectSources(step.onFailure, "onFailure"),
      ];
    case "attack":
      return [
        { field: "reason", text: step.reason },
        ...effectSources(step.onHit, "onHit"),
      ];
  }
}

/**
 * The presence-only diff the plan implies (contract rule 5): one change per
 * presence-effect target in any group, and one per arriving NPC. An id with no
 * S0 actor is left out.
 */
function plannedDiff(
  snapshot: ActorSnapshot,
  groups: ReadonlyMap<string | null, readonly Step[]>,
  arriving: readonly string[],
): SnapshotDiff {
  const after = new Map<string, ScenePresence>();
  const addEffects = (effects: readonly Effect[]) => {
    for (const e of effects) {
      if (e.effect === "presence")
        after.set(e.targetId, REASON_TO_PRESENCE[e.reason]);
    }
  };
  for (const steps of groups.values()) {
    for (const step of steps) {
      switch (step.step) {
        case "effect":
          addEffects(step.effects);
          break;
        case "check":
          addEffects(step.onSuccess);
          addEffects(step.onFailure);
          break;
        case "attack":
          addEffects(step.onHit);
          break;
        default:
          break;
      }
    }
  }
  for (const id of arriving) after.set(id, REASON_TO_PRESENCE.arrived);
  const actors: ActorChange[] = [];
  for (const [id, to] of after) {
    const actor = snapshot.actors.find(
      (a) => a.id === id || a.combatantId === id,
    );
    if (!actor) continue;
    actors.push({
      kind: "presence",
      actorId: actor.id,
      before: actor.presence,
      after: to,
    });
  }
  return {
    fromSeq: snapshot.throughSeq,
    toSeq: snapshot.throughSeq,
    stage: [],
    actors,
  };
}

export function checkPlan(input: PlanInput): PlanVerdict[] {
  const { snapshot } = input;
  const valid = new Set<string>(input.joining);
  const noCombatant = new Set<string>();
  // Specs 068 and 075: exact ids of S0 npc actors with no combatant (never aliases).
  // Any non-presence field may name one, attacks and damage included.
  const npcIds = new Set<string>();
  const inOrder = new Set<string>(snapshot.stage.encounter?.order ?? []);
  const actorIds = new Set<string>(input.joining);
  const absentIds = new Set<string>();
  const arrivingIds = new Set<string>(input.arriving);
  for (const a of snapshot.actors) {
    actorIds.add(a.id);
    if (a.presence === "absent" && !arrivingIds.has(a.id)) {
      absentIds.add(a.id);
      if (a.combatantId) absentIds.add(a.combatantId);
    }
    if (a.combatantId) valid.add(a.combatantId);
    else {
      noCombatant.add(a.id);
      if (a.kind === "npc") npcIds.add(a.id);
      for (const alias of a.aliases) noCombatant.add(alias);
    }
  }

  const groups = new Map<string | null, readonly Step[]>();
  for (const r of input.readings) {
    // A clarify reading runs no step: nothing to gate.
    groups.set(r.actionId, r.clarify !== null ? [] : r.steps);
  }
  for (const r of input.rulings) groups.set(r.actionId, r.steps);

  const resumed = new Set(input.resumed);
  const diff = plannedDiff(snapshot, groups, input.arriving);
  const claimState = { snapshot, diff };

  const verdicts: PlanVerdict[] = [];
  for (const [actionId, steps] of groups) {
    let failure: PlanFailure | null = null;
    const pull = new Set<string>();
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
        if (!valid.has(id) && !npcIds.has(id)) {
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
        // Specs 068, 075: a named actor outside the order is pulled in. Free mode
        // pulls only an actor with no combatant (nothing else to do).
        const actor = snapshot.actors.find(
          (a) =>
            a.combatantId === id || (a.combatantId === null && a.id === id),
        );
        if (
          actor &&
          !inOrder.has(actor.id) &&
          !inOrder.has(id) &&
          !input.joining.includes(id) &&
          (snapshot.stage.encounter || actor.combatantId === null)
        ) {
          pull.add(id);
        }
      }
      if (failure) break;
    }
    if (failure) {
      verdicts.push({
        actionId,
        ok: false,
        code: "UNKNOWN_COMBATANT",
        failure,
      });
      continue;
    }
    // Spec 058: the reason check. A resumed plan skips it (spec 057).
    let reasonFailure: ReasonFailure | null = null;
    if (actionId === null || !resumed.has(actionId)) {
      scan: for (const [stepIndex, step] of steps.entries()) {
        for (const { field, text } of stepTexts(step)) {
          const res = checkClaims(claimState, text);
          if (!res.pass) {
            reasonFailure = { stepIndex, field, text, issues: res.issues };
            break scan;
          }
        }
      }
    }
    verdicts.push(
      reasonFailure
        ? {
            actionId,
            ok: false,
            code: REASON_REFUSAL_CODE,
            failure: reasonFailure,
          }
        : pull.size > 0
          ? { actionId, ok: true, pull: [...pull] }
          : { actionId, ok: true },
    );
  }
  return verdicts;
}
