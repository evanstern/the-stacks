import { activeActorFor } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { listDmJobs } from "../../src/dm/jobs.js";
import { clearDmJobsBeforeEach, tick, workerFor } from "./worker-world.js";
import {
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
  type World,
} from "./world.js";

// TASK-0165 (spec 060, FR-016): a seated human DM's end-encounter and
// table-mode requests apply directly through the real gate, and the enqueuer
// queues what rule 4 says.

loudSkip("human-dm-encounter.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const PARTY = ["tamsin", "odo", "kestrel"];
/** One d20 per party combatant, in PARTY order; the 20 goes first. */
const diceFor = (first: string) => PARTY.map((id) => (id === first ? 20 : 1));

function outcome(r: { ok: boolean; outcome?: string; refusal?: unknown }) {
  return r.ok ? r.outcome : r.refusal;
}

/** Scene started under the AI seat, a human DM seated, initiative rolled, turn mode on. */
async function inTurnMode(first: string) {
  const w = await createWorld({ dice: diceFor(first) });
  workerFor(w);
  await startScene(w);
  const seat = await w.as(operator, {
    kind: "dm.seat",
    reason: "A human takes the DM seat",
    after: { kind: "human", userId: HUMAN_DM },
  });
  expect(seat.ok ? "ok" : seat.refusal).toBe("ok");
  const rolled = await w.as(operator, {
    kind: "mechanics",
    command: {
      type: "initiative.roll",
      participants: PARTY.map((combatantId) => ({
        combatantId,
        mode: "normal",
      })),
      reason: "Combat begins",
    },
    actionId: null,
    visibility: "public",
  });
  expect(outcome(rolled)).toBe("applied");
  const p = await w.projections();
  expect(p.encounter?.activeCombatantId).toBe(first);
  const turn = await w.as(operator, {
    kind: "table-mode",
    reason: "Turn order begins",
    after: {
      mode: "turn",
      ...activeActorFor(p, p.encounter?.activeCombatantId as string),
    },
  });
  expect(outcome(turn)).toBe("applied");
  await tick();
  return w;
}

async function jobCount(w: World) {
  const db_ = requireDb();
  const turns = await listDmJobs(db_, w.sessionId, 100, "turn");
  const companions = await listDmJobs(db_, w.sessionId, 100, "companion");
  return { turns: turns.length, companions: companions.length };
}

const endBody = {
  kind: "mechanics",
  command: { type: "encounter.end", reason: "The fight is over" },
  actionId: null,
  visibility: "public",
};
const freeBody = {
  kind: "table-mode",
  reason: "The DM switches to free mode.",
  after: { mode: "free" },
};

describe.skipIf(!reachable)(
  "a seated human DM ends an encounter or changes table mode (database)",
  () => {
    it("(a) encounter.end then free mode apply, write public rows, and queue no turn job", async () => {
      const w = await inTurnMode("tamsin");
      const before = await jobCount(w);
      const start = (await readRows(w)).length;

      const ended = await w.as(operator, endBody);
      expect(outcome(ended)).toBe("applied");
      const freed = await w.as(operator, freeBody);
      expect(outcome(freed)).toBe("applied");
      await tick();

      const rows = (await readRows(w)).slice(start);
      const endedRow = rows.find((r) => r.type === "encounter.ended");
      expect(endedRow).toMatchObject({ actor: HUMAN_DM, visibility: "public" });
      const modeRow = rows.find((r) => r.type === "table-mode.changed");
      expect(modeRow).toMatchObject({ actor: HUMAN_DM, visibility: "public" });
      expect(
        (modeRow?.payload as { after?: { mode: string } } | undefined)?.after
          ?.mode,
      ).toBe("free");

      const p = await w.projections();
      expect(p.encounter).toBeNull();
      expect(p.tableMode.mode).toBe("free");
      expect(await jobCount(w)).toEqual(before);
    });

    it("(b) free then turn keeps the encounter and queues one companion turn job for a companion", async () => {
      const w = await inTurnMode("odo");
      const freed = await w.as(operator, freeBody);
      expect(outcome(freed)).toBe("applied");
      await tick();
      const before = await jobCount(w);
      const p = await w.projections();
      expect(p.encounter).not.toBeNull();

      const back = await w.as(operator, {
        kind: "table-mode",
        reason: "The DM switches to turn mode.",
        after: {
          mode: "turn",
          ...activeActorFor(p, p.encounter?.activeCombatantId as string),
        },
      });
      expect(outcome(back)).toBe("applied");
      await tick();

      const after = await jobCount(w);
      expect(after.companions - before.companions).toBe(1);
      expect(after.turns).toBe(before.turns);
      const jobs = await listDmJobs(requireDb(), w.sessionId, 100, "companion");
      expect(
        jobs.some(
          (j) =>
            (j.input as { reason?: string }).reason === "turn" &&
            JSON.stringify(j.input).includes("odo"),
        ),
      ).toBe(true);
      const p2 = await w.projections();
      expect(p2.encounter).not.toBeNull();
      expect(p2.tableMode.mode).toBe("turn");
    });

    it("(b2) free then turn queues no job when a human is active", async () => {
      const w = await inTurnMode("tamsin");
      expect(outcome(await w.as(operator, freeBody))).toBe("applied");
      await tick();
      const before = await jobCount(w);
      const p = await w.projections();
      const back = await w.as(operator, {
        kind: "table-mode",
        reason: "The DM switches to turn mode.",
        after: {
          mode: "turn",
          ...activeActorFor(p, p.encounter?.activeCombatantId as string),
        },
      });
      expect(outcome(back)).toBe("applied");
      await tick();
      expect(await jobCount(w)).toEqual(before);
      expect((await w.projections()).encounter).not.toBeNull();
    });

    it("(c) a player is refused NOT_AUTHORIZED, and a second end is refused NO_ACTIVE_ENCOUNTER", async () => {
      const w = await inTurnMode("tamsin");

      const asPlayerEnd = await w.as(player, endBody);
      expect(asPlayerEnd.ok).toBe(false);
      if (!asPlayerEnd.ok)
        expect(asPlayerEnd.refusal.code).toBe("NOT_AUTHORIZED");
      const asPlayerMode = await w.as(player, freeBody);
      expect(asPlayerMode.ok).toBe(false);
      if (!asPlayerMode.ok)
        expect(asPlayerMode.refusal.code).toBe("NOT_AUTHORIZED");
      expect((await w.projections()).encounter).not.toBeNull();

      expect(outcome(await w.as(operator, endBody))).toBe("applied");
      const second = await w.as(operator, endBody);
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.refusal.code).toBe("NO_ACTIVE_ENCOUNTER");
        expect(second.refusal.source).toBe("engine");
      }
    });
  },
);
