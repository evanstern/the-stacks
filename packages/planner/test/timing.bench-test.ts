import { describe, expect, it } from "vitest";
import { plan } from "../src/index.js";
import { actors, baseState, intent, tgt, view } from "./fixtures.js";

// Wall-clock budget (TASK-0308 moved it out of determinism.test.ts). Runs only in
// `pnpm check:timing`, serially, so parallel turbo load cannot skew it.
describe("timing (planner)", () => {
  it("plans in under 5 ms on a 64-zone space (median of 20 after a warm-up)", () => {
    const s = baseState();
    const zones = Array.from({ length: 64 }, (_, n) => ({
      id: `z${n}`,
      name: `Zone ${n}`,
      kind: "area" as const,
      tags: [],
      hidden: false,
    }));
    s.engine.space = {
      zones: [...(s.engine.space?.zones ?? []), ...zones].slice(0, 64),
      edges: [{ from: "a", to: "b", kind: "open", feet: 30 }],
    };
    const i = intent("attack", {
      targets: [tgt("goblin-2")],
      params: { weapon: "Longsword" },
    });
    void actors;
    plan(s, view(s), i);
    const times: number[] = [];
    for (let n = 0; n < 20; n++) {
      const t0 = performance.now();
      plan(s, view(s), i);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[10] as number).toBeLessThan(5);
  });
});
