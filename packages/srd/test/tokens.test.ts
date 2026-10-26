import { describe, expect, it } from "vitest";
import { estimateTokens } from "../src/tokens.js";

describe("estimateTokens", () => {
  it.each([
    ["", 0],
    ["Goblin Warrior", 4],
    ["AC 15, HP 10 (3d6)", 10],
    ["Slashing", 2],
    ["1234567", 3],
  ])("golden: %j -> %i", (input, expected) => {
    expect(estimateTokens(input)).toBe(expected);
  });

  it("counts whitespace-only input as 0", () => {
    expect(estimateTokens(" \n\t  ")).toBe(0);
  });

  it("ignores whitespace amount", () => {
    expect(estimateTokens("a   b")).toBe(estimateTokens("a b"));
  });

  it("is deterministic across repeated calls", () => {
    const text = "Fixture Monster, AC 12 (2d8 + 4)";
    expect(estimateTokens(text)).toBe(estimateTokens(text));
  });
});
