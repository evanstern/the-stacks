import { type Intent, IntentSchema, parse } from "@the-stacks/intent";
import { callJson } from "../pipeline/call.js";
import type { Node } from "../pipeline/context.js";
import { buildInterpretPrompt, PROMPT_VERSION } from "../prompts/interpret.js";
import { PURPOSE_OF } from "../purposes.js";
import type { BeatItem } from "./assemble.js";
import {
  type IntentBody,
  IntentBodySchema,
  InterpretOutput,
  type InterpretReading,
} from "./schemas.js";

type Actor = Intent["actor"];
type Source = Intent["source"];
type Commit = Intent["commit"];

/** FR-005: the actor comes from the beat item, never from the model. */
export function actorOfItem(item: BeatItem): Actor | null {
  if (item.actor.startsWith("ai:companion:")) {
    return { kind: "companion", id: item.actor.slice("ai:companion:".length) };
  }
  return item.characterId ? { kind: "pc", id: item.characterId } : null;
}

export type StampResult =
  | { ok: true; intent: Intent }
  | { ok: false; path: string; message: string };

/**
 * Plan D2/D3: stamp a model body with id, actor, source and commit, then
 * validate the whole envelope. Pure.
 */
export function stampIntent(
  body: IntentBody,
  stamp: { id: string; actor: Actor; source: Source; commit: Commit },
): StampResult {
  const parsed = IntentSchema.safeParse({ ...body, ...stamp });
  if (parsed.success) return { ok: true, intent: parsed.data };
  const issue = parsed.error.issues[0];
  return {
    ok: false,
    path: (issue?.path ?? []).join("."),
    message: issue?.message ?? "invalid intent",
  };
}

/** The body of a stamped Intent: what a reading holds. */
function bodyOf(intent: Intent): unknown {
  return {
    kind: intent.kind,
    targets: intent.targets,
    params: intent.params,
    ...(intent.text !== undefined ? { text: intent.text } : {}),
  };
}

const clarifyReading = (
  actionId: string,
  question: string,
): InterpretReading => ({
  actionId,
  stages: [],
  clarify: question.slice(0, 200),
  followUps: [],
});

/**
 * Plan D2: parse a slash item without a model. A parse refusal, a kind the
 * interpret list does not cover, or a body the schema rejects (a `dc`) becomes a
 * clarify reading with no stage (spec OQ-5).
 */
export function parseSlashItem(
  item: BeatItem,
  actor: Actor | null,
): InterpretReading {
  if (!actor) {
    return clarifyReading(item.actionId, "I cannot tell who is acting.");
  }
  const res = parse(item.text.trim(), {
    id: `${item.actionId}.0`,
    actor,
    source: "composer",
    commit: "declared",
  });
  if (!res.ok) return clarifyReading(item.actionId, res.refusal.message);
  const body = IntentBodySchema.safeParse(bodyOf(res.intent));
  if (!body.success) {
    return clarifyReading(
      item.actionId,
      `/${res.intent.kind} is not an action command here, or carries a number the engine owns.`,
    );
  }
  return {
    actionId: item.actionId,
    stages: [{ intent: body.data, beside: null }],
    clarify: null,
    followUps: [],
  };
}

const isSlash = (text: string): boolean => text.trimStart().startsWith("/");

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

  // Spec FR-004: slash items never reach the model.
  const fresh = assembled.beat.filter((b) => !resumedIds.has(b.actionId));
  const slash = fresh.filter((b) => isSlash(b.text));
  const slashReadings = slash.map((b) => parseSlashItem(b, actorOfItem(b)));
  const slashIds = new Set(slash.map((b) => b.actionId));
  const expected = full.filter(
    (id) => id === null || (!resumedIds.has(id) && !slashIds.has(id)),
  );
  const local = [...resumedReadings, ...slashReadings];
  if (expected.length === 0) {
    return {
      ok: true,
      node: "interpret",
      output: { readings: byBeatOrder(local) },
      calls: [],
    };
  }

  const prompt = buildInterpretPrompt({
    ctx,
    assembled,
    director,
    skip: slashIds,
  });
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
  // FR-003 / plan D2: stamp every model body; a failure is invalid-output.
  const jobShort = ctx.job.id
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(0, 8);
  for (const r of result.value.readings) {
    const item = r.actionId
      ? assembled.beat.find((b) => b.actionId === r.actionId)
      : undefined;
    const actor: Actor | null = item
      ? actorOfItem(item)
      : assembled.npcTurn
        ? { kind: "npc", id: assembled.npcTurn.combatantId }
        : null;
    for (const [n, st] of r.stages.entries()) {
      const stamped = actor
        ? stampIntent(st.intent, {
            id: r.actionId ? `${r.actionId}.${n}` : `npc.${jobShort}.${n}`,
            actor,
            source: "ai",
            commit: r.actionId ? "declared" : "confirmed",
          })
        : ({
            ok: false,
            path: "actor",
            message: "no actor for this item",
          } as const);
      if (!stamped.ok) {
        return {
          ok: false,
          node: "interpret",
          calls: result.calls,
          error: {
            kind: "invalid-output",
            message: `interpret stage ${n} of ${r.actionId ?? "the monster turn"} is not a valid Intent at ${stamped.path}: ${stamped.message}`,
            detail: { actionId: r.actionId, stage: n, path: stamped.path },
          },
        };
      }
    }
  }
  // Order the readings like the beat (monster turn last).
  return {
    ok: true,
    node: "interpret",
    output: { readings: byBeatOrder([...result.value.readings, ...local]) },
    calls: result.calls,
  };
};
