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
const equipment = readFixture("equipment.html");
const bestiary = readFixture("bestiary.html");

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

/**
 * User Story 2 (specs/012-ddb-parser/tasks.md T014): tables and stat blocks
 * become exactly one whole block each; sidebars are marked.
 */
describe("parseDdbExport — US2: tables whole", () => {
  const book = parseDdbExport({ book: BOOK, pages: [equipment] });
  const tables = book.blocks.filter((b) => b.kind === "table");

  it("T014: every table in the export becomes exactly one table block", () => {
    expect(tables).toHaveLength(3);
  });

  it("T014: a table with a header row and no merged cells", () => {
    expect(tables[0].table).toEqual({
      caption: "Simple Melee Weapons",
      header: ["Name", "Cost", "Damage", "Weight", "Properties"],
      rows: [
        ["Club", "1 sp", "1d4 bludgeoning", "2 lb.", "Light"],
        [
          "Dagger",
          "2 gp",
          "1d4 piercing",
          "1 lb.",
          "Finesse, light, thrown (range 20/60)",
        ],
        ["Quarterstaff", "2 sp", "1d6 bludgeoning", "4 lb.", "Versatile (1d8)"],
      ],
    });
  });

  it("T014: a table with a header column instead of a header row", () => {
    expect(tables[1].table).toEqual({
      caption: "Coin Values (in Copper)",
      header: [],
      rows: [
        ["Copper (cp)", "1"],
        ["Silver (sp)", "10"],
        ["Gold (gp)", "100"],
      ],
    });
  });

  it("T014: a merged (colspan) cell keeps its text without inventing columns", () => {
    expect(tables[2].table).toEqual({
      caption: "Adventuring Gear",
      header: ["Item", "Cost", "Weight"],
      rows: [
        ["Ammunition"],
        ["Arrows (20)", "1 gp", "1 lb."],
        ["Crossbow bolts (20)", "1 gp", "1.5 lb."],
      ],
    });
  });

  it("T014: every table block's anchor round-trips", () => {
    for (const block of book.blocks) {
      expect(book.text.slice(block.anchor.start, block.anchor.end)).toBe(
        block.text,
      );
    }
  });

  it("T014: no block contains site-chrome text", () => {
    for (const block of book.blocks) {
      for (const chrome of CHROME_STRINGS) {
        expect(block.text).not.toContain(chrome);
      }
    }
  });
});

describe("parseDdbExport — US2: stat blocks whole", () => {
  const book = parseDdbExport({ book: BOOK, pages: [bestiary] });
  const statBlocks = book.blocks.filter((b) => b.kind === "statBlock");

  it("T014: every stat block in the export becomes exactly one statBlock block", () => {
    expect(statBlocks).toHaveLength(3);
    expect(statBlocks.map((b) => b.statBlock?.name)).toEqual([
      "Goblin",
      "Wolf",
      "Cave Skitterer",
    ]);
  });

  it("T014: a complete stat block keeps its name and labelled fields, including ability scores", () => {
    const goblin = statBlocks[0];
    expect(goblin.statBlock?.fields.map((f) => f.label)).toEqual([
      "Armor Class",
      "Hit Points",
      "Speed",
      "Skills",
      "Senses",
      "Languages",
      "Challenge",
      "STR",
      "DEX",
      "CON",
      "INT",
      "WIS",
      "CHA",
    ]);
    expect(goblin.statBlock?.fields).toContainEqual({
      label: "Armor Class",
      value: "15 (leather armor, shield)",
    });
    expect(goblin.statBlock?.fields).toContainEqual({
      label: "STR",
      value: "8(-1)",
    });
  });

  it("T014: the malformed stat block (missing ability scores) still becomes one whole block", () => {
    const caveSkitterer = statBlocks[2];
    expect(caveSkitterer.statBlock?.name).toBe("Cave Skitterer");
    expect(caveSkitterer.statBlock?.fields.map((f) => f.label)).toEqual([
      "Armor Class",
      "Hit Points",
      "Speed",
    ]);
    expect(caveSkitterer.text).toContain("Cave Skitterer");
    expect(caveSkitterer.text).toContain("Bite");
  });

  it("T014: every stat-block anchor round-trips", () => {
    for (const block of book.blocks) {
      expect(book.text.slice(block.anchor.start, block.anchor.end)).toBe(
        block.text,
      );
    }
  });

  it("T014: no block contains site-chrome text", () => {
    for (const block of book.blocks) {
      for (const chrome of CHROME_STRINGS) {
        expect(block.text).not.toContain(chrome);
      }
    }
  });
});

describe("parseDdbExport — US2: sidebar marking", () => {
  it("T014: the sidebar in basic-rules.html becomes exactly one sidebar block", () => {
    const book = parseDdbExport({ book: BOOK, pages: [basicRules] });
    const sidebars = book.blocks.filter((b) => b.kind === "sidebar");
    expect(sidebars).toHaveLength(1);
    expect(sidebars[0].text).toContain("STACKING ADVANTAGE");
    expect(sidebars[0].text).toContain("never stack");
    expect(sidebars[0].path).toEqual([
      BOOK,
      "Chapter 1: Basic Rules",
      "Advantage and Disadvantage",
      "Rolling with Advantage",
    ]);
    expect(
      book.text.slice(sidebars[0].anchor.start, sidebars[0].anchor.end),
    ).toBe(sidebars[0].text);
  });
});

describe("parseDdbExport — headings: all (T025, generic HTML)", () => {
  const html = `<!doctype html><html><body>
    <h1>Untitled Guide</h1>
    <p>Intro paragraph.</p>
    <h2>Getting Started</h2>
    <p>Getting started text.</p>
    <h3>Installation</h3>
    <p>Installation text.</p>
  </body></html>`;

  it("an unclassed h2/h3 page gives paths from its headings", () => {
    const book = parseDdbExport(
      { book: BOOK, pages: [html] },
      { headings: "all" },
    );
    const headingPaths = book.blocks
      .filter((b) => b.kind === "heading")
      .map((b) => b.path);
    expect(headingPaths).toEqual([
      [BOOK, "Untitled Guide"],
      [BOOK, "Untitled Guide", "Getting Started"],
      [BOOK, "Untitled Guide", "Getting Started", "Installation"],
    ]);
    const intro = book.blocks.find((b) => b.text === "Intro paragraph.");
    expect(intro?.path).toEqual([BOOK, "Untitled Guide"]);
  });

  it("default 'ddb' mode does not promote unclassed h2/h3 to headings", () => {
    const book = parseDdbExport({ book: BOOK, pages: [html] });
    const headingPaths = book.blocks
      .filter((b) => b.kind === "heading")
      .map((b) => b.path);
    // Only the bare h1 (heading by tag alone) is picked up; h2/h3 without
    // `heading-anchor` are not.
    expect(headingPaths).toEqual([[BOOK, "Untitled Guide"]]);
  });

  it("every existing DDB fixture test passes unchanged (spot check)", () => {
    expect(parseDdbExport({ book: BOOK, pages: [basicRules] })).toEqual(
      parseDdbExport({ book: BOOK, pages: [basicRules] }, undefined),
    );
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
