import type { Ruling } from "./nodes/adjudicate.js";
import type { DirectorNodeOutput } from "./nodes/director.js";
import type { InterpretReading, Step } from "./nodes/schemas.js";

/**
 * First-stage rule (specs/064-plan-first-step): in free mode a plan resolves
 * only its first stage. Pure; the runner applies it between adjudicate and
 * resolve.
 */

const MAX_FOLLOW_UPS = 6;
type Check = Extract<Step, { step: "check" }>;

const sameCheck = (a: Check, b: Step): boolean =>
  b.step === "check" &&
  a.kind === b.kind &&
  a.ability === b.ability &&
  a.skill === b.skill;

/** Keeps steps up to the end of the first run of like checks. No check cuts nothing. */
export function firstStage(steps: readonly Step[]): {
  kept: Step[];
  cut: Step[];
} {
  const first = steps.findIndex((s) => s.step === "check");
  if (first < 0) return { kept: [...steps], cut: [] };
  const head = steps[first] as Check;
  let end = first + 1;
  while (end < steps.length && sameCheck(head, steps[end] as Step)) end += 1;
  return { kept: steps.slice(0, end), cut: steps.slice(end) };
}

const merge = (...lists: readonly string[][]): string[] =>
  [...new Set(lists.flat())].slice(0, MAX_FOLLOW_UPS);

/** Cuts each acting reading and ruling after its first stage; free mode only. */
export function cutPlans(input: {
  mode: "free" | "turn";
  readings: InterpretReading[];
  rulings: Ruling[];
}): { readings: InterpretReading[]; rulings: Ruling[] } {
  const { mode, readings, rulings } = input;
  if (mode !== "free") return { readings, rulings };
  return {
    readings: readings.map((r) => {
      if (r.actionId === null) return r;
      const { kept, cut } = firstStage(r.steps);
      return {
        ...r,
        steps: kept,
        followUps: merge(
          r.followUps,
          cut.map((s) => s.reason),
        ),
      };
    }),
    rulings: rulings.map((r) => {
      if (r.actionId === null) return r;
      const { kept, cut } = firstStage(r.steps);
      return {
        ...r,
        steps: kept,
        followUps: merge(
          r.followUps,
          cut.map((s) => s.reason),
        ),
      };
    }),
  };
}

const HELD = "held: the plan was cut to its first stage";

/** Holds turn, tracker and scene-end decisions of a cut beat. `free` is never held. */
export function holdDirector(
  director: DirectorNodeOutput,
  cutBeat: boolean,
): DirectorNodeOutput {
  if (!cutBeat) return director;
  const overrides = [...director.overrides];
  let { tableMode, trackers, scene } = director;
  if (tableMode.to === "turn") {
    tableMode = { to: "stay" };
    overrides.push({ decision: "turn", reason: HELD });
  }
  if (trackers.length > 0) {
    trackers = [];
    overrides.push({ decision: "tracker", reason: HELD });
  }
  if (scene.status === "end") {
    scene = { status: "continue" };
    overrides.push({ decision: "scene-end", reason: HELD });
  }
  if (overrides.length === director.overrides.length) return director;
  return { ...director, tableMode, trackers, scene, overrides };
}
