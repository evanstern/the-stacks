import { PLAN_KINDS } from "@the-stacks/planner";
import type { BeatItem } from "./nodes/assemble.js";
import type { DirectorNodeOutput } from "./nodes/director.js";
import type { InterpretReading, InterpretStage } from "./nodes/schemas.js";

/**
 * First-stage rule (specs/064-plan-first-step): in free mode a plan resolves
 * only its first stage. Pure; the runner applies it after interpret and
 * before resolve.
 */

const MAX_FOLLOW_UPS = 6;

/**
 * Spec 104 FR-011: a stage rolls when its kind is planned and mutates through the engine's dice:
 * a check, save, contest, search, hide, attack or cast. Keeps stages up to and including the
 * first roll-bearing run of like stages; the rest become follow-ups.
 */
const ROLLS = new Set([
  "check",
  "save",
  "contest",
  "search",
  "hide",
  "attack",
  "cast",
  "grapple",
  "shove",
]);
const rolls = (s: InterpretStage): boolean =>
  ROLLS.has(s.intent.kind) && PLAN_KINDS[s.intent.kind].class !== "unserved";
const sameStage = (a: InterpretStage, b: InterpretStage): boolean =>
  a.intent.kind === b.intent.kind &&
  JSON.stringify(a.intent.params) === JSON.stringify(b.intent.params);

export function firstStages(stages: readonly InterpretStage[]): {
  kept: InterpretStage[];
  cut: InterpretStage[];
} {
  const first = stages.findIndex(rolls);
  if (first < 0) return { kept: [...stages], cut: [] };
  const head = stages[first] as InterpretStage;
  let end = first + 1;
  while (end < stages.length && sameStage(head, stages[end] as InterpretStage))
    end += 1;
  return { kept: stages.slice(0, end), cut: stages.slice(end) };
}

/** A cut stage's follow-up line: the Intent's own words when it has them, else its kind. */
const stageLine = (s: InterpretStage): string =>
  (s.intent.text ?? `then ${s.intent.kind}`).slice(0, 200);

const merge = (...lists: readonly string[][]): string[] =>
  [...new Set(lists.flat())].slice(0, MAX_FOLLOW_UPS);

/** Cuts each acting reading and ruling after its first stage; free mode only. */
export function cutPlans(input: {
  mode: "free" | "turn";
  readings: InterpretReading[];
}): { readings: InterpretReading[] } {
  const { mode, readings } = input;
  if (mode !== "free") return { readings };
  return {
    readings: readings.map((r) => {
      if (r.actionId === null) return r;
      const { kept, cut } = firstStages(r.stages);
      return {
        ...r,
        stages: kept,
        followUps: merge(r.followUps, cut.map(stageLine)),
      };
    }),
  };
}

const HELD = "held: the plan was cut to its first stage";
export const CLARIFY_HELD = "held: an action awaits an answer";

/**
 * Action ids a human's clarify holds (specs/073): committed, not an `ai:`
 * actor, a reading that asks a question.
 */
export function clarifyHolds(
  beat: readonly BeatItem[],
  readings: readonly InterpretReading[],
): Set<string> {
  const held = new Set<string>();
  for (const b of beat) {
    if (b.status !== "committed" || b.actor.startsWith("ai:")) continue;
    if (readings.some((r) => r.actionId === b.actionId && r.clarify !== null))
      held.add(b.actionId);
  }
  return held;
}

/** Holds turn, tracker and scene-end decisions of a cut beat. `free` is never held. */
export function holdDirector(
  director: DirectorNodeOutput,
  cutBeat: boolean,
  reason: string = HELD,
): DirectorNodeOutput {
  if (!cutBeat) return director;
  const overrides = [...director.overrides];
  let { tableMode, trackers, scene } = director;
  if (tableMode.to === "turn") {
    tableMode = { to: "stay" };
    overrides.push({ decision: "turn", reason });
  }
  if (trackers.length > 0) {
    trackers = [];
    overrides.push({ decision: "tracker", reason });
  }
  if (scene.status === "end") {
    scene = { status: "continue" };
    overrides.push({ decision: "scene-end", reason });
  }
  if (overrides.length === director.overrides.length) return director;
  return { ...director, tableMode, trackers, scene, overrides };
}
