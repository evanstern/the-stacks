// scripts/deploy-lib.test.mjs — stdlib-only unit tests for the pure
// deploy/rollback/drift logic (spec 016), plus workflow-file invariants.
// No Docker; runs in ci:check via `pnpm check:scripts`. See
// specs/016-hosted-dev-cd/tasks.md T002.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  deployDecision,
  driftVerdict,
  healthMatches,
  renderDevEnv,
  tagsToPrune,
} from "./deploy-lib.mjs";

// --- deployDecision (research R2) ---

test("deployDecision deploys when the commit is main HEAD", () => {
  assert.equal(
    deployDecision({ sha: "abc", mainHead: "abc", allowStale: false }),
    "deploy",
  );
});

test("deployDecision skips a stale commit with no override", () => {
  assert.equal(
    deployDecision({ sha: "old", mainHead: "abc", allowStale: false }),
    "skip",
  );
});

test("deployDecision deploys a stale commit when allowStale is set (operator rollback)", () => {
  assert.equal(
    deployDecision({ sha: "old", mainHead: "abc", allowStale: true }),
    "deploy",
  );
});

// --- healthMatches (research R6 step 8) ---

test("healthMatches requires status ok and the matching commit", () => {
  assert.equal(healthMatches({ status: "ok", commit: "abc" }, "abc"), true);
});

test("healthMatches rejects a degraded status", () => {
  assert.equal(
    healthMatches({ status: "degraded", commit: "abc" }, "abc"),
    false,
  );
});

test("healthMatches rejects a mismatched commit", () => {
  assert.equal(healthMatches({ status: "ok", commit: "old" }, "abc"), false);
});

test("healthMatches rejects a missing body", () => {
  assert.equal(healthMatches(null, "abc"), false);
});

// --- driftVerdict (research R7) ---

test("driftVerdict is ok when dev reports main HEAD", () => {
  assert.equal(
    driftVerdict({ expected: "abc", observed: "abc", expectedAgeMin: 5 }),
    "ok",
  );
});

test("driftVerdict is pending when they differ but HEAD is younger than the grace window", () => {
  assert.equal(
    driftVerdict({ expected: "abc", observed: "old", expectedAgeMin: 10 }),
    "pending",
  );
});

test("driftVerdict is drift when they differ past the grace window", () => {
  assert.equal(
    driftVerdict({ expected: "abc", observed: "old", expectedAgeMin: 45 }),
    "drift",
  );
});

test("driftVerdict is drift, never pending, when dev is unreachable", () => {
  assert.equal(
    driftVerdict({ expected: "abc", observed: null, expectedAgeMin: 1 }),
    "drift",
  );
});

test("driftVerdict honors a custom grace window", () => {
  assert.equal(
    driftVerdict({
      expected: "abc",
      observed: "old",
      expectedAgeMin: 5,
      graceMin: 3,
    }),
    "drift",
  );
});

// --- tagsToPrune (research R6 step 10) ---

test("tagsToPrune keeps the newest `keep` tags per repository", () => {
  const images = [
    {
      Repository: "stacks-dev-app",
      Tag: "c1",
      CreatedAt: "2026-09-01 00:00:00 +0000 UTC",
    },
    {
      Repository: "stacks-dev-app",
      Tag: "c2",
      CreatedAt: "2026-09-02 00:00:00 +0000 UTC",
    },
    {
      Repository: "stacks-dev-app",
      Tag: "c3",
      CreatedAt: "2026-09-03 00:00:00 +0000 UTC",
    },
    {
      Repository: "stacks-dev-app",
      Tag: "c4",
      CreatedAt: "2026-09-04 00:00:00 +0000 UTC",
    },
  ];
  assert.deepEqual(tagsToPrune(images), ["stacks-dev-app:c1"]);
});

test("tagsToPrune prunes each repository independently", () => {
  const images = [
    {
      Repository: "stacks-dev-app",
      Tag: "c1",
      CreatedAt: "2026-09-01T00:00:00Z",
    },
    {
      Repository: "stacks-dev-app",
      Tag: "c2",
      CreatedAt: "2026-09-02T00:00:00Z",
    },
    {
      Repository: "stacks-dev-migrate",
      Tag: "c1",
      CreatedAt: "2026-09-01T00:00:00Z",
    },
    {
      Repository: "stacks-dev-migrate",
      Tag: "c2",
      CreatedAt: "2026-09-02T00:00:00Z",
    },
  ];
  assert.deepEqual(tagsToPrune(images, 1), [
    "stacks-dev-app:c1",
    "stacks-dev-migrate:c1",
  ]);
});

test("tagsToPrune removes nothing when there are `keep` or fewer tags", () => {
  const images = [
    {
      Repository: "stacks-dev-app",
      Tag: "c1",
      CreatedAt: "2026-09-01T00:00:00Z",
    },
  ];
  assert.deepEqual(tagsToPrune(images), []);
});

// --- renderDevEnv (research R4) ---

const EXAMPLE = [
  "POSTGRES_USER=stacks",
  "POSTGRES_PASSWORD=changeme",
  "DATABASE_URL=postgres://stacks:changeme@db:5432/stacks",
  "DB_PORT=5432",
  "APP_PORT=3000",
  "STACKS_ENV=default",
].join("\n");

test("renderDevEnv sets the fixed dev ports/env and a matching DATABASE_URL", () => {
  const text = renderDevEnv(EXAMPLE, "deadbeef");
  const lines = text.split("\n");
  assert.ok(lines.includes("APP_PORT=3000"));
  assert.ok(lines.includes("DB_PORT=5432"));
  assert.ok(lines.includes("STACKS_ENV=dev"));
  assert.ok(lines.includes("POSTGRES_PASSWORD=deadbeef"));
  assert.ok(
    lines.includes("DATABASE_URL=postgres://stacks:deadbeef@db:5432/stacks"),
  );
});

// --- Workflow invariants (research R1, R8; contracts/workflows.md) ---

const ROOT = join(import.meta.dirname, "..");
const WORKFLOWS = join(ROOT, ".github/workflows");

function readWorkflow(name) {
  return readFileSync(join(WORKFLOWS, name), "utf8");
}

function normalizeGuard(text) {
  return text.replace(/\s+/g, "");
}

const JOB_GUARD = normalizeGuard(`
  github.event_name == 'workflow_dispatch' ||
  (github.event.workflow_run.conclusion == 'success' &&
   github.event.workflow_run.event == 'push' &&
   github.event.workflow_run.head_branch == 'main')
`);

test("deploy-dev.yml has no pull_request / pull_request_target trigger", () => {
  const text = readWorkflow("deploy-dev.yml");
  assert.doesNotMatch(text, /pull_request/);
});

test("deploy-dev.yml carries the exact job guard from research R1", () => {
  const text = readWorkflow("deploy-dev.yml");
  assert.ok(
    normalizeGuard(text).includes(JOB_GUARD),
    "expected the workflow_dispatch / workflow_run success+push+main guard",
  );
});

test("drift-dev.yml has no pull_request / pull_request_target trigger", {
  todo: "pending T012 (Phase 4)",
}, () => {
  const text = readWorkflow("drift-dev.yml");
  assert.doesNotMatch(text, /pull_request/);
});

test("ci.yml never names the self-hosted runner", () => {
  const text = readWorkflow("ci.yml");
  assert.doesNotMatch(text, /self-hosted/);
});

test("no existing workflow that runs on self-hosted carries a pull_request trigger", () => {
  for (const name of readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml"))) {
    const text = readFileSync(join(WORKFLOWS, name), "utf8");
    if (/self-hosted/.test(text)) {
      assert.doesNotMatch(
        text,
        /pull_request/,
        `${name} runs on self-hosted and must not trigger on pull_request`,
      );
    }
  }
});
