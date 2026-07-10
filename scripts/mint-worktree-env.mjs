#!/usr/bin/env node
/**
 * mint-worktree-env — the worktree environment protocol, self-enforced
 * (009 US2, FR-011/013/014/016; contracts/environment.md). Run from a
 * worktree root:
 *
 *   node scripts/mint-worktree-env.mjs --secrets-from ../main/.env   # mint
 *   node scripts/mint-worktree-env.mjs --check                       # drift
 *   node scripts/mint-worktree-env.mjs --force --secrets-from …      # re-mint
 *
 * Guarantees this file owns (the math lives in worktree-env-lib.mjs, tested):
 *  - REFUSES to overwrite an existing .env without --force — re-minting is a
 *    deliberate act, never a side effect (FR-013).
 *  - REFUSES on any port intersection with a sibling worktree's .env —
 *    collisions are a named mint-time error, not a runtime bind failure.
 *  - Copies secrets or leaves them blank with a loud warning — it never
 *    invents an operator password or session secret.
 *  - Prints the minted profile as a table: the protocol's CLI visibility
 *    avenue (constitution v2.2.0 Principle V; spec FR-018).
 *
 * Exit codes: 0 ok · 1 refusal (exists/collision/underivable) · 2 drift found.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname as parentDir, join, resolve } from "node:path";
import process from "node:process";

import { checkDrift, deriveProfile, findPortCollisions, mintEnv, parseEnv } from "./worktree-env-lib.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const at = args.indexOf(name);
  return at !== -1 && args[at + 1] ? args[at + 1] : undefined;
};

const worktreeRoot = process.cwd();
const worktreeName = basename(worktreeRoot);
const templatePath = join(worktreeRoot, ".env.example");
const envPath = join(worktreeRoot, ".env");

function fail(message, code = 1) {
  console.error(`✖ ${message}`);
  process.exit(code);
}

if (!existsSync(templatePath)) {
  fail(`.env.example not found in ${worktreeRoot} — run from a worktree root.`);
}
const template = readFileSync(templatePath, "utf8");

// ---------------------------------------------------------------------------
// --check: the drift mode (FR-016). Key drift and coupling breaks are
// failures (exit 2); ports differing from the DERIVED block are only noted —
// deliberate overrides are legitimate protocol citizens (§3).
// ---------------------------------------------------------------------------
if (flag("--check")) {
  if (!existsSync(envPath)) {
    fail(`.env not found — nothing to check. Mint one first.`);
  }
  const envContent = readFileSync(envPath, "utf8");
  const report = checkDrift(template, envContent);

  let derived;
  try {
    derived = deriveProfile(worktreeName);
  } catch {
    derived = null; // un-derivable dirname: skip the informational comparison
  }
  if (derived) {
    const env = parseEnv(envContent);
    const actual = {
      web: env.V3_WEB_PORT,
      api: env.V3_API_PORT,
      ml: env.V3_ML_PORT,
      postgres: env.V3_POSTGRES_PORT,
    };
    const diffs = Object.entries(derived.ports).filter(
      ([service, port]) => actual[service] !== String(port),
    );
    if (diffs.length > 0) {
      console.log(
        `ℹ ports differ from the derived block (deliberate override? fine if recorded — §3):`,
      );
      for (const [service, port] of diffs) {
        console.log(`    ${service}: derived ${port}, .env has ${actual[service]}`);
      }
    }
  }

  const findings = report.missing.length + report.unknown.length + report.couplings.length;
  for (const key of report.missing) console.error(`✖ missing key (in .env.example, not .env): ${key}`);
  for (const key of report.unknown) console.error(`✖ unknown key (in .env, not .env.example): ${key}`);
  for (const message of report.couplings) console.error(`✖ coupling: ${message}`);
  if (findings > 0) {
    fail(`${findings} drift finding(s). Reconcile by hand per the report, or re-mint with --force.`, 2);
  }
  console.log(`✔ ${worktreeName}/.env matches the environment contract.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Mint mode.
// ---------------------------------------------------------------------------
if (existsSync(envPath) && !flag("--force")) {
  fail(
    `${worktreeName}/.env already exists. Re-minting overwrites ports, identity, AND secrets — ` +
      `if that is what you want, re-run with --force (and --secrets-from to keep your secrets).`,
  );
}

let profile;
try {
  profile = deriveProfile(worktreeName);
} catch (error) {
  fail(error.message);
}

// Sibling scan: every peer directory with a .env participates in the
// collision check, main/ included.
const siblingsRoot = parentDir(worktreeRoot);
const siblings = readdirSync(siblingsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== worktreeName)
  .map((entry) => ({ dirname: entry.name, path: join(siblingsRoot, entry.name, ".env") }))
  .filter((sibling) => existsSync(sibling.path))
  .map((sibling) => ({ dirname: sibling.dirname, env: parseEnv(readFileSync(sibling.path, "utf8")) }));

const collisions = findPortCollisions(profile, siblings);
if (collisions.length > 0) {
  for (const { dirname, port } of collisions) {
    console.error(`✖ port ${port} is already published by ../${dirname}/.env`);
  }
  fail(`refusing to mint a colliding block — resolve the overlap first (contracts/environment.md §2).`);
}

// Secrets: copied verbatim from --secrets-from (typically ../main/.env),
// never generated. Blank secrets still mint — the stack just won't pass auth
// until the operator fills them, and we say so.
const secretsPath = option("--secrets-from");
let secrets = {};
if (secretsPath) {
  const resolved = resolve(worktreeRoot, secretsPath);
  if (!existsSync(resolved)) {
    fail(`--secrets-from ${secretsPath}: file not found.`);
  }
  const donor = parseEnv(readFileSync(resolved, "utf8"));
  secrets = {
    OPERATOR_PASSWORD_HASH: donor.OPERATOR_PASSWORD_HASH,
    SESSION_SECRET: donor.SESSION_SECRET,
  };
}

writeFileSync(envPath, mintEnv(template, worktreeName, secrets));

const row = (label, value) => console.log(`  ${label.padEnd(22)} ${value}`);
console.log(`✔ minted ${worktreeName}/.env`);
row("COMPOSE_PROJECT_NAME", profile.projectName);
row("V3_WEB_PORT", profile.ports.web);
row("V3_API_PORT", profile.ports.api);
row("V3_ML_PORT", profile.ports.ml);
row("V3_POSTGRES_PORT", profile.ports.postgres);
row("API_INTERNAL_URL", `http://api:${profile.ports.api} (derived — moves with the api port)`);
if (!secrets.OPERATOR_PASSWORD_HASH || !secrets.SESSION_SECRET) {
  console.warn(
    `⚠ secrets are BLANK (no --secrets-from, or donor had none). The stack will start but ` +
      `auth cannot succeed until OPERATOR_PASSWORD_HASH and SESSION_SECRET are set — see .env.example.`,
  );
} else {
  row("secrets", `copied from ${secretsPath}`);
}
console.log(`→ next: docker compose up -d --build --wait`);
