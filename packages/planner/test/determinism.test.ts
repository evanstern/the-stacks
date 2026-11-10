import { INTENT_KINDS } from "@the-stacks/intent";
import { VALID } from "@the-stacks/intent/fixtures";
import { describe, expect, it } from "vitest";
import { plan } from "../src/index.js";
import { actors, baseState, intent, sansText, tgt, view } from "./fixtures.js";

const fixtures = INTENT_KINDS.flatMap((k) => VALID[k]);

describe("determinism", () => {
  it("plans every valid fixture twice to deep-equal results", () => {
    for (const i of fixtures) {
      const s = baseState();
      expect(plan(s, view(s), i), i.kind).toEqual(plan(s, view(s), i));
    }
  });

  it("is insensitive to text", () => {
    for (const i of fixtures) {
      const s = baseState();
      const other = {
        ...i,
        text: i.text === undefined ? undefined : "other words",
      };
      expect(sansText(plan(s, view(s), other as typeof i)), i.kind).toEqual(
        sansText(plan(s, view(s), i)),
      );
    }
  });

  it("does not mutate its inputs", () => {
    const s = baseState();
    const before = structuredClone(s);
    for (const i of fixtures) plan(s, view(s), i);
    expect(s).toEqual(before);
  });

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
