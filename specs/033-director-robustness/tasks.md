---
description: "Task list for director robustness (TASK-0102)"
---

# Tasks: First Scene — director output survives real models; failed jobs keep their error detail

**Input**: `specs/033-director-robustness/` — spec.md, plan.md, research.md, quickstart.md,
contracts/failure-record.md, contracts/director-output.md; amendment 2026-10-26:
contracts/interpret-output.md, contracts/rules-terms.md, research R10 and R11.

**Tests**: required. Every card AC is proven by a named test or a recorded run below.

**Dispatch unit**: Phases 1, 3 (fix part), 3b and 5 are implementer dispatches (sonnet).
Phases 2, 3 (classification part), 4 and 4b are **orchestrator-run**. Never dispatch them. Run
phases in order: 1, 2, 3, 4, 3b, 4b, 5.

**Gate for every dispatched phase** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/server test && pnpm check:boundaries`.
Phase 3b also runs `pnpm --filter @the-stacks/dnd5e-engine test` and
`pnpm --filter @the-stacks/session-model test`, because it changes the engine's command schema.
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
| #3 a provider playtest passes the old failure turn with no director invalid-output | T015 (offline), T019 (paid run; director part met) |
| #3, interpret extension (amendment; FR-018–FR-028) | T025, T027, T030, T033 (offline), T037 (paid rerun) |
| #4 existing dm tests green; scripted CI playtest passes | T021, T022 |

---

## Phase 1: Persist diagnostics (US1; AC #1)

**Goal**: a failed turn job keeps its schema issues, purpose and attempt excerpts.

- [x] T001 [US1] In `apps/server/src/dm/pipeline/call.ts`, export `excerptOf(text)` per
  contracts/failure-record.md. Make `collect()` return `outputTokens` from the `done` event.
- [x] T002 [US1] In `callJson`, record one `AttemptExcerpt` per failed attempt. Build the
  `invalid-output` detail as `{ purpose, promptVersion, issues, attempts }`. Keep the re-ask
  text unchanged.
- [x] T003 [P] [US1] In `apps/server/test/dm/call.test.ts`, test: the detail after two
  failures; `excerptOf` at 8000 and 8001 characters (head 6000, tail 2000, elided count);
  `outputTokens` null when absent.
- [x] T004 [US1] In `apps/server/src/jobs/queue.ts`, let `finishJob` take `{ error, result? }`.
  Write `result` on failure when present; write null otherwise.
- [x] T005 [US1] In `apps/server/src/dm/worker.ts`, on a non-fenced, non-aborted turn failure,
  write `TurnFailureResult` (contracts/failure-record.md) with `latest`, `outcome.calls` and the
  failure. Do the same for the bad-seed path. Log `dm.turn.failed` with `detail` minus
  `attempts`. Add the `TurnFailureResult` type in `apps/server/src/dm/jobs.ts`.
- [x] T006 [US1] In `apps/server/test/dm/worker.integration.test.ts`, script two invalid
  director outputs. Assert `jobs.error` is `stopped at director: invalid-output`, and
  `jobs.result.failure` holds node, kind, purpose, issues and two excerpts. Assert the route's
  item for that job has non-empty `calls` and no `failure` field.
- [x] T007 [P] [US1] In `apps/server/src/dm/nodes/schemas.ts`, give the `advance` refine the
  message `advance must be a non-zero integer from -3 to 3`. Test it in
  `apps/server/test/dm/director.test.ts`.
- [x] T008 [US1] Run the phase gate and the database suites. Commit. Push the branch.

**Checkpoint**: AC #1 met. The branch is ready for the capture.

---

## Phase 2: Capture the real failure (US2; AC #2) — ORCHESTRATOR-RUN, PAID

**Goal**: the real failing director output is committed as a fixture.

- [x] T009 Orchestrator: build the composite worktree (quickstart A). Get the operator's spend
  ceiling. Record it on the card.
- [x] T010 Orchestrator: run the capture (quickstart B). Commit the evidence directory.
- [x] T011 Orchestrator: when the failure is a director `invalid-output`, commit the fixture
  `apps/server/test/dm/fixtures/director-capture-<runId>.json`. Otherwise stop and ask the
  operator (FR-011).

**Checkpoint**: the fixture is on the branch. No dispatch happens before this point.

---

## Phase 3: Classify and fix (US2, US3; AC #2, #3)

**Goal**: the fix the evidence selects, proven against the fixture.

- [x] T012 Orchestrator: write `specs/033-director-robustness/evidence/classification.md`.
  List each attempt's issues, the selected catalog rows (contracts/director-output.md), and why
  each other row is not selected. Commit it before the dispatch.
- [x] T013 [US2] In `apps/server/test/dm/director-capture.test.ts`, write the reproduction part:
  each captured attempt fails the strict v1 parse with the fixture's issue paths. Run it on the
  unfixed code. Commit it green (it reproduces the failure).
- [x] T014 [US3] Build only the selected rows, in catalog order, each with its row's tests:
  - C1: `extractJson` in `call.ts`, used by `parseAgainst`.
  - C3, C4, C5: `normalizeDirector` in `nodes/director.ts`; the `normalize` hook on
    `callJson`; the director passes it.
  - C2, C6, C7, C8: prompt v2 in `prompts/director.ts`; bump `PROMPT_VERSION` to
    `dm.director-v2`; update the version in `assemble.test.ts`, `routes.integration.test.ts`
    and `call.test.ts`.
  - C9: the adapter fix in `ai/adapters/openai-compatible.ts` with an SSE case in
    `apps/server/test/ai.openai-compatible.test.ts`.
- [x] T015 [US3] In `director-capture.test.ts`, add the fixed-pipeline part: the captured
  attempts through `callJson` with the director's `normalize` return `ok`, and
  `legalizeDirector` accepts the value. For a prompt-only classification, replace it with a
  prompt snapshot test, as `classification.md` states.
- [x] T016 [P] [US4] When `normalizeDirector` exists, add a table test: for every rule, an
  input with each numeric field set to an out-of-range value leaves that value unchanged.
- [x] T017 Run the phase gate and the database suites. Commit. Push the branch.

**Checkpoint**: AC #2 met. AC #3 holds offline.

---

## Phase 4: Verification run (US3; AC #3) — ORCHESTRATOR-RUN, PAID

**Ran 2026-10-26.** Run `20261026T152743Z-greyhollow-ford-provider`
(`evidence/verify-20261026T152743Z-greyhollow-ford-provider/`). No director failure; 4 moves
committed; spend $1.00 under the $22 ceiling. The run stopped at **interpret**
(`stopped at interpret: invalid-output`). T020 committed the fixture
`apps/server/test/dm/fixtures/interpret-capture-20261026T152743Z-greyhollow-ford-provider.json`
and stopped. The operator ruling led to this amendment (Phases 3b and 4b). T019 and T020 stay
unticked: the run did not reach `completed`, and Phase 4b's rerun is the verification of
record.

- [x] T018 Orchestrator: merge the branch tip into the composite worktree (quickstart C1). Get
  the operator's spend ceiling. Record it on the card.
- [x] T019 Orchestrator: run the verification (quickstart C). Commit the evidence directory.
  Record pass or fail, spend and the run id on the card. *(Ran: director part passed; stopped at
  interpret. Superseded by T037.)*
- [x] T020 Orchestrator: on a fail, commit the new failure record as a second fixture and stop
  for an operator ruling. Do not start Phase 5. *(Done for the interpret failure: fixture
  committed; operator ruled to amend.)*

**Checkpoint**: the director part of AC #3 met. The interpret part moves to Phases 3b and 4b.

---

## Phase 3b: Interpret fix and the skill gate (US5; AC #3, amendment) — DISPATCH (sonnet)

**Goal**: interpret output from real models parses; no invented rules term passes a gate.
Contracts: `contracts/interpret-output.md`, `contracts/rules-terms.md`.

**Rules for this phase**: interpret stays strict. Add no normalizer. Never map, coerce or drop
a condition, skill, damage type, ability or number. Never edit `.env`.

- [x] T025 [US5] In `apps/server/test/dm/interpret-capture.test.ts`, load the interpret fixture.
  Parse each attempt's `excerpt` as `parseAgainst` does: `stripFence`, `JSON.parse`, then
  `InterpretOutput.safeParse`. Assert attempt 1 throws in `JSON.parse` (`not valid JSON`).
  Assert attempt 2 fails with issue path `readings.0.steps.0.onSuccess.0.condition`. Assert
  the fixture's `promptVersion` is `dm.interpret-v1`. Run it on the unfixed code. Commit it
  green.
- [x] T026 [US5] In `packages/dnd5e-engine/src/schema/state.ts`, add `SkillSchema` (the 18 keys
  in `contracts/rules-terms.md`) and `type Skill`. In `schema/commands.ts`, set `check.roll`
  `skill: SkillSchema.nullable().default(null)`. Export both from `src/index.ts`. Leave
  `schema/events.ts` unchanged.
- [x] T027 [P] [US5] In `packages/dnd5e-engine/test/commands/attacks.test.ts`, add scripted
  tests: each of the 18 keys rolls a `check.resolved` with that key; `"Perception"`,
  `"sleight of hand"` and `"spotting"` are refused with `INVALID_COMMAND` via `expectRefusal`;
  `null` and an omitted skill still resolve. Run the engine tests.
- [x] T028 [US5] In `apps/server/src/dm/nodes/schemas.ts`, derive `SkillSchema` from the
  engine's `check.roll` command shape, like `AbilitySchema`. Unwrap the default and the
  nullable. Throw at load when the inner schema is not an enum. Set `StepSchema` check
  `skill: SkillSchema.nullable()`. Export `CONDITION_KEYS` and `SKILL_KEYS` option arrays
  from the uncast enums.
- [x] T029 [US5] In `apps/server/src/dm/seed/schema.ts`, use `SkillSchema` from
  `../nodes/schemas.js` for character `skills` keys (`z.partialRecord`) and clue
  `check.skill` (nullable). Confirm `apps/server/seeds/greyhollow-ford.json` still loads.
- [x] T030 [P] [US5] Update every skill value listed in `contracts/rules-terms.md` ("Files whose
  skill values change") to its kebab key. Update any assertion that reads one back. Add
  `apps/server/test/dm/rules-terms.test.ts`: `StepSchema` rejects an unknown skill, a
  title-case skill and the condition `spotted-lookout`; `EffectSchema` rejects an unknown
  damage type; `StepSchema` rejects an unknown ability; the server `SKILL_KEYS` equal the
  engine `SkillSchema.options`. In `apps/server/test/dm/seed.test.ts`, assert a seed with an
  unknown skill key fails to load.
- [x] T031 [US5] In `apps/server/src/dm/prompts/common.ts`, make `STEP_GRAMMAR` render the
  condition keys, skill keys and damage types from `CONDITION_KEYS`, `SKILL_KEYS` and
  `DamageTypeSchema.options`. Add the narrative-outcome sentence. Follow
  `contracts/interpret-output.md` "Prompt shape" items 1 and 2.
- [x] T032 [US5] In `apps/server/src/dm/prompts/interpret.ts`, apply "Prompt shape" items 3–5:
  the no-fence line, one sentence per `reason`, each cap in words, and one complete minimal
  check-step example held as an object and rendered with `JSON.stringify`. Set
  `PROMPT_VERSION` to `dm.interpret-v2`. In `prompts/adjudicate.ts`, set `PROMPT_VERSION` to
  `dm.adjudicate-v2`. Update every test that pins either version.
- [x] T033 [US5] Add `apps/server/test/dm/interpret-prompt.test.ts`: the system prompt holds every
  `CONDITION_KEYS`, `SKILL_KEYS` and damage-type value; it holds the narrative-outcome sentence
  and the no-fence line; the example object parses under `InterpretOutput`; an inline snapshot
  of `STEP_GRAMMAR` plus the interpret `OUTPUT_SHAPE`. Assert the adjudicate system prompt
  also holds the three lists.
- [x] T034 Run the phase gate and the database suites. Commit. Push the branch.

**Checkpoint**: the interpret part of AC #3 holds offline. The skill gate is in place.

---

## Phase 4b: Verification rerun (US5; AC #3, amendment) — ORCHESTRATOR-RUN, PAID

- [x] T035 Orchestrator: operator checkpoint for `dm.interpret` `maxTokens`. Propose a value
  from research R10. Record the operator's decision on the card. The operator sets it in the
  operator-owned `.env`, or approves the orchestrator setting it. No implementer edits `.env`.
- [x] T036 Orchestrator: merge the branch tip into the composite worktree (quickstart C1). Get
  the operator's spend ceiling. Record it on the card.
- [x] T037 Orchestrator: run the verification (quickstart C, amended pass rule). Commit the
  evidence directory `evidence/verify-<runId>/`. Record pass or fail, outcome, spend and the run
  id on the card.
- [x] T038 Orchestrator: on a fail, or on a failure of any other kind, commit the failure record
  as a fixture under `apps/server/test/dm/fixtures/`. Stop for an operator ruling. Do not start
  Phase 5.
  *Not triggered (2026-10-26):* run `20261026T155348Z-greyhollow-ford-provider` passed the
  amended rule (no failed job; 6 moves committed; 29 turn jobs succeeded; $5.07). It ended
  `timed-out` at the scenario's 15-minute `maxWallMs` in fight round 4. That limit is a TASK-0048
  harness defect, fixed on that branch.

**Checkpoint**: AC #3 met for director and interpret.

---

## Phase 5: Full gate (US4; AC #4)

- [x] T021 [US4] Run `pnpm ci:check` and the database suites with `REQUIRE_DATABASE=1`. Fix
  any regression without loosening a test.
- [x] T022 Orchestrator: run the scripted CI playtest in the composite worktree (quickstart D).
  Record it on the card.
- [x] T023 [P] [US4] Add one line under the amended sections of
  `specs/031-dm-runtime/contracts/turn-jobs.md`, `node-seam.md` and `director.md`:
  "Amended by specs/033-director-robustness/contracts/<file>." Commit.
- [x] T039 [P] [US4] Add one line under the amended sections of
  `specs/031-dm-runtime/contracts/nodes.md` ("interpret", step schema), `scene-seed.md`
  (`skills`, clue `check`) and `specs/026-dnd5e-engine/contracts/commands.md` (`check.roll`):
  "Amended by specs/033-director-robustness/contracts/<file>." Commit.
- [x] T024 Orchestrator: tear down the composite worktree (quickstart E).

**Checkpoint**: AC #4 met. The task is ready for PR.

---

## Dependencies & Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 3b → Phase 4b → Phase 5. No phase overlaps.
Phases 2, 4 and 4b each need their own operator-approved ceiling. Phase 4b also needs the T035
`maxTokens` checkpoint. Within a phase, `[P]` tasks touch separate files. In Phase 3b, T025
runs first, the engine (T026, T027) before the server (T028–T030), and the prompts (T031–T033)
last.

## Notes

- `DirectorOutput` changes only by the `advance` refine message (T007).
- `InterpretOutput` gains no leniency. Its only change is the closed `skill` enum (T028).
- `check.resolved.skill` stays a nullable string (contracts/rules-terms.md).
- No migration. No new dependency. The amendment adds neither.
- The operator route never serves the failure record. The operator reads it with SQL
  (quickstart B5).
