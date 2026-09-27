---
description: "Task list for spec 009 — CI pipeline with boundary check"
---

# Tasks: CI pipeline with boundary check

**Input**: Design documents from `/specs/009-ci-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED where the spec demands proof — the boundary fixture (FR-006) and the
zero-skip guard (US2). No new unit tests otherwise.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational — the one command

**Purpose**: the single check-set entry point every story plugs into.

- [x] T001 Add `.nvmrc` containing `22` at the repository root.
- [x] T002 In root `package.json` add scripts: `"check:boundaries": "node scripts/check-boundaries.mjs"`, `"check:hooks": "node --test '.claude/hooks/*.test.mjs'"` (quoted glob — see research R7 deviation), and `"ci:check": "pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:boundaries && pnpm check:hooks"`. Create a placeholder `scripts/check-boundaries.mjs` that exits 0 (filled in Phase 4). If `.claude/hooks/*.test.mjs` does not exist yet on this branch, `check:hooks` will report no tests — acceptable until main is merged in (research R7).

**Checkpoint**: `pnpm ci:check` runs locally and reaches the end.

## Phase 2: User Story 4 — test files typechecked (Priority: P2, foundational for CI green)

**Goal**: `pnpm typecheck` covers `apps/server/test/`.

**Independent Test**: a deliberate type error in a test file fails `pnpm typecheck`.

- [x] T003 [US4] Create `apps/server/test/tsconfig.json` per research R5 (extends `../../../tsconfig.base.json`, `include: ["."]`, references the server and shared projects). Add it to root `tsconfig.json` `references`. Record in `specs/009-ci-pipeline/research.md` R5 which variant (composite+noEmit, or a dedicated `typecheck:test` script) actually worked.
- [x] T004 [US4] Run `pnpm typecheck`; fix every type error it exposes in `apps/server/test/*.ts` without changing test behavior. Confirm with the quickstart negative check 3, then revert the probe.

**Checkpoint**: typecheck green with tests included.

## Phase 3: User Story 2 — integration tests cannot skip in CI (Priority: P1)

**Goal**: with `REQUIRE_DATABASE=1`, an unreachable database fails the run.

**Independent Test**: quickstart negative check 4.

- [x] T005 [US2] In each of `apps/server/test/auth.integration.test.ts`, `events.integration.test.ts`, `ws.integration.test.ts`: where the file computes `reachable` and loud-skips, add — before the `describe.skipIf` — `if (!reachable && process.env.REQUIRE_DATABASE === "1") throw new Error(<the same notice text>)`. Local behavior without the variable stays unchanged.
- [x] T006 [US2] Add `REQUIRE_DATABASE` to `turbo.json` `globalEnv` (turbo filters undeclared env vars from tasks). Verify: db stopped + `REQUIRE_DATABASE=1 pnpm test` fails; db up + migrated + same command passes with 0 skipped.

**Checkpoint**: skips impossible under the CI flag.

## Phase 4: User Story 3 — boundary check (Priority: P1)

**Goal**: forbidden imports fail lint; a fixture proves every rule fires.

**Independent Test**: `pnpm check:boundaries` passes; deleting any one rule makes it fail.

- [x] T007 [US3] In `biome.json`, add `overrides` implementing every row of `specs/009-ci-pipeline/contracts/boundary-rules.md` with `noRestrictedImports` (confirm the rule's group and the `paths`/`patterns` option shape against `node_modules/@biomejs/biome/configuration_schema.json`). Each override's `includes` covers both the real zone glob and its mirror under `fixtures/boundary-violations/`. Run `pnpm lint` — real code must pass.
- [x] T008 [US3] Create one violating file per contract row under `fixtures/boundary-violations/` mirroring the zone path (e.g. `fixtures/boundary-violations/apps/web/src/bad.ts` importing `@the-stacks/server`; `.../apps/server/src/codex/bad.ts` importing `../session/x`). Exclude `fixtures/` from the root lint (`files.includes` `!fixtures`), from turbo/tsc (it is outside every package, confirm), and from the build.
- [x] T009 [US3] Implement `scripts/check-boundaries.mjs` (stdlib only) per research R3: run Biome over `fixtures/boundary-violations/` with the rule, assert nonzero exit, and assert every fixture file path appears in the diagnostics; print `boundary rules: N/N fixtures flagged`; exit 1 otherwise. If Biome refuses to lint the excluded path, use the fallback in R3 and record which worked in research.md.
- [x] T010 [US3] Prove it: temporarily delete one override → `pnpm check:boundaries` fails; restore. Temporarily add `import "@the-stacks/server";` to `apps/web/src/main.tsx` → `pnpm lint` fails; restore.

**Checkpoint**: boundary rules enforced and self-proving.

## Phase 5: User Story 1 — the workflow (Priority: P1) 🎯 MVP gate

**Goal**: every PR and main push runs `pnpm ci:check` against a real database.

**Independent Test**: the PR's own run is green with 0 skipped tests.

- [x] T011 [US1] Create `.github/workflows/ci.yml` per research R4/R6: triggers `pull_request` and `push` on `main`; `concurrency` group per ref with `cancel-in-progress: true`; one job on `ubuntu-latest`, `timeout-minutes: 15`; `services.db` = `pgvector/pgvector:pg17` with `POSTGRES_USER/PASSWORD/DB` = `stacks/stacks/stacks`, port `5432:5432`, `pg_isready` health options; job `env` sets `DATABASE_URL` and `TEST_DATABASE_URL` to `postgres://stacks:stacks@localhost:5432/stacks` and `REQUIRE_DATABASE: "1"`. Steps: checkout, `pnpm/action-setup` (version from `packageManager`), `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm`, `pnpm install --frozen-lockfile`, `pnpm --filter @the-stacks/server db:migrate`, `pnpm ci:check`. Pin actions to major versions.
- [ ] T012 [US1] Push; confirm the run triggers on the PR and passes. Record the run URL in the task's PR body. (Orchestrator opens the PR; implementer pushes.)

**Checkpoint**: CI live.

## Phase 6: User Story 5 — document and extend (Priority: P2)

- [ ] T013 [US5] Add a "Checks" section to `README.md`: the quickstart's local reproduction block, and "To add a suite: define a script and append `&& pnpm <script>` to `ci:check`." Keep it under 25 lines.
- [ ] T014 [US5] After TASK-0018 merges: merge `origin/main` into this branch (never rebase), confirm `pnpm check:hooks` runs the hook tests, and re-run `pnpm ci:check`.

## Phase 7: Polish & re-ground

- [ ] T015 Run the full quickstart (local reproduction + all four negative checks); paste results into the PR body.
- [ ] T016 Run `/grounding-wiki:wiki-update`: notes `test-suite` and `monorepo-and-toolchain` are NEEDS-REVIEW (test/ now typechecked; new scripts, `.nvmrc`, CI). Re-verify prose against this branch's diff, then re-pin. Freshness gate prints OK.

## Dependencies & Execution Order

- Phase 1 blocks all.
- Phases 2, 3, 4 are independent of each other after Phase 1 (different files, except
  `turbo.json` only in T006) — dispatch as one sequential group to keep one agent's
  context on `package.json`/`biome.json`.
- Phase 5 needs 2–4 (CI must be green on first run).
- T014 needs TASK-0018 merged. Phase 7 last; T016 run by the orchestrator.

## Implementation Strategy

- Dispatch A: Phases 1–4 (local, no CI). Dispatch B: Phases 5–6 (T011–T013).
- Orchestrator: PR, T012 verification, T014 merge-in, Phase 7.
