import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkWriteBoundary } from "../helpers/import-graph.js";

const SRC = fileURLToPath(new URL("../../src", import.meta.url));
const DM = join(SRC, "dm");

function listTs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listTs(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/** Source with comments and string literals blanked, so only real calls match. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
}

describe("dm/ write boundary (AC #5)", () => {
  it("only resolve, companion, chronicle, the floor job and the ruling answerer call gate.submit", () => {
    const callers = listTs(DM)
      .filter((f) => /\.submit\(/.test(code(f)))
      .map((f) => relative(DM, f).split("\\").join("/"))
      .sort();
    expect(callers).toEqual([
      "chronicle.ts",
      "companion.ts",
      "floor.ts",
      "nodes/resolve.ts",
      "rulings.ts",
    ]);
  });

  it("no file under dm/ imports a log writer", () => {
    const violations = checkWriteBoundary(SRC).filter((v) =>
      v.file.startsWith("dm/"),
    );
    expect(violations).toEqual([]);
  });

  it("no file under dm/ reaches the log, ingestion, library store, codex or ws", () => {
    const bad = listTs(DM).filter((f) =>
      /from\s+"[^"]*\/(events|ws|codex)\/|from\s+"[^"]*library\/(ingest\/|store)/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(bad.map((f) => relative(DM, f))).toEqual([]);
  });
});
