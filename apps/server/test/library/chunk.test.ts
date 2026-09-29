import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Block, ParsedBook } from "../../src/library/ddb/index.js";
import { parseDdbExport } from "../../src/library/ddb/index.js";
import { CHUNK_MAX_CHARS, chunkBook } from "../../src/library/ingest/chunk.js";

/**
 * Unit tests for `chunkBook` (specs/017-ingestion-pipeline Phase 3, T016):
 * invariants 1-7 in contracts/ingest-modules.md, over the three committed
 * DDB fixtures and hand-built books. Pure function — no database.
 */

const BOOK = "Fixture Sourcebook";

function readFixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/ddb/${name}`, import.meta.url)),
    "utf8",
  );
}

/** Builds a `ParsedBook` whose blocks' spans and text are correct by construction. */
function buildBook(
  book: string,
  parts: { path: string[]; kind: Block["kind"]; text: string }[],
): ParsedBook {
  let text = "";
  const blocks: Block[] = parts.map((p) => {
    if (text.length > 0) text += "\n\n";
    const start = text.length;
    text += p.text;
    const end = text.length;
    return {
      kind: p.kind,
      path: p.path,
      text: p.text,
      anchor: { book, path: p.path, start, end },
    };
  });
  return { book, text, blocks };
}

/** Asserts invariants 1, 5, and 7 hold for any `chunkBook` call. */
function assertCoreInvariants(
  input: ParsedBook,
  output: ParsedBook,
  maxChars: number,
) {
  expect(output.text).toBe(input.text); // invariant 7
  let cursor = 0;
  let consumedInputBlocks = 0;
  for (const chunk of output.blocks) {
    expect(output.text.slice(chunk.anchor.start, chunk.anchor.end)).toBe(
      chunk.text,
    ); // invariant 1
    expect(chunk.anchor.start).toBeGreaterThanOrEqual(cursor); // invariant 5: in order
    cursor = chunk.anchor.end;
    const spanned = input.blocks.filter(
      (b) =>
        b.anchor.start >= chunk.anchor.start &&
        b.anchor.end <= chunk.anchor.end,
    );
    consumedInputBlocks += spanned.length;
    if (spanned.length > 1) {
      expect(chunk.anchor.end - chunk.anchor.start).toBeLessThanOrEqual(
        maxChars,
      ); // invariant 4
    }
  }
  expect(consumedInputBlocks).toBe(input.blocks.length); // invariant 5: covers every block once
}

describe("chunkBook — DDB fixtures (round trip)", () => {
  const basicRules = parseDdbExport({
    book: BOOK,
    pages: [readFixture("basic-rules.html")],
  });
  const equipment = parseDdbExport({
    book: BOOK,
    pages: [readFixture("equipment.html")],
  });
  const bestiary = parseDdbExport({
    book: BOOK,
    pages: [readFixture("bestiary.html")],
  });

  it("invariants 1, 5, 7 hold over basic-rules.html at the default budget", () => {
    const chunked = chunkBook(basicRules);
    assertCoreInvariants(basicRules, chunked, CHUNK_MAX_CHARS);
  });

  it("invariant 2: every table in equipment.html becomes exactly one unchanged output block", () => {
    const inputTables = equipment.blocks.filter((b) => b.kind === "table");
    expect(inputTables.length).toBeGreaterThan(0);
    const chunked = chunkBook(equipment);
    const outputTables = chunked.blocks.filter((b) => b.kind === "table");
    expect(outputTables).toEqual(inputTables);
    assertCoreInvariants(equipment, chunked, CHUNK_MAX_CHARS);
  });

  it("invariant 2: every stat block in bestiary.html becomes exactly one unchanged output block", () => {
    const inputStatBlocks = bestiary.blocks.filter(
      (b) => b.kind === "statBlock",
    );
    expect(inputStatBlocks.length).toBeGreaterThan(0);
    const chunked = chunkBook(bestiary);
    const outputStatBlocks = chunked.blocks.filter(
      (b) => b.kind === "statBlock",
    );
    expect(outputStatBlocks).toEqual(inputStatBlocks);
    assertCoreInvariants(bestiary, chunked, CHUNK_MAX_CHARS);
  });
});

describe("chunkBook — hand-built invariants", () => {
  it("a heading plus short paragraphs under the same section merge into one prose chunk", () => {
    const book = buildBook(BOOK, [
      { path: [BOOK, "Ch. 1"], kind: "heading", text: "Chapter 1" },
      { path: [BOOK, "Ch. 1"], kind: "prose", text: "First paragraph." },
      { path: [BOOK, "Ch. 1"], kind: "prose", text: "Second paragraph." },
    ]);
    const chunked = chunkBook(book);
    expect(chunked.blocks).toHaveLength(1);
    expect(chunked.blocks[0].kind).toBe("prose");
    expect(chunked.blocks[0].path).toEqual([BOOK, "Ch. 1"]);
    assertCoreInvariants(book, chunked, CHUNK_MAX_CHARS);
  });

  it("invariant 3: blocks under different paths never merge", () => {
    const book = buildBook(BOOK, [
      { path: [BOOK, "Ch. 1"], kind: "prose", text: "Section one text." },
      { path: [BOOK, "Ch. 2"], kind: "prose", text: "Section two text." },
    ]);
    const chunked = chunkBook(book);
    expect(chunked.blocks).toHaveLength(2);
    expect(chunked.blocks[0].path).toEqual([BOOK, "Ch. 1"]);
    expect(chunked.blocks[1].path).toEqual([BOOK, "Ch. 2"]);
    assertCoreInvariants(book, chunked, CHUNK_MAX_CHARS);
  });

  it("invariant 2 + 4: a 5,000-char table under a section stays its own chunk, never merged", () => {
    const bigTable = "x".repeat(5000);
    const book = buildBook(BOOK, [
      { path: [BOOK, "Ch. 1"], kind: "heading", text: "Chapter 1" },
      { path: [BOOK, "Ch. 1"], kind: "table", text: bigTable },
      { path: [BOOK, "Ch. 1"], kind: "prose", text: "After the table." },
    ]);
    const chunked = chunkBook(book, { maxChars: 2000 });
    const tableChunk = chunked.blocks.find((b) => b.kind === "table");
    expect(tableChunk?.text).toBe(bigTable);
    expect(chunked.blocks).toHaveLength(3); // heading alone, table alone, trailing prose alone
    assertCoreInvariants(book, chunked, 2000);
  });

  it("invariant 4: an oversize single prose block stays whole, unmerged with neighbors", () => {
    const oversized = "y".repeat(3000);
    const book = buildBook(BOOK, [
      { path: [BOOK, "Ch. 1"], kind: "prose", text: oversized },
      { path: [BOOK, "Ch. 1"], kind: "prose", text: "Short tail." },
    ]);
    const chunked = chunkBook(book, { maxChars: 2000 });
    expect(chunked.blocks).toHaveLength(2);
    expect(chunked.blocks[0].text).toBe(oversized);
    assertCoreInvariants(book, chunked, 2000);
  });

  it("invariant 6: maxChars 0 returns one output block per input block (identity)", () => {
    const book = buildBook(BOOK, [
      { path: [BOOK, "Ch. 1"], kind: "heading", text: "Chapter 1" },
      { path: [BOOK, "Ch. 1"], kind: "prose", text: "First paragraph." },
      { path: [BOOK, "Ch. 1"], kind: "prose", text: "Second paragraph." },
    ]);
    const chunked = chunkBook(book, { maxChars: 0 });
    expect(chunked.blocks).toEqual(book.blocks);
  });

  it("astral-plane text keeps span equality after a merge", () => {
    const book = buildBook(BOOK, [
      {
        path: [BOOK, "Ch. 1"],
        kind: "heading",
        text: "A Dragon Appears \u{1F409}",
      },
      {
        path: [BOOK, "Ch. 1"],
        kind: "prose",
        text: "Roll for initiative \u{1F3B2}.",
      },
    ]);
    const chunked = chunkBook(book);
    expect(chunked.blocks).toHaveLength(1);
    assertCoreInvariants(book, chunked, CHUNK_MAX_CHARS);
  });
});
