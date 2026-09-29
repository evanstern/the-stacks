import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDdbExport } from "../../src/library/ddb/index.js";
import { walkPages } from "../../src/library/ddb/walk.js";

/**
 * User Story 3 (specs/012-ddb-parser/tasks.md T017): a real D&D Beyond
 * export can be tested locally; absence skips visibly (SC-005). Nothing
 * here reads or logs real book text — only counts (constitution VIII).
 *
 * Amended by orchestrator 2026-09-28: per-book layout for multi-book
 * exports — `fixtures/private/ddb/<book>/**\/*.html`, one subdirectory per
 * book, each subdirectory parsed as its own book.
 */

const PRIVATE_DIR = fileURLToPath(
  new URL("../../../../fixtures/private/ddb", import.meta.url),
);

function isHidden(name: string): boolean {
  return name === "__MACOSX" || name.startsWith(".");
}

function listHtmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => entry.toLowerCase().endsWith(".html"))
    .filter((entry) => !entry.split(sep).some(isHidden))
    .sort()
    .map((entry) => join(dir, entry));
}

function listBookDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isHidden(entry.name))
    .map((entry) => entry.name)
    .sort();
}

const books = listBookDirs(PRIVATE_DIR)
  .map((name) => ({ name, files: listHtmlFiles(join(PRIVATE_DIR, name)) }))
  .filter((b) => b.files.length > 0);

if (books.length === 0) {
  console.warn(
    "ddb real-export suite SKIPPED: put D&D Beyond export pages in fixtures/private/ddb/ to run it",
  );
}

describe.skipIf(books.length === 0)(
  "parseDdbExport — private real-export suite (T017)",
  () => {
    for (const { name: book, files } of books) {
      describe(book, () => {
        const pages = files.map((f) => readFileSync(f, "utf8"));
        const parsed = parseDdbExport({ book, pages });

        it("reports per-book counts (counts only, no book text)", () => {
          const byKind: Record<string, number> = {};
          for (const b of parsed.blocks) {
            byKind[b.kind] = (byKind[b.kind] ?? 0) + 1;
          }
          const zeroBlockPages = files
            .map((f, i) => ({
              file: relative(PRIVATE_DIR, f),
              count: walkPages(book, [pages[i]]).blocks.length,
            }))
            .filter((p) => p.count === 0)
            .map((p) => p.file);
          console.log(
            `[ddb private] ${book}: pages=${files.length} blocks=${parsed.blocks.length} byKind=${JSON.stringify(byKind)} zeroBlockPages=${JSON.stringify(zeroBlockPages)}`,
          );
        });

        it("parses with at least one block", () => {
          expect(parsed.blocks.length).toBeGreaterThanOrEqual(1);
        });

        it("every anchor round-trips against the normalized text", () => {
          for (const block of parsed.blocks) {
            expect(
              parsed.text.slice(block.anchor.start, block.anchor.end),
            ).toBe(block.text);
          }
        });

        it("no block has empty text", () => {
          for (const block of parsed.blocks) {
            expect(block.text.length).toBeGreaterThan(0);
          }
        });

        it("every block's path is non-empty", () => {
          for (const block of parsed.blocks) {
            expect(block.path.length).toBeGreaterThan(0);
          }
        });

        it("block spans strictly increase and never overlap", () => {
          for (let i = 0; i < parsed.blocks.length; i++) {
            const anchor = parsed.blocks[i].anchor;
            expect(anchor.start).toBeLessThan(anchor.end);
            if (i > 0) {
              expect(anchor.start).toBeGreaterThanOrEqual(
                parsed.blocks[i - 1].anchor.end,
              );
            }
          }
        });
      });
    }
  },
);
