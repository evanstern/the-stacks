# Research: CI pipeline with boundary check

## R1 — Where the check set lives

- **Decision**: a root `ci:check` script chaining `pnpm lint && pnpm typecheck &&
  pnpm build && pnpm test && pnpm check:boundaries && pnpm check:hooks`. CI's only
  check step is `pnpm ci:check`.
- **Rationale**: one definition serves CI and local runs (FR-008); adding a suite is one
  `&& pnpm <suite>` edit in one file (FR-009). Turbo already fans out per package.
- **Alternatives**: separate YAML steps per check (clearer per-step UI, but the local
  command then drifts from CI); a turbo `ci` task (hides ordering across root scripts).

## R2 — Boundary check mechanism

- **Decision**: Biome `linter.rules.nursery|style.noRestrictedImports` (whichever group
  holds it in 2.5.14 — confirm against the installed schema) under `overrides`, one per
  zone:
  - `apps/web/**` — forbid `@the-stacks/server` and any relative path into `apps/server`.
  - `packages/shared/**` — forbid `@the-stacks/server`, `@the-stacks/web`, and relative
    paths into `apps/`.
  - `apps/server/src/library/**`, `.../codex/**`, `.../session/**` — each forbids the
    other two zones' directories (plane rule). The zones do not exist yet; the rule is
    declared ahead of the code.
- **Rationale**: no dependency (operator ruling); runs inside the existing lint step.
- **Alternatives**: dependency-cruiser (new dependency — ruled out); a hand-written
  import scanner (reimplements what Biome already parses).

## R3 — Proving the rules fire (fixture)

- **Decision**: `fixtures/boundary-violations/` mirrors each zone's path shape
  (e.g. `fixtures/boundary-violations/apps/web/bad.ts`). Biome overrides also match
  these paths. Normal lint EXCLUDES the fixture dir. `scripts/check-boundaries.mjs` runs
  `biome lint --only=<rule> fixtures/boundary-violations` via `node:child_process`,
  asserts nonzero exit, and asserts every fixture file is named in the output.
- **Rationale**: FR-006 — the run fails if a fixture is NOT flagged, and the fixture
  never pollutes the real lint. If Biome's `files.includes` exclusion prevents linting
  an explicitly passed path, fall back to a separate
  `fixtures/boundary-violations/biome.json` that `extends` the root config with the dir
  included; record which one worked in this file.
- **Alternatives**: a test inside Vitest (couples a lint concern to the server's test
  runner).

## R4 — Database in CI

- **Decision**: `services.db` with `pgvector/pgvector:pg17`, `POSTGRES_USER/PASSWORD/DB`
  set, port 5432 published, health check `pg_isready` with interval and retries. Job env
  sets both `DATABASE_URL` and `TEST_DATABASE_URL` to
  `postgres://stacks:stacks@localhost:5432/stacks` — `loadConfig` throws without
  `DATABASE_URL`, and migrate/tests prefer `TEST_DATABASE_URL`. Run
  `pnpm --filter @the-stacks/server db:migrate` before `ci:check`.
- **Zero-skip enforcement**: the test step must fail on any skip. Set
  `REQUIRE_DATABASE=1` in CI; each integration file's existing loud-skip guard is
  changed to `throw` instead of skip when that variable is set. (Local behavior
  unchanged.)
- **Rationale**: FR-003 + US2 scenario 2 — a DB failure turns red, never silent green.

## R5 — Typechecking tests

- **Decision**: `apps/server/test/tsconfig.json` extending the base, `noEmit`
  (composite projects cannot emit into src' outDir), `include: ["."]`, `references` to
  `..` (the server) and shared; root `tsconfig.json` adds it as a reference, so
  `tsc -b` covers it. If `composite`+`noEmit` conflicts, set `composite: false` and add
  a dedicated `typecheck:test` script (`tsc -p apps/server/test --noEmit`) wired into
  the server's `typecheck` script. Record which one worked here.
- **Verified**: the primary variant (`composite` inherited `true` from the base config,
  `noEmit: true` added, `include: ["."]`, `references` to `..` and `../../../packages/shared`)
  worked with no `composite`/`noEmit` conflict — `tsc -b` ran straight to real type
  errors in the test files, never to a config error. No fallback needed.
- **Rationale**: FR-007; keeps `pnpm typecheck` as the single entry.

## R6 — Triggers and concurrency

- **Decision**: `on: pull_request: branches: [main]` and `push: branches: [main]`;
  `concurrency: group: ci-${{ github.ref }}, cancel-in-progress: true`. Node from
  `.nvmrc` (`22`), pnpm from `packageManager`, pnpm store cached by setup-node.
- **Rationale**: FR-001, FR-011, reproducible toolchain versions.

## R7 — Hook tests before TASK-0018 merges

- **Decision**: `check:hooks` = `node --test '.claude/hooks/*.test.mjs'` — quoted, so
  Node's own glob matching resolves it identically under any shell. This branch merges
  `main` in after TASK-0018 lands, so the hook test file exists by PR time. Until then
  the script is added but not yet asserted.
- **Deviation (T002)**: the plain directory form `node --test .claude/hooks/` fails on
  Node 22.23 with `MODULE_NOT_FOUND` — Node does not recurse a bare directory argument.
  Verified on this branch: with no `*.test.mjs` file yet present, the quoted-glob form
  reports 0 tests found and exits 0 (not an error) — acceptable until `main` merges in.
