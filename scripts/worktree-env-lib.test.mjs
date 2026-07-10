/**
 * T009 (009 US2): the worktree-environment derivation math, TDD'd before the
 * CLI exists (contracts/environment.md §2–§4). Runs under node's built-in
 * test runner (`node --test scripts/`, wired into `pnpm verify` by T012) —
 * zero dependencies, same posture as check-boundaries.mjs.
 *
 * What must hold:
 *  - identity/ports derive from the worktree DIRNAME alone (determinism
 *    replaces registration; uniqueness is inherited from feature numbering)
 *  - main/ is the fixed point: offset 0, project the-stacks-v3
 *  - port-coupled values move together (API_INTERNAL_URL) or not at all
 *    (EMBEDDING_ENDPOINT, DATABASE_URL are container-internal)
 *  - collisions and drift are DETECTABLE before docker ever binds a port
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkDrift,
  deriveProfile,
  findPortCollisions,
  mintEnv,
  parseEnv,
} from "./worktree-env-lib.mjs";

const TEMPLATE = `# header comment
OPERATOR_PASSWORD_HASH=
SESSION_SECRET=
COMPOSE_PROJECT_NAME=the-stacks-v3
V3_WEB_PORT=4400
V3_API_PORT=4401
V3_ML_PORT=4402
V3_POSTGRES_PORT=5442
DATABASE_URL=postgresql://stacks_v3:stacks_v3@postgres:5432/stacks_v3
EMBEDDING_ENDPOINT=http://ml:4402
API_INTERNAL_URL=http://api:4401
`;

test("deriveProfile: feature worktree gets default + 10×NNN and a dirname project", () => {
  const profile = deriveProfile("009-library-surface-env");
  assert.equal(profile.projectName, "the-stacks-009-library-surface-env");
  assert.deepEqual(profile.ports, { web: 4490, api: 4491, ml: 4492, postgres: 5532 });
});

test("deriveProfile: main is the fixed point — offset 0, the-stacks-v3", () => {
  const profile = deriveProfile("main");
  assert.equal(profile.projectName, "the-stacks-v3");
  assert.deepEqual(profile.ports, { web: 4400, api: 4401, ml: 4402, postgres: 5442 });
});

test("deriveProfile: a dirname with no feature number cannot be derived — refuse loudly", () => {
  assert.throws(() => deriveProfile("feature-without-number"), /feature number/i);
});

test("mintEnv: derived values land; port-coupled API_INTERNAL_URL tracks the api port", () => {
  const env = parseEnv(
    mintEnv(TEMPLATE, "009-library-surface-env", {
      OPERATOR_PASSWORD_HASH: "$$2b$$10$$x",
      SESSION_SECRET: "s".repeat(64),
    }),
  );
  assert.equal(env.COMPOSE_PROJECT_NAME, "the-stacks-009-library-surface-env");
  assert.equal(env.V3_WEB_PORT, "4490");
  assert.equal(env.V3_API_PORT, "4491");
  assert.equal(env.V3_ML_PORT, "4492");
  assert.equal(env.V3_POSTGRES_PORT, "5532");
  // The footgun the tool exists to retire: forgetting this line used to mean
  // ECONNREFUSED from every web loader (it lived only as a compose comment).
  assert.equal(env.API_INTERNAL_URL, "http://api:4491");
  // Container-internal addresses do NOT move: only host publishes shift.
  assert.equal(env.EMBEDDING_ENDPOINT, "http://ml:4402");
  assert.equal(env.DATABASE_URL, "postgresql://stacks_v3:stacks_v3@postgres:5432/stacks_v3");
  // Secrets are copied verbatim, never invented.
  assert.equal(env.OPERATOR_PASSWORD_HASH, "$$2b$$10$$x");
  assert.equal(env.SESSION_SECRET, "s".repeat(64));
});

test("mintEnv: missing secrets stay blank (warned by the CLI, never generated)", () => {
  const env = parseEnv(mintEnv(TEMPLATE, "009-library-surface-env", {}));
  assert.equal(env.OPERATOR_PASSWORD_HASH, "");
  assert.equal(env.SESSION_SECRET, "");
});

test("findPortCollisions: names the sibling and the shared port", () => {
  const mine = deriveProfile("009-library-surface-env");
  const collisions = findPortCollisions(mine, [
    { dirname: "main", env: { V3_WEB_PORT: "4400", V3_API_PORT: "4401" } },
    { dirname: "010-retrieval", env: { V3_WEB_PORT: "4490" } }, // manual mistake
  ]);
  assert.deepEqual(collisions, [{ dirname: "010-retrieval", port: 4490 }]);
});

test("findPortCollisions: disjoint blocks are clean", () => {
  const mine = deriveProfile("009-library-surface-env");
  assert.deepEqual(
    findPortCollisions(mine, [{ dirname: "main", env: { V3_WEB_PORT: "4400" } }]),
    [],
  );
});

test("checkDrift: missing keys, unknown keys, and broken port coupling are all named", () => {
  const drifted = `OPERATOR_PASSWORD_HASH=x
SESSION_SECRET=y
COMPOSE_PROJECT_NAME=the-stacks-009-library-surface-env
V3_WEB_PORT=4490
V3_API_PORT=4491
V3_ML_PORT=4492
V3_POSTGRES_PORT=5532
DATABASE_URL=postgresql://stacks_v3:stacks_v3@postgres:5432/stacks_v3
EMBEDDING_ENDPOINT=http://ml:4402
API_INTERNAL_URL=http://api:4401
SOME_RETIRED_KEY=1
`; // missing nothing except... API_INTERNAL_URL points at 4401 while api is 4491
  const report = checkDrift(TEMPLATE, drifted);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.unknown, ["SOME_RETIRED_KEY"]);
  assert.equal(report.couplings.length, 1);
  assert.match(report.couplings[0], /API_INTERNAL_URL/);
});

test("checkDrift: a template key absent from .env is reported missing", () => {
  const report = checkDrift(TEMPLATE, "V3_WEB_PORT=4490\n");
  assert.ok(report.missing.includes("SESSION_SECRET"));
  assert.ok(report.missing.includes("COMPOSE_PROJECT_NAME"));
});

test("checkDrift: a clean minted env has no findings", () => {
  const minted = mintEnv(TEMPLATE, "009-library-surface-env", {
    OPERATOR_PASSWORD_HASH: "h",
    SESSION_SECRET: "s",
  });
  const report = checkDrift(TEMPLATE, minted);
  assert.deepEqual(report, { missing: [], unknown: [], couplings: [] });
});
