import { describe, expect, it } from "vitest";
import { band, path } from "../src/index.js";
import { mk } from "./helpers.js";

// SC-005 (spec 094): a wall-clock budget, run alone by `pnpm check:timing`.
// It is excluded from `vitest run` because turbo runs every package's tests
// in parallel, so a shared CI runner measures load, not path() (TASK-0303).
describe("timing (SC-005)", () => {
  it("path and band on 64 zones take under 1 ms each", () => {
    const ids = Array.from({ length: 64 }, (_, i) => `z${i}`);
    const edges: [string, string, number][] = [];
    for (let i = 0; i < 63; i++) edges.push([`z${i}`, `z${i + 1}`, 5]);
    for (let i = 0; i < 60; i += 3) edges.push([`z${i}`, `z${i + 4}`, 10]);
    const s = mk(ids, edges);
    // Warm up, then take the median per-call time over 9 batches so one slow
    // batch on a shared CI runner cannot fail the test. The 1 ms budget stays.
    const perCall = (fn: () => unknown) => {
      for (let i = 0; i < 200; i++) fn();
      const batches: number[] = [];
      for (let b = 0; b < 9; b++) {
        const t = performance.now();
        for (let i = 0; i < 50; i++) fn();
        batches.push((performance.now() - t) / 50);
      }
      return batches.sort((x, y) => x - y)[4];
    };
    expect(perCall(() => path(s, "z0", "z63"))).toBeLessThan(1);
    expect(perCall(() => band(s, "z0", "z63"))).toBeLessThan(1);
  });
});
