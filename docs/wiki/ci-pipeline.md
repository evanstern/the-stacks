---
name: ci-pipeline
description: GitHub Actions CI (pgvector/pg17 service, REQUIRE_DATABASE=1), the pnpm ci:check aggregate script, and the boundary-rules check that proves Biome's plane-isolation lint actually fires. Load for CI, build-gate, or "does main enforce this" questions.
kind: pipeline
sources:
  - .github/workflows/ci.yml
  - package.json
  - scripts/check-boundaries.mjs
  - biome.json
  - turbo.json
  - specs/009-ci-pipeline/contracts/boundary-rules.md
  - README.md
verified_against: 019bbb09735d0b96b296c88edec05213b8fb0c76
---

# CI pipeline

Every pull request and push to `main` runs one job (`.github/workflows/ci.yml`) that
reproduces, in order, everything a contributor is expected to run by hand before this task:
lint, typecheck, build, test, boundary check, hook tests. Before this branch, none of this
ran anywhere — gates were run by hand and their output pasted into the PR.

## How it works

Root `package.json`'s `ci:check` script is the single aggregate:
`pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:boundaries && pnpm
check:hooks && pnpm check:host-scripts`. CI runs exactly this one command (`pnpm ci:check`), so there is no drift
between what CI enforces and what a contributor can reproduce locally — see README.md's
"Checks" section for the exact local reproduction steps.

The workflow provisions a `pgvector/pgvector:pg17` service container (`POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB` all `stacks`) health-checked with `pg_isready`, runs
`pnpm --filter @the-stacks/server db:migrate`, then `pnpm ci:check` with `DATABASE_URL`,
`TEST_DATABASE_URL`, and `REQUIRE_DATABASE=1` all set. `REQUIRE_DATABASE` is declared in
`turbo.json`'s `globalEnv` because Turbo filters undeclared variables out of task environments,
and the `test` task is `cache: false` so a local run can never replay a green result recorded
while the database was up. With `REQUIRE_DATABASE=1` and a reachable database, [[test-suite]]'s three
integration suites run instead of loud-skipping — CI proves all 72 tests, not the 30 that a
database-less run proves.

`check:boundaries` (`node scripts/check-boundaries.mjs`) proves the `noRestrictedImports`
zone rules in `biome.json` actually fire, rather than trusting the config was written
correctly. `specs/009-ci-pipeline/contracts/boundary-rules.md` defines five zones (`apps/web`,
`packages/shared`, and the server's `library`/`codex`/`session` planes), each forbidden from
importing the others directly (constitution III). Each zone has one deliberately-violating
fixture file under `fixtures/boundary-violations/` mirroring its path. The script lints only
`fixtures/boundary-violations/` with `biome lint --only=style/noRestrictedImports
--reporter=json`, run with `cwd` set inside that directory (Biome's root `files.includes`
excludes `fixtures`, and refuses to lint an excluded path from the repo root; the fixture
tree's own nested `biome.json`, which extends the root config and re-includes `**`, takes
over as that subtree's root). It fails unless every fixture file is flagged and Biome's exit
code is nonzero.

`check:hooks` runs `node --test '.claude/hooks/*.test.mjs'` — the project's own Claude Code
hooks get the same CI gate as application code.

`check:host-scripts` imports `apps/server/src/config.ts`, `db.ts`, `auth/password.ts`, and
`schema/auth.ts` under `node --experimental-strip-types` — the same runtime
`apps/server/scripts/migrate.ts` and `create-operator.ts` use — so a relative import that
Node's native TypeScript stripping can't resolve (host scripts can't follow `src/`'s
`.js`-suffixed imports; see [[configuration]]) fails `ci:check` instead of only `db:migrate`.
Added after TASK-0023 shipped a `config.ts` import that broke `db:migrate` in CI while
`ci:check` (which never runs `db:migrate`) stayed green.

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
