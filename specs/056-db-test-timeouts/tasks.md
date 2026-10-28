# Tasks: DB integration tests survive full-suite load

**Input**: `specs/056-db-test-timeouts/` — spec.md, plan.md, research.md, quickstart.md.

**Tests**: no new test. The change is the timeout budget of existing tests. Phase 3's three
full runs are the proof (card AC #2).

**Dispatch**: Phases 2 and 4 are one sonnet implementer dispatch each. Phases 1 and 3 are
orchestrator-run: they need `TEST_DATABASE_URL` exported, which the auto-mode classifier denies
to implementers. Run phases in order.

**Format**: `[ID] [P?] [Story] Description`. `[P]` = a different file with no open dependency.
`[US1]` = a full DB run passes first time (P1). `[US2]` = each timeout states its reason (P2).
"(orchestrator-run)" = the orchestrator runs it, not an implementer.

**Standing rules for every phase**:

- Work only in `/Users/evanstern/projects/the-stacks/.worktrees/task-0154`.
- Run `pnpm install --frozen-lockfile` first in a fresh worktree.
- Change no assertion, fixture, production source file or `apps/server/vitest.config.ts`.
- Never read, print or commit keys, passwords or database URLs.
- Commit with `git -C <literal worktree path>`, staging and committing in separate Bash calls.
  Lead each commit message with `TASK-0154:`.

---

## Phase 1: Measure before the fix (card AC #1) — orchestrator-run

**Goal**: measured durations for every slow server DB test, alone and under a full run.

**Independent test**: `evidence/alone.txt` and `evidence/baseline.txt` exist and show per-test
durations for the 8 DB tests in the three named files.

- [x] T001 (orchestrator-run) Bring the stack up and migrate, per quickstart.md "Prerequisites".
- [x] T002 (orchestrator-run) [US1] Run the three files alone, per quickstart.md "Phase 1" step 1. Write `specs/056-db-test-timeouts/evidence/alone.txt`.
- [x] T003 (orchestrator-run) [US1] Run one full `REQUIRE_DATABASE=1 pnpm test`, per quickstart.md "Phase 1" steps 2 and 3. Write `specs/056-db-test-timeouts/evidence/baseline.txt`. Read both files for secrets. Leave them uncommitted for Phase 2.

---

## Phase 2: Size and set the timeouts (card AC #1)

**Goal**: every in-scope DB test has an explicit timeout from plan.md D2, with one comment.

**Independent test**: `pnpm lint` and `pnpm typecheck` exit 0; each changed `it(` carries a
TASK-0154 comment and a numeric third argument; `git diff --stat` lists only test files and
`specs/056-db-test-timeouts/`.

- [x] T004 [US1] Read `evidence/alone.txt` and `evidence/baseline.txt`. Write `specs/056-db-test-timeouts/evidence/measurement.md` with one row per in-scope test: file, test name, alone ms, baseline ms (or "timed out"), `measuredMs`, timeout from plan.md D2. In-scope: the 8 DB tests in the three named files, plus every `*.integration.test.ts` test over 2 500 ms in `baseline.txt` (plan.md D3). List non-DB tests over 2.5 s in a separate "reported, not changed" section.
- [x] T005 Stop and report to the orchestrator if any D2 result exceeds 120 000 ms. Do not set that timeout.
- [x] T006 [P] [US1] [US2] In `apps/server/test/dm/scene.integration.test.ts`, set the D2 timeout as the third argument of the "plays Greyhollow Ford to its end through exploration, social and fight" `it(`. Add the one-line comment from plan.md D4 above it, with the real figures.
- [x] T007 [P] [US1] [US2] In `apps/server/test/playtest/harness.integration.test.ts`, do the same for each of its 4 tests.
- [x] T008 [P] [US1] [US2] In `apps/server/test/playtest/provider.integration.test.ts`, do the same for each of its 3 tests.
- [x] T009 [US1] [US2] Do the same for each extra test T004 put in scope. Skip this task when T004 found none, and say so in `measurement.md`.
- [x] T010 Run `pnpm lint` and `pnpm typecheck`. Both exit 0. Run `pnpm --filter @the-stacks/server test` without a database: the DB suites loud-skip and the rest pass.
- [x] T011 Commit `specs/056-db-test-timeouts/evidence/` and the test files: `TASK-0154: load-sized timeouts for DB scene and playtest tests`. Push.

---

## Phase 3: Three consecutive full runs (card AC #2) — orchestrator-run

**Goal**: three full `REQUIRE_DATABASE=1` runs in a row pass with no re-run.

**Independent test**: `evidence/run-1.txt`, `run-2.txt` and `run-3.txt` each show every
package's test files passing.

- [x] T012 (orchestrator-run) [US1] Run quickstart.md "Phase 3" on the Phase 2 commit. Write `specs/056-db-test-timeouts/evidence/run-1.txt` to `run-3.txt`. A failed run restarts the count: keep its filtered file as `evidence/run-failed-<k>.txt` and start again at run 1 (spec OQ-1 default (a)).
- [x] T013 (orchestrator-run) Report a failure in a test Phase 2 changed as a finding: its timeout is too small. Do not count that run. Re-size it in a new Phase 2 dispatch.
- [x] T014 (orchestrator-run) Read every evidence file for secrets. Leave them uncommitted for Phase 4.

---

## Phase 4: Evidence, wiki, runbook and close (card AC #1, card AC #2)

**Goal**: the evidence is committed, the wiki describes the timeouts, and the runbook and spec
054 record the 2026-10-28 state.

**Independent test**: the freshness gate prints `OK`; the spec-bridge gate exits 0;
`measurement.md` has a "Three-run result" section naming each run's exit code.

- [ ] T015 [US1] Add a "Three-run result" section to `evidence/measurement.md`: per run, the file name, exit code, each package's `Test Files` line, and the slowest duration of each timed test. Name any `run-failed-<k>.txt` and its failing test.
- [ ] T016 [US2] In `docs/wiki/test-suite.md`, add one paragraph after the `vitest.config.ts` paragraph. It says: the DB scene and playtest tests set explicit per-test timeouts sized by the TASK-0154 rule (3x the measured worst case, 30 s floor); the suite-wide default stays 5 s; the load is turbo running every package at once, since `fileParallelism: false` already serialises server files. Name each timed test file.
- [ ] T017 [US2] In `docs/wiki/test-suite.md`, add `apps/server/test/dm/scene.integration.test.ts`, `apps/server/test/playtest/harness.integration.test.ts` and `apps/server/test/playtest/provider.integration.test.ts` (and any T009 file) to `sources`. Add one clause on the load-sized timeouts to `description`. Re-pin `verified_against` to the Phase 2 commit after reading each source.
- [ ] T018 Regenerate `docs/wiki/CAPSULES.md` with `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/scripts/capsules.mjs . docs/wiki`.
- [ ] T019 In `docs/wiki/INDEX.md`'s state paragraph, add one sentence: DB scene and playtest integration tests carry load-sized timeouts (TASK-0154, specs/056) and pass three consecutive full runs.
- [ ] T020 In `docs/design/m3-table-sweep-runbook.md`'s Execution log, fill the TASK-0159 row: replace "(this PR)" with `[#80](https://github.com/evanstern/the-stacks/pull/80)` and "—" with `` `da31a11` ``. Do not edit other existing rows.
- [ ] T021 Append an amendment row dated 2026-10-28, task "(amendment)": `Operator ruled in chat on the remaining order: "Sounds good on ordering". Remaining order: TASK-0154 → TASK-0168 → TASK-0161 → TASK-0167 → TASK-0165 → the TASK-0053 demo. Spec 054 Phase 8 commands T041-T043 ran on 2026-10-28 under the operator's go (recorded on TASK-0163).`
- [ ] T022 Append a TASK-0154 row dated 2026-10-28 with PR "(this PR)", merge "—", tokens from the orchestrator, and notes: the timeouts chosen, the number of tests in scope, and the three-run result.
- [ ] T023 In `specs/054-two-player-alpha-kit/tasks.md`, tick T041, T042 and T043 (`- [ ]` to `- [x]`). Append to each: ` Done 2026-10-28 under the operator's go; result recorded on TASK-0163.` Do not tick T044 or T045.
- [ ] T024 Run the freshness gate (`node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` prints `OK`) and the spec-bridge gate (`node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` exits 0). Run `pnpm lint`.
- [ ] T025 Commit: `TASK-0154: evidence, wiki re-ground, runbook rows`. Push.
- [ ] T026 (orchestrator-run) Run `REQUIRE_DATABASE=1 pnpm ci:check` on the final tree with only `TEST_DATABASE_URL` exported. Expect exit 0 with no re-run.

---

## Dependencies

- Phase 1 → Phase 2 → Phase 3 → Phase 4. Each phase needs the previous phase's evidence.
- Inside Phase 2: T004 and T005 come first. T006, T007 and T008 run in parallel. T009 follows
  T004. T010 and T011 come last.
- Inside Phase 4: T015 to T023 touch different files and may run in any order. T018 follows
  T017. T024 and T025 come last.
