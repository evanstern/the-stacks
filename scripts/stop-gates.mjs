#!/usr/bin/env node
// stop-gates.mjs — the repo's Claude Code Stop-hook gate: a turn may not end
// with the doctrine ledgers broken.
//
// Invoked by .claude/hooks/stop-gates.sh (which resolves node the way the
// user's shell would and no-ops if it's absent — a missing runtime must never
// block Stop). Contract, mirroring praxis's gate-runner without importing it
// (this hook has to work when praxis isn't installed):
//
//   stdin   hook JSON; { stop_hook_active: true } → exit 0 (never re-fire)
//   exit 0  allow Stop (warnings may be printed to stderr)
//   exit 2  block Stop; stderr becomes the message the model acts on
//
// What blocks: spec-artifact problems (orphaned specs, Principle VIII closure)
// and ADR malformations — both are in-repo checks with zero dependencies —
// plus wiki freshness WHEN praxis is available to check it (stale pins are a
// real doctrine break). Praxis being absent only warns: CI runs the same gate
// from a pinned checkout and stays authoritative.
//
// The spec-bridge plugin ships its own Stop hook for the board gate (status
// can't exceed artifacts) — deliberately not duplicated here.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { collectProblems as specArtifactProblems } from "./check-spec-artifacts.mjs";
import { collectProblems as adrProblems } from "./check-adrs.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function findPraxisFor(subpath) {
  const candidates = [
    process.env.PRAXIS_DIR,
    join(homedir(), "projects", "praxis"),
    join(REPO_ROOT, ".praxis"),
  ].filter(Boolean);
  const found = candidates.find((c) => existsSync(join(c, subpath)));
  // Physical path: run-gates.mjs's run-as-CLI guard breaks when spawned via a
  // symlinked path (import.meta.url is symlink-resolved, process.argv[1]
  // isn't) — it exits 0 having run nothing.
  return found ? realpathSync(found) : null;
}

export function main() {
  const input = readStdinJson();
  if (input?.stop_hook_active) return 0;

  const problems = [];
  const warnings = [];

  problems.push(...specArtifactProblems(REPO_ROOT));
  const adrs = adrProblems(REPO_ROOT);
  problems.push(...adrs.problems);
  warnings.push(...adrs.warnings);

  // Prefer praxis's versioned consumer contract (scripts/run-gates.mjs,
  // v0.4.0+); fall back to the plugin's own CLI for older checkouts.
  const runner = "scripts/run-gates.mjs";
  const freshnessCli = "grounding-wiki/gates/cli.mjs";
  const praxis = findPraxisFor(runner) ?? findPraxisFor(freshnessCli);
  if (praxis) {
    const args = existsSync(join(praxis, runner))
      ? [join(praxis, runner), "--gates", "wiki-freshness", "--path", REPO_ROOT]
      : [join(praxis, freshnessCli), "freshness", REPO_ROOT, "docs/wiki"];
    const res = spawnSync(process.execPath, args, { encoding: "utf8" });
    if (res.status !== 0) {
      problems.push(
        `docs/wiki is stale or broken — re-verify and re-pin (/grounding-wiki:wiki-update):\n` +
        `${`${res.stdout ?? ""}${res.stderr ?? ""}`.trim().replace(/^/gm, "  ")}`,
      );
    }
  } else {
    warnings.push("praxis not found — wiki freshness deferred to CI");
  }

  for (const w of warnings) console.error(`warn: [stop-gates] ${w}`);
  if (problems.length) {
    console.error("[stop-gates] the turn can't end with doctrine ledgers broken:");
    for (const p of problems) console.error(`  - ${p}`);
    return 2;
  }
  return 0;
}

process.exit(main());
