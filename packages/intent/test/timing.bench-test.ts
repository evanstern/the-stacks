import { describe, expect, it } from "vitest";
import { parse } from "../src/index.js";

// Wall-clock budget (TASK-0308 moved it out of property.test.ts). Runs only in
// `pnpm check:timing`, serially, so parallel turbo load cannot skew it.
describe("latency", () => {
  it("p95 of 1000 parses of a 200-character line is under 1 ms", () => {
    const line =
      `/attack @goblin-1 with "light crossbow" +adv -- ${"a quick shot at the beast ".repeat(7)}`.slice(
        0,
        200,
      );
    const ctx = {
      id: "i",
      actor: { kind: "pc", id: "t" } as const,
      source: "composer" as const,
      commit: "confirmed" as const,
    };
    for (let n = 0; n < 200; n++) parse(line, ctx); // warm up
    const ms: number[] = [];
    for (let n = 0; n < 1000; n++) {
      const t0 = performance.now();
      parse(line, ctx);
      ms.push(performance.now() - t0);
    }
    ms.sort((a, b) => a - b);
    expect(line.length).toBe(200);
    expect(ms[949] as number).toBeLessThan(1);
  });
});
