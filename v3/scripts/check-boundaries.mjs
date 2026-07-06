#!/usr/bin/env node
// Fails the build on structural boundary violations the type system can't
// catch on its own (FR-019, FR-005, SC-006). Run via `pnpm verify`.
//
// Three rules, each pinned to constitutional doctrine:
//   1. apps/web may not import @stacks/db or reach into api/worker/ml source
//      (FR-019): the web app is a client of the HTTP contract, nothing more.
//      TypeScript can't stop a workspace import that would quietly couple
//      the UI to the schema, so this scan does.
//   2. No v3 file may import across the v3/ root into v2 code (decision D1,
//      FR-005): v3 is a clean rebuild, not a graft. A single relative import
//      escaping v3/ would silently re-entangle the old tree.
//   3. No hardcoded model identifiers in product code (Principle VII, SC-006):
//      models are configuration, resolved env-first via @stacks/core
//      model-roles. A literal model id in source would bypass FR-013/D14's
//      fail-fast env resolution and pin deploys to one model.
// These are lexical scans over import/source text — cheap, dependency-free,
// and intentionally blunt: they enforce architecture by failing CI, in the
// same spirit as the append-only-by-construction event table.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const V3_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

const files = walk(V3_ROOT);
const violations = [];

const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const relPath = relative(V3_ROOT, file);

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

  // 2. No v3 file may import from v2 (repo-root apps/, or any path that
  // resolves outside the v3/ root) — D1.
  for (const match of content.matchAll(IMPORT_PATTERN)) {
    const spec = match[1];
    if (!spec.startsWith(".")) continue; // package imports (npm/workspace) are fine
    const resolved = resolve(dirname(file), spec);
    if (!resolved.startsWith(V3_ROOT)) {
      violations.push(`${relPath}: import escapes v3/ into v2 territory: "${spec}" (D1, FR-005)`);
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
