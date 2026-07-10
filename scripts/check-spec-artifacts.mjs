#!/usr/bin/env node
// check-spec-artifacts.mjs — Spec Kit integrity + Principle VIII closure.
//
//   node scripts/check-spec-artifacts.mjs
//
// Two rules, each pinned to constitutional doctrine:
//   1. Every specs/NNN-*/ directory must contain spec.md — a spec dir without
//      its spec is an orphaned artifact tree (spec-kit integrity; the spec
//      dir is the source of truth the Backlog board derives from).
//   2. A spec whose tasks.md is fully checked claims a COMPLETE cycle, and the
//      constitution says a cycle without its learning artifact is incomplete
//      (Principle VIII): completion requires evidence.md (the converge-gate
//      record) AND docs/courses/<spec-dir-basename>/index.html (the
//      feature-scoped interactive course). The checkbox regex matches
//      spec-bridge's derivation, so "complete" here is exactly what moves the
//      board task to Done — the board, this gate, and the constitution agree
//      on one definition of finished.
//
// Same posture as check-boundaries.mjs: dependency-free lexical scan, exit 1
// with a violation list. The pure core is unit-tested in
// check-spec-artifacts.test.mjs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- pure core (unit-tested) ----------

// Same checkbox shape spec-bridge's derivation counts ("- [x] T001 ..."),
// so this gate and the board can never disagree about completeness.
const CHECKBOX = /^\s*[-*]\s+\[([ xX])\]\s+\S/;

export function parseCheckboxes(text) {
  let done = 0, total = 0;
  for (const line of String(text ?? "").split("\n")) {
    const m = CHECKBOX.exec(line);
    if (!m) continue;
    total += 1;
    if (m[1] !== " ") done += 1;
  }
  return { done, total };
}

/**
 * Decide pass/fail for one spec dir from plain data. Returns errors ([] = pass).
 *   name        spec dir basename (e.g. "008-ingestion-service")
 *   hasSpec     spec.md exists
 *   tasksText   tasks.md content, or null if absent
 *   hasEvidence evidence.md exists
 *   hasCourse   docs/courses/<name>/index.html exists
 */
export function evaluateSpec({ name, hasSpec, tasksText, hasEvidence, hasCourse }) {
  const errors = [];
  if (!hasSpec) {
    errors.push(`specs/${name}: spec.md missing — a spec directory must carry its spec`);
  }
  if (tasksText == null) return errors; // no tasks yet — nothing claims completion
  const { done, total } = parseCheckboxes(tasksText);
  if (total === 0 || done < total) return errors; // cycle still open — closure not owed yet
  if (!hasEvidence) {
    errors.push(
      `specs/${name}: tasks complete (${done}/${total}) but evidence.md missing — ` +
      `record the converge verdict before calling the cycle closed`,
    );
  }
  if (!hasCourse) {
    errors.push(
      `specs/${name}: tasks complete (${done}/${total}) but docs/courses/${name}/index.html ` +
      `missing — Principle VIII: run /spec-cycle-course and link it from evidence.md`,
    );
  }
  return errors;
}

// ---------- filesystem wrapper ----------

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function collectProblems(repoRoot = REPO_ROOT) {
  const specsDir = join(repoRoot, "specs");
  if (!existsSync(specsDir)) return [];
  const problems = [];
  for (const name of readdirSync(specsDir).sort()) {
    if (!/^\d{3}-/.test(name)) continue; // skip non-feature entries (e.g. .v2 staging)
    const dir = join(specsDir, name);
    const tasksPath = join(dir, "tasks.md");
    problems.push(...evaluateSpec({
      name,
      hasSpec: existsSync(join(dir, "spec.md")),
      tasksText: existsSync(tasksPath) ? readFileSync(tasksPath, "utf8") : null,
      hasEvidence: existsSync(join(dir, "evidence.md")),
      hasCourse: existsSync(join(repoRoot, "docs", "courses", name, "index.html")),
    }));
  }
  return problems;
}

export function main() {
  const problems = collectProblems();
  if (problems.length) {
    console.error("spec-artifacts check failed:");
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  console.log("spec-artifacts ok: every spec has its spec.md; every closed cycle has evidence + course");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
