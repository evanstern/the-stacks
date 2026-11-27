// scripts/env.test.mjs — Docker end-to-end test for the per-worktree compose
// stacks (spec 010, research R9). Wired as `pnpm check:env`; deliberately
// NOT in `ci:check` (no Docker-in-Docker in CI, and a stack build costs
// minutes — see research R9). Skips with a visible reason when Docker is
// unreachable, or when labeled resources already exist (so this test never
// prunes a stack it didn't create).
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  deriveIdentity,
  parseEnvKeys,
  publishedHost,
  urlHost,
} from "./env-lib.mjs";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const envScript = path.join(thisDir, "env.mjs");

function dockerReachable() {
  return spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
}

function repoRoot() {
  const commonDir = execFileSync(
    "git",
    ["-C", thisDir, "rev-parse", "--path-format=absolute", "--git-common-dir"],
    { encoding: "utf8" },
  ).trim();
  return path.dirname(commonDir);
}

function labeledCount(project) {
  const filter = `label=com.docker.compose.project=${project}`;
  return ["ps -a", "network ls", "volume ls"].reduce((total, sub) => {
    const [cmd, ...rest] = sub.split(" ");
    const result = spawnSync(
      "docker",
      [cmd, ...rest, "--filter", filter, "--format", "{{.ID}}"],
      { encoding: "utf8" },
    );
    return total + result.stdout.trim().split("\n").filter(Boolean).length;
  }, 0);
}

function env(args, cwd) {
  return spawnSync("node", [envScript, ...args], { cwd, encoding: "utf8" });
}

/** Labels of the first (only) container in a compose project, as a plain object. */
function containerLabels(project) {
  const result = spawnSync(
    "docker",
    [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      "{{json .}}",
    ],
    { encoding: "utf8" },
  );
  const line = result.stdout.trim().split("\n")[0];
  const out = {};
  for (const pair of (JSON.parse(line).Labels ?? "").split(",")) {
    const i = pair.indexOf("=");
    if (i !== -1) out[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return out;
}

function existingStackCount() {
  const result = spawnSync(
    "docker",
    ["ps", "-a", "--filter", "label=org.the-stacks.env", "--format", "{{.ID}}"],
    { encoding: "utf8" },
  );
  return result.stdout.trim().split("\n").filter(Boolean).length;
}

const skipReason = !dockerReachable()
  ? "Docker is not reachable"
  : existingStackCount() > 0
    ? "labeled stacks are already running — refusing to risk pruning them"
    : null;

if (skipReason) {
  test(`skipped: ${skipReason}`, { skip: skipReason }, () => {});
} else {
  const root = repoRoot();
  const headSha = execFileSync("git", ["-C", thisDir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();

  test("up -> both stacks healthy -> down -> zero labeled resources for both", async (t) => {
    const worktree = path.join(
      root,
      ".worktrees",
      `env-selftest-${process.pid}`,
    );
    execFileSync("git", [
      "-C",
      root,
      "worktree",
      "add",
      "--detach",
      worktree,
      headSha,
    ]);
    t.after(() => {
      spawnSync("git", ["-C", root, "worktree", "remove", "--force", worktree]);
    });

    const identity = deriveIdentity({ toplevel: worktree, rootToplevel: root });

    const up = env(["up"], worktree);
    assert.equal(up.status, 0, up.stdout + up.stderr);

    const health = await fetch(
      `http://${urlHost(publishedHost(process.env.DOCKER_HOST))}:${identity.appPort}/health`,
    ).then((r) => r.json());
    assert.equal(health.commit, headSha);

    assert.ok(labeledCount(identity.project) > 0, "app stack is running");
    assert.ok(labeledCount(identity.testProject) > 0, "test stack is running");

    const testLabels = containerLabels(identity.testProject);
    assert.equal(testLabels["org.the-stacks.env"], identity.env);
    assert.equal(testLabels["org.the-stacks.worktree"], worktree);
    assert.equal(testLabels["org.the-stacks.commit"], headSha);

    // Never assert on raw .env text here: this worktree's self-test inherits
    // the real root .env, so a failure message must never dump the file.
    const written = parseEnvKeys(
      readFileSync(path.join(worktree, ".env"), "utf8"),
    );
    assert.ok(
      written.TEST_DATABASE_URL?.includes(String(identity.testDbPort)),
      "TEST_DATABASE_URL does not name testDbPort",
    );

    // `up` names inherited shared keys, never values, and only when the
    // root .env actually has a non-derived key.
    const rootEnvPath = path.join(root, ".env");
    const rootHasSharedKeys = existsSync(rootEnvPath)
      ? Object.keys(parseEnvKeys(readFileSync(rootEnvPath, "utf8"))).length > 0
      : false;
    assert.equal(
      /inherited from .*\.env: /.test(up.stdout),
      rootHasSharedKeys,
      "inherited-keys line presence must match whether root .env has shared keys",
    );

    // Spec 095: both databases hold every migration the journal lists.
    const expected = JSON.parse(
      readFileSync(
        path.join(worktree, "apps/server/drizzle/meta/_journal.json"),
        "utf8",
      ),
    ).entries.length;
    for (const [project, files] of [
      [identity.project, []],
      [identity.testProject, ["-f", "docker-compose.test.yml"]],
    ]) {
      const count = spawnSync(
        "docker",
        [
          "compose",
          "-p",
          project,
          ...files,
          "exec",
          "-T",
          "db",
          "sh",
          "-c",
          'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from drizzle.__drizzle_migrations"',
        ],
        { cwd: worktree, encoding: "utf8" },
      );
      assert.equal(
        Number(count.stdout.trim()),
        expected,
        `${project} migrations`,
      );
    }

    const down = env(["down"], worktree);
    assert.equal(down.status, 0, down.stdout + down.stderr);

    assert.equal(labeledCount(identity.project), 0);
    assert.equal(labeledCount(identity.testProject), 0);
  });

  test("prune --check finds an orphan, prune removes it", async (t) => {
    const worktree = path.join(
      root,
      ".worktrees",
      `env-selftest-orphan-${process.pid}`,
    );
    execFileSync("git", [
      "-C",
      root,
      "worktree",
      "add",
      "--detach",
      worktree,
      headSha,
    ]);
    const identity = deriveIdentity({ toplevel: worktree, rootToplevel: root });

    const up = env(["up"], worktree);
    assert.equal(up.status, 0, up.stdout + up.stderr);

    // Delete the worktree WITHOUT `env:down` first — the orphan scenario.
    execFileSync("git", [
      "-C",
      root,
      "worktree",
      "remove",
      "--force",
      worktree,
    ]);
    t.after(() => {
      // Best-effort: `prune` below should already have torn these down.
      spawnSync("docker", [
        "compose",
        "-p",
        identity.project,
        "down",
        "-v",
        "--remove-orphans",
      ]);
      spawnSync("docker", [
        "compose",
        "-p",
        identity.testProject,
        "-f",
        "docker-compose.test.yml",
        "down",
        "-v",
        "--remove-orphans",
      ]);
    });

    const check1 = env(["prune", "--check"]);
    assert.equal(check1.status, 1, check1.stdout + check1.stderr);
    assert.match(check1.stdout, new RegExp(identity.project));
    assert.match(check1.stdout, new RegExp(identity.testProject));

    const prune = env(["prune"]);
    assert.equal(prune.status, 0, prune.stdout + prune.stderr);

    const check2 = env(["prune", "--check"]);
    assert.equal(check2.status, 0, check2.stdout + check2.stderr);

    assert.equal(labeledCount(identity.project), 0);
    assert.equal(labeledCount(identity.testProject), 0);
  });
}
