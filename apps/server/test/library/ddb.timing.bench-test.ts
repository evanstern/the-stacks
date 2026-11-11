// Wall-clock budget (moved from ddb.perf.test.ts by TASK-0308). Runs only in
// `pnpm check:timing`, serially, so parallel turbo load cannot skew it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDdbExport } from "../../src/library/ddb/index.js";

/**
 * Phase 6 (specs/012-ddb-parser/tasks.md T019, SC-004): parsing a
 * ~300-page book stays fast. Deterministic and CI-safe — synthetic
 * fixtures only, repeated to size; the 10s bound is generous on purpose
 * so this never flakes on a loaded CI runner.
 */

function readFixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/ddb/${name}`, import.meta.url)),
    "utf8",
  );
}

const FIXTURES = ["basic-rules.html", "equipment.html", "bestiary.html"].map(
  readFixture,
);

describe("parseDdbExport — perf (T019)", () => {
  it("parses a ~300-page book in under 10s", () => {
    const pages = Array.from({ length: 100 }, () => FIXTURES).flat();
    expect(pages.length).toBe(300);

    const start = performance.now();
    const book = parseDdbExport({ book: "Perf Fixture Book", pages });
    const durationMs = performance.now() - start;

    expect(book.blocks.length).toBeGreaterThan(0);
    expect(durationMs).toBeLessThan(10_000);
  }, 15_000);
});
