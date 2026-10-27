import { seededRng } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { scenarioRng } from "../../src/playtest/dice.js";

describe("scenarioRng", () => {
  it("serves scripted faces first, then the seeded sequence", () => {
    const rng = scenarioRng([3, 7], 42);
    const ref = seededRng(42);
    expect(rng.rollDie(20)).toBe(3);
    expect(rng.rollDie(20)).toBe(7);
    for (let i = 0; i < 10; i++) expect(rng.rollDie(20)).toBe(ref.rollDie(20));
  });

  it("counts both kinds of draw", () => {
    const rng = scenarioRng([5], 1);
    rng.rollDie(6);
    rng.rollDie(6);
    rng.rollDie(6);
    expect(rng.drawn()).toBe(3);
    expect(rng.scriptedUsed()).toBe(1);
  });

  it("rejects a scripted face outside the die", () => {
    expect(() => scenarioRng([9], null).rollDie(6)).toThrow(/outside 1\.\.6/);
  });
});
