// Proves the boundary rules in biome.json actually fire (FR-006): lints
// fixtures/boundary-violations/ — deliberately-violating files, one per
// contracts/boundary-rules.md row — with Biome's noRestrictedImports rule,
// and fails unless every fixture is flagged.
//
// Biome's own files.includes excludes "fixtures" from the normal lint run
// (so these fixtures never pollute real lint), which also means Biome
// refuses to lint the path when it's passed from the repo root — so this
// runs with cwd set INSIDE the fixture dir, where its own nested biome.json
// (extends: ../../biome.json, its own files.includes re-including "**")
// takes over as that subtree's root (research R3 fallback).
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixturesDir = path.join(root, "fixtures/boundary-violations");
const biomeBin = path.join(root, "node_modules/.bin/biome");

function listFixtures(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFixtures(full, base));
    else if (entry.name.endsWith(".ts"))
      out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

const expected = listFixtures(fixturesDir).sort();

const result = spawnSync(
  biomeBin,
  ["lint", "--only=style/noRestrictedImports", "--reporter=json", "."],
  { cwd: fixturesDir, encoding: "utf8" },
);

let diagnostics = [];
try {
  diagnostics = JSON.parse(result.stdout).diagnostics ?? [];
} catch {
  console.error("boundary check: could not parse Biome's JSON output");
  console.error(result.stdout, result.stderr);
  process.exit(1);
}

const flagged = new Set(diagnostics.map((d) => d.location.path));
const missing = expected.filter((f) => !flagged.has(f));

if (result.status === 0 || missing.length > 0) {
  console.error(
    `boundary rules: ${expected.length - missing.length}/${expected.length} fixtures flagged`,
  );
  if (missing.length > 0) console.error(`not flagged: ${missing.join(", ")}`);
  if (result.status === 0) console.error("Biome exited 0 — expected nonzero");
  process.exit(1);
}

console.log(
  `boundary rules: ${expected.length}/${expected.length} fixtures flagged`,
);
