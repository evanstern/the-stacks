import { describe, expect, it } from "vitest";
import { BAND_FEET, band, path, rangeOf, reachCovers } from "../src/index.js";
import { mk } from "./helpers.js";

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("path", () => {
  it("walks the cheapest open path", () => {
    const s = mk(
      ["a", "b", "c"],
      [
        ["a", "b", 20],
        ["b", "c", 20],
      ],
    );
    expect(path(s, "a", "c")).toEqual({ zones: ["a", "b", "c"], feet: 40 });
    expect(path(s, "a", "a")).toEqual({ zones: ["a"], feet: 0 });
  });
  it("skips blocked edges and returns null with no passable path", () => {
    const s = mk(["a", "b"], [["a", "b", 5, "blocked"]]);
    expect(path(s, "a", "b")).toBeNull();
    expect(path(s, "a", "nope")).toBeNull();
  });
  it("doubles squeeze and climb, not door", () => {
    expect(
      path(mk(["a", "b"], [["a", "b", 10, "squeeze"]]), "a", "b")?.feet,
    ).toBe(20);
    expect(
      path(mk(["a", "b"], [["a", "b", 10, "climb"]]), "a", "b")?.feet,
    ).toBe(20);
    expect(path(mk(["a", "b"], [["a", "b", 10, "door"]]), "a", "b")?.feet).toBe(
      10,
    );
  });
  it("prefers a longer route when the short one is a squeeze", () => {
    const s = mk(
      ["a", "b", "c"],
      [
        ["a", "c", 30, "squeeze"],
        ["a", "b", 20],
        ["b", "c", 20],
      ],
    );
    expect(path(s, "a", "c")).toEqual({ zones: ["a", "b", "c"], feet: 40 });
  });
  it("tie-breaks lexicographically", () => {
    const s = mk(
      ["a", "x", "m", "z"],
      [
        ["a", "x", 10],
        ["x", "z", 10],
        ["a", "m", 10],
        ["m", "z", 10],
      ],
    );
    expect(path(s, "a", "z")?.zones).toEqual(["a", "m", "z"]);
  });
});

describe("band", () => {
  const s = mk(
    ["a", "b", "c", "d", "e"],
    [
      ["a", "b", 5],
      ["b", "c", 5],
      ["c", "d", 5],
      ["a", "e", 5, "blocked"],
    ],
  );
  it("counts passable edges", () => {
    expect(band(s, "a", "a")).toBe("engaged");
    expect(band(s, "a", "b")).toBe("near");
    expect(band(s, "a", "c")).toBe("far");
    expect(band(s, "a", "d")).toBe("out");
  });
  it("is out across a blocked edge or unknown zone", () => {
    expect(band(s, "a", "e")).toBe("out");
    expect(band(s, "a", "zz")).toBe("out");
  });
});

describe("rules", () => {
  it("BAND_FEET", () =>
    expect(BAND_FEET).toEqual({ engaged: 5, near: 30, far: 120 }));
  it("reachCovers only engaged", () => {
    expect(reachCovers("engaged", 5)).toBe(true);
    expect(reachCovers("near", 10)).toBe(false);
    expect(reachCovers("engaged", 0)).toBe(false);
  });
  it("rangeOf", () => {
    expect(rangeOf("far", { normal: 80, long: 320 })).toBe("long");
    expect(rangeOf("far", { normal: 120, long: 360 })).toBe("normal");
    expect(rangeOf("far", { normal: 20, long: 60 })).toBe("out");
    expect(rangeOf("near", { normal: 20, long: 60 })).toBe("long");
    expect(rangeOf("out", { normal: 1000, long: 1000 })).toBe("out");
  });
});

describe("seeded property checks", () => {
  function randomSpace(rnd: () => number, n: number) {
    const ids = Array.from({ length: n }, (_, i) => `z${i}`);
    const edges: [string, string, number, "open" | "squeeze" | "blocked"][] =
      [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (rnd() < 0.4) {
          const k = rnd();
          edges.push([
            `z${i}`,
            `z${j}`,
            5 * (1 + Math.floor(rnd() * 6)),
            k < 0.15 ? "blocked" : k < 0.35 ? "squeeze" : "open",
          ]);
        }
    return mk(ids, edges);
  }
  function brute(
    s: ReturnType<typeof mk>,
    from: string,
    to: string,
  ): number | null {
    let best: number | null = null;
    const walk = (at: string, seen: Set<string>, ft: number) => {
      if (best !== null && ft >= best) return;
      if (at === to) {
        best = ft;
        return;
      }
      for (const e of s.edges) {
        if (e.kind === "blocked") continue;
        const nxt = e.from === at ? e.to : e.to === at ? e.from : null;
        if (nxt === null || seen.has(nxt)) continue;
        walk(
          nxt,
          new Set([...seen, nxt]),
          ft + (e.kind === "squeeze" ? e.feet * 2 : e.feet),
        );
      }
    };
    walk(from, new Set([from]), 0);
    return best;
  }
  it("band is symmetric and path is minimal against brute force", () => {
    const rnd = mulberry32(42);
    for (let trial = 0; trial < 30; trial++) {
      const s = randomSpace(rnd, 7);
      for (const a of s.zones) {
        for (const b of s.zones) {
          expect(band(s, a.id, b.id)).toBe(band(s, b.id, a.id));
          expect(path(s, a.id, b.id)?.feet ?? null).toBe(brute(s, a.id, b.id));
        }
      }
    }
  });
});

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
