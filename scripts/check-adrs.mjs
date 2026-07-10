#!/usr/bin/env node
// check-adrs.mjs — ADRs stay well-formed and uniquely numbered.
//
//   node scripts/check-adrs.mjs
//
// The constitution makes ADRs load-bearing: reopening a fixed decision
// (D1–D14) or violating a grounding principle REQUIRES one, and evidence/wiki
// pages link to them by number. This gate can't know when an ADR *should*
// have been written (that's the constitution gate in plan.md and review), but
// it can keep the ledger trustworthy once one exists:
//
//   - filename NNNN-kebab-slug.md, H1 `# ADR NNNN: <title>` with matching NNNN
//   - metadata bullets: Status (proposed|accepted|superseded|rejected), Date
//     (YYYY-MM-DD), Decision maker
//   - sections: ## Decision, ## Context, ## Consequences
//   - duplicate numbers FAIL (two ADRs claiming one number breaks every link
//     to it); numbering gaps only WARN (ADRs are never renumbered — a gap is
//     history, not corruption)
//
// Format matches docs/adr/0001-retire-v2-before-parity.md, the founding
// example. Same posture as check-boundaries.mjs: dependency-free, exit 1 with
// a violation list; pure core unit-tested in check-adrs.test.mjs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- pure core (unit-tested) ----------

const FILENAME = /^(\d{4})-[a-z0-9-]+\.md$/;
const STATUSES = ["proposed", "accepted", "superseded", "rejected"];

/** Validate one ADR. Returns { errors, warnings } (empty arrays = clean). */
export function validateAdr(filename, text) {
  const errors = [];
  const fm = FILENAME.exec(filename);
  if (!fm) {
    return { errors: [`docs/adr/${filename}: filename must be NNNN-kebab-slug.md`], warnings: [] };
  }
  const number = fm[1];
  const h1 = /^# ADR (\d{4}): \S.*$/m.exec(text);
  if (!h1) {
    errors.push(`docs/adr/${filename}: missing H1 of the form "# ADR ${number}: <title>"`);
  } else if (h1[1] !== number) {
    errors.push(`docs/adr/${filename}: H1 says ADR ${h1[1]} but the filename says ${number}`);
  }
  const status = /^- \*\*Status\*\*:\s*(\S+)/m.exec(text);
  if (!status) {
    errors.push(`docs/adr/${filename}: missing "- **Status**: <${STATUSES.join("|")}>" bullet`);
  } else if (!STATUSES.includes(status[1].toLowerCase())) {
    errors.push(`docs/adr/${filename}: Status "${status[1]}" is not one of ${STATUSES.join("|")}`);
  }
  if (!/^- \*\*Date\*\*:\s*\d{4}-\d{2}-\d{2}/m.test(text)) {
    errors.push(`docs/adr/${filename}: missing "- **Date**: YYYY-MM-DD" bullet`);
  }
  if (!/^- \*\*Decision maker\*\*:\s*\S/m.test(text)) {
    errors.push(`docs/adr/${filename}: missing "- **Decision maker**: <who>" bullet`);
  }
  for (const section of ["Decision", "Context", "Consequences"]) {
    if (!new RegExp(`^## ${section}\\b`, "m").test(text)) {
      errors.push(`docs/adr/${filename}: missing "## ${section}" section`);
    }
  }
  return { errors, warnings: [] };
}

/** Cross-file numbering: duplicates fail, gaps warn. */
export function validateNumbering(filenames) {
  const errors = [], warnings = [];
  const numbers = filenames
    .map((f) => FILENAME.exec(f)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i - 1]) {
      errors.push(`docs/adr: number ${String(numbers[i]).padStart(4, "0")} is used by more than one ADR`);
    } else if (numbers[i] !== numbers[i - 1] + 1) {
      warnings.push(
        `docs/adr: numbering gap between ${String(numbers[i - 1]).padStart(4, "0")} and ` +
        `${String(numbers[i]).padStart(4, "0")} (gaps are history, not errors — never renumber)`,
      );
    }
  }
  return { errors, warnings };
}

// ---------- filesystem wrapper ----------

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function collectProblems(repoRoot = REPO_ROOT) {
  const adrDir = join(repoRoot, "docs", "adr");
  if (!existsSync(adrDir)) return { problems: [], warnings: [] };
  const files = readdirSync(adrDir).filter((f) => f.endsWith(".md")).sort();
  const problems = [], warnings = [];
  for (const file of files) {
    const { errors } = validateAdr(file, readFileSync(join(adrDir, file), "utf8"));
    problems.push(...errors);
  }
  const numbering = validateNumbering(files);
  problems.push(...numbering.errors);
  warnings.push(...numbering.warnings);
  return { problems, warnings };
}

export function main() {
  const { problems, warnings } = collectProblems();
  for (const w of warnings) console.error(`warn: ${w}`);
  if (problems.length) {
    console.error("adr check failed:");
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  console.log("adr check ok: every ADR is well-formed and uniquely numbered");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
