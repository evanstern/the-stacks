import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ValidationError } from "../../src/errors.js";
import { parseDdbExport } from "../../src/library/ddb/index.js";

/**
 * User Story 1 (specs/012-ddb-parser/tasks.md T010, T013): an export becomes
 * ordered, anchored blocks. Fixture is synthetic/original text only
 * (constitution VIII) — see test/fixtures/ddb/README.md.
 */

const BOOK = "Fixture Sourcebook";

function readFixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/ddb/${name}`, import.meta.url)),
    "utf8",
  );
}

const basicRules = readFixture("basic-rules.html");

const CHROME_STRINGS = [
  "Home", // nav
  "Table of Contents", // article header top-next-nav
  "Posted by", // article header byline
  "Fixture footer text", // article footer
  "Fixture site footer", // ddb-footer
  "Jump to...", // nav-select
  "dataLayer", // script
  "max-width", // style
];

describe("parseDdbExport — US1: anchored sections", () => {
  const book = parseDdbExport({ book: BOOK, pages: [basicRules] });

  it("T010: every heading path is in document order, starting with the book title", () => {
    const headingPaths = book.blocks
      .filter((b) => b.kind === "heading")
      .map((b) => b.path);

    expect(headingPaths).toEqual([
      [BOOK, "Chapter 1: Basic Rules"],
      [BOOK, "Chapter 1: Basic Rules", "Ability Checks"],
      [BOOK, "Chapter 1: Basic Rules", "Advantage and Disadvantage"],
      [
        BOOK,
        "Chapter 1: Basic Rules",
        "Advantage and Disadvantage",
        "Rolling with Advantage",
      ],
      [BOOK, "Chapter 1: Basic Rules", "Movement"],
      [BOOK, "Chapter 1: Basic Rules", "Movement", "Difficult Terrain"],
      [
        BOOK,
        "Chapter 1: Basic Rules",
        "Movement",
        "Difficult Terrain",
        "Squeezing",
      ],
    ]);
  });

  it("T010: a skipped heading level (h2 -> h4) is recorded without an invented h3", () => {
    const rolling = book.blocks.find(
      (b) => b.text === "Rolling with Advantage",
    );
    expect(rolling?.path).toEqual([
      BOOK,
      "Chapter 1: Basic Rules",
      "Advantage and Disadvantage",
      "Rolling with Advantage",
    ]);
  });

  it("T010: every block's anchor round-trips against the normalized text", () => {
    for (const block of book.blocks) {
      expect(book.text.slice(block.anchor.start, block.anchor.end)).toBe(
        block.text,
      );
      expect(block.anchor.book).toBe(BOOK);
      expect(block.anchor.path).toEqual(block.path);
    }
  });

  it("T010: block spans strictly increase and never overlap", () => {
    for (let i = 0; i < book.blocks.length; i++) {
      const anchor = book.blocks[i].anchor;
      expect(anchor.start).toBeLessThan(anchor.end);
      if (i > 0) {
        expect(anchor.start).toBeGreaterThanOrEqual(
          book.blocks[i - 1].anchor.end,
        );
      }
    }
  });

  it("T010: no block contains site-chrome text", () => {
    for (const block of book.blocks) {
      for (const chrome of CHROME_STRINGS) {
        expect(block.text).not.toContain(chrome);
      }
    }
    expect(book.text).not.toMatch(/window\.dataLayer/);
  });

  it("T010: non-ASCII text is preserved exactly", () => {
    expect(book.text).toContain("Zoë");
    expect(book.text).toContain("—"); // em dash
    expect(book.text).toContain("’"); // curly apostrophe
  });

  it("T010: parsing the same fixture twice yields deep-equal output", () => {
    const again = parseDdbExport({ book: BOOK, pages: [basicRules] });
    expect(again).toEqual(book);
  });
});

describe("parseDdbExport — error paths (T013)", () => {
  it("throws ValidationError on empty pages", () => {
    expect(() => parseDdbExport({ book: BOOK, pages: [] })).toThrow(
      ValidationError,
    );
  });

  it("throws ValidationError when a page has no content root and no body", () => {
    expect(() =>
      parseDdbExport({
        book: BOOK,
        pages: [
          "<!DOCTYPE html><html><head><title>Empty</title></head></html>",
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for a non-DDB page with no content", () => {
    const nonDdb = `<!DOCTYPE html><html><body>
      <nav>Home</nav>
      <header>Site header</header>
      <footer>Site footer</footer>
    </body></html>`;
    expect(() => parseDdbExport({ book: BOOK, pages: [nonDdb] })).toThrow(
      ValidationError,
    );
  });
});
