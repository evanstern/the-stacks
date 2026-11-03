import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { interpret } from "../../src/dm/nodes/interpret.js";
import {
  AdjudicateModelOutput,
  InterpretOutput,
  InterpretReadingSchema,
  StepSchema,
} from "../../src/dm/nodes/schemas.js";
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

const checkStep = {
  step: "check",
  reason: "Ana picks the vault lock",
  combatantId: "ana",
  kind: "ability-check",
  ability: "dex",
  skill: "sleight-of-hand",
  expression: "1d20+5",
  mode: "normal",
  dc: 15,
  autoFail: null,
  onSuccess: [],
  onFailure: [],
  stakes: {
    success: "The attempt works as intended.",
    cost: "It works, at a small price.",
    failure: "The attempt comes to nothing.",
    severe: "It goes badly wrong.",
  },
  onCost: [],
  onSevere: [],
  newRisk: null,
};

function reading(actionId: string | null, over: object = {}) {
  return {
    actionId,
    intent: "check",
    uncertain: true,
    needsAdjudication: false,
    rulesQuestion: null,
    clarify: null,
    steps: [checkStep],
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
    expect(prompt?.system).toContain("INPUTS");
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

  it("requires a rulesQuestion when adjudication is needed", () => {
    const bad = InterpretOutput.safeParse({
      readings: [reading("a", { needsAdjudication: true, steps: [] })],
    });
    expect(bad.success).toBe(false);
  });
});

describe("step schema (AC #5)", () => {
  it("has no field for a total, an applied amount or a verdict", () => {
    const parsed = StepSchema.parse({
      ...checkStep,
      total: 99,
      outcome: "success",
      applied: 7,
    });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("outcome");
    expect(parsed).not.toHaveProperty("applied");
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

describe("check stakes contract (spec 070)", () => {
  const parse = (over: Record<string, unknown>, kind = "ability-check") =>
    InterpretReadingSchema.safeParse(
      reading("act-1", { steps: [{ ...checkStep, kind, ...over }] }),
    );
  const stakes = (over: object) => ({ ...checkStep.stakes, ...over });

  it("rejects a check with no stakes.failure", () => {
    const { failure: _f, ...rest } = checkStep.stakes;
    expect(parse({ stakes: rest }).success).toBe(false);
  });

  it("requires stakes.success (spec 080)", () => {
    expect(parse({ stakes: stakes({ success: null }) }).success).toBe(false);
    const { success: _s, ...rest } = checkStep.stakes;
    expect(parse({ stakes: rest }).success).toBe(false);
  });

  it("defaults reveals to null and rejects a malformed reference (spec 080)", () => {
    const { reveals: _r, ...rest } = checkStep as Record<string, unknown>;
    expect(StepSchema.parse(rest)).toMatchObject({ reveals: null });
    expect(parse({ reveals: "ferry-house#1" }).success).toBe(true);
    expect(parse({ reveals: "ferry-house" }).success).toBe(false);
    expect(parse({ reveals: "ferry-house#9" }).success).toBe(false);
  });

  it("rejects an ability check with a null cost or severe", () => {
    expect(parse({ stakes: stakes({ cost: null }) }).success).toBe(false);
    expect(parse({ stakes: stakes({ severe: null }) }).success).toBe(false);
  });

  it("parses a saving throw with null cost and severe", () => {
    expect(
      parse({ stakes: stakes({ cost: null, severe: null }) }, "saving-throw")
        .success,
    ).toBe(true);
  });

  it("defaults newRisk to null and the band effect lists to empty", () => {
    const { newRisk: _n, onCost: _c, onSevere: _s, ...rest } = checkStep;
    const parsed = StepSchema.parse(rest);
    expect(parsed).toMatchObject({ newRisk: null, onCost: [], onSevere: [] });
  });

  it("applies the ability-check rule to an adjudicate ruling", () => {
    const ruling = (st: object) => ({
      ruling: "r",
      citations: [],
      steps: [{ ...checkStep, stakes: st }],
    });
    expect(
      AdjudicateModelOutput.safeParse(ruling(stakes({ cost: null }))).success,
    ).toBe(false);
    expect(
      AdjudicateModelOutput.safeParse(ruling(checkStep.stakes)).success,
    ).toBe(true);
  });
});
