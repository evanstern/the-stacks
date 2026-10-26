import { describe, expect, it } from "vitest";
import { hasPlainD20, parseDiceExpression, rollParsed } from "../src/dice.js";
import { scriptedRng } from "../src/index.js";

function terms(expr: string) {
  const r = parseDiceExpression(expr);
  if (!r.ok) throw new Error(`${expr}: ${r.code}`);
  return r.terms;
}

describe("parseDiceExpression", () => {
  it("parses the grammar", () => {
    expect(terms("d20")).toEqual([
      { kind: "dice", sign: 1, count: 1, sides: 20, keep: null },
    ]);
    expect(terms("1d20+5")).toEqual([
      { kind: "dice", sign: 1, count: 1, sides: 20, keep: null },
      { kind: "modifier", value: 5 },
    ]);
    expect(terms("4d6kh3")[0]).toMatchObject({
      count: 4,
      sides: 6,
      keep: { mode: "highest", n: 3 },
    });
    expect(terms("2d20kl1")[0]).toMatchObject({
      keep: { mode: "lowest", n: 1 },
    });
    expect(terms("1d20+5+1d4")).toHaveLength(3);
    expect(terms("1d20+5-1d4")[2]).toMatchObject({ sign: -1, sides: 4 });
    expect(terms("-1d4+2")[0]).toMatchObject({ sign: -1 });
    expect(terms("  2D6 + 3 ")).toEqual(terms("2d6+3"));
    expect(terms("2D6KH1")[0]).toMatchObject({
      keep: { mode: "highest", n: 1 },
    });
  });

  it("rejects malformed and zero cases", () => {
    for (const bad of [
      "3d",
      "d",
      "1d0",
      "0d6",
      "4d6kh0",
      "1d20++2",
      "",
      "abc",
    ]) {
      const r = parseDiceExpression(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.code, bad).toBe("INVALID_DICE_EXPRESSION");
    }
  });

  it("enforces limits at and one past each bound", () => {
    const ok = ["100d6", "1d1000", "4d6kh4", "1d4+1000", "1d4-1000"];
    for (const e of ok) expect(parseDiceExpression(e).ok, e).toBe(true);
    const over = ["101d6", "1d1001", "4d6kh5", "1d4+1001", "1d4-1001"];
    for (const e of over) {
      const r = parseDiceExpression(e);
      expect(r.ok, e).toBe(false);
      if (!r.ok) expect(r.code, e).toBe("DICE_LIMIT_EXCEEDED");
    }
    const twenty = Array(20).fill("1").join("+");
    expect(parseDiceExpression(twenty).ok).toBe(true);
    const r21 = parseDiceExpression(Array(21).fill("1").join("+"));
    expect(r21.ok).toBe(false);
    const len200 = `1d4${"+1".repeat(98)}`.padEnd(200, " ");
    expect(len200.length).toBe(200);
    expect(parseDiceExpression(len200).ok).toBe(false); // 99 terms: term limit, not length
    const tooLong = `${"1".repeat(201)}`;
    const rl = parseDiceExpression(tooLong);
    expect(rl.ok).toBe(false);
    if (!rl.ok) expect(rl.code).toBe("DICE_LIMIT_EXCEEDED");
  });
});

describe("hasPlainD20", () => {
  it("accepts exactly one plain positive 1d20", () => {
    expect(hasPlainD20(terms("1d20+5"))).toBe(true);
    expect(hasPlainD20(terms("1d20+5+1d4"))).toBe(true);
    for (const e of ["2d20", "1d20kh1", "1d6", "1d20+1d20", "-1d20"]) {
      expect(hasPlainD20(terms(e)), e).toBe(false);
    }
  });
});

describe("rollParsed critical doubling", () => {
  it("doubles dice counts and keeps modifiers", () => {
    const rng = scriptedRng([1, 2, 3, 4]);
    const r = rollParsed(
      terms("2d6+3"),
      { mode: "normal", critical: true },
      rng,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(rng.calls()).toBe(4);
    expect(r.total).toBe(13);
    expect(r.terms[0]).toMatchObject({ count: 4, faces: [1, 2, 3, 4] });
  });

  it("refuses a doubled count over the limit with no draw", () => {
    const rng = scriptedRng([]);
    const r = rollParsed(
      terms("60d6"),
      { mode: "normal", critical: true },
      rng,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("DICE_LIMIT_EXCEEDED");
    expect(rng.calls()).toBe(0);
  });
});
