import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { interpret } from "../../src/dm/nodes/interpret.js";
import { InterpretOutput, StepSchema } from "../../src/dm/nodes/schemas.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";

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
  skill: "Sleight of Hand",
  expression: "1d20+5",
  mode: "normal",
  dc: 15,
  autoFail: null,
  onSuccess: [],
  onFailure: [],
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
