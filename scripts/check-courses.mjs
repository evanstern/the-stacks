#!/usr/bin/env node
// check-courses.mjs — every Principle VIII course must pass the praxis course gate.
//
//   node scripts/check-courses.mjs [--praxis <dir>] [--require-praxis]
//
// The course gate itself (self-containment, module structure, quizzes,
// translation blocks, chrome version stamp) lives in praxis's
// codebase-to-course plugin — the same chrome /spec-cycle-course generates
// with. This wrapper only decides WHERE praxis is and WHICH courses are held
// to the bar:
//
//   - praxis is found via --praxis <dir>, then $PRAXIS_DIR, then
//     ~/projects/praxis, then ./.praxis (the CI checkout). Absent praxis is a
//     warning locally (CI is authoritative) but a failure under
//     --require-praxis (CI must never silently skip a gate).
//   - LEGACY courses (built on pre-gate v1 chrome, before this gate existed)
//     get their failures downgraded to warnings. Rebuilding them on current
//     chrome and EMPTYING this set is tracked on the board (task-4..7,
//     ADR 0002). Any course not in the set — i.e. every future course — must
//     pass outright.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Pre-gate courses, tolerated until rebuilt (board tasks 4–7). Add nothing
// here — entries only leave (007 left with TASK-4's chrome-v2 rebuild).
const LEGACY = new Set([
  "008-ingestion-service",
  "009-library-surface-env",
]);

export function findPraxis(argv, env = process.env, home = homedir()) {
  const i = argv.indexOf("--praxis");
  const candidates = [
    i !== -1 ? argv[i + 1] : null,
    env.PRAXIS_DIR,
    join(home, "projects", "praxis"),
    join(REPO_ROOT, ".praxis"),
  ].filter(Boolean);
  const found = candidates.find((c) => existsSync(join(c, "codebase-to-course", "gates", "cli.mjs")));
  // Physical path matters: run-gates.mjs's run-as-CLI guard compares
  // import.meta.url (which node resolves through symlinks) with
  // process.argv[1] (as typed). Spawned via a symlinked path
  // (~/projects -> Claude/Code) the guard fails and the runner exits 0
  // having run NOTHING — a silent pass, the worst gate failure mode.
  return found ? realpathSync(found) : null;
}

/** Prefer praxis's versioned consumer contract (run-gates.mjs, v0.4.0+); fall
 *  back to the plugin's own gate CLI for older checkouts. Same validator either
 *  way — the runner is just the surface praxis promises not to break. */
function courseGateArgs(praxis, courseDir) {
  const runner = join(praxis, "scripts", "run-gates.mjs");
  if (existsSync(runner)) {
    return [runner, "--gates", "course", "--path", REPO_ROOT, "--course-dir", relative(REPO_ROOT, courseDir)];
  }
  return [join(praxis, "codebase-to-course", "gates", "cli.mjs"), "course", courseDir];
}

export function main(argv = process.argv.slice(2)) {
  const requirePraxis = argv.includes("--require-praxis");
  const praxis = findPraxis(argv);
  if (!praxis) {
    if (requirePraxis) {
      console.error("course check failed: praxis not found (--praxis <dir>, $PRAXIS_DIR, ~/projects/praxis, .praxis) — CI must run the real gate");
      return 1;
    }
    console.error("warn: praxis not found — course gate deferred to CI (which checks out praxis at a pinned tag)");
    return 0;
  }

  const coursesDir = join(REPO_ROOT, "docs", "courses");
  const courses = existsSync(coursesDir)
    ? readdirSync(coursesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
    : [];
  if (courses.length === 0) { console.log("course check ok: no courses yet"); return 0; }

  let failed = false;
  for (const name of courses) {
    const dir = join(coursesDir, name);
    const res = spawnSync(process.execPath, courseGateArgs(praxis, dir), { encoding: "utf8" });
    const output = `${res.stdout ?? ""}${res.stderr ?? ""}`.trim();
    if (res.status === 0) {
      console.log(`docs/courses/${name}: OK`);
    } else if (LEGACY.has(name)) {
      console.error(`warn: docs/courses/${name}: LEGACY (pre-gate chrome, rebuild tracked on the board) — gate says:\n${output.replace(/^/gm, "  ")}`);
    } else {
      failed = true;
      console.error(`docs/courses/${name}: course gate FAILED:\n${output.replace(/^/gm, "  ")}`);
    }
  }
  if (failed) { console.error("course check failed (non-legacy course above)"); return 1; }
  console.log("course check ok");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
