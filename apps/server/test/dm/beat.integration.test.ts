import { afterAll, describe, expect, it } from "vitest";
import { listDmJobs } from "../../src/dm/jobs.js";
import { resolve as realResolve } from "../../src/dm/nodes/resolve.js";
import { DEFAULT_NODES } from "../../src/dm/worker.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  commitAction,
  createWorld,
  db,
  loudSkip,
  reachable,
  readRows,
  requireDb,
  startScene,
} from "./world.js";

loudSkip("beat.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const director = {
  purpose: "dm.director",
  respond: {
    type: "json",
    value: {
      beat: { decision: "resolve" },
      tableMode: { to: "stay" },
      trackers: [],
      scene: { status: "continue" },
      pacing: { tension: "low", spotlight: null, beatId: "ferry-house" },
      goalNote: "",
      companionPrompts: [],
    },
  },
};

const check = (actionId: string, _reason: string) => ({
  actionId,
  stages: [
    {
      intent: {
        kind: "check",
        targets: [],
        params: { skill: "athletics", difficulty: "medium" },
      },
      beside: {
        stakes: {
          success: "The attempt works as intended.",
          cost: "It works, at a small price.",
          failure: "The attempt comes to nothing.",
          severe: "It goes badly wrong.",
        },
        onSuccess: [],
        onFailure: [],
        onCost: [],
        onSevere: [],
        newRisk: null,
        reveals: null,
        autoFail: null,
      },
    },
  ],
  clarify: null,
  followUps: [],
});
// A player-seat difficulty is ignored (spec 097): the AI seat rules on each check.
const rule = {
  purpose: "dm.adjudicate",
  respond: {
    type: "json",
    value: { decision: "accept", difficulty: "medium" },
  },
};

const interpret = (...readings: unknown[]) => ({
  purpose: "dm.interpret",
  respond: { type: "json", value: { readings } },
});
const narrate = (value: string) => ({
  purpose: "dm.narrate",
  respond: { type: "text", value },
});

describe.skipIf(!reachable)("the beat queue (database)", () => {
  it("queues one turn for actions committed during a turn, resolved in commit order", async () => {
    const w = await createWorld({
      dice: [15, 16, 17],
      calls: [
        rule,
        rule,
        rule,
        // Turn 1: act-first only.
        director,
        interpret(check("act-first", "Tamsin forces the shutter")),
        narrate(
          "The shutter groans, then gives way under Tamsin's shoulder and lets the grey light in.",
        ),
        // Turn 2: act-second then act-third, in commit order.
        director,
        interpret(
          check("act-third", "Tamsin pries at the lintel"),
          check("act-second", "Tamsin tests the floorboards"),
        ),
        narrate(
          "Tamsin pries the lintel free and tests the boards, and both hold firm beneath her boots.",
        ),
        {
          purpose: "dm.chronicle",
          respond: { type: "json", value: { entries: [] } },
        },
      ],
    });

    // Resolve parks until released, so the beat is "inside resolve".
    let release!: () => void;
    const gate = new Promise<void>((res) => {
      release = res;
    });
    let entered!: () => void;
    const inside = new Promise<void>((res) => {
      entered = res;
    });
    let parked = false;
    const { worker } = workerFor(w, {
      nodes: {
        ...DEFAULT_NODES,
        resolve: async (ctx) => {
          if (!parked) {
            parked = true;
            entered();
            await gate;
          }
          return realResolve(ctx);
        },
      },
    });

    await startScene(w);
    await commitAction(w, "Tamsin forces the stuck shutter.", "act-first");
    await tick();
    const running = worker.processOne();
    await inside;

    // Two more commits land while the first beat is held inside resolve.
    await commitAction(w, "Tamsin tests the floorboards.", "act-second");
    await commitAction(w, "Tamsin pries at the lintel.", "act-third");
    await tick();

    const during = await listDmJobs(requireDb(), w.sessionId, 10, "turn");
    expect(during.filter((j) => j.status === "running")).toHaveLength(1);
    expect(during.filter((j) => j.status === "queued")).toHaveLength(1);

    release();
    expect(await running).toBe(true);
    await drainAll(worker);

    // An AI-seat ruling request also queues a `ruling` turn (spec 102); it finds nothing open.
    const turns = (await listDmJobs(requireDb(), w.sessionId, 10, "turn"))
      .reverse()
      .filter((j) => (j.input as { trigger?: string }).trigger !== "ruling");
    expect(turns.map((j) => j.status)).toEqual(["succeeded", "succeeded"]);

    // Beat 1 held only act-first; beat 2 held the two later commits, in commit order.
    const beats = turns.map(
      (j) => (j.result as { checkpoint: { beat: string[] } }).checkpoint.beat,
    );
    expect(beats).toEqual([["act-first"], ["act-second", "act-third"]]);
    const resolved = (await readRows(w))
      .filter((r) => r.type === "action.resolved")
      .map((r) => (r.payload as { actionId: string }).actionId);
    expect(resolved).toEqual(["act-first", "act-second", "act-third"]);
    expect(w.scripted.remaining().dice).toBe(0);
  });
});
