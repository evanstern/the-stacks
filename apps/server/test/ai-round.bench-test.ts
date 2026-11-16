import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { listDmJobs } from "../src/dm/jobs.js";
import { parseSeed } from "../src/dm/seed/load.js";
import {
  cmd,
  fresh,
  nextJob,
  run,
  turnInto,
} from "./dm/encounter-lifecycle.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  workerFor,
} from "./dm/worker-world.js";
import {
  createWorld,
  db,
  loudSkip,
  player,
  requireDb,
  TAMSIN_USER,
} from "./dm/world.js";

/**
 * Spec 107 (TASK-0299, R1 exit criterion 3): one full 4v4 round on the fake model through the
 * real gate, queue and worker. Run by `pnpm check:timing`, serially. No provider key.
 */
loudSkip("../ai-round.bench-test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

// constitution IX: "A combat round of 4 PCs and 4 monsters MUST take under 60 s of wall time."
const BUDGET_MS = 60000;

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(HERE, p), "utf8"));
const seed = parseSeed(read("dm/fixtures/greyhollow-ford-4v4.json"));
const script = read("dm/scripts/ai-round-4v4.json") as {
  dice: number[];
  calls: unknown[];
};

describe.skipIf(!db)("4v4 round bench (database)", () => {
  it("one round under budget, no interpret, three companion calls, one director call", async () => {
    const w = await createWorld({
      dice: script.dice,
      calls: script.calls,
      seed,
    });
    const started = await w.runResolve({
      job: {
        trigger: "scene-start",
        start: { seedId: seed.seedId, seats: { tamsin: TAMSIN_USER } },
      },
    });
    if (!started.result.ok) throw new Error(started.result.error.message);
    fresh(w);
    await run(w, { director: turnInto(), job: nextJob() });
    fresh(w);
    // Everyone in the reed camp, except one goblin one edge away (monster-policy step 7).
    for (const id of ["tamsin", "odo", "kestrel", "wren"]) {
      await cmd(w, {
        type: "combatant.place",
        combatantId: id,
        zoneId: "reed-camp",
      });
    }
    await cmd(w, {
      type: "combatant.place",
      combatantId: "goblin-4",
      zoneId: "reed-marsh",
    });

    const { worker } = workerFor(w, { loadSeed: () => seed });
    let stop = -1;
    let armed = false;
    w.gate.onAppended((_s, rows) => {
      if (!armed || stop >= 0) return;
      const hit = rows.some(
        (r) =>
          r.type === "table-mode.changed" &&
          JSON.stringify((r.payload as { after?: unknown }).after).includes(
            '"activeCharacterId":"tamsin"',
          ),
      );
      if (hit) stop = performance.now();
    });
    const declared = await w.as(player, {
      kind: "action.declare",
      action: {
        actionId: "act-round",
        characterId: "tamsin",
        scope: "character",
        text: '/attack @goblin-2 with "Longsword"',
      },
    });
    if (!declared.ok) throw new Error(`declare: ${declared.refusal.code}`);
    armed = true;
    const start = performance.now();
    const committed = await w.as(player, {
      kind: "action.commit",
      actionId: "act-round",
    });
    if (!committed.ok) throw new Error(`commit: ${committed.refusal.code}`);
    await drainAll(worker);

    const calls = w.scripted.provider.chatCalls.map((c) => c.request.purpose);
    const count = (p: string) => calls.filter((x) => x === p).length;
    const jobs = await listDmJobs(requireDb(), w.sessionId, 100);
    const ms = stop - start;
    const ok = stop >= 0 && ms < BUDGET_MS;
    console.log(
      `ai-round 4v4 ms=${ms.toFixed(0)} budget=${BUDGET_MS}ms ${ok ? "OK" : "FAIL"} model-calls: companion=${count("dm.companion")} director=${count("dm.director")} narrate=${count("dm.narrate")} interpret=${count("dm.interpret")}`,
    );
    for (const j of [...jobs].reverse()) {
      if (j.startedAt && j.finishedAt)
        console.log(
          `  job ${j.kind} ${j.status} ${j.finishedAt.getTime() - j.startedAt.getTime()}ms`,
        );
    }
    expect(stop, "human never became active in round 2").toBeGreaterThanOrEqual(
      0,
    );
    expect(ms, `round took ${ms.toFixed(0)}ms (constitution IX)`).toBeLessThan(
      BUDGET_MS,
    );
    expect(jobs.filter((j) => j.status === "failed")).toEqual([]);
    expect(count("dm.interpret")).toBe(0);
    expect(count("dm.companion")).toBe(3);
    expect(
      count("dm.director"),
      "companions skip the Director (spec 118)",
    ).toBe(1);
    expect(count("dm.narrate")).toBe(8);
  }, 120_000);
});
