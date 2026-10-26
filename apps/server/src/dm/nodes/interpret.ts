import { callJson } from "../pipeline/call.js";
import type { Node } from "../pipeline/context.js";
import { buildInterpretPrompt, PROMPT_VERSION } from "../prompts/interpret.js";
import { PURPOSE_OF } from "../purposes.js";
import { InterpretOutput } from "./schemas.js";

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
  const expected: (string | null)[] = assembled.beat.map((b) => b.actionId);
  if (assembled.npcTurn) expected.push(null);
  if (expected.length === 0) {
    return { ok: true, node: "interpret", output: { readings: [] }, calls: [] };
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
  const order = new Map(expected.map((id, i) => [id, i]));
  const readings = [...result.value.readings].sort(
    (a, b) => (order.get(a.actionId) ?? 0) - (order.get(b.actionId) ?? 0),
  );
  return {
    ok: true,
    node: "interpret",
    output: { readings },
    calls: result.calls,
  };
};
