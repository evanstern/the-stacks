#!/usr/bin/env node
// scripts/deploy-dev.mjs — the vm-104 `dev` CLI (spec 016): `deploy`,
// `status`, `drift`, `backup`, `restore`, `init-secrets`. Runs on vm-104 as
// `stacks`, from a checkout of the repo. stdlib + Docker CLI only, in the
// spawnSync style of scripts/env.mjs. See
// specs/016-hosted-dev-cd/contracts/deploy-cli.md and research.md R4, R6.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deployDecision,
  driftVerdict,
  healthMatches,
  renderDevEnv,
  tagsToPrune,
} from "./deploy-lib.mjs";
import { parseEnvKeys } from "./env-lib.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJECT = "stacks-dev";
// `env.DEV_ENV_FILE`, not `process.env.DEV_ENV_FILE` — the config.ts idiom
// (indirect access dodges biome's noUndeclaredEnvVars for an ops-only
// override that has no place in .env.example).
const env = process.env;
const DEV_ENV_FILE = env.DEV_ENV_FILE || "/home/stacks/dev/.env";
const BASE_COMPOSE = path.join(ROOT, "docker-compose.yml");
const DEV_COMPOSE = path.join(ROOT, "deploy/dev/compose.dev.yml");
// FR-012 only — applied to the swap step by `--force-unhealthy`, never to
// the rollback swap. See deploy/dev/compose.force-unhealthy.yml.
const FORCE_UNHEALTHY_COMPOSE = path.join(
  ROOT,
  "deploy/dev/compose.force-unhealthy.yml",
);
const BACKUPS_DIR = path.join(path.dirname(DEV_ENV_FILE), "backups");

function git(args, cwd = ROOT) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function dockerReachable() {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

function environmentError(message) {
  console.error(message);
  process.exit(2);
}

function composeArgs(extraFiles = []) {
  const args = ["-p", PROJECT, "-f", BASE_COMPOSE, "-f", DEV_COMPOSE];
  for (const file of extraFiles) args.push("-f", file);
  args.push("--env-file", DEV_ENV_FILE);
  return args;
}

function composeEnv(sha) {
  return {
    ...process.env,
    STACKS_ENV: "dev",
    STACKS_WORKTREE: ROOT,
    STACKS_COMMIT: sha,
  };
}

/** Every mutating compose call: inherited stdio (never captured/echoed), never `down`/`-v`. */
function runCompose(cmdArgs, sha, extraFiles = []) {
  return spawnSync(
    "docker",
    ["compose", ...composeArgs(extraFiles), ...cmdArgs],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: composeEnv(sha),
    },
  );
}

/** The commit label of the currently running `app`, or `null` on a first deploy. */
function getPrevCommit() {
  const ps = spawnSync(
    "docker",
    ["compose", ...composeArgs(), "ps", "-q", "app"],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  const id = ps.stdout.trim().split("\n")[0];
  if (!id) return null;
  const inspect = spawnSync(
    "docker",
    [
      "inspect",
      "--format",
      '{{ index .Config.Labels "org.the-stacks.commit" }}',
      id,
    ],
    { encoding: "utf8" },
  );
  const commit = inspect.stdout.trim();
  return commit && commit !== "<no value>" ? commit : null;
}

function utcStamp() {
  return new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d+Z$/, "Z");
}

/**
 * `pg_dump -Fc` of the running `db` to `/home/stacks/dev/backups/` (research
 * R6 step 5; contracts/deploy-cli.md `backup`). `label` writes
 * `manual-<label>.dump` (never auto-pruned); otherwise names the file by
 * timestamp and the currently running commit.
 */
function backup({ label } = {}) {
  mkdirSync(BACKUPS_DIR, { recursive: true, mode: 0o700 });
  const name = label
    ? `manual-${label}.dump`
    : `${utcStamp()}-${(getPrevCommit() ?? "unknown").slice(0, 7)}.dump`;
  const file = path.join(BACKUPS_DIR, name);
  const creds = parseEnvKeys(readFileSync(DEV_ENV_FILE, "utf8"));
  const result = spawnSync(
    "docker",
    [
      "compose",
      ...composeArgs(),
      "exec",
      "-T",
      "db",
      "pg_dump",
      "-Fc",
      "-U",
      creds.POSTGRES_USER,
      creds.POSTGRES_DB,
    ],
    { cwd: ROOT },
  );
  if (result.status !== 0) {
    throw new Error(
      `backup failed: ${(result.stderr ?? "").toString().trim()}`,
    );
  }
  writeFileSync(file, result.stdout, { mode: 0o600 });
  return file;
}

/** Keep the newest 10 non-manual backups (research R6 step 5). */
function pruneBackups() {
  if (!existsSync(BACKUPS_DIR)) return;
  const dumps = readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith(".dump") && !f.startsWith("manual-"))
    .sort();
  for (const file of dumps.slice(0, -10))
    unlinkSync(path.join(BACKUPS_DIR, file));
}

/** Keep current + 2 previous release image tags (research R6 step 10). */
function pruneImages() {
  const ls = spawnSync("docker", ["image", "ls", "--format", "json"], {
    encoding: "utf8",
  });
  if (ls.status !== 0) return; // best-effort — never fails a successful deploy
  const images = ls.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((image) =>
      ["stacks-dev-app", "stacks-dev-migrate"].includes(image.Repository),
    );
  for (const tag of tagsToPrune(images)) spawnSync("docker", ["rmi", tag]);
  spawnSync("docker", [
    "image",
    "prune",
    "-f",
    "--filter",
    "label=org.the-stacks.env=dev",
  ]);
}

function envPort() {
  if (!existsSync(DEV_ENV_FILE)) return 3000;
  const keys = parseEnvKeys(readFileSync(DEV_ENV_FILE, "utf8"));
  return Number(keys.APP_PORT) || 3000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GET /health with a timeout; `null` on any failure (unreachable, timeout, bad JSON). */
async function fetchHealthBody(port, timeoutMs) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return await res.json();
  } catch {
    return null;
  }
}

/** Poll /health for up to 180s (research R6 step 8). */
async function verify(sha) {
  const port = envPort();
  const deadline = Date.now() + 180_000;
  while (true) {
    const body = await fetchHealthBody(port, 3000);
    if (healthMatches(body, sha)) return true;
    if (Date.now() >= deadline) return false;
    await sleep(3000);
  }
}

function reportFailure(prev) {
  console.log(
    prev ? `dev is serving ${prev}` : "first deploy failed; dev is not serving",
  );
  process.exit(1);
}

function preflightOrExit(sha, allowStale) {
  if (!dockerReachable()) environmentError("Docker is not reachable.");
  if (!existsSync(DEV_ENV_FILE)) {
    environmentError(
      `secrets file missing: ${DEV_ENV_FILE} — run init-secrets first.`,
    );
  }
  let head;
  try {
    head = git(["rev-parse", "HEAD"]);
  } catch (err) {
    environmentError(err.message);
  }
  if (head !== sha) {
    environmentError(
      `checkout HEAD (${head}) does not match requested commit ${sha}.`,
    );
  }
  if (!allowStale) {
    let mainHead;
    try {
      mainHead = git(["ls-remote", "origin", "refs/heads/main"]).split(
        /\s+/,
      )[0];
    } catch (err) {
      environmentError(err.message);
    }
    if (deployDecision({ sha, mainHead, allowStale }) === "skip") {
      console.log(`skipping: ${sha} is stale (main is at ${mainHead}).`);
      process.exit(0);
    }
  }
}

async function deploy(
  sha,
  { allowStale = false, forceUnhealthy = false } = {},
) {
  preflightOrExit(sha, allowStale);
  const prev = getPrevCommit();

  if (runCompose(["build", "app", "migrate"], sha).status !== 0)
    reportFailure(prev);
  if (runCompose(["up", "-d", "--wait", "db"], sha).status !== 0)
    reportFailure(prev);
  if (prev) {
    try {
      backup();
      pruneBackups();
    } catch (err) {
      console.error(err.message);
      reportFailure(prev);
    }
  }
  if (runCompose(["run", "--rm", "migrate"], sha).status !== 0)
    reportFailure(prev);
  const swapFiles = forceUnhealthy ? [FORCE_UNHEALTHY_COMPOSE] : [];
  const swapped =
    runCompose(["up", "-d", "--no-build", "app"], sha, swapFiles).status === 0;

  const ok = swapped && (await verify(sha));
  if (ok) {
    pruneImages();
    console.log(`dev is serving ${sha}`);
    process.exit(0);
  }

  // Verify failure (research R6 step 9): roll back to `prev` without the
  // force-unhealthy file, then verify it. No `prev` means this was the
  // first deploy — nothing to roll back to.
  if (!prev) reportFailure(prev);
  const rolledBack =
    runCompose(["up", "-d", "--no-build", "app"], prev).status === 0 &&
    (await verify(prev));
  console.log(rolledBack ? `dev is serving ${prev}` : "dev is not serving");
  process.exit(1);
}

/**
 * `main` HEAD vs. what `/health` reports (research R7). No Docker: git plus
 * one HTTP request, so the hourly workflow needs nothing else.
 */
async function drift() {
  let expected, expectedAgeMin;
  try {
    expected = git(["rev-parse", "HEAD"]);
    const committedAt = Number(git(["log", "-1", "--format=%ct"]));
    expectedAgeMin = (Date.now() / 1000 - committedAt) / 60;
  } catch (err) {
    environmentError(err.message);
  }
  const body = await fetchHealthBody(envPort(), 5000);
  const observed = body?.commit ?? null;
  const verdict = driftVerdict({ expected, observed, expectedAgeMin });
  console.log(
    `${verdict}: expected ${expected}, observed ${observed ?? "unreachable"}`,
  );
  process.exit(verdict === "drift" ? 1 : 0);
}

async function status() {
  if (!dockerReachable()) environmentError("Docker is not reachable.");
  const prev = getPrevCommit();
  console.log(`running commit: ${prev ?? "none"}`);
  const body = await fetchHealthBody(envPort(), 5000);
  console.log(`/health: ${body ? JSON.stringify(body) : "unreachable"}`);
  const ls = spawnSync("docker", ["image", "ls", "--format", "json"], {
    encoding: "utf8",
  });
  const images = (
    ls.status === 0 ? ls.stdout.trim().split("\n").filter(Boolean) : []
  )
    .map((line) => JSON.parse(line))
    .filter((image) =>
      ["stacks-dev-app", "stacks-dev-migrate"].includes(image.Repository),
    );
  console.log(
    `images: ${images.map((i) => `${i.Repository}:${i.Tag}`).join(", ") || "none"}`,
  );
  const backups = existsSync(BACKUPS_DIR)
    ? readdirSync(BACKUPS_DIR)
        .filter((f) => f.endsWith(".dump"))
        .sort()
        .slice(-5)
    : [];
  console.log(`newest backups: ${backups.join(", ") || "none"}`);
}

function backupVerb({ label }) {
  if (!dockerReachable()) environmentError("Docker is not reachable.");
  if (!existsSync(DEV_ENV_FILE)) {
    environmentError(`secrets file missing: ${DEV_ENV_FILE}`);
  }
  try {
    const file = backup({ label });
    pruneBackups();
    console.log(file);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

/**
 * `restore <file> --yes` (contracts/deploy-cli.md): stops `app`, restores
 * `db` from the dump with `pg_restore --clean --if-exists`, starts `app`
 * back at its current image, and verifies `/health`.
 */
async function restoreVerb(file, { yes }) {
  if (!yes) {
    console.error("refusing without --yes");
    process.exit(2);
  }
  if (!dockerReachable()) environmentError("Docker is not reachable.");
  if (!existsSync(DEV_ENV_FILE)) {
    environmentError(`secrets file missing: ${DEV_ENV_FILE}`);
  }
  const filePath = path.isAbsolute(file) ? file : path.join(BACKUPS_DIR, file);
  if (!existsSync(filePath))
    environmentError(`backup file not found: ${filePath}`);

  const sha = getPrevCommit() ?? "unknown";
  if (runCompose(["stop", "app"], sha).status !== 0) {
    console.error("failed to stop app");
    process.exit(1);
  }
  const creds = parseEnvKeys(readFileSync(DEV_ENV_FILE, "utf8"));
  const restoreResult = spawnSync(
    "docker",
    [
      "compose",
      ...composeArgs(),
      "exec",
      "-T",
      "db",
      "pg_restore",
      "--clean",
      "--if-exists",
      "-U",
      creds.POSTGRES_USER,
      "-d",
      creds.POSTGRES_DB,
    ],
    { cwd: ROOT, input: readFileSync(filePath) },
  );
  if (restoreResult.status !== 0) {
    console.error(
      `restore failed: ${(restoreResult.stderr ?? "").toString().trim()}`,
    );
    process.exit(1);
  }
  if (runCompose(["up", "-d", "--no-build", "app"], sha).status !== 0) {
    console.error("failed to start app");
    process.exit(1);
  }
  const ok = await verify(sha);
  console.log(ok ? `dev is serving ${sha}` : "dev is not serving");
  process.exit(ok ? 0 : 1);
}

function initSecrets() {
  if (existsSync(DEV_ENV_FILE)) {
    console.error(`already exists: ${DEV_ENV_FILE}`);
    process.exit(1);
  }
  mkdirSync(path.dirname(DEV_ENV_FILE), { recursive: true, mode: 0o700 });
  const exampleText = readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const password = randomBytes(24).toString("hex");
  writeFileSync(DEV_ENV_FILE, renderDevEnv(exampleText, password), {
    mode: 0o600,
  });
  console.log(DEV_ENV_FILE);
}

const [, , verb, ...rest] = process.argv;
switch (verb) {
  case "deploy": {
    const sha = rest[0];
    if (!sha) {
      console.error(
        "usage: deploy-dev.mjs deploy <sha> [--allow-stale] [--force-unhealthy]",
      );
      process.exit(2);
    }
    await deploy(sha, {
      allowStale: rest.includes("--allow-stale"),
      forceUnhealthy: rest.includes("--force-unhealthy"),
    });
    break;
  }
  case "status":
    await status();
    break;
  case "drift":
    await drift();
    break;
  case "backup": {
    const nameIdx = rest.indexOf("--name");
    backupVerb({ label: nameIdx !== -1 ? rest[nameIdx + 1] : undefined });
    break;
  }
  case "restore":
    await restoreVerb(rest[0], { yes: rest.includes("--yes") });
    break;
  case "init-secrets":
    initSecrets();
    break;
  default:
    console.error(`unknown or not-yet-implemented verb "${verb}"`);
    console.error(
      "usage: deploy-dev.mjs <deploy|status|drift|backup|restore|init-secrets>",
    );
    process.exit(2);
}
