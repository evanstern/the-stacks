import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { interpret } from "../../src/dm/nodes/interpret.js";
import { InterpretOutput } from "../../src/dm/nodes/schemas.js";
import type { ResumedPlan } from "../../src/dm/resume.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import {
  commit,
  declare,
  freeEventsThrough,
  makeCtx,
  projectDm,
} from "./helpers.js";

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};

/** One Intent reading: a plain `dodge` stage, no beside. */
function reading(actionId: string | null, over: object = {}) {
  return {
    actionId,
    clarify: null,
    followUps: [],
    stages: [
      { intent: { kind: "dodge", targets: [], params: {} }, beside: null },
    ],
    ...over,
  };
}

async function setup(
  readings: unknown[] | null,
  events = freeEventsThrough("action.committed"),
) {
  const script = loadDmScript({
    v: 1,
    name: "interpret",
    dice: [],
    calls:
      readings === null
        ? []
        : [
            {
              purpose: "dm.interpret",
              respond: { type: "json", value: { readings } },
            },
          ],
  });
  const scripted = createScriptedDm(script);
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const ctx = makeCtx({
    deps: { gateway, loadProjections: async () => projectDm(events) },
  });
  const assembled = await assemble(ctx);
  if (!assembled.ok) throw new Error("assemble failed");
  return {
    scripted,
    ctx: { ...ctx, results: { assemble: assembled.output, director } },
  };
}

describe("interpret", () => {
  it("returns one reading per beat item with one dm.interpret call", async () => {
    const { ctx, scripted } = await setup([reading("act-lockpick")]);
    const result = await interpret(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.readings).toHaveLength(1);
    expect(result.calls.map((c) => c.purpose)).toEqual(["dm.interpret"]);
    expect(scripted.remaining().calls["dm.interpret"]).toBe(0);
    const prompt = scripted.provider.chatCalls[0]?.request;
    expect(prompt?.messages[0]?.content).toContain("act-lockpick");
    expect(prompt?.system).toContain("Intent grammar");
  });

  it("fails invalid-output when a beat item has no reading", async () => {
    const { ctx } = await setup([reading("someone-else")]);
    const result = await interpret(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid-output");
  });

  it("fails invalid-output on an extra reading", async () => {
    const { ctx } = await setup([reading("act-lockpick"), reading(null)]);
    const result = await interpret(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid-output");
  });

  it("makes no call for an empty beat", async () => {
    const { ctx } = await setup(null, freeEventsThrough("narration"));
    const result = await interpret(ctx);
    expect(result).toMatchObject({
      ok: true,
      output: { readings: [] },
      calls: [],
    });
  });

  it("refuses the old step-grammar fields on a reading", () => {
    const bad = InterpretOutput.safeParse({
      readings: [reading("a", { needsAdjudication: true, steps: [] })],
    });
    expect(bad.success).toBe(false);
  });

  it("stamps each model stage: id, actor, source and commit validate (FR-003)", async () => {
    const { ctx } = await setup([reading("act-lockpick")]);
    const result = await interpret(ctx);
    expect(result.ok).toBe(true);
  });

  it("fails invalid-output with the issue path when a stamped Intent is invalid", async () => {
    // A `contest` with no target passes the lenient body arity? It does not: arity is in the body.
    // An id past 64 chars cannot come from the model, so force the failure through the actor.
    const events = freeEventsThrough("action.committed");
    const { ctx } = await setup([reading("act-lockpick")], events);
    const assembled = ctx.results.assemble;
    if (!assembled) throw new Error("no assemble");
    const noActor = {
      ...assembled,
      beat: assembled.beat.map((b) => ({ ...b, characterId: null })),
    };
    const result = await interpret({
      ...ctx,
      results: { ...ctx.results, assemble: noActor },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid-output");
      expect(result.error.message).toContain("actor");
    }
  });

  it("makes zero dm.interpret calls for a slash-only beat (SC-001)", async () => {
    const base = freeEventsThrough("narration");
    const n = base.length;
    const events = [
      ...base,
      declare(n + 1, "act-slash", "ana", '/attack @goblin-2 with "Dagger"'),
      commit(n + 2, "act-slash"),
    ];
    const { ctx, scripted } = await setup(null, events);
    const result = await interpret(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calls).toEqual([]);
    expect(scripted.provider.chatCalls).toHaveLength(0);
    expect(result.output.readings).toHaveLength(1);
    expect(
      (result.output.readings[0] as { stages: { intent: { kind: string } }[] })
        .stages[0]?.intent.kind,
    ).toBe("attack");
  });

  it("sends only the prose item to the model when a slash item shares the beat", async () => {
    const base = freeEventsThrough("narration");
    const n = base.length;
    const events = [
      ...base,
      declare(n + 1, "act-slash", "ana", "/dodge"),
      commit(n + 2, "act-slash"),
      declare(n + 3, "act-prose", "bram", "Bram ducks behind the cart."),
      commit(n + 4, "act-prose"),
    ];
    const { ctx, scripted } = await setup([reading("act-prose")], events);
    const result = await interpret(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.readings.map((r) => r.actionId)).toEqual([
      "act-slash",
      "act-prose",
    ]);
    const user = JSON.stringify(
      scripted.provider.chatCalls[0]?.request.messages,
    );
    expect(user).toContain("act-prose [committed]");
    expect(user).not.toContain("act-slash [committed]");
  });
});

describe("interpret: resumed plans (specs/057)", () => {
  const twoActions = () => {
    const base = freeEventsThrough("narration");
    const n = base.length;
    return [
      ...base,
      declare(n + 1, "act-old", "ana", "Ana searches the ford."),
      commit(n + 2, "act-old"),
      declare(n + 3, "act-new", "bram", "Bram shouts."),
      commit(n + 4, "act-new"),
    ];
  };
  const plan = (actionId: string) =>
    ({
      actionId,
      fromJobId: "job-paused",
      reading: reading(actionId),
      ruling: null,
      submissions: [],
    }) as unknown as ResumedPlan;

  async function withResumed(ids: string[], readings: unknown[] | null) {
    const s = await setup(readings, twoActions());
    const assemble0 = s.ctx.results.assemble;
    if (!assemble0) throw new Error("no assemble");
    return {
      ...s,
      ctx: {
        ...s.ctx,
        results: {
          ...s.ctx.results,
          assemble: { ...assemble0, resumed: ids.map(plan) },
        },
      },
    };
  }

  it("makes no call when every beat item is resumed and returns their readings in beat order", async () => {
    const s = await withResumed(["act-old", "act-new"], null);
    const result = await interpret(s.ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calls).toEqual([]);
    expect(result.output.readings.map((r) => r.actionId)).toEqual([
      "act-old",
      "act-new",
    ]);
  });

  it("asks only about the fresh item and merges both in beat order", async () => {
    const s = await withResumed(["act-old"], [reading("act-new")]);
    const result = await interpret(s.ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.readings.map((r) => r.actionId)).toEqual([
      "act-old",
      "act-new",
    ]);
    const user = JSON.stringify(
      s.scripted.provider.chatCalls[0]?.request.messages,
    );
    expect(user).toContain("act-new [committed]");
    expect(user).not.toContain("act-old [committed]");
  });

  it("fails invalid-output when the model reads the resumed item too", async () => {
    const s = await withResumed(
      ["act-old"],
      [reading("act-new"), reading("act-old")],
    );
    const result = await interpret(s.ctx);
    expect(result.ok).toBe(false);
  });
});
