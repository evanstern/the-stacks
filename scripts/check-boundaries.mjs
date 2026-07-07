#!/usr/bin/env node
// Fails the build on structural boundary violations the type system can't
// catch on its own (FR-019, FR-005, SC-006). Run via `pnpm verify`.
//
// Three rules, each pinned to constitutional doctrine:
//   1. apps/web may not import @stacks/db or reach into api/worker/ml source
//      (FR-019): the web app is a client of the HTTP contract, nothing more.
//      TypeScript can't stop a workspace import that would quietly couple
//      the UI to the schema, so this scan does.
//   2. No source file may import outside the scanned source roots (originally
//      decision D1's "no v3 -> v2 imports"; v2 was retired and v3 promoted to
//      the repo root in 2026-07, so this now guards against relative imports
//      escaping apps/packages/scripts into docs, specs, or out of the repo —
//      kept as a cheap tripwire against accidental re-entanglement).
//   3. No hardcoded model identifiers in product code (Principle VII, SC-006):
//      models are configuration, resolved env-first via @stacks/core
//      model-roles. A literal model id in source would bypass FR-013/D14's
//      fail-fast env resolution and pin deploys to one model.
//   4. Ingestion plugins are pure transforms (008 FR-014, research R13):
//      packages/ingestion-plugins may import NO internal package except
//      @stacks/ingestion-contract. A plugin that could reach @stacks/db or
//      @stacks/ingestion could embed, index, or query — exactly what the
//      plugin seam exists to make impossible. This wall is what keeps
//      "write a new ingester" a small task (008 SC-007).
//   5. Parsing/archive libraries are confined to their owners (008 R13):
//      cheerio/sanitize-html only under packages/ingestion-plugins, yauzl
//      only under apps/worker. Parsing knowledge leaking into the pipeline
//      core is the v2 failure mode ("adapter bolted beside legacy parsers")
//      that 008's plugin-only path retires.
// These are lexical scans over import/source text — cheap, dependency-free,
// and intentionally blunt: they enforce architecture by failing CI, in the
// same spirit as the append-only-by-construction event table.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Only the source roots are scanned: docs/, specs/, and course artifacts may
// legitimately contain model ids and code snippets.
const SOURCE_ROOTS = ["apps", "packages", "scripts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".py"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", ".react-router", "__pycache__", ".venv"]);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...walk(full));
    } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const files = SOURCE_ROOTS.filter((root) => existsSync(join(REPO_ROOT, root))).flatMap((root) =>
  walk(join(REPO_ROOT, root)),
);
const violations = [];

const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const relPath = relative(REPO_ROOT, file);

  // 1. web must not depend on @stacks/db or reach into another app directly —
  // it consumes the system only through the API contract (FR-019).
  if (relPath.startsWith(join("apps", "web"))) {
    if (content.includes("@stacks/db")) {
      violations.push(`${relPath}: apps/web must not import @stacks/db (FR-019)`);
    }
    for (const match of content.matchAll(IMPORT_PATTERN)) {
      const spec = match[1];
      if (/\/apps\/(api|worker|ml)(\/|$)/.test(spec)) {
        violations.push(`${relPath}: apps/web must not import from another app directly: "${spec}" (FR-019)`);
      }
    }
  }

  // 2. No relative import may escape the source roots (see header rule 2).
  for (const match of content.matchAll(IMPORT_PATTERN)) {
    const spec = match[1];
    if (!spec.startsWith(".")) continue; // package imports (npm/workspace) are fine
    const resolved = resolve(dirname(file), spec);
    const insideASourceRoot = SOURCE_ROOTS.some((root) =>
      resolved.startsWith(join(REPO_ROOT, root)),
    );
    if (!insideASourceRoot) {
      violations.push(`${relPath}: relative import escapes the source roots: "${spec}" (FR-005 tripwire)`);
    }
  }

  // 3. No hardcoded model identifiers in PRODUCT code — they live only in
  // .env.example / compose defaults (Principle VII, SC-006, quickstart Scenario 7).
  // Test fixtures are exempt: a realistic model-id literal in a test is not a
  // runtime hardcode, and forcing fakes there would hurt test readability.
  const isTestFile = /\btests?\b/.test(relPath) || /\.test\.(ts|tsx|py)$/.test(relPath);
  if (!isTestFile && content.includes("sentence-transformers")) {
    violations.push(`${relPath}: hardcoded model identifier "sentence-transformers" (SC-006) — use env config`);
  }

  // 4. Plugins import only the contract among internal packages (008 FR-014).
  // Matched on parsed import specifiers (not substring: "@stacks/ingestion" is
  // a prefix of the *allowed* "@stacks/ingestion-contract").
  if (relPath.startsWith(join("packages", "ingestion-plugins"))) {
    for (const match of content.matchAll(IMPORT_PATTERN)) {
      const spec = match[1];
      if (!spec.startsWith("@stacks/")) continue;
      const pkg = spec.split("/").slice(0, 2).join("/");
      if (pkg !== "@stacks/ingestion-contract") {
        violations.push(
          `${relPath}: ingestion plugins may only import @stacks/ingestion-contract, not "${spec}" (008 FR-014)`,
        );
      }
    }
  }

  // 5. Parsing/archive libraries stay with their owners (008 R13). Checked on
  // import specifiers so prose mentions in comments don't trip it.
  const LIB_OWNERS = [
    { lib: "cheerio", owner: join("packages", "ingestion-plugins") },
    { lib: "sanitize-html", owner: join("packages", "ingestion-plugins") },
    { lib: "yauzl", owner: join("apps", "worker") },
  ];
  for (const match of content.matchAll(IMPORT_PATTERN)) {
    const spec = match[1];
    for (const { lib, owner } of LIB_OWNERS) {
      if ((spec === lib || spec.startsWith(`${lib}/`)) && !relPath.startsWith(owner)) {
        violations.push(`${relPath}: "${lib}" may only be imported under ${owner} (008 R13)`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Boundary check failed:\n");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  console.error(`\n${violations.length} violation(s) found.`);
  process.exit(1);
}

console.log(`Boundary check passed (${files.length} files scanned).`);
