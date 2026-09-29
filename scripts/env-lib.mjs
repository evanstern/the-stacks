// scripts/env-lib.mjs — pure derivation functions for the per-worktree
// compose stacks (spec 010). No fs/child_process/network here: everything
// a caller needs from git/docker is gathered by scripts/env.mjs and passed
// in as plain data, so this file runs (and is tested) without Docker.
//
// See specs/010-worktree-stacks/research.md R2 (env/project name),
// R3 (port derivation), R5 (.env merge), R6 (orphan detection), and
// data-model.md for the shapes below.
import { createHash } from "node:crypto";
import { basename } from "node:path";

const RESERVED = new Set(["main", "dev"]);

function sanitizeEnv(name) {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

// task-<n> (1 <= n <= 999) gets the fixed doc-0002 range; everything else
// (including task-1000+, which falls out of range) gets a disjoint hashed
// range so a non-numbered worktree name still works with no registry.
function derivePorts(env) {
  const taskMatch = env.match(/^task-(\d+)$/);
  if (taskMatch) {
    const n = Number.parseInt(taskMatch[1], 10);
    if (n >= 1 && n <= 999) return { appPort: 3000 + n, dbPort: 15000 + n };
  }
  const hash = createHash("sha256").update(env).digest();
  const k = 1000 + (hash.readUInt32BE(0) % 8000);
  return { appPort: 3000 + k, dbPort: 15000 + k };
}

/**
 * Derive a worktree's stack identity. Throws when `toplevel` is the root
 * checkout (root is read-only — use `pnpm env:main`) or when the sanitized
 * name is a reserved env (`main`, `dev`).
 */
export function deriveIdentity({ toplevel, rootToplevel }) {
  if (toplevel === rootToplevel) {
    throw new Error(
      "env.mjs must run from a worktree, not the root checkout — use `pnpm env:main` for a local main stack.",
    );
  }
  const env = sanitizeEnv(basename(toplevel));
  if (RESERVED.has(env)) {
    throw new Error(
      `"${env}" is a reserved env name (main: \`pnpm env:main\`; dev: TASK-0021's hosted environment) — rename the worktree.`,
    );
  }
  const { appPort, dbPort } = derivePorts(env);
  return { env, project: `stacks-${env}`, appPort, dbPort };
}

/** Identity for the local `origin/main` stack (research R8). */
export function mainIdentity() {
  return { env: "main", project: "stacks-main", appPort: 3000, dbPort: 5432 };
}

/** Parse `KEY=value` lines out of a `.env`-style text (ignores comments/blank lines). */
export function parseEnvKeys(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

/**
 * Merge `.env.example` with an existing `.env` and the derived keys for
 * this stack. Derived keys always win (a stale port must never survive);
 * operator-set keys are preserved; comments and layout come from the
 * example file (research R5).
 */
export function mergeEnvFile(exampleText, existingText, derived) {
  const existing = parseEnvKeys(existingText ?? "");
  const seen = new Set();
  const lines = exampleText.split("\n").map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) return line;
    const key = match[1];
    seen.add(key);
    const value = Object.hasOwn(derived, key)
      ? derived[key]
      : (existing[key] ?? line.slice(key.length + 1));
    return `${key}=${value}`;
  });
  for (const [key, value] of Object.entries(derived)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  for (const [key, value] of Object.entries(existing)) {
    if (!seen.has(key) && !Object.hasOwn(derived, key)) {
      seen.add(key);
      lines.push(`${key}=${value}`);
    }
  }
  return lines.join("\n");
}

/**
 * Mark each running stack orphaned when its env isn't exempt (`main`,
 * `dev`) and its worktree path isn't among the live worktrees.
 */
export function classifyStacks(runningStacks, worktreePaths) {
  const known = new Set(worktreePaths);
  return runningStacks.map((stack) => ({
    ...stack,
    orphan: !RESERVED.has(stack.env) && !known.has(stack.worktree),
  }));
}

/** Absolute worktree paths from `git worktree list --porcelain`. */
export function parseWorktreeList(porcelain) {
  const paths = [];
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree "))
      paths.push(line.slice("worktree ".length));
  }
  return paths;
}
