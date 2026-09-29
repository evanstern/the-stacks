// scripts/env-lib.test.mjs — stdlib-only unit tests for the pure derivation
// functions behind the per-worktree compose stacks (spec 010). No Docker;
// runs in ci:check via `pnpm check:scripts`. See specs/010-worktree-stacks/
// tasks.md T002.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyStacks,
  deriveIdentity,
  mainIdentity,
  mergeEnvFile,
  parseWorktreeList,
} from "./env-lib.mjs";

const ROOT = "/repo/the-stacks";
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function findYamlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findYamlFiles(full));
    else if (entry.name.endsWith(".yml")) out.push(full);
  }
  return out;
}

test("task-0020 derives 3020/15020", () => {
  const identity = deriveIdentity({
    toplevel: "/repo/the-stacks/.worktrees/task-0020",
    rootToplevel: ROOT,
  });
  assert.deepEqual(identity, {
    env: "task-0020",
    project: "stacks-task-0020",
    testProject: "stacks-task-0020-test",
    appPort: 3020,
    dbPort: 15020,
    testDbPort: 25020,
  });
});

test("task-0033 derives 3033/15033/25033 and testProject stacks-task-0033-test", () => {
  const identity = deriveIdentity({
    toplevel: "/repo/the-stacks/.worktrees/task-0033",
    rootToplevel: ROOT,
  });
  assert.equal(identity.appPort, 3033);
  assert.equal(identity.dbPort, 15033);
  assert.equal(identity.testDbPort, 25033);
  assert.equal(identity.testProject, "stacks-task-0033-test");
});

test("task-7 derives 3007/15007/25007", () => {
  const identity = deriveIdentity({
    toplevel: "/repo/the-stacks/.worktrees/task-7",
    rootToplevel: ROOT,
  });
  assert.equal(identity.appPort, 3007);
  assert.equal(identity.dbPort, 15007);
  assert.equal(identity.testDbPort, 25007);
});

test("task-1000 (out of 1-999 range) falls into the hashed range, deterministically", () => {
  const call = () =>
    deriveIdentity({
      toplevel: "/repo/the-stacks/.worktrees/task-1000",
      rootToplevel: ROOT,
    });
  const first = call();
  const second = call();
  assert.deepEqual(first, second);
  assert.ok(
    first.appPort >= 4000 && first.appPort <= 11999,
    "appPort in hashed range",
  );
  assert.ok(
    first.dbPort >= 16000 && first.dbPort <= 23999,
    "dbPort in hashed range",
  );
  assert.ok(
    first.testDbPort >= 26000 && first.testDbPort <= 33999,
    "testDbPort in hashed range",
  );
  assert.equal(first.testDbPort - first.dbPort, 10000);
});

test("a non-task worktree name hashes deterministically into its own range", () => {
  const call = () =>
    deriveIdentity({
      toplevel: "/repo/the-stacks/.worktrees/sweep-m1-wave1",
      rootToplevel: ROOT,
    });
  const first = call();
  const second = call();
  assert.deepEqual(first, second);
  assert.equal(first.env, "sweep-m1-wave1");
  assert.equal(first.project, "stacks-sweep-m1-wave1");
  assert.equal(first.testProject, "stacks-sweep-m1-wave1-test");
  assert.ok(
    first.appPort >= 4000 && first.appPort <= 11999,
    "appPort in hashed range",
  );
  assert.ok(
    first.dbPort >= 16000 && first.dbPort <= 23999,
    "dbPort in hashed range",
  );
  assert.ok(
    first.testDbPort >= 26000 && first.testDbPort <= 33999,
    "testDbPort in hashed range",
  );
  assert.equal(first.testDbPort - first.dbPort, 10000);
});

test("uppercase and odd characters are sanitized into [a-z0-9-]", () => {
  const identity = deriveIdentity({
    toplevel: "/repo/the-stacks/.worktrees/Sweep_M1!Wave.1",
    rootToplevel: ROOT,
  });
  assert.equal(identity.env, "sweep-m1-wave-1");
  assert.equal(identity.project, "stacks-sweep-m1-wave-1");
});

test("running from the root checkout is refused", () => {
  assert.throws(
    () => deriveIdentity({ toplevel: ROOT, rootToplevel: ROOT }),
    /root checkout/,
  );
});

test("reserved env names are refused from a worktree", () => {
  assert.throws(
    () =>
      deriveIdentity({
        toplevel: "/repo/the-stacks/.worktrees/main",
        rootToplevel: ROOT,
      }),
    /reserved/,
  );
  assert.throws(
    () =>
      deriveIdentity({
        toplevel: "/repo/the-stacks/.worktrees/dev",
        rootToplevel: ROOT,
      }),
    /reserved/,
  );
});

test("a worktree name ending in -test is refused (spec 020 R9)", () => {
  assert.throws(
    () =>
      deriveIdentity({
        toplevel: "/repo/the-stacks/.worktrees/foo-test",
        rootToplevel: ROOT,
      }),
    /-test/,
  );
});

test("mainIdentity is fixed at 3000/5432 and carries no test project", () => {
  const identity = mainIdentity();
  assert.deepEqual(identity, {
    env: "main",
    project: "stacks-main",
    appPort: 3000,
    dbPort: 5432,
  });
  assert.ok(!("testProject" in identity));
});

test("mergeEnvFile keeps an operator-set key and overwrites a stale derived key", () => {
  const example = [
    "POSTGRES_USER=stacks",
    "POSTGRES_PASSWORD=changeme",
    "DB_PORT=5432",
    "APP_PORT=3000",
  ].join("\n");
  const existing = ["POSTGRES_PASSWORD=super-secret", "APP_PORT=9999"].join(
    "\n",
  );
  const merged = mergeEnvFile(example, existing, {
    APP_PORT: "3020",
    DB_PORT: "15020",
  });
  const lines = merged.split("\n");
  assert.ok(lines.includes("POSTGRES_PASSWORD=super-secret"));
  assert.ok(lines.includes("APP_PORT=3020"));
  assert.ok(lines.includes("DB_PORT=15020"));
  assert.ok(lines.includes("POSTGRES_USER=stacks"));
});

test("mergeEnvFile appends a derived key absent from the example (e.g. commented-out)", () => {
  const example = "# TEST_DATABASE_URL=postgres://…\nAPP_PORT=3000";
  const merged = mergeEnvFile(example, "", {
    TEST_DATABASE_URL: "postgres://x",
    APP_PORT: "3020",
  });
  const lines = merged.split("\n");
  assert.ok(lines.includes("TEST_DATABASE_URL=postgres://x"));
  assert.ok(lines.includes("APP_PORT=3020"));
});

test("classifyStacks exempts main and dev from orphan status", () => {
  const running = [
    { project: "stacks-main", env: "main", worktree: "/gone" },
    { project: "stacks-dev", env: "dev", worktree: "/also-gone" },
    {
      project: "stacks-task-1",
      env: "task-1",
      worktree: "/repo/the-stacks/.worktrees/task-1",
    },
    {
      project: "stacks-task-2",
      env: "task-2",
      worktree: "/repo/the-stacks/.worktrees/task-2-removed",
    },
  ];
  const known = ["/repo/the-stacks/.worktrees/task-1"];
  const classified = classifyStacks(running, known);
  assert.equal(classified.find((s) => s.env === "main").orphan, false);
  assert.equal(classified.find((s) => s.env === "dev").orphan, false);
  assert.equal(classified.find((s) => s.env === "task-1").orphan, false);
  assert.equal(classified.find((s) => s.env === "task-2").orphan, true);
});

test("the pgvector image is pinned in exactly one place: docker-compose.yml (research R12)", () => {
  const files = [
    path.join(repoRoot, "docker-compose.yml"),
    path.join(repoRoot, "docker-compose.test.yml"),
    ...findYamlFiles(path.join(repoRoot, "deploy")),
    ...findYamlFiles(path.join(repoRoot, ".github", "workflows")),
  ];
  const holders = [];
  let total = 0;
  for (const file of files) {
    const count = (readFileSync(file, "utf8").match(/pgvector\//g) ?? []).length;
    if (count > 0) holders.push(`${path.relative(repoRoot, file)} (${count})`);
    total += count;
  }
  assert.equal(
    total,
    1,
    `expected exactly one "pgvector/" occurrence, in docker-compose.yml; found in: ${holders.join(", ") || "nowhere"}`,
  );
  assert.deepEqual(holders, ["docker-compose.yml (1)"]);
});

test("parseWorktreeList reads absolute paths out of porcelain output", () => {
  const porcelain = [
    "worktree /repo/the-stacks",
    "HEAD abc123",
    "branch refs/heads/main",
    "",
    "worktree /repo/the-stacks/.worktrees/task-1",
    "HEAD def456",
    "branch refs/heads/task-1-foo",
    "",
  ].join("\n");
  assert.deepEqual(parseWorktreeList(porcelain), [
    "/repo/the-stacks",
    "/repo/the-stacks/.worktrees/task-1",
  ]);
});
