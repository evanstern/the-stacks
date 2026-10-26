import { describe, expect, it } from "vitest";
import {
  depsFor,
  NODE_NAMES,
  type Node,
  type NodeName,
  type NodeOutputs,
  throwingGate,
} from "../../src/dm/pipeline/context.js";
import { type Nodes, runTurn } from "../../src/dm/pipeline/runner.js";
import { emptyCheckpoint, makeCtx, makeDeps, testSeed } from "./helpers.js";

const assembled = (over: Partial<NodeOutputs["assemble"]> = {}) =>
  ({
    projections: {},
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

  it("makes no call on an empty beat", async () => {
    const spy = stubNodes({ assemble: assembled({ beat: [] }) });
    const outcome = await runTurn(makeCtx(), spy.nodes);
    expect(outcome).toEqual({ status: "empty-beat" });
    expect(spy.order).toEqual(["assemble"]);
  });

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
    expect(outcome).toEqual({ status: "held", companions: ["bram"] });
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
