import type { SessionProjections } from "@the-stacks/session-model";
import { callJson } from "../pipeline/call.js";
import type { Node } from "../pipeline/context.js";
import { buildInterpretPrompt, PROMPT_VERSION } from "../prompts/interpret.js";
import { PURPOSE_OF } from "../purposes.js";
import { InterpretOutput, type InterpretReading } from "./schemas.js";

const ACTOR_FIELDS = {
  attack: "attackerId",
  spell: "casterId",
  help: "helperId",
  check: "combatantId",
  move: "combatantId",
} as const;

/**
 * Replace a seated player's user id in a step's actor field with that
 * member's combatant id. Pure; targets and the plan gate are untouched.
 * ponytail: bridge until TASK-0269, where the seat supplies the actor.
 */
export function seatActorIds(
  readings: readonly InterpretReading[],
  party: SessionProjections["party"],
): {
  readings: InterpretReading[];
  swaps: { actionId: string | null; field: string }[];
} {
  const seat = new Map<string, string>();
  for (const m of party) {
    if (
      m.controller.kind === "player" &&
      m.combatantId &&
      !seat.has(m.controller.userId)
    ) {
      seat.set(m.controller.userId, m.combatantId);
    }
  }
  const swaps: { actionId: string | null; field: string }[] = [];
  const out = readings.map((r) => ({
    ...r,
    steps: r.steps.map((step) => {
      const field = ACTOR_FIELDS[step.step as keyof typeof ACTOR_FIELDS];
      const id = field && (step as Record<string, unknown>)[field];
      const to = typeof id === "string" ? seat.get(id) : undefined;
      if (!to) return step;
      swaps.push({ actionId: r.actionId, field });
      return { ...step, [field]: to } as typeof step;
    }),
  }));
  return { readings: out, swaps };
}

/**
 * The interpret node (contracts/nodes.md "interpret"): one reading per beat
 * item, plus one with `actionId: null` for a monster turn. A missing, extra
 * or repeated reading is `invalid-output`. An empty beat with no monster
 * turn (scene start) makes no call.
 */
export const interpret: Node<"interpret"> = async (ctx) => {
  const assembled = ctx.results.assemble;
  const director = ctx.results.director;
  if (!assembled || !director) {
    return {
      ok: false,
      node: "interpret",
      calls: [],
      error: {
        kind: "internal",
        message: "interpret ran before assemble and director",
      },
    };
  }
  const seatNormalized = (rs: InterpretReading[]): InterpretReading[] => {
    const { readings, swaps } = seatActorIds(rs, assembled.projections.party);
    for (const s of swaps) {
      ctx.deps.log({
        event: "dm.interpret.seat-actor",
        jobId: ctx.job.id,
        actionId: s.actionId,
        field: s.field,
      });
    }
    return readings;
  };
  // Resumed items keep the plan the paused turn made (specs/057 FR-006).
  const resumed = assembled.resumed ?? [];
  const resumedIds = new Set(resumed.map((r) => r.actionId));
  const full: (string | null)[] = assembled.beat.map((b) => b.actionId);
  if (assembled.npcTurn) full.push(null);
  const order = new Map(full.map((id, i) => [id, i]));
  const byBeatOrder = <T extends { actionId: string | null }>(xs: T[]): T[] =>
    [...xs].sort(
      (a, b) => (order.get(a.actionId) ?? 0) - (order.get(b.actionId) ?? 0),
    );
  const resumedReadings = resumed
    .filter((r) => order.has(r.actionId))
    .map((r) => r.reading);
  const expected = full.filter((id) => id === null || !resumedIds.has(id));
  if (expected.length === 0) {
    return {
      ok: true,
      node: "interpret",
      output: { readings: seatNormalized(byBeatOrder(resumedReadings)) },
      calls: [],
    };
  }

  const prompt = buildInterpretPrompt({ ctx, assembled, director });
  const result = await callJson(ctx.deps, {
    purpose: PURPOSE_OF.interpret,
    promptVersion: PROMPT_VERSION,
    system: prompt.system,
    user: prompt.user,
    schema: InterpretOutput,
    signal: ctx.signal,
  });
  if (!result.ok) {
    return {
      ok: false,
      node: "interpret",
      error: result.error,
      calls: result.calls,
    };
  }

  const got = result.value.readings.map((r) => r.actionId);
  const mismatch =
    got.length !== expected.length ||
    [...got].sort().join("|") !== [...expected].sort().join("|");
  if (mismatch) {
    return {
      ok: false,
      node: "interpret",
      calls: result.calls,
      error: {
        kind: "invalid-output",
        message: "interpret readings do not match the beat",
        detail: { expected, got },
      },
    };
  }
  // Order the readings like the beat (monster turn last).
  const readings = byBeatOrder([...result.value.readings, ...resumedReadings]);
  return {
    ok: true,
    node: "interpret",
    output: { readings: seatNormalized(readings) },
    calls: result.calls,
  };
};
