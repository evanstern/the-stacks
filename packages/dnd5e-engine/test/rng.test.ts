import { describe, expect, it } from "vitest";
import { scriptedRng, seededRng } from "../src/index.js";
import { RngContractError, ScriptedDiceError } from "../src/rng.js";

describe("seededRng", () => {
  it("repeats for the same seed", () => {
    const a = seededRng(7);
    const b = seededRng(7);
    const fa = Array.from({ length: 1000 }, () => a.rollDie(20));
    const fb = Array.from({ length: 1000 }, () => b.rollDie(20));
    expect(fa).toEqual(fb);
  });

  it("differs for different seeds", () => {
    const a = seededRng(1);
    const b = seededRng(2);
    const fa = Array.from({ length: 100 }, () => a.rollDie(20));
    const fb = Array.from({ length: 100 }, () => b.rollDie(20));
    expect(fa).not.toEqual(fb);
  });

  it("stays in range and reaches every face", () => {
    for (const sides of [4, 6, 20, 100]) {
      const rng = seededRng(99);
      const seen = new Set<number>();
      for (let i = 0; i < 10000; i += 1) {
        const f = rng.rollDie(sides);
        expect(f).toBeGreaterThanOrEqual(1);
        expect(f).toBeLessThanOrEqual(sides);
        seen.add(f);
      }
      expect(seen.size).toBe(sides);
    }
  });

  it("rejects a bad seed", () => {
    expect(() => seededRng(-1)).toThrow(RngContractError);
    expect(() => seededRng(1.5)).toThrow(RngContractError);
    expect(() => seededRng(2 ** 32)).toThrow(RngContractError);
  });
});

describe("scriptedRng", () => {
  it("returns faces in order and tracks counts", () => {
    const rng = scriptedRng([3, 5, 1]);
    expect(rng.remaining()).toBe(3);
    expect(rng.rollDie(6)).toBe(3);
    expect(rng.rollDie(6)).toBe(5);
    expect(rng.calls()).toBe(2);
    expect(rng.rollDie(6)).toBe(1);
    expect(rng.remaining()).toBe(0);
  });

  it("throws when exhausted", () => {
    const rng = scriptedRng([2]);
    rng.rollDie(6);
    expect(() => rng.rollDie(6)).toThrow(ScriptedDiceError);
  });

  it("throws on an out-of-range face", () => {
    expect(() => scriptedRng([7]).rollDie(6)).toThrow(ScriptedDiceError);
    expect(() => scriptedRng([0]).rollDie(6)).toThrow(ScriptedDiceError);
  });
});
