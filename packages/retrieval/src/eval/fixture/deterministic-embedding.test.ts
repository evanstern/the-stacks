/**
 * T026 (010 US4): the fixture embedding's determinism IS its contract
 * (research R8) — same text, same vector, on every machine, forever. The
 * frozen components below pin the generator against accidental "harmless"
 * rewrites: change the math and the CI floor's history stops meaning
 * anything.
 */
import { describe, expect, it } from "vitest";

import { deterministicEmbedding, FIXTURE_EMBEDDING_STAMP } from "./deterministic-embedding";

describe("deterministicEmbedding", () => {
  it("is deterministic and unit-normalized", () => {
    const a = deterministicEmbedding("grapple stamina cost");
    const b = deterministicEmbedding("grapple stamina cost");
    expect(a).toEqual(b);
    expect(a).toHaveLength(FIXTURE_EMBEDDING_STAMP.dimensions);
    const norm = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 10);
  });

  it("different texts land on different vectors", () => {
    expect(deterministicEmbedding("a")).not.toEqual(deterministicEmbedding("b"));
  });

  it("frozen regression pin: the first components never drift", () => {
    // Computed once at fixture creation (2026-07-11); a change here is a
    // generator change and invalidates every historical floor value — bump
    // model "deterministic-v1" deliberately if you ever mean it.
    const v = deterministicEmbedding("pin");
    expect(v.slice(0, 3).map((x) => x.toFixed(6))).toEqual([
      "0.204653",
      "-0.188128",
      "-0.161116",
    ]);
  });
});
