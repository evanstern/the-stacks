import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import {
  cmd,
  fresh,
  initDice,
  nextJob,
  run,
  turnInto,
} from "./encounter-lifecycle.js";
import { clearDmJobsBeforeEach, workerFor } from "./worker-world.js";
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
 * Spec 107 US-2 (TASK-0299): a monster turn is code. The fake gateway is strict and scripts
 * only `dm.narrate`, so a `dm.director` or `dm.interpret` call fails the job.
 */
loudSkip("npc-turn-intents.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const narrate = {
  purpose: "dm.narrate",
  respond: { type: "text", value: "Snag lunges, scimitar flashing." },
};

async function inTurnMode(dice: number[], calls: unknown[]) {
  const w = await createWorld({
    dice,
    // Chronicle passes vary with idle timing; spare ones are harmless.
    calls: [
      ...calls,
      ...[1, 2, 3].map(() => ({
        purpose: "dm.chronicle",
        respond: { type: "json", value: { entries: [] } },
      })),
    ],
  });
  await startScene(w);
  await run(w, { director: turnInto(), job: nextJob() });
  fresh(w);
  return w;
}

async function monsterTurn(w: World) {
  const { worker } = workerFor(w);
  await enqueueTurn(requireDb(), w.sessionId, "npc-turn", null);
  await worker.processOne(); // the monster job only
  const jobs = await listDmJobs(requireDb(), w.sessionId, 50);
  return { jobs, rows: await readRows(w) };
}
const purposes = (w: World) =>
  w.scripted.provider.chatCalls.map((c) => c.request.purpose);

describe.skipIf(!reachable)(
  "monster turns emit Intents in code (database)",
  () => {
    it("a melee attack: one Intent, one model call (narrate), the turn advances", async () => {
      const w = await inTurnMode([...initDice(3), 15, 4, 4, 4], [narrate]);
      const before = purposes(w).length;
      // inTurnMode used no gateway calls; script narrate now.
      const { jobs, rows } = await monsterTurn(w);
      expect(jobs.filter((j) => j.status === "failed")).toEqual([]);
      expect(
        jobs.filter((j) => j.kind === "turn" && j.status === "succeeded"),
      ).toHaveLength(1);
      // The follow-up companion job may start; the monster job itself calls narrate only.
      const used = purposes(w).slice(before);
      expect(
        used.filter((p) => p === "dm.director" || p === "dm.interpret"),
      ).toEqual([]);
      expect(used.filter((p) => p === "dm.narrate")).toHaveLength(1);
      expect(rows.some((r) => r.type === "turn.advanced")).toBe(true);
    });

    it("no conscious party combatant: zero stages, the turn still advances", async () => {
      const w = await inTurnMode([...initDice(3), 15, 4, 4, 4], [narrate]);
      for (const id of ["tamsin", "odo", "kestrel"]) {
        await cmd(w, {
          type: "damage.apply",
          targetId: id,
          components: [
            { amount: { kind: "fixed", value: 99 }, damageType: "slashing" },
          ],
          critical: false,
          defenses: null,
        });
      }
      const before = purposes(w).length;
      const { jobs, rows } = await monsterTurn(w);
      expect(
        jobs.filter((j) => j.kind === "turn").map((j) => j.status),
      ).toContain("succeeded");
      const used = purposes(w).slice(before);
      expect(
        used.filter((p) => p === "dm.director" || p === "dm.interpret"),
      ).toEqual([]);
      expect(rows.some((r) => r.type === "turn.advanced")).toBe(true);
    });
  },
);
