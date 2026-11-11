import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { check } from "../../src/dm/nodes/check.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { dmOnlySeedText } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/** Spec 103 T019: one narrate call, no audit call; leaks drop, contradictions ship with a correction. */

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "rising", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};
const resolved: ResolveOutput = {
  submissions: [],
  actionResults: [],
  appendedRows: [],
  nextJob: null,
  chronicle: false,
  npcTurn: null,
  ...EMPTY_RESOLVE_SNAPSHOT,
  lastSeq: 0,
};

async function run(narrateText: string | null) {
  const scripted = createScriptedDm(
    loadDmScript({
      v: 1,
      name: "check-node",
      dice: [],
      calls:
        narrateText === null
          ? []
          : [
              {
                purpose: "dm.narrate",
                respond: { type: "text", value: narrateText },
              },
            ],
    }),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const events = freeEventsThrough("action.resolved");
  const ctx0 = makeCtx({
    deps: { gateway, loadProjections: async () => projectDm(events) },
  });
  const assembled = await assemble(ctx0);
  if (!assembled.ok) throw new Error("assemble failed");
  const snapshot = buildSnapshot(assembled.output.projections, ctx0.seed);
  const ctx = {
    ...ctx0,
    results: {
      assemble: assembled.output,
      director,
      resolve: { ...resolved, snapshot },
    },
  };
  const n = await narrate(ctx);
  if (!n.ok) throw new Error("narrate failed");
  const c = await check({
    ...ctx,
    results: { ...ctx.results, narrate: n.output },
  });
  if (!c.ok) throw new Error("check failed");
  return { scripted, narrated: n.output, checked: c.output, seed: ctx0.seed };
}

describe("check node (spec 103)", () => {
  it("makes one narrate call, none for audit, and ships clean prose untouched", async () => {
    const { scripted, checked } = await run(
      "[describe] The tumblers give way and the door swings inward.",
    );
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);
    expect(Object.keys(scripted.remaining().calls)).not.toContain("dm.audit");
    expect(checked.record.corrected).toBe(false);
    expect(checked.shipped?.corrections).toEqual([]);
    expect(checked.shipped?.text).toContain("door swings inward");
  });

  it("drops a digit sentence and keeps the rest", async () => {
    const { checked } = await run(
      "[describe] The lock gives way. It takes 12 tries. The door opens.",
    );
    expect(checked.shipped?.prose).not.toMatch(/[0-9]/);
    expect(checked.shipped?.prose).toContain("The door opens.");
    // parseSlots already dropped the digit sentence; the check finds nothing left.
    expect(checked.record.contradiction).toEqual([]);
  });

  it("drops a DM-only sentence and appends a dm correction", async () => {
    const probe = await run("[describe] x.");
    const secret = dmOnlySeedText(probe.seed).find((s) => s.length > 8);
    if (!secret) throw new Error("seed has no DM-only text");
    const { checked } = await run(
      `[describe] The door opens. ${secret}. Dust falls.`,
    );
    expect(checked.shipped?.text).not.toContain(secret);
    expect(checked.shipped?.corrections).toHaveLength(1);
    expect(checked.shipped?.corrections[0]?.visibility).toBe("dm");
    expect(checked.shipped?.corrections[0]?.text).toMatch(
      /^Correction \(hidden\)/,
    );
  });

  it("ships a life-state contradiction and appends a public correction", async () => {
    const { checked } = await run(
      "[describe] Ana dies in the mud. The door opens.",
    );
    expect(checked.shipped?.text).toContain("Ana dies in the mud.");
    expect(checked.shipped?.corrections.map((c) => c.visibility)).toEqual([
      "public",
    ]);
    expect(checked.shipped?.corrections[0]?.text).toMatch(/^Correction: /);
    expect(checked.record.contradiction.map((i) => i.kind)).toEqual([
      "life-state",
    ]);
  });

  it("ships restate, rows and State when the narrate call errors", async () => {
    const { narrated, checked } = await run(null);
    expect(narrated.narrateError).toBe("gateway");
    expect(checked.record.narrateError).toBe("gateway");
    expect(checked.shipped?.text).toBe(narrated.text);
    expect(checked.shipped?.corrections).toEqual([]);
  });
});
