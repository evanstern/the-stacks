import { describe, expect, it } from "vitest";
import {
  emptyState,
  execute,
  scriptedRng,
  seededRng,
} from "../../src/index.js";
import { countingRng, expectOk, expectRefusal } from "../helpers.js";

const run = (expression: string, mode = "normal", faces: number[] = []) => {
  const rng = scriptedRng(faces);
  const result = execute(
    emptyState(),
    { type: "roll", expression, mode, reason: "test" },
    rng,
  );
  return { result, rng };
};

describe("roll", () => {
  it("keeps the highest three of 4d6kh3", () => {
    const { result, rng } = run("4d6kh3", "normal", [6, 2, 5, 3]);
    const [event] = expectOk(result);
    expect(event).toMatchObject({
      type: "dice.rolled",
      purpose: "roll",
      total: 14,
      natural: null,
      combatantId: null,
    });
    if (event?.type !== "dice.rolled") throw new Error("wrong event");
    expect(event.terms[0]).toMatchObject({
      faces: [6, 2, 5, 3],
      kept: [true, false, true, true],
    });
    expect(rng.remaining()).toBe(0);
  });

  it("advantage keeps the higher d20", () => {
    const { result, rng } = run("1d20+2", "advantage", [4, 17]);
    const [event] = expectOk(result);
    expect(event).toMatchObject({ total: 19, natural: 17, mode: "advantage" });
    if (event?.type !== "dice.rolled") throw new Error("wrong event");
    expect(event.terms[0]).toMatchObject({
      count: 1,
      faces: [4, 17],
      kept: [false, true],
    });
    expect(rng.remaining()).toBe(0);
  });

  it("disadvantage keeps the lower d20", () => {
    const { result } = run("1d20", "disadvantage", [4, 17]);
    expect(expectOk(result)[0]).toMatchObject({ total: 4, natural: 4 });
  });

  it("sums bonus dice terms and subtracts negative ones", () => {
    const { result } = run("1d20+5+1d4", "normal", [10, 3]);
    expect(expectOk(result)[0]).toMatchObject({ total: 18, natural: 10 });
    const { result: r2 } = run("1d20-1d4", "normal", [10, 3]);
    expect(expectOk(r2)[0]).toMatchObject({ total: 7 });
  });

  it("allows a negative total", () => {
    const { result } = run("1d4-10", "normal", [2]);
    expect(expectOk(result)[0]).toMatchObject({ total: -8 });
  });

  it("is deterministic under a seed", () => {
    const cmd = {
      type: "roll",
      expression: "3d6",
      mode: "normal",
      reason: "t",
    };
    const a = execute(emptyState(), cmd, seededRng(5));
    const b = execute(emptyState(), cmd, seededRng(5));
    expect(a).toEqual(b);
  });

  it.each([
    ["3d", "INVALID_DICE_EXPRESSION"],
    ["0d6", "INVALID_DICE_EXPRESSION"],
    ["101d6", "DICE_LIMIT_EXCEEDED"],
    ["1d1001", "DICE_LIMIT_EXCEEDED"],
  ] as const)("refuses %s", (expression, code) => {
    const rng = countingRng(scriptedRng([]));
    const result = execute(
      emptyState(),
      { type: "roll", expression, mode: "normal", reason: "t" },
      rng,
    );
    if (code === "INVALID_DICE_EXPRESSION") {
      expectRefusal(result, "INVALID_DICE_EXPRESSION");
    } else {
      expectRefusal(result, "DICE_LIMIT_EXCEEDED");
    }
    expect(rng.draws()).toBe(0);
  });

  it.each(["2d20", "1d20kh1", "1d6", "1d20+1d20"])(
    "refuses advantage on %s",
    (expression) => {
      const rng = countingRng(scriptedRng([]));
      const result = execute(
        emptyState(),
        { type: "roll", expression, mode: "advantage", reason: "t" },
        rng,
      );
      expectRefusal(result, "ADVANTAGE_NOT_APPLICABLE");
      expect(rng.draws()).toBe(0);
    },
  );
});
