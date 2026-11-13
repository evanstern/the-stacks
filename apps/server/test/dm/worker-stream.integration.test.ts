import { afterAll, describe, expect, it } from "vitest";
import type { NarrationPart } from "../../src/dm/pipeline/context.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  commitAction,
  createWorld,
  db,
  loudSkip,
  reachable,
  startScene,
} from "./world.js";

/** Spec 108 FR-007: the worker sends `end` when a turn job finishes, on every outcome. */

loudSkip("worker-stream.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

describe.skipIf(!reachable)("DM worker narration stream (database)", () => {
  it("sends rows first and `end` last for a turn that ships", async () => {
    const s = script("shutter-check.json");
    const w = await createWorld({ dice: s.dice, calls: s.calls });
    const got: [string, NarrationPart][] = [];
    const { worker } = workerFor(w, {
      onNarrationStream: (sid, p) => got.push([sid, p]),
    });
    await startScene(w);
    await commitAction(w, "Tamsin forces the stuck shutter.", "act-shutter");
    await tick();
    await drainAll(worker);
    const mine = got.filter(([sid]) => sid === w.sessionId).map(([, p]) => p);
    const turnJobs = new Set(mine.map((p) => p.jobId));
    expect(mine.length).toBeGreaterThan(1);
    // Per job: `end` is the last part, exactly once.
    for (const id of turnJobs) {
      const own = mine.filter((p) => p.jobId === id);
      expect(own.at(-1)?.slot).toBe("end");
      expect(own.filter((p) => p.slot === "end")).toHaveLength(1);
    }
    expect(mine.some((p) => p.slot === "rows")).toBe(true);
    expect(mine.some((p) => p.slot === "describe")).toBe(true);
  });

  it("sends `end` when the turn fails", async () => {
    const w = await createWorld({ calls: [] });
    const got: NarrationPart[] = [];
    const { worker } = workerFor(w, {
      onNarrationStream: (_sid, p) => got.push(p),
    });
    await startScene(w);
    await commitAction(w, "Tamsin knocks.", "act-knock");
    await tick();
    await worker.drain();
    expect(got.at(-1)?.slot).toBe("end");
  });
});
