import { describe, expect, it } from "vitest";
import { withholdRefusedInputs } from "../../src/dm/nodes/narrate.js";
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

/** Phase 3: the goal note promises no dice result. */
describe("goal note withhold on a failed check", () => {
  const facts = (band: string, goalNote: string) =>
    ({
      rulings: [],
      actions: [
        { actionId: "a1", followUps: [], rolls: [{ name: "Kestrel", band }] },
      ],
      director: { goalNote },
    }) as never;
  const state = { snapshot, diff: null };
  const detail =
    "Withheld goalNote: a check this beat failed, and the note was written before the dice.";
  it.each([
    ["severe-failure", "Give them who holds command here"],
    ["failure", "Reward the scan with one true thing: Pell alive at the post"],
  ])("withholds the note on %s", (band, note) => {
    const r = withholdRefusedInputs(facts(band, note), state);
    expect(r.facts.director.goalNote).toBe("");
    expect(r.withheld).toEqual([{ kind: "doctrine", detail }]);
  });
  it("keeps the note on a success", () => {
    const r = withholdRefusedInputs(
      facts("success", "Keep the post in view"),
      state,
    );
    expect(r.facts.director.goalNote).toBe("Keep the post in view");
    expect(r.withheld).toEqual([]);
  });
});
