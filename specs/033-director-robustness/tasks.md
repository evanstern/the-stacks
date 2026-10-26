---
description: "Task list for director robustness (TASK-0102)"
---

# Tasks: First Scene — director output survives real models; failed jobs keep their error detail

**Input**: `specs/033-director-robustness/` — spec.md, plan.md, research.md, quickstart.md,
contracts/failure-record.md, contracts/director-output.md.

**Tests**: required. Every card AC is proven by a named test or a recorded run below.

**Dispatch unit**: Phases 1, 3 (fix part) and 5 are implementer dispatches (sonnet). Phases 2,
3 (classification part) and 4 are **orchestrator-run**. Never dispatch them. Run phases in
order.

**Gate for every dispatched phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
Phase 5 runs `pnpm ci:check`.

**Database suites**: run on the worktree's own stack. Run `pnpm env:up`. Run
`pnpm --filter @the-stacks/server db:migrate`. Run the suites with `REQUIRE_DATABASE=1`.

**Known flake**: the WebSocket gateway integration tests flake. Re-run on an unrelated
WebSocket failure. Record each re-run in the phase's commit message.

**Commits**: one or more per phase, each message led by `TASK-0102:`.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 failure record with issues, purpose, bounded excerpt; a test | T003, T004, T006 |
| #2 real output captured and committed; a test reproduces it | T010, T011, T014 |
| #3 a provider playtest passes the old failure turn with no director invalid-output | T015 (offline), T019 (paid run) |
| #4 existing dm tests green; scripted CI playtest passes | T021, T022 |

---

## Phase 1: Persist diagnostics (US1; AC #1)

**Goal**: a failed turn job keeps its schema issues, purpose and attempt excerpts.

- [ ] T001 [US1] In `apps/server/src/dm/pipeline/call.ts`, export `excerptOf(text)` per
  contracts/failure-record.md. Make `collect()` return `outputTokens` from the `done` event.
- [ ] T002 [US1] In `callJson`, record one `AttemptExcerpt` per failed attempt. Build the
  `invalid-output` detail as `{ purpose, promptVersion, issues, attempts }`. Keep the re-ask
  text unchanged.
- [ ] T003 [P] [US1] In `apps/server/test/dm/call.test.ts`, test: the detail after two
  failures; `excerptOf` at 8000 and 8001 characters (head 6000, tail 2000, elided count);
  `outputTokens` null when absent.
- [ ] T004 [US1] In `apps/server/src/jobs/queue.ts`, let `finishJob` take `{ error, result? }`.
  Write `result` on failure when present; write null otherwise.
- [ ] T005 [US1] In `apps/server/src/dm/worker.ts`, on a non-fenced, non-aborted turn failure,
  write `TurnFailureResult` (contracts/failure-record.md) with `latest`, `outcome.calls` and the
  failure. Do the same for the bad-seed path. Log `dm.turn.failed` with `detail` minus
  `attempts`. Add the `TurnFailureResult` type in `apps/server/src/dm/jobs.ts`.
- [ ] T006 [US1] In `apps/server/test/dm/worker.integration.test.ts`, script two invalid
  director outputs. Assert `jobs.error` is `stopped at director: invalid-output`, and
  `jobs.result.failure` holds node, kind, purpose, issues and two excerpts. Assert the route's
  item for that job has non-empty `calls` and no `failure` field.
- [ ] T007 [P] [US1] In `apps/server/src/dm/nodes/schemas.ts`, give the `advance` refine the
  message `advance must be a non-zero integer from -3 to 3`. Test it in
  `apps/server/test/dm/director.test.ts`.
- [ ] T008 [US1] Run the phase gate and the database suites. Commit. Push the branch.

**Checkpoint**: AC #1 met. The branch is ready for the capture.

---

## Phase 2: Capture the real failure (US2; AC #2) — ORCHESTRATOR-RUN, PAID

**Goal**: the real failing director output is committed as a fixture.

- [ ] T009 Orchestrator: build the composite worktree (quickstart A). Get the operator's spend
  ceiling. Record it on the card.
- [ ] T010 Orchestrator: run the capture (quickstart B). Commit the evidence directory.
- [ ] T011 Orchestrator: when the failure is a director `invalid-output`, commit the fixture
  `apps/server/test/dm/fixtures/director-capture-<runId>.json`. Otherwise stop and ask the
  operator (FR-011).

**Checkpoint**: the fixture is on the branch. No dispatch happens before this point.

---

## Phase 3: Classify and fix (US2, US3; AC #2, #3)

**Goal**: the fix the evidence selects, proven against the fixture.

- [ ] T012 Orchestrator: write `specs/033-director-robustness/evidence/classification.md`.
  List each attempt's issues, the selected catalog rows (contracts/director-output.md), and why
  each other row is not selected. Commit it before the dispatch.
- [ ] T013 [US2] In `apps/server/test/dm/director-capture.test.ts`, write the reproduction part:
  each captured attempt fails the strict v1 parse with the fixture's issue paths. Run it on the
  unfixed code. Commit it green (it reproduces the failure).
- [ ] T014 [US3] Build only the selected rows, in catalog order, each with its row's tests:
  - C1: `extractJson` in `call.ts`, used by `parseAgainst`.
  - C3, C4, C5: `normalizeDirector` in `nodes/director.ts`; the `normalize` hook on
    `callJson`; the director passes it.
  - C2, C6, C7, C8: prompt v2 in `prompts/director.ts`; bump `PROMPT_VERSION` to
    `dm.director-v2`; update the version in `assemble.test.ts`, `routes.integration.test.ts`
    and `call.test.ts`.
  - C9: the adapter fix in `ai/adapters/openai-compatible.ts` with an SSE case in
    `apps/server/test/ai.openai-compatible.test.ts`.
- [ ] T015 [US3] In `director-capture.test.ts`, add the fixed-pipeline part: the captured
  attempts through `callJson` with the director's `normalize` return `ok`, and
  `legalizeDirector` accepts the value. For a prompt-only classification, replace it with a
  prompt snapshot test, as `classification.md` states.
- [ ] T016 [P] [US4] When `normalizeDirector` exists, add a table test: for every rule, an
  input with each numeric field set to an out-of-range value leaves that value unchanged.
- [ ] T017 Run the phase gate and the database suites. Commit. Push the branch.

**Checkpoint**: AC #2 met. AC #3 holds offline.

---

## Phase 4: Verification run (US3; AC #3) — ORCHESTRATOR-RUN, PAID

- [ ] T018 Orchestrator: merge the branch tip into the composite worktree (quickstart C1). Get
  the operator's spend ceiling. Record it on the card.
- [ ] T019 Orchestrator: run the verification (quickstart C). Commit the evidence directory.
  Record pass or fail, spend and the run id on the card.
- [ ] T020 Orchestrator: on a fail, commit the new failure record as a second fixture and stop
  for an operator ruling. Do not start Phase 5.

**Checkpoint**: AC #3 met.

---

## Phase 5: Full gate (US4; AC #4)

- [ ] T021 [US4] Run `pnpm ci:check` and the database suites with `REQUIRE_DATABASE=1`. Fix
  any regression without loosening a test.
- [ ] T022 Orchestrator: run the scripted CI playtest in the composite worktree (quickstart D).
  Record it on the card.
- [ ] T023 [P] [US4] Add one line under the amended sections of
  `specs/031-dm-runtime/contracts/turn-jobs.md`, `node-seam.md` and `director.md`:
  "Amended by specs/033-director-robustness/contracts/<file>." Commit.
- [ ] T024 Orchestrator: tear down the composite worktree (quickstart E).

**Checkpoint**: AC #4 met. The task is ready for PR.

---

## Dependencies & Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. No phase overlaps. Phase 2 and Phase 4 each
need their own operator-approved ceiling. Within a phase, `[P]` tasks touch separate files.

## Notes

- `DirectorOutput` changes only by the `advance` refine message (T007).
- No migration. No new dependency.
- The operator route never serves the failure record. The operator reads it with SQL
  (quickstart B5).
