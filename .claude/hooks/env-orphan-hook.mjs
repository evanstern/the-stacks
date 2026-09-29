#!/usr/bin/env node
// env-orphan-hook.mjs — Stop hook: warns about orphaned per-worktree compose
// stacks without ever blocking a session end (spec 010, research R7). Runs
// `node scripts/env.mjs prune --check`; on exit 1 prints a warning naming
// the orphans to stderr. On exit 2 (Docker unreachable — not an orphan
// signal) or exit 0 (nothing to report) it is silent. Always exits 0: an
// orphan is a warning, never a block.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);

function defaultPruneCheck() {
  return spawnSync(
    "node",
    [path.join(projectDir, "scripts/env.mjs"), "prune", "--check"],
    { encoding: "utf8" },
  );
}

/** Pure decision: given a `prune --check` spawn result, the warning to print (or null). */
export function warningFor(result) {
  if (result.status !== 1) return null;
  return `[env-orphan-hook] orphaned compose stacks found — run \`pnpm env:prune\`:\n${result.stdout}`;
}

export function run(pruneCheck = defaultPruneCheck) {
  const warning = warningFor(pruneCheck());
  if (warning) console.error(warning);
  process.exit(0);
}

// Only run when invoked directly (not when imported by a test).
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  run();
}
