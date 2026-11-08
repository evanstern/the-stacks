# Tasks: Migrated stacks

**Input**: `specs/095-migrated-stacks/` (spec.md, plan.md). Plan D1 to D6 settle every choice; read
them before a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0098:`. No paid model run.

**Before Phase 1**: merge `origin/main` into the branch. Run `pnpm install --frozen-lockfile`.
Re-read `scripts/env.mjs` `runUp`, `down` and `prune` as merged.

**Rules for every phase**: never read, print or interpolate a `.env` password on the host. Never
`source` or `export $(grep …)` the `.env`. Never touch the root checkout or another worktree.

## Phase 1: Migrate on up, verify, back off (US1, US2, US3; FR-001 to FR-010)

**Goal**: `env up` and `env main` leave every stack database migrated and verified.

**Independent test**: `pnpm check:scripts` passes the new `migrationShortfall` cases. The new ingest
backoff test passes. `pnpm check:env` passes the count assertion when Docker is reachable.

- [ ] T001 [US3] In `scripts/env-lib.mjs`, add `migrationShortfall(journalText, appliedText)` (plan D2).
- [ ] T002 [P] [US3] In `scripts/env-lib.test.mjs`, add cases: equal counts, short count, non-integer
      applied text, applied above expected.
- [ ] T003 [US1] [US2] In `scripts/env.mjs` `runUp`, add plan D1 steps 3 to 7. Each failure exits 1
      and names the stack and the database.
- [ ] T004 [US1] In `scripts/env.mjs` `down` and `prune`, remove `<project>-migrate` (plan D3).
- [ ] T005 [US1] In `scripts/env.test.mjs`, after `up`, assert both databases' migration counts equal
      the journal's entry count (plan D2 command).
- [ ] T006 [US3] In `apps/server/src/library/ingest/worker.ts`, wait `POLL_MS` after a failed loop
      iteration (plan D4).
- [ ] T007 [P] [US3] Add `apps/server/test/library/worker.backoff.test.ts` (plan, Files touched).
- [ ] T008 [P] In `apps/server/scripts/migrate.ts` and `apps/server/src/cli/create-operator.ts`, print
      the target line (plan D5).
- [ ] T009 Amend `specs/010-worktree-stacks/contracts/env-cli.md` and
      `specs/010-worktree-stacks/quickstart.md` (plan D6).
- [ ] T010 Run `pnpm ci:check`. If Docker is reachable and no labeled stack runs, run `pnpm check:env`.
      Otherwise, run `pnpm env:up` in this worktree, report both counts, and leave the stack up.
      Commit as `TASK-0098 phase 1: migrate stacks on up`.

## Phase 2: Wiki (re-ground)

**Goal**: the notes describe migrate-on-up and pass the freshness gate.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T011 NEEDS-REVIEW `docs/wiki/runtime-stacks.md`: add migrate-and-verify to `env up`/`env main`;
      replace the TASK-0158 hand-migrate paragraph with a pointer to the automatic step.
- [ ] T012 NEEDS-REVIEW `docs/wiki/migrations.md`: state that `env up` migrates both stack databases;
      note the host target line.
- [ ] T013 NEEDS-REVIEW `docs/wiki/test-suite.md`: a fresh `env up` needs no hand migrate before
      `REQUIRE_DATABASE=1` suites.
- [ ] T014 Re-verify every other note whose `sources:` lists a Phase 1 file:
      `configuration.md`, `operator-provisioning.md`, `ingestion.md`. Re-pin each honestly.
- [ ] T015 Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed; update
      `docs/wiki/INDEX.md` to match. Run the freshness gate. Commit as `TASK-0098 phase 2: re-ground wiki`.

**[orchestrator]** after merge: card OQ2 and OQ3 if the operator accepts them. Update
`docs/ops/orchestrator-kit/dispatch-rules.md` and `docs/ops/orchestrator-handoff.md` to drop the
hand-migrate step.
