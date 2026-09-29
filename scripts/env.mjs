#!/usr/bin/env node
// scripts/env.mjs — the `pnpm env:*` CLI (spec 010): `up`, `down` (`[main]`),
// `status`, `prune`, and `main` (a local `origin/main` stack in a detached
// worktree, research R8). See specs/010-worktree-stacks/contracts/env-cli.md.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyStacks,
  deriveIdentity,
  mainIdentity,
  mergeEnvFile,
  parseWorktreeList,
} from "./env-lib.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function git(args, cwd = root) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/** Absolute path of the root checkout, found from ANY worktree via the git dir they share. */
function rootToplevel(cwd) {
  const commonDir = git(
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    cwd,
  );
  return path.dirname(commonDir);
}

function dockerReachable() {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

function environmentError(message) {
  console.error(message);
  process.exit(2);
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

function resolveIdentity(cwd) {
  let toplevel;
  try {
    toplevel = git(["rev-parse", "--show-toplevel"], cwd);
  } catch {
    environmentError("env.mjs must run inside a git repository.");
  }
  return {
    toplevel,
    identity: deriveIdentity({ toplevel, rootToplevel: rootToplevel(cwd) }),
  };
}

function currentCommit(toplevel) {
  const sha = git(["rev-parse", "HEAD"], toplevel);
  const dirty = git(["status", "--porcelain"], toplevel).length > 0;
  return dirty ? `${sha}-dirty` : sha;
}

/** Writes `.env` in `toplevel`. TEST_DATABASE_URL points at the test stack's fixed, throwaway credentials (spec 020 R5) — never the app database's. */
function writeEnvFile(toplevel, { appPort, dbPort, testDbPort, env }) {
  const examplePath = path.join(toplevel, ".env.example");
  const envPath = path.join(toplevel, ".env");
  const exampleText = readFileSync(examplePath, "utf8");
  const existingText = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const derived = {
    APP_PORT: String(appPort),
    DB_PORT: String(dbPort),
    STACKS_ENV: env,
  };
  if (testDbPort !== undefined) {
    derived.TEST_DB_PORT = String(testDbPort);
    derived.TEST_DATABASE_URL = `postgres://stacks:stacks@localhost:${testDbPort}/stacks`;
  }
  writeFileSync(envPath, mergeEnvFile(exampleText, existingText, derived));
}

function composeEnv({ env, toplevel, commit }) {
  return {
    ...process.env,
    STACKS_ENV: env,
    STACKS_WORKTREE: toplevel,
    STACKS_COMMIT: commit,
  };
}

async function runUp(toplevel, identity) {
  const { env, project, testProject, appPort, dbPort, testDbPort } = identity;

  const ports = [
    ["app", appPort],
    ["database", dbPort],
  ];
  if (testProject) ports.push(["test database", testDbPort]);
  for (const [label, port] of ports) {
    if (!(await portFree(port))) {
      console.error(`refusing: ${label} port ${port} is already bound.`);
      process.exit(1);
    }
  }

  writeEnvFile(toplevel, { appPort, dbPort, testDbPort, env });
  const commit = currentCommit(toplevel);
  const envVars = composeEnv({ env, toplevel, commit });

  if (testProject) {
    const testResult = spawnSync(
      "docker",
      [
        "compose",
        "-p",
        testProject,
        "-f",
        "docker-compose.test.yml",
        "up",
        "-d",
        "--wait",
      ],
      {
        cwd: toplevel,
        stdio: "inherit",
        env: { ...envVars, TEST_DB_PORT: String(testDbPort) },
      },
    );
    if (testResult.status !== 0) {
      console.error(`${testProject}: docker compose up failed.`);
      process.exit(1);
    }
  }

  const result = spawnSync(
    "docker",
    ["compose", "-p", project, "up", "-d", "--build", "--wait"],
    {
      cwd: toplevel,
      stdio: "inherit",
      env: envVars,
    },
  );
  if (result.status !== 0) {
    console.error(`${project}: docker compose up failed.`);
    process.exit(1);
  }
  const portsText = testProject
    ? `app :${appPort}, db :${dbPort}, test-db :${testDbPort}`
    : `app :${appPort}, db :${dbPort}`;
  const label = testProject ? `${project} + ${testProject}` : project;
  console.log(
    `${label}: up — http://localhost:${appPort} (${portsText}), commit ${commit}`,
  );
}

async function up() {
  if (!dockerReachable())
    environmentError(
      "Docker is not reachable — start Docker Desktop and try again.",
    );
  const { toplevel, identity } = resolveIdentityOrRefuse(process.cwd());
  await runUp(toplevel, identity);
}

function down(isMain) {
  if (!dockerReachable())
    environmentError(
      "Docker is not reachable — start Docker Desktop and try again.",
    );
  let toplevel, project, testProject;
  if (isMain) {
    project = "stacks-main";
  } else {
    ({
      toplevel,
      identity: { project, testProject },
    } = resolveIdentityOrRefuse(process.cwd()));
  }

  const spawnOpts = toplevel
    ? { cwd: toplevel, stdio: "inherit" }
    : { stdio: "inherit" };

  if (testProject) {
    const testResult = spawnSync(
      "docker",
      [
        "compose",
        "-p",
        testProject,
        "-f",
        "docker-compose.test.yml",
        "down",
        "-v",
        "--remove-orphans",
      ],
      spawnOpts,
    );
    if (testResult.status !== 0) {
      console.error(`${testProject}: docker compose down failed.`);
      process.exit(1);
    }
    console.log(`${testProject}: down`);
  }

  const result = spawnSync(
    "docker",
    ["compose", "-p", project, "down", "-v", "--remove-orphans"],
    spawnOpts,
  );
  if (result.status !== 0) {
    console.error(`${project}: docker compose down failed.`);
    process.exit(1);
  }
  console.log(`${project}: down`);

  if (isMain) {
    const rootPath = rootToplevel(process.cwd());
    const envMainPath = path.join(rootPath, ".worktrees", "env-main");
    if (existsSync(envMainPath)) {
      try {
        git(["worktree", "remove", "--force", envMainPath], rootPath);
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
      console.log(`removed worktree ${envMainPath}`);
    }
  }
}

/** `pnpm env:main` (research R8): fresh detached `origin/main` worktree, then `up`. */
async function mainVerb() {
  if (!dockerReachable())
    environmentError(
      "Docker is not reachable — start Docker Desktop and try again.",
    );
  const rootPath = rootToplevel(process.cwd());
  const envMainPath = path.join(rootPath, ".worktrees", "env-main");
  try {
    git(["fetch", "origin", "main"], rootPath);
    if (existsSync(envMainPath)) {
      git(["checkout", "--detach", "origin/main"], envMainPath);
      git(["reset", "--hard", "origin/main"], envMainPath);
      git(["clean", "-fdx", "-e", ".env"], envMainPath);
    } else {
      git(
        ["worktree", "add", "--detach", envMainPath, "origin/main"],
        rootPath,
      );
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  await runUp(envMainPath, mainIdentity());
}

function resolveIdentityOrRefuse(cwd) {
  try {
    return resolveIdentity(cwd);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

/** Parse `docker ps --format '{{json .}}'`'s comma-joined `Labels` field. */
function parseLabels(text) {
  const out = {};
  for (const pair of (text ?? "").split(",")) {
    const i = pair.indexOf("=");
    if (i === -1) continue;
    out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}

/** One entry per compose project labeled `org.the-stacks.env` (research R6). */
function listRunningStacks() {
  const result = spawnSync(
    "docker",
    [
      "ps",
      "-a",
      "--filter",
      "label=org.the-stacks.env",
      "--format",
      "{{json .}}",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0)
    environmentError(`docker ps failed: ${result.stderr.trim()}`);
  const byProject = new Map();
  for (const line of result.stdout.split("\n").filter(Boolean)) {
    const labels = parseLabels(JSON.parse(line).Labels);
    const project = labels["com.docker.compose.project"];
    if (!project || byProject.has(project)) continue;
    byProject.set(project, {
      project,
      env: labels["org.the-stacks.env"],
      worktree: labels["org.the-stacks.worktree"],
      commit: labels["org.the-stacks.commit"],
    });
  }
  return [...byProject.values()];
}

function classifiedStacks() {
  let worktrees;
  try {
    worktrees = parseWorktreeList(git(["worktree", "list", "--porcelain"]));
  } catch (err) {
    environmentError(err.message);
  }
  return classifyStacks(listRunningStacks(), worktrees);
}

function branchOf(worktree) {
  const result = spawnSync(
    "git",
    ["-C", worktree, "rev-parse", "--abbrev-ref", "HEAD"],
    { encoding: "utf8" },
  );
  return result.status === 0 ? result.stdout.trim() : "-";
}

function status() {
  if (!dockerReachable())
    environmentError(
      "Docker is not reachable — start Docker Desktop and try again.",
    );
  const stacks = classifiedStacks();
  if (stacks.length === 0) {
    console.log("no labeled stacks running.");
    return;
  }
  for (const stack of stacks) {
    const branch = stack.orphan ? "-" : branchOf(stack.worktree);
    console.log(
      `${stack.project} env=${stack.env} worktree=${stack.worktree} branch=${branch} commit=${stack.commit}${stack.orphan ? " ORPHAN" : ""}`,
    );
  }
}

function prune(check) {
  if (!dockerReachable())
    environmentError(
      "Docker is not reachable — start Docker Desktop and try again.",
    );
  const orphans = classifiedStacks().filter((stack) => stack.orphan);
  if (check) {
    if (orphans.length === 0) {
      console.log("no orphans.");
      return;
    }
    for (const orphan of orphans)
      console.log(
        `orphan: ${orphan.project} (worktree ${orphan.worktree} gone)`,
      );
    process.exit(1);
  }
  for (const orphan of orphans) {
    const result = spawnSync(
      "docker",
      ["compose", "-p", orphan.project, "down", "-v", "--remove-orphans"],
      { stdio: "inherit" },
    );
    if (result.status !== 0) {
      console.error(`${orphan.project}: docker compose down failed.`);
      process.exit(1);
    }
    console.log(`${orphan.project}: removed`);
  }
}

const [, , verb, ...rest] = process.argv;
switch (verb) {
  case "up":
    await up();
    break;
  case "down":
    down(rest.includes("main"));
    break;
  case "status":
    status();
    break;
  case "prune":
    prune(rest.includes("--check"));
    break;
  case "main":
    await mainVerb();
    break;
  default:
    console.error(
      `unknown or not-yet-implemented verb "${verb}"${rest.length ? ` (args: ${rest.join(" ")})` : ""}`,
    );
    console.error("usage: env.mjs <up|down|status|prune|main>");
    process.exit(2);
}
