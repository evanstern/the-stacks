import { describe, expect, it } from "vitest";
import { CLARIFY_HELD } from "../../src/dm/first-stage.js";
import { interpret } from "../../src/dm/nodes/interpret.js";
import {
  depsFor,
  NODE_NAMES,
  type Node,
  type NodeName,
  type NodeOutputs,
  throwingGate,
} from "../../src/dm/pipeline/context.js";
import { type Nodes, runTurn } from "../../src/dm/pipeline/runner.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import {
  emptyCheckpoint,
  makeCtx,
  makeDeps,
  projectDm,
  testSeed,
} from "./helpers.js";
import { greyhollowDuo, greyhollowFight } from "./snapshot-fixtures.js";

const duo = greyhollowDuo();
const assembled = (over: Partial<NodeOutputs["assemble"]> = {}) =>
  ({
    projections: {},
    snapshot: buildSnapshot(duo.projections, duo.seed),
    throughSeq: 5,
    beat: [{ actionId: "a1" }],
    npcTurn: null,
    presentNpcIds: [],
    activeEncounterId: null,
    srdRecords: [],
    transcriptTail: [],
    priorSteps: {},
    rejections: {},
    ...over,
  }) as unknown as NodeOutputs["assemble"];

const directorResolve = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
} as unknown as NodeOutputs["director"];

const reading = (needs: boolean) =>
  ({
    actionId: "a1",
    intent: "check",
    uncertain: true,
    needsAdjudication: needs,
    rulesQuestion: needs ? "q" : null,
    clarify: null,
    steps: [],
    followUps: [],
  }) as NodeOutputs["interpret"]["readings"][number];

interface Spy {
  order: string[];
  nodes: Nodes;
  gates: Record<string, unknown>;
}

function stubNodes(
  over: {
    assemble?: NodeOutputs["assemble"];
    director?: NodeOutputs["director"];
    interpret?: NodeOutputs["interpret"];
    fail?: NodeName;
    throws?: NodeName;
  } = {},
): Spy {
  const order: string[] = [];
  const gates: Record<string, unknown> = {};
  const make =
    <N extends NodeName>(name: N, output: () => NodeOutputs[N]): Node<N> =>
    async (ctx) => {
      order.push(name);
      gates[name] = ctx.deps.gate;
      if (over.throws === name) throw new Error("boom with prompt text");
      if (over.fail === name) {
        return {
          ok: false,
          node: name,
          calls: [],
          error: { kind: "gateway", message: "bad" },
        };
      }
      return {
        ok: true,
        node: name,
        output: output(),
        calls: [
          {
            purpose: "dm.director",
            promptVersion: `${name}-v1`,
            attempt: 1,
            outcome: "ok",
            errorKind: null,
            provider: null,
            model: null,
            inputTokens: null,
            outputTokens: null,
            costUsd: null,
            durationMs: null,
          },
        ],
      };
    };
  const nodes: Nodes = {
    assemble: make("assemble", () => over.assemble ?? assembled()),
    director: make("director", () => over.director ?? directorResolve),
    interpret: make(
      "interpret",
      () => over.interpret ?? { readings: [reading(false)] },
    ),
    adjudicate: make("adjudicate", () => ({ rulings: [] })),
    resolve: make("resolve", () => ({}) as never),
    narrate: make("narrate", () => ({}) as never),
    audit: make("audit", () => ({}) as never),
  };
  return { order, nodes, gates };
}

describe("runTurn", () => {
  it("runs the nodes in pipeline order and skips adjudicate without a flagged reading", async () => {
    const spy = stubNodes();
    const outcome = await runTurn(makeCtx(), spy.nodes);
    expect(outcome.status).toBe("completed");
    expect(spy.order).toEqual([
      "assemble",
      "director",
      "interpret",
      "resolve",
      "narrate",
      "audit",
    ]);
    if (outcome.status === "completed") {
      expect(outcome.results.adjudicate).toEqual({ rulings: [] });
    }
    expect(NODE_NAMES).toEqual([
      "assemble",
      "director",
      "interpret",
      "adjudicate",
      "resolve",
      "narrate",
      "audit",
    ]);
  });

  it("runs adjudicate when a reading is flagged", async () => {
    const spy = stubNodes({ interpret: { readings: [reading(true)] } });
    await runTurn(makeCtx(), spy.nodes);
    expect(spy.order).toContain("adjudicate");
    expect(spy.order.indexOf("adjudicate")).toBeLessThan(
      spy.order.indexOf("resolve"),
    );
  });

  it("skips adjudicate for a resumed reading and stores resumed with the beat", async () => {
    const plan = { actionId: "a1" } as never;
    const spy = stubNodes({
      assemble: assembled({ resumed: [plan] } as never),
      interpret: { readings: [reading(true)] },
    });
    const saved: ReturnType<typeof emptyCheckpoint>[] = [];
    const ctx = makeCtx({
      deps: {
        saveCheckpoint: async (c) => {
          saved.push(c);
          return true;
        },
      },
    });
    await runTurn(ctx, spy.nodes);
    expect(spy.order).not.toContain("adjudicate");
    expect(saved[0]?.beat).toEqual(["a1"]);
    expect(saved[0]?.resumed).toEqual([plan]);
  });

  it("reuses checkpointed planning outputs and makes no call for them", async () => {
    const spy = stubNodes();
    const checkpoint = {
      ...emptyCheckpoint(),
      beat: ["a1"],
      director: directorResolve,
      interpret: { readings: [reading(true)] },
      adjudicate: { rulings: [] },
    };
    const ctx = makeCtx({ checkpoint });
    const outcome = await runTurn(ctx, spy.nodes);
    expect(outcome.status).toBe("completed");
    expect(spy.order).toEqual(["assemble", "resolve", "narrate", "audit"]);
  });

  it("saves the checkpoint after each planning node and freezes the beat", async () => {
    const saved: ReturnType<typeof emptyCheckpoint>[] = [];
    const spy = stubNodes({ interpret: { readings: [reading(true)] } });
    const ctx = makeCtx({
      deps: {
        saveCheckpoint: async (c) => {
          saved.push(c);
          return true;
        },
      },
    });
    await runTurn(ctx, spy.nodes);
    expect(saved[0]?.beat).toEqual(["a1"]);
    expect(saved.at(-1)?.director).not.toBeNull();
    expect(saved.at(-1)?.interpret).not.toBeNull();
    expect(saved.at(-1)?.adjudicate).not.toBeNull();
  });

  it("stops before the next node when the fence is false", async () => {
    const spy = stubNodes();
    let n = 0;
    const ctx = makeCtx({
      deps: { fence: async () => ++n <= 2 },
    });
    const outcome = await runTurn(ctx, spy.nodes);
    expect(outcome).toMatchObject({
      status: "failed",
      node: "interpret",
      error: { kind: "fenced" },
    });
    expect(spy.order).toEqual(["assemble", "director"]);
  });

  it("fails fenced when the stage write is refused", async () => {
    const spy = stubNodes();
    const ctx = makeCtx({ deps: { setStage: async () => false } });
    const outcome = await runTurn(ctx, spy.nodes);
    expect(outcome).toMatchObject({
      status: "failed",
      error: { kind: "fenced" },
    });
    expect(spy.order).toEqual([]);
  });

  it("turns a thrown node into an internal error without leaking the message", async () => {
    const spy = stubNodes({ throws: "director" });
    const outcome = await runTurn(makeCtx(), spy.nodes);
    expect(outcome).toMatchObject({
      status: "failed",
      node: "director",
      error: { kind: "internal" },
    });
    if (outcome.status === "failed") {
      expect(outcome.error.message).not.toContain("prompt text");
    }
  });

  it("returns a failed outcome with the node's error", async () => {
    const spy = stubNodes({ fail: "interpret" });
    const outcome = await runTurn(makeCtx(), spy.nodes);
    expect(outcome).toMatchObject({
      status: "failed",
      node: "interpret",
      error: { kind: "gateway" },
    });
    if (outcome.status === "failed") expect(outcome.calls).toHaveLength(2);
  });

  it("fails the turn with state-overflow when interpret's state cannot fit, and makes no call", async () => {
    const { projections, seed } = greyhollowFight();
    const base = buildSnapshot(projections, seed);
    const template = base.actors[0];
    if (!template) throw new Error("fixture has no actors");
    const snapshot = {
      ...base,
      actors: Array.from({ length: 150 }, (_, i) => ({
        ...template,
        id: `big-${i}`,
        name: `Overflow Beast ${i}`,
        kind: "monster" as const,
      })),
    };
    const spy = stubNodes({ assemble: assembled({ snapshot }) });
    let chats = 0;
    const logs: Record<string, unknown>[] = [];
    spy.nodes.interpret = interpret;
    const ctx = makeCtx({
      deps: {
        gateway: {
          chat: () => {
            chats++;
            throw new Error("a model call was made");
          },
        },
        log: (e) => logs.push(e as Record<string, unknown>),
      },
    });
    const outcome = await runTurn(ctx, spy.nodes);
    expect(chats).toBe(0);
    expect(outcome).toMatchObject({
      status: "failed",
      node: "interpret",
      error: {
        kind: "state-overflow",
        detail: { view: "dm", actors: 150, node: "interpret" },
      },
    });
    expect(logs.some((l) => l.event === "dm.node.state-overflow")).toBe(true);
  });

  it("makes no call on an empty beat", async () => {
    const spy = stubNodes({ assemble: assembled({ beat: [] }) });
    const outcome = await runTurn(makeCtx(), spy.nodes);
    expect(outcome).toEqual({ status: "empty-beat" });
    expect(spy.order).toEqual(["assemble"]);
  });

  it("runs the talk path for a talk trigger with an empty beat", async () => {
    const spy = stubNodes({
      assemble: assembled({
        beat: [],
        projections: projectDm([]),
        snapshot: { actors: [] },
      } as never),
    });
    const outcome = await runTurn(
      makeCtx({ job: { trigger: "talk", triggerSeq: 1 } }),
      spy.nodes,
    );
    expect(outcome).toMatchObject({ status: "talk", shipped: false });
    expect(spy.order).toEqual(["assemble"]);
  });

  it.each(["commit", "approval", "npc-turn", "manual", "reconcile"] as const)(
    "still returns empty-beat for the %s trigger",
    async (trigger) => {
      const spy = stubNodes({ assemble: assembled({ beat: [] }) });
      const outcome = await runTurn(makeCtx({ job: { trigger } }), spy.nodes);
      expect(outcome).toEqual({ status: "empty-beat" });
    },
  );

  it("does not treat an empty beat as empty on scene start", async () => {
    const spy = stubNodes({ assemble: assembled({ beat: [] }) });
    const outcome = await runTurn(
      makeCtx({ job: { trigger: "scene-start" } }),
      spy.nodes,
    );
    expect(outcome.status).toBe("completed");
  });

  it("does not treat an empty beat as empty when an NPC acts", async () => {
    const spy = stubNodes({
      assemble: assembled({
        beat: [],
        npcTurn: { combatantId: "snag", srdMonsterId: "goblin-warrior" },
      }),
    });
    const outcome = await runTurn(makeCtx(), spy.nodes);
    expect(outcome.status).toBe("completed");
  });

  it("runs resolve in hold mode and returns held", async () => {
    const hold = {
      ...directorResolve,
      beat: { decision: "hold", companions: ["bram"], reason: "ask Bram" },
    } as unknown as NodeOutputs["director"];
    const spy = stubNodes({ director: hold });
    const outcome = await runTurn(makeCtx(), spy.nodes);
    expect(outcome).toMatchObject({ status: "held", companions: ["bram"] });
    // A held turn keeps its calls (TASK-0116): the stub nodes made calls.
    expect(
      outcome.status === "held" ? outcome.calls.length : 0,
    ).toBeGreaterThan(0);
    expect(spy.order).toEqual(["assemble", "director", "resolve"]);
  });

  it("gives only resolve the real gate (AC #5)", async () => {
    const realGate = makeDeps().gate;
    const spy = stubNodes();
    await runTurn(makeCtx({ deps: { gate: realGate } }), spy.nodes);
    for (const name of NODE_NAMES) {
      if (name === "adjudicate") continue;
      if (name === "resolve") expect(spy.gates[name]).toBe(realGate);
      else expect(spy.gates[name]).toBe(throwingGate);
    }
    expect(() => (throwingGate.submit as unknown as () => void)()).toThrow(
      /resolve/,
    );
    expect(depsFor(makeDeps(), "director").gate).toBe(throwingGate);
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const spy = stubNodes();
    const outcome = await runTurn(
      makeCtx({ signal: controller.signal }),
      spy.nodes,
    );
    expect(outcome).toMatchObject({
      status: "failed",
      error: { kind: "aborted" },
    });
  });

  it("each node is a plain async function of one argument", async () => {
    const { assemble } = await import("../../src/dm/nodes/assemble.js");
    const { director } = await import("../../src/dm/nodes/director.js");
    const { interpret } = await import("../../src/dm/nodes/interpret.js");
    const { adjudicate } = await import("../../src/dm/nodes/adjudicate.js");
    for (const node of [assemble, director, interpret, adjudicate]) {
      expect(node.length).toBe(1);
      expect(node.constructor.name).toBe("AsyncFunction");
    }
    expect(testSeed().seedId).toBe("greyhollow-ford");
  });
});

describe("runTurn post-planning cut (specs/064)", () => {
  const chk = (skill: string) => ({
    step: "check",
    reason: `${skill} check`,
    combatantId: "pc-ana",
    kind: "ability-check",
    ability: "dex",
    skill,
    expression: "1d20+3",
    mode: "normal",
    dc: 12,
    autoFail: null,
    onSuccess: [],
    onFailure: [],
    stakes: {
      success: null,
      cost: "It works, at a small price.",
      failure: "The attempt comes to nothing.",
      severe: "It goes badly wrong.",
    },
    onCost: [],
    onSevere: [],
    newRisk: null,
  });
  const planReading = () =>
    ({
      ...reading(false),
      steps: [chk("stealth"), chk("persuasion")],
    }) as unknown as NodeOutputs["interpret"]["readings"][number];
  const free = assembled({
    projections: { tableMode: { mode: "free" } },
  } as never);
  const turnDirector = {
    ...directorResolve,
    tableMode: { to: "turn", encounterId: "e1" },
    trackers: [{ id: "alarm" }],
  } as unknown as NodeOutputs["director"];

  function spyResolve(spy: Spy) {
    const seen: { interpret?: unknown; director?: unknown }[] = [];
    const inner = spy.nodes.resolve;
    spy.nodes.resolve = (async (ctx) => {
      seen.push({
        interpret: ctx.results.interpret,
        director: ctx.results.director,
      });
      return inner(ctx);
    }) as typeof inner;
    return seen;
  }

  it("cuts once before resolve and stores cut: true in one save", async () => {
    const spy = stubNodes({
      assemble: free,
      director: turnDirector,
      interpret: { readings: [planReading()] },
    });
    const seen = spyResolve(spy);
    const saved: ReturnType<typeof emptyCheckpoint>[] = [];
    const ctx = makeCtx({
      deps: {
        saveCheckpoint: async (c) => {
          saved.push(c);
          return true;
        },
      },
    });
    await runTurn(ctx, spy.nodes);
    expect(seen).toHaveLength(1);
    const i = seen[0]?.interpret as NodeOutputs["interpret"];
    expect(i.readings[0]?.steps).toHaveLength(1);
    expect(i.readings[0]?.followUps).toEqual(["persuasion check"]);
    const d = seen[0]?.director as NodeOutputs["director"];
    expect(d.tableMode).toEqual({ to: "stay" });
    expect(d.trackers).toEqual([]);
    expect(saved.at(-1)?.cut).toBe(true);
    expect(saved.at(-1)?.interpret?.readings[0]?.steps).toHaveLength(1);
  });

  it("asks before an undeclared method and holds the turn (spec 077)", async () => {
    const stealthRead = {
      ...reading(false),
      steps: [{ ...chk("stealth"), combatantId: "tamsin" }],
    } as unknown as NodeOutputs["interpret"]["readings"][number];
    const spy = stubNodes({
      assemble: assembled({
        beat: [
          {
            actionId: "a1",
            committedSeq: 11,
            actor: "00000000-0000-4000-8000-000000000001",
            characterId: "tamsin",
            scope: "character",
            text: "We move toward the reed camp.",
            status: "committed",
          },
        ],
        projections: { tableMode: { mode: "free" } },
      } as never),
      director: turnDirector,
      interpret: { readings: [stealthRead] },
    });
    const seen = spyResolve(spy);
    const saved: ReturnType<typeof emptyCheckpoint>[] = [];
    const ctx = makeCtx({
      deps: {
        saveCheckpoint: async (c) => {
          saved.push(c);
          return true;
        },
      },
    });
    await runTurn(ctx, spy.nodes);
    const i = seen[0]?.interpret as NodeOutputs["interpret"];
    expect(i.readings[0]?.steps).toEqual([]);
    expect(i.readings[0]?.clarify).toMatch(/unseen/);
    const d = seen[0]?.director as NodeOutputs["director"];
    expect(d.overrides.some((o) => o.reason === CLARIFY_HELD)).toBe(true);
    expect(saved.at(-1)?.interpret?.readings[0]?.clarify).toMatch(/unseen/);
  });

  it("does not cut or hold again on a reclaim with cut: true", async () => {
    const spy = stubNodes();
    const cutReading = {
      ...planReading(),
      steps: [chk("stealth")],
      followUps: ["persuasion check"],
    };
    const ctx = makeCtx({
      checkpoint: {
        ...emptyCheckpoint(),
        beat: ["a1"],
        cut: true,
        director: turnDirector,
        interpret: { readings: [cutReading] } as never,
        adjudicate: { rulings: [] },
      },
    });
    const seen = spyResolve(spy);
    spy.nodes.assemble = (async () => ({
      ok: true,
      node: "assemble",
      calls: [],
      output: free,
    })) as never;
    await runTurn(ctx, spy.nodes);
    const held = seen[0]?.director as NodeOutputs["director"];
    expect(held.tableMode).toEqual({
      to: "turn",
      encounterId: "e1",
    });
  });

  it("never cuts a hold beat", async () => {
    const spy = stubNodes({
      assemble: free,
      director: {
        ...turnDirector,
        beat: { decision: "hold", companions: [] },
      } as never,
      interpret: { readings: [planReading()] },
    });
    const saved: ReturnType<typeof emptyCheckpoint>[] = [];
    const ctx = makeCtx({
      deps: {
        saveCheckpoint: async (c) => {
          saved.push(c);
          return true;
        },
      },
    });
    const out = await runTurn(ctx, spy.nodes);
    expect(out.status).toBe("held");
    expect(saved.some((c) => c.cut)).toBe(false);
  });
});
