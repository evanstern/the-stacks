import { afterAll, describe, expect, it } from "vitest";
import { HOLD_ACT_TEXT, runCompanionJob } from "../../src/dm/companion.js";
import { listDmJobs } from "../../src/dm/jobs.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import {
  cmd,
  fresh,
  initDice,
  nextJob,
  run,
  turnInto,
} from "./encounter-lifecycle.js";
import { clearDmJobsBeforeEach, drainAll, workerFor } from "./worker-world.js";
import {
  createWorld,
  db,
  loudSkip,
  reachable,
  readRows,
  requireDb,
  startScene,
  type World,
} from "./world.js";

/**
 * Spec 107 US-1 (TASK-0299): a companion's own turn is typed Intents. The gateway is strict and
 * scripts no `dm.interpret`, so an interpret call fails the job.
 */
loudSkip("companion-turn-intents.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const reply = (turn: unknown) => ({
  purpose: "dm.companion",
  respond: {
    type: "json",
    value: { say: null, comment: null, act: null, pending: [], turn },
  },
});
const narrate = {
  purpose: "dm.narrate",
  respond: { type: "text", value: "Odo acts." },
};
const chronicle = ["a", "b", "c"].map(() => ({
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
}));

async function odoTurn(turn: unknown, logs: unknown[] = [], fight = false) {
  const w = await createWorld({
    // fight: initiative gives Odo the first turn (index 1 rolls 20); the rest are attack and damage faces.
    dice: fight
      ? [...initDice(1), 15, 6, 6, 6, 6]
      : [15, 12, 12, 12, 12, 12, 12, 12],
    calls: [reply(turn), narrate, ...chronicle],
  });
  await startScene(w);
  if (fight) {
    await run(w, { director: turnInto(), job: nextJob() });
    fresh(w);
    for (const id of ["snag", "goblin-2", "goblin-3"]) await kill(w, id);
    await cmd(w, {
      type: "damage.apply",
      targetId: "goblin-4",
      components: [
        { amount: { kind: "fixed", value: 6 }, damageType: "slashing" },
      ],
      critical: false,
      defenses: null,
    });
  }
  const res = fight
    ? { ok: true as const }
    : await w.gate.submit(
        w.sessionId,
        { kind: "ai", actor: "ai:dm" },
        {
          kind: "table-mode",
          summary: null,
          rationale: null,
          reason: "Test: Odo's turn.",
          after: {
            mode: "turn",
            activeActor: "ai:companion:odo",
            activeCharacterId: "odo",
          },
        },
      );
  if (!res.ok) throw new Error(`table-mode refused: ${res.refusal.code}`);
  const { worker } = workerFor(w); // attach before the commit so it queues the turn job
  const base = w.ctx().deps;
  const result = await runCompanionJob(
    {
      gateway: base.gateway,
      gate: base.gate,
      loadProjections: base.loadProjections,
      loadSeed: (id: string) => loadSeed(id),
      enqueueTurnForced: async () => {},
      fence: async () => true,
      log: (e: unknown) => void logs.push(e),
    },
    {
      id: "00000000-0000-4000-8000-0000000000c9",
      input: {
        v: 1 as const,
        sessionId: w.sessionId,
        companions: ["odo"],
        reason: "turn",
        beatJobId: null,
      },
    },
    new AbortController().signal,
  );
  return { w, result, worker };
}

const kill = (w: World, id: string) =>
  cmd(w, {
    type: "damage.apply",
    targetId: id,
    components: [
      { amount: { kind: "fixed", value: 99 }, damageType: "slashing" },
    ],
    critical: false,
    defenses: null,
  });

const purposes = (w: World) =>
  w.scripted.provider.chatCalls.map((c) => c.request.purpose);
const declaredText = async (w: World) =>
  (
    (await readRows(w)).find(
      (r) => r.type === "action.declared",
    ) as unknown as {
      payload: { text: string };
    }
  ).payload.text;

describe.skipIf(!reachable)("companion turns emit Intents (database)", () => {
  it("two valid bodies: one declare of two slash lines, then the turn job makes no interpret call", async () => {
    const { w, result, worker } = await odoTurn(
      [
        {
          kind: "attack",
          targets: [{ kind: "actor", id: "goblin-2" }],
          params: { weapon: "Mace" },
        },
        { kind: "dodge", targets: [], params: {} },
      ].slice(0, 1),
    );
    expect(result.calls).toHaveLength(1);
    const text = await declaredText(w);
    expect(text).toBe("/attack @goblin-2 with Mace");
    await drainAll(worker);
    expect(purposes(w)).not.toContain("dm.interpret");
    expect(purposes(w)).not.toContain("dm.director");
    expect(purposes(w)).toContain("dm.narrate");
    const jobs = await listDmJobs(requireDb(), w.sessionId, 50);
    expect(jobs.filter((j) => j.status === "failed")).toEqual([]);
  });

  it("a multi-line turn declares one line per body", async () => {
    const { w, worker } = await odoTurn([
      { kind: "stand", targets: [], params: {} },
      {
        kind: "attack",
        targets: [{ kind: "actor", id: "goblin-2" }],
        params: { weapon: "Mace" },
      },
    ]);
    expect((await declaredText(w)).split("\n")).toHaveLength(2);
    await drainAll(worker);
    expect(purposes(w)).not.toContain("dm.interpret");
    expect(purposes(w)).not.toContain("dm.director");
    expect(purposes(w)).toContain("dm.narrate");
  });

  it("an invalid body takes the hold act, and interpret still makes no call", async () => {
    const { w, worker } = await odoTurn([
      // Parses as a body but is no valid Intent: a move takes a zone, not an actor.
      {
        kind: "move",
        targets: [{ kind: "actor", id: "goblin-2" }],
        params: {},
      },
    ]);
    expect(await declaredText(w)).toBe(HOLD_ACT_TEXT);
    await drainAll(worker);
    expect(purposes(w)).not.toContain("dm.interpret");
    expect(purposes(w)).not.toContain("dm.director");
    expect(purposes(w)).toContain("dm.narrate");
  });

  it("a null or empty turn takes the hold act; the turn resolves with no interpret call and advances", async () => {
    for (const turn of [null, []]) {
      const { w, worker } = await odoTurn(turn);
      expect(await declaredText(w)).toBe(HOLD_ACT_TEXT);
      await drainAll(worker);
      expect(purposes(w)).not.toContain("dm.interpret");
      expect(purposes(w)).not.toContain("dm.director");
      expect(purposes(w)).not.toContain("dm.director");
      expect(purposes(w)).toContain("dm.narrate");
      expect(
        (await readRows(w)).some((r) => r.type === "intent.recorded"),
      ).toBe(false);
    }
  });

  it("a null turn logs dm.companion.turn-invalid with reason missing-turn and still holds", async () => {
    const logs: unknown[] = [];
    const { w } = await odoTurn(null, logs);
    expect(await declaredText(w)).toBe(HOLD_ACT_TEXT);
    expect(logs).toContainEqual(
      expect.objectContaining({
        event: "dm.companion.turn-invalid",
        reason: "missing-turn",
      }),
    );
  });

  it("a companion's killing blow ends the fight in code with no Director call (spec 118 FR-007)", async () => {
    const { w, worker } = await odoTurn(
      [
        {
          kind: "attack",
          targets: [{ kind: "actor", id: "goblin-4" }],
          params: { weapon: "Mace" },
        },
      ],
      [],
      true,
    );
    await drainAll(worker);
    expect(purposes(w)).not.toContain("dm.director");
    const rows = await readRows(w);
    expect(rows.filter((r) => r.type === "encounter.ended")).toHaveLength(1);
    const mode = rows.filter((r) => r.type === "table-mode.changed").at(-1);
    expect(mode?.payload).toMatchObject({
      after: { mode: "free" },
      reason: "No foe still stands.",
    });
  });
});
