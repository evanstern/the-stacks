import { describe, expect, it } from "vitest";
import { splitArrivals } from "../../src/dm/nodes/resolve.js";
import type { Step } from "../../src/dm/nodes/schemas.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { greyhollowFight } from "./snapshot-fixtures.js";

/** Spec 089: arrivals a check's stakes name wait for the band. */
const { projections, seed } = greyhollowFight();
const snapshot = buildSnapshot(projections, seed);
const check = (success: string): Step =>
  ({
    step: "check",
    stakes: {
      success,
      cost: null,
      failure: "Nothing clear.",
      severe: null,
    },
  }) as never;

describe("splitArrivals", () => {
  it("a success text naming Pell makes him dependent", () => {
    expect(
      splitArrivals(["pell"], [check("She spots Pell alive")], snapshot, seed),
    ).toEqual({ unconditional: [], dependent: ["pell"] });
  });
  it("no check, or a check that does not name him, is unconditional", () => {
    expect(splitArrivals(["pell"], [], snapshot, seed)).toEqual({
      unconditional: ["pell"],
      dependent: [],
    });
    expect(
      splitArrivals(["pell"], [check("She hears wind")], snapshot, seed),
    ).toEqual({ unconditional: ["pell"], dependent: [] });
  });
  it("a ruling's check counts the same", () => {
    const steps = [check("Pell is tied there")];
    expect(splitArrivals(["wenna", "pell"], steps, snapshot, seed)).toEqual({
      unconditional: ["wenna"],
      dependent: ["pell"],
    });
  });
});
