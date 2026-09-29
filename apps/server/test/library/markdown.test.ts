import { describe, expect, it } from "vitest";
import { ValidationError } from "../../src/errors.js";
import { parseMarkdown } from "../../src/library/ingest/markdown.js";

/**
 * Unit tests for the Markdown block splitter (specs/017-ingestion-pipeline
 * T026, contracts/ingest-modules.md). Fixtures are inline and synthetic.
 */

const BOOK = "Fixture Markdown Book";

describe("parseMarkdown", () => {
  it("span equality for every block", () => {
    const book = parseMarkdown({
      book: BOOK,
      text: "# Title\n\nIntro paragraph.\n\n## Section\n\nMore text.",
    });
    for (const block of book.blocks) {
      expect(book.text.slice(block.anchor.start, block.anchor.end)).toBe(
        block.text,
      );
    }
  });

  it("ATX headings push the path stack", () => {
    const book = parseMarkdown({
      book: BOOK,
      text: "# Title\n\nIntro.\n\n## Section One\n\nBody one.\n\n### Sub\n\nBody sub.\n\n## Section Two\n\nBody two.",
    });
    const headingPaths = book.blocks
      .filter((b) => b.kind === "heading")
      .map((b) => b.path);
    expect(headingPaths).toEqual([
      [BOOK, "Title"],
      [BOOK, "Title", "Section One"],
      [BOOK, "Title", "Section One", "Sub"],
      [BOOK, "Title", "Section Two"],
    ]);
    const bodyTwo = book.blocks.find((b) => b.text === "Body two.");
    expect(bodyTwo?.path).toEqual([BOOK, "Title", "Section Two"]);
  });

  it("a fenced code block stays one whole prose block", () => {
    const fence = "```js\nconst x = 1;\n\nconst y = 2;\n```";
    const book = parseMarkdown({
      book: BOOK,
      text: `# Title\n\n${fence}\n\nAfter.`,
    });
    const fenced = book.blocks.find((b) => b.text.includes("const x = 1;"));
    expect(fenced?.kind).toBe("prose");
    expect(fenced?.text).toBe(fence);
  });

  it("consecutive `|` lines stay one whole table block", () => {
    const table = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const book = parseMarkdown({
      book: BOOK,
      text: `# Title\n\n${table}\n\nAfter.`,
    });
    const tableBlock = book.blocks.find((b) => b.kind === "table");
    expect(tableBlock?.text).toBe(table);
  });

  it("consecutive list-item lines form one list block", () => {
    const list = "- one\n- two\n- three";
    const book = parseMarkdown({
      book: BOOK,
      text: `# Title\n\n${list}\n\nAfter.`,
    });
    const listBlock = book.blocks.find((b) => b.kind === "list");
    expect(listBlock?.text).toBe(list);
  });

  it("blank-line-separated text forms separate prose paragraphs", () => {
    const book = parseMarkdown({
      book: BOOK,
      text: "First paragraph.\n\nSecond paragraph.",
    });
    const prose = book.blocks.filter((b) => b.kind === "prose");
    expect(prose.map((b) => b.text)).toEqual([
      "First paragraph.",
      "Second paragraph.",
    ]);
  });

  it("CRLF input parses the same as LF input", () => {
    const lf = parseMarkdown({
      book: BOOK,
      text: "# Title\n\nIntro paragraph.\n\n## Section\n\nMore text.",
    });
    const crlf = parseMarkdown({
      book: BOOK,
      text: "# Title\r\n\r\nIntro paragraph.\r\n\r\n## Section\r\n\r\nMore text.",
    });
    expect(
      crlf.blocks.map((b) => ({ kind: b.kind, path: b.path, text: b.text })),
    ).toEqual(
      lf.blocks.map((b) => ({ kind: b.kind, path: b.path, text: b.text })),
    );
  });

  it("throws ValidationError on empty text", () => {
    expect(() => parseMarkdown({ book: BOOK, text: "" })).toThrow(
      ValidationError,
    );
  });

  it("throws ValidationError on whitespace-only text", () => {
    expect(() => parseMarkdown({ book: BOOK, text: "   \n\n  \n" })).toThrow(
      ValidationError,
    );
  });
});
