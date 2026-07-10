/**
 * The version-bump gate's pure core (check-version-bump.mjs). Runs under
 * `node --test scripts/` inside `pnpm verify` — zero dependencies, same
 * posture as worktree-env-lib.test.mjs.
 *
 * What must hold:
 *  - released surface = what a deploy or `pnpm verify` runs (apps/, packages/,
 *    scripts/, compose files, root manifests); docs/specs/backlog/process
 *    dirs are exempt
 *  - surface touched ⇒ head version must be valid semver, strictly greater
 *    than base, and not already tagged (versions are never reused)
 *  - nothing touched ⇒ no bump owed, whatever the versions say
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluate, releasedSurface, semverGt, semverParse } from "./check-version-bump.mjs";

test("semverParse accepts x.y.z only", () => {
  assert.deepEqual(semverParse("1.2.3"), [1, 2, 3]);
  assert.equal(semverParse("1.2"), null);
  assert.equal(semverParse("v1.2.3"), null);
  assert.equal(semverParse(null), null);
});

test("semverGt is a strict semver comparison", () => {
  assert.equal(semverGt("0.2.0", "0.1.9"), true);
  assert.equal(semverGt("0.1.0", "0.1.0"), false);
  assert.equal(semverGt("0.1.0", "0.2.0"), false);
  assert.equal(semverGt("1.0.0", "0.99.99"), true);
});

test("releasedSurface: shipped code in, process/docs out", () => {
  for (const p of [
    "apps/api/src/app.ts",
    "packages/db/src/schema/jobs.ts",
    "scripts/check-boundaries.mjs",
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "package.json",
    "pnpm-lock.yaml",
    ".env.example",
  ]) assert.equal(releasedSurface(p), true, p);
  for (const p of [
    "docs/wiki/ingestion.md",
    "specs/009-library-surface-env/tasks.md",
    "backlog/tasks/task-1 - v3-Walking-Skeleton.md",
    ".github/workflows/ci.yml",
    ".githooks/pre-commit",
    ".claude/settings.json",
    ".specify/memory/constitution.md",
    "README.md",
    "AGENTS.md",
  ]) assert.equal(releasedSurface(p), false, p);
});

test("surface touched without a bump fails with an actionable message", () => {
  const errors = evaluate({
    changedFiles: ["apps/api/src/app.ts"],
    baseVersion: "0.1.0",
    headVersion: "0.1.0",
    tagExists: false,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /did not increase \(base 0\.1\.0, head 0\.1\.0\)/);
});

test("surface touched with a proper bump passes", () => {
  assert.deepEqual(
    evaluate({ changedFiles: ["packages/core/src/errors.ts"], baseVersion: "0.1.0", headVersion: "0.2.0", tagExists: false }),
    [],
  );
});

test("a bump onto an already-released tag fails (versions are never reused)", () => {
  const errors = evaluate({
    changedFiles: ["scripts/check-boundaries.mjs"],
    baseVersion: "0.1.0",
    headVersion: "0.2.0",
    tagExists: true,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /already released/);
});

test("non-semver head version fails when surface changed", () => {
  const errors = evaluate({
    changedFiles: ["apps/web/app/root.tsx"],
    baseVersion: "0.1.0",
    headVersion: "next",
    tagExists: false,
  });
  assert.match(errors[0], /not x\.y\.z semver/);
});

test("docs/process-only diffs owe no bump", () => {
  assert.deepEqual(
    evaluate({
      changedFiles: ["docs/adr/0002-x.md", "backlog/config.yml", ".github/workflows/ci.yml"],
      baseVersion: "0.1.0",
      headVersion: "0.1.0",
      tagExists: true, // even a stale tag state is irrelevant when nothing shipped changed
    }),
    [],
  );
});

test("first bump from an unreadable base passes (bootstrap case)", () => {
  assert.deepEqual(
    evaluate({ changedFiles: ["apps/api/src/app.ts"], baseVersion: null, headVersion: "0.1.0", tagExists: false }),
    [],
  );
});
