---
name: ci-pipeline
description: GitHub Actions CI (the docker-compose.test.yml test stack, REQUIRE_DATABASE=1), the pnpm ci:check aggregate script, and the boundary-rules check that proves Biome's plane-isolation lint actually fires. Load for CI, build-gate, or "does main enforce this" questions.
kind: pipeline
sources:
  - .github/workflows/ci.yml
  - docker-compose.test.yml
  - package.json
  - scripts/check-boundaries.mjs
  - biome.json
  - turbo.json
  - specs/009-ci-pipeline/contracts/boundary-rules.md
  - README.md
  - .github/workflows/deploy-dev.yml
  - .github/workflows/drift-dev.yml
verified_against: 3e6be73f61bcdba0b2df26cc0669c33be406bc26
---

# CI pipeline

Every pull request and push to `main` runs one job (`.github/workflows/ci.yml`) that
reproduces, in order, everything a contributor is expected to run by hand before this task:
lint, typecheck, build, test, boundary check, hook tests, script tests. Before this branch,
none of this ran anywhere — gates were run by hand and their output pasted into the PR. Two
more workflows, `deploy-dev.yml` and `drift-dev.yml` (TASK-0021, spec 016), run on vm-104's
self-hosted runner instead of in this job — see [[hosted-dev]].

## How it works

Root `package.json`'s `ci:check` script is the single aggregate:
`pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:boundaries && pnpm
check:hooks && pnpm check:scripts && pnpm check:host-scripts && pnpm check:timing`. `check:timing` runs five packages' wall-clock budgets serially after `turbo run test` (TASK-0303, TASK-0308). `scripts/check-no-wallclock-tests.mjs` (last in `ci:check`) fails a regular `*.test.ts` that asserts on `performance.now()`. CI runs exactly this one
command (`pnpm ci:check`), so there is no drift between what CI enforces and what a
contributor can reproduce locally — see README.md's "Checks" section for the exact local
reproduction steps. `check:scripts` (`node --test 'scripts/*lib.test.mjs'`, spec 010) is the
Docker-free unit-test gate for `scripts/env-lib.mjs`'s pure derivation logic — see
[[runtime-stacks]] — and, since TASK-0021 (spec 016), for `scripts/deploy-lib.mjs`'s pure
logic behind the hosted `dev` deploy/rollback/drift verbs — see [[hosted-dev]]. Its
Docker-dependent sibling, `check:env`, proves the same tooling
against real containers but is deliberately **not** in `ci:check` (no Docker-in-Docker in
this repo's CI today; [[runtime-stacks]] covers it).

The workflow brings up `docker-compose.test.yml`'s throwaway `db` stack (`TEST_DB_PORT=5432
docker compose -f docker-compose.test.yml up -d --wait`, spec 020) — the same file and the
same `pgvector/pgvector:pg17` image (named once, in `docker-compose.yml`'s `db` service, and
`extend`ed here) a developer's own `pnpm env:up` uses locally; there is no separate
`services:` container declaration to drift out of sync (see [[compose-stack]]). It then runs
`pnpm --filter @the-stacks/server db:migrate`, then `pnpm ci:check` with `DATABASE_URL`,
`TEST_DATABASE_URL`, and `REQUIRE_DATABASE=1` all set. `REQUIRE_DATABASE` is declared in
`turbo.json`'s `globalEnv` because Turbo filters undeclared variables out of task environments,
and the `test` task is `cache: false` so a local run can never replay a green result recorded
while the database was up. With `REQUIRE_DATABASE=1` and a reachable database, every
environment-gated integration suite ([[test-suite]]'s three, [[ingestion]]'s, and
[[benchmarks]]' every-commit-tier suites) runs instead of loud-skipping — CI proves 411 of 416
tests (5 skipped are the load bench's `demand`/`dev`-tier cases, named-skipped on purpose
inside `test/bench/load.integration.test.ts`, not silently absent), not the 289 a
database-less run proves. `pnpm test` is also where the load bench's two `commit`-tier cases (`ingest-smoke`,
`concurrency-smoke`) actually run on every push — they are Vitest tests, not a separate
`bench:load` invocation; see [[benchmarks]]. Since TASK-0048 `pnpm test` also runs the playtest suites, including the CI playtest of the shipped scenario (a strict `FakeProvider`, no spend; see [[playtest-harness]]); the test counts above predate them. `pnpm playtest` itself is not in `ci:check`.

`check:boundaries` (`node scripts/check-boundaries.mjs`) proves the `noRestrictedImports`
zone rules in `biome.json` actually fire, rather than trusting the config was written
correctly. `specs/009-ci-pipeline/contracts/boundary-rules.md` defines five original zones (`apps/web`,
`packages/shared`, and the server's `library`/`codex`/`session` planes), each forbidden from
importing the others directly (constitution III). A sixth zone, `packages/dnd5e-engine`
(purity, constitution VI; [[dnd5e-engine]]), forbids I/O imports and clock/network globals. A seventh zone, `packages/srd` ([[srd-data]]),
forbids importing `@the-stacks/dnd5e-engine`, the server, the web app, or app/engine paths by relative
import; its fixture is `fixtures/boundary-violations/packages/srd/src/bad.ts`. A `packages/space/src/**` zone ([[space]], TASK-0270) allows `zod` only and has its own fixture under `fixtures/boundary-violations/packages/space/`. An eighth zone, `packages/session-model/src/**` ([[session-model]]), forbids server, web, database, network, model imports and clock/network globals; the engine zone also forbids importing the session model, and its fixture sits under `fixtures/boundary-violations/packages/session-model/`. A ninth zone, `apps/server/src/dm/**` ([[dm-runtime]], TASK-0046), forbids importing the event-log writers (`**/events/**`), ingestion, the library store, codex and ws, so session state is written only through the gate; its fixture is `fixtures/boundary-violations/apps/server/src/dm/bad.ts`. A tenth zone, `packages/intent/src/**` ([[intent-contract]], TASK-0266), forbids node modules, workspace packages, network and clock globals; its fixtures sit under `fixtures/boundary-violations/packages/intent/`. An eleventh zone, `packages/planner/src/**` ([[planner]], TASK-0267), allows intent, space, engine and zod only; its four fixtures sit under `fixtures/boundary-violations/packages/planner/`.
A separate guard, the server write-boundary test (`apps/server/test/write-boundary.test.ts`, an import-graph check, not a Biome rule; see [[proposal-gate]]), runs in `pnpm test`; its seeded violation tree is excluded from Biome.
Each zone has deliberately-violating fixture files under `fixtures/boundary-violations/`
mirroring its path. The script lints only
`fixtures/boundary-violations/` with `biome lint --only=style/noRestrictedImports
--only=style/noRestrictedGlobals --reporter=json`, run with `cwd` set inside that directory (Biome's root `files.includes`
excludes `fixtures`, and refuses to lint an excluded path from the repo root; the fixture
tree's own nested `biome.json`, which extends the root config and re-includes `**`, takes
over as that subtree's root). It fails unless every fixture file is flagged and Biome's exit
code is nonzero.

`check:hooks` runs `node --test '.claude/hooks/*.test.mjs'` — the project's own Claude Code
hooks get the same CI gate as application code.

`check:host-scripts` imports `apps/server/src/config.ts` and `db.ts` under `node
--experimental-strip-types` — the same runtime `apps/server/scripts/migrate.ts` uses — so a
relative import that Node's native TypeScript stripping can't resolve (host scripts can't
follow `src/`'s `.js`-suffixed imports; see [[configuration]]) fails `ci:check` instead of
only `db:migrate`. Added after TASK-0023 shipped a `config.ts` import that broke `db:migrate`
in CI while `ci:check` (which never runs `db:migrate`) stayed green. It dropped
`auth/password.ts` and `schema/auth.ts` (TASK-0036) once `create-operator.ts` moved to
`src/cli/` and started compiling under `tsc` like every other `src/` file — nothing loads
those two under strip-types anymore.

## Connections

Enforces the constitution's plane-isolation rule (Zone table above) that [[monorepo-and-toolchain]]'s
Biome config declares. Runs [[test-suite]] with `REQUIRE_DATABASE=1`, turning the loud-skip
integration suites into hard failures on a missing database. Replaces the "no CI, gates run
by hand" state described in earlier [[overview]] history.

## Operational notes

`REQUIRE_DATABASE=1` changes only the integration suites' unreachable-database branch: it
`throw`s the same notice text it would otherwise `console.warn`, so a broken database
connection fails the run instead of silently skipping it. Locally, without
`REQUIRE_DATABASE` set, the suites still loud-skip as before — this variable is what CI sets
that a local run normally does not.
