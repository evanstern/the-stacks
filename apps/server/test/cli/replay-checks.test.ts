import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Export,
  format,
  replay,
  splitShipped,
} from "../../src/cli/replay-checks.js";

const sample = JSON.parse(
  readFileSync(
    new URL("../fixtures/c-aud-export.sample.json", import.meta.url),
    "utf8",
  ),
) as Export;

describe("replay-checks (spec 103 C-AUD)", () => {
  it("counts one clean, one leak and one fallback turn", () => {
    const r = replay(sample);
    expect(r.turns).toBe(3);
    expect([r.auditCalls, r.narrateCalls]).toEqual([2, 2]);
    const g = Object.fromEntries(r.groups.map((x) => [x.old, x]));
    expect(g.passed).toMatchObject({
      turns: 2,
      clean: 1,
      leak: 1,
      contradiction: 0,
    });
    expect(g.fallback).toMatchObject({ turns: 1, clean: null, leak: 0 });
    expect(r.leakKinds).toEqual({ "dm-only-text": 1 });
    expect(format(r)).toContain(
      "turns narrated: 3   dm.audit calls: 2   dm.narrate calls: 2",
    );
  });

  it("splits prose from dice lines at the first digit line", () => {
    expect(splitShipped("Prose here.\n\nA — B: 1d20 → 4 = 4: Miss")).toEqual({
      prose: "Prose here.",
      rows: ["A — B: 1d20 → 4 = 4: Miss"],
    });
    expect(splitShipped("Only prose.").rows).toEqual([]);
  });
});
