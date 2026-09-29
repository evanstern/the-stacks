import { describe, expect, it } from "vitest";
import {
  type CiteToken,
  createCiteParser,
  locateQuote,
} from "../../src/library/cite.js";

/**
 * Phase 1 unit tests (specs/018-rules-answerer/tasks.md T003, contracts/
 * answer.md invariants 4-6, research R1). Pure: no database, no gateway.
 */

describe("locateQuote", () => {
  const passage =
    "You can use the Attack action to make a special melee attack, a grapple.";

  it("finds an exact match and returns its offsets", () => {
    const quote = "make a special melee attack";
    const start = passage.indexOf(quote);
    expect(locateQuote(passage, quote)).toEqual({
      start,
      end: start + quote.length,
    });
  });

  it("repairs whitespace drift (newline vs space, doubled spaces) to the passage's own offsets", () => {
    const drifted = "make a special\nmelee  attack";
    const exact = "make a special melee attack";
    const start = passage.indexOf(exact);
    const match = locateQuote(passage, drifted);
    expect(match).toEqual({ start, end: start + exact.length });
    expect(passage.slice(match?.start, match?.end)).toBe(exact);
  });

  it("repairs curly quotes and dashes to straight equivalents", () => {
    const straightPassage = 'You can use the "Attack" action to end the turn.';
    const quote = "the “Attack” action";
    const exact = 'the "Attack" action';
    const start = straightPassage.indexOf(exact);
    expect(locateQuote(straightPassage, quote)).toEqual({
      start,
      end: start + exact.length,
    });
  });

  it("rejects a paraphrase", () => {
    expect(locateQuote(passage, "you make a grappling attempt")).toBeNull();
  });

  it("rejects a case change", () => {
    expect(locateQuote(passage, "make a special melee ATTACK")).toBeNull();
  });

  it("rejects a quote under 3 words / 12 characters", () => {
    expect(locateQuote(passage, "a grapple")).toBeNull();
  });

  it("accepts the whole passage even when short", () => {
    const short = "Ok.";
    expect(locateQuote(short, "Ok.")).toEqual({ start: 0, end: short.length });
  });

  it("returns the first occurrence when the quote repeats", () => {
    const repeated = "attack, attack, attack the flank with a running attack";
    const quote = "attack, attack, attack";
    expect(locateQuote(repeated, quote)).toEqual({
      start: 0,
      end: quote.length,
    });
  });
});

function tokenText(tokens: CiteToken[]): string {
  return tokens
    .filter((t): t is { type: "text"; text: string } => t.type === "text")
    .map((t) => t.text)
    .join("");
}

describe("createCiteParser", () => {
  it("parses text, a citation, and trailing text unsplit", () => {
    const p = createCiteParser();
    const tokens = [
      ...p.push(
        'Grappling is an attack. <cite p="1">a special melee attack</cite> more.',
      ),
      ...p.end(),
    ];
    expect(tokens).toEqual([
      { type: "text", text: "Grappling is an attack. " },
      { type: "cite", p: "1", quote: "a special melee attack" },
      { type: "text", text: " more." },
    ]);
  });

  it("parses <refuse/> and tolerates <refuse />", () => {
    for (const marker of ["<refuse/>", "<refuse />"]) {
      const p = createCiteParser();
      const tokens = [...p.push(marker), ...p.end()];
      expect(tokens).toEqual([{ type: "refuse" }]);
    }
  });

  it("plain < and 'a < b' stay text", () => {
    const p = createCiteParser();
    const tokens = [...p.push("a < b and < end"), ...p.end()];
    expect(tokenText(tokens)).toBe("a < b and < end");
    expect(tokens.every((t) => t.type === "text")).toBe(true);
  });

  it("yields malformed for an unterminated marker at end()", () => {
    const p = createCiteParser();
    const tokens = [...p.push('before <cite p="1">never closes'), ...p.end()];
    expect(tokens).toEqual([
      { type: "text", text: "before " },
      { type: "malformed" },
    ]);
  });

  it("yields malformed for an oversized marker (over 1000 characters)", () => {
    const p = createCiteParser();
    const long = "x".repeat(1100);
    const tokens = [...p.push(`<cite p="1">${long}`), ...p.end()];
    expect(tokens.filter((t) => t.type === "malformed")).toHaveLength(1);
    expect(tokens.some((t) => t.type === "cite")).toBe(false);
  });

  it("a marker split at every possible character boundary parses identically to unsplit", () => {
    const fixture =
      'See the rules. <cite p="2">the exact quoted text</cite> and done.';
    const wholeTokens = (() => {
      const p = createCiteParser();
      return [...p.push(fixture), ...p.end()];
    })();
    // A push() boundary may fragment a run of plain text into more than one
    // "text" token (harmless: a consumer concatenates them), so compare the
    // non-text tokens exactly and the reassembled text as a whole.
    const nonText = (tokens: CiteToken[]) =>
      tokens.filter((t) => t.type !== "text");

    for (let i = 0; i <= fixture.length; i++) {
      const p = createCiteParser();
      const tokens = [
        ...p.push(fixture.slice(0, i)),
        ...p.push(fixture.slice(i)),
        ...p.end(),
      ];
      expect(nonText(tokens)).toEqual(nonText(wholeTokens));
      expect(tokenText(tokens)).toBe(tokenText(wholeTokens));
    }
  });

  it("holds a marker split across three text events", () => {
    const p = createCiteParser();
    const tokens = [
      ...p.push("start <ci"),
      ...p.push('te p="1">exact q'),
      ...p.push("uote here</cite> end"),
      ...p.end(),
    ];
    expect(tokens).toEqual([
      { type: "text", text: "start " },
      { type: "cite", p: "1", quote: "exact quote here" },
      { type: "text", text: " end" },
    ]);
  });
});
