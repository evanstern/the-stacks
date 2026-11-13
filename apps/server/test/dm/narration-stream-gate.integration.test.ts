import { afterAll, describe, expect, it } from "vitest";
import type { NarrationPart } from "../../src/dm/pipeline/context.js";
import {
  clearDmJobsBeforeEach,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  commitAction,
  createWorld,
  db,
  loudSkip,
  player,
  readRows,
  startScene,
} from "./world.js";

/**
 * Spec 108 AC #4: while narrate is paused mid-stream, the gate still accepts an `intent`
 * (free mode, and the floor holder in turn mode). Narrate holds no entry, lock or floor.
 */

loudSkip("narration-stream-gate.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

type Gw = Parameters<typeof workerFor>[1] extends infer O
  ? O extends { gateway?: infer G }
    ? NonNullable<G>
    : never
  : never;

/** Wraps the world gateway so the `dm.narrate` call stalls until `release()`. */
function pausing(base: Gw) {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let paused!: () => void;
  const reached = new Promise<void>((r) => {
    paused = r;
  });
  const gateway = {
    chat(req: Parameters<Gw["chat"]>[0]) {
      if (req.purpose !== "dm.narrate") return base.chat(req);
      return (async function* () {
        paused();
        await gate;
        yield* base.chat(req);
      })();
    },
  } as Gw;
  return { gateway, release, reached };
}

const intent = (id: string) => ({
  kind: "intent" as const,
  intent: {
    id,
    kind: "hide",
    actor: { kind: "pc", id: "tamsin" },
    source: "composer",
    commit: "confirmed",
  },
});

describe.skipIf(!db)(
  "narration stream does not hold the gate (database)",
  () => {
    async function run(mode: "free" | "turn") {
      const s = script("shutter-check.json");
      if (mode === "turn") {
        (
          s.calls[0] as {
            respond: { value: { tableMode: unknown } };
          }
        ).respond.value.tableMode = {
          to: "turn",
          encounterId: "reed-camp",
          reason: "Fight.",
        };
      }
      // 7 initiative dice (tamsin first), then the shutter check d20 and spare dice.
      const dice =
        mode === "turn"
          ? [20, 1, 1, 1, 1, 1, 1, ...s.dice, 15, 4, 4, 4]
          : [...s.dice, 12, 12];
      const w = await createWorld({ dice, calls: s.calls });
      const parts: NarrationPart[] = [];
      const p = pausing(w.ctx().deps.gateway as Gw);
      const { worker } = workerFor(w, {
        gateway: p.gateway,
        onNarrationStream: (_sid, part) => parts.push(part),
      });
      await startScene(w);
      await commitAction(w, "Tamsin forces the stuck shutter.", "act-shutter");
      await tick();
      const running = worker.processOne();
      await p.reached;
      // Narrate is mid-call: the rows part has gone out, no row has shipped yet.
      expect(parts.some((x) => x.slot === "rows")).toBe(true);
      expect((await readRows(w)).some((r) => r.type === "narration")).toBe(
        false,
      );
      const res = await w.as(player, intent("hide-during-narrate"));
      expect(res.ok).toBe(true);
      p.release();
      await running;
      return { w, parts };
    }

    it("free mode: an intent is accepted mid-narrate, then the narration row ships", async () => {
      const { w, parts } = await run("free");
      const rows = await readRows(w);
      expect(rows.some((r) => r.type === "narration")).toBe(true);
      expect(parts.at(-1)?.slot).toBe("end");
    });

    it("turn mode: the floor holder's intent is accepted mid-narrate", async () => {
      const { w } = await run("turn");
      expect((await readRows(w)).some((r) => r.type === "narration")).toBe(
        true,
      );
    });
  },
);
