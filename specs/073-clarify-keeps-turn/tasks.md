# Tasks: Clarify keeps the turn

**Input**: `specs/073-clarify-keeps-turn/` (spec.md, plan.md). Plan research R1 to R6 and design
D1 to D6 settle every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. Phase 1 needs the worktree stack:
`pnpm env:up`, migrate both databases by hand, restart the app, then run the DB suite with only
`TEST_DATABASE_URL` exported and `REQUIRE_DATABASE=1`.

**Overlap rule**: edit only the files plan "Files" lists for your phase. In `fallback.ts`, edit only
the closing clarify loop of `factualSummary`. If a task seems to need another file, stop and report.

## Phase 1: A clarify holds the turn (card AC #1, merge condition; US1)

**Goal**: a human's clarify spends no turn and no Director move.

**Independent test**: `clarify-keeps-turn.integration.test.ts` and `first-stage.test.ts` pass.

- [x] T001 [US1] In `apps/server/src/dm/first-stage.ts`, apply plan D1. Add `clarifyHolds` and
      `CLARIFY_HELD`. Give `holdDirector` an optional `reason` parameter defaulting to `HELD`.
- [x] T002 [US1] In `apps/server/src/dm/pipeline/runner.ts`, apply plan D2. Hold the Director for a
      clarify beat after the cut hold. Add `clarified` to the `dm.plan.cut` log line.
- [x] T003 [US1] In `apps/server/src/dm/nodes/resolve.ts`, apply plan D3. Compute the held ids.
      Exclude them from the third disjunct of the turn advance group's `done` test.
- [x] T004 [US1] Create `apps/server/test/dm/clarify-keeps-turn.integration.test.ts` with plan
      "Tests" cases 1 to 3. Follow `resolve.integration.test.ts`'s `inTurnMode` pattern. Name the
      run 1 source in the file header.
- [x] T005 [P] [US1] Extend `apps/server/test/dm/first-stage.test.ts` as plan "Tests" says.
- [x] T006 Amend `specs/031-dm-runtime/contracts/resolve.md` and `director.md` as plan "Contracts"
      says. Mark each change "Amended by spec 073 (TASK-0209)".
- [x] T007 Run `pnpm ci:check` and the DB suite. Commit as
      `TASK-0209 phase 1: a clarify holds the turn`.

## Phase 2: The player sees the question (card AC #2; US2)

**Goal**: the fallback and the narration both end with the clarify question.

**Independent test**: `fallback.test.ts`, `audit.test.ts`, `narrate.test.ts` and
`interpret-prompt.test.ts` pass with the new cases.

- [ ] T008 [US2] In `apps/server/src/dm/nodes/audit.ts`, apply plan D5. Exempt a closing clarify
      question from the option-menu check.
- [ ] T009 [US2] In `apps/server/src/dm/fallback.ts`, apply plan D4. Change only the closing clarify
      loop of `factualSummary`.
- [ ] T010 [US2] In `apps/server/src/dm/prompts/narrate.ts`, apply plan D6. Set `PROMPT_VERSION` to
      `dm.narrate-v8`. Replace the two rule texts.
- [ ] T011 [P] [US2] Extend `apps/server/test/dm/fallback.test.ts` as plan "Tests" says, including
      the `run 1 seq 172–176` case. Update the "Which door?" expectations. The property test passes.
- [ ] T012 [P] [US2] Extend `apps/server/test/dm/audit.test.ts` as plan "Tests" says.
- [ ] T013 [P] [US2] In `apps/server/test/dm/narrate.test.ts`, pin `dm.narrate-v8` and assert both v8
      rules.
- [ ] T014 [P] [US2] Extend `apps/server/test/dm/interpret-prompt.test.ts` with the answer-turn case.
- [ ] T015 Amend `specs/034-narration-quality/contracts/fallback-summary.md`, `audit-criteria.md`
      and `narration-facts.md` as plan "Contracts" says. Mark each change
      "Amended by spec 073 (TASK-0209)".
- [ ] T016 Run `pnpm ci:check`. Commit as `TASK-0209 phase 2: the clarify question reaches the player`.

## Phase 3: Wiki upkeep

**Goal**: the grounding wiki describes the hold and the voiced question, re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T017 Run `/grounding-wiki:wiki-update`. Review these notes against the diff (NEEDS-REVIEW):
      `dm-failure-and-gates`, `dm-runtime`, `turn-floor`, `dm-narration-quality`.
- [ ] T018 In `turn-floor.md` "Resolve's 'turn moved' guard", add that a human's clarify skips the
      advance and the floor stays with the active actor. In `dm-runtime.md`, describe the clarify
      hold on the Director and the advance. In `dm-narration-quality.md`, record `dm.narrate-v8`,
      the voiced fallback question and the option-menu exemption. In `dm-failure-and-gates.md`,
      record that the option-menu check exempts the clarify question.
- [ ] T019 Re-pin the notes that list a touched file only as a source and need no prose change:
      `dm-turn-jobs`, `dm-talk-triggers`, `party-panel`, `seed-npc-presence`. Read each changed
      hunk first; edit the note if a claim changed.
- [ ] T020 Update the `CAPSULES.md` lines for every note edited in T018. Add one sentence to
      `INDEX.md`'s state paragraph naming TASK-0209 and specs/073.
- [ ] T021 Run the freshness gate and the spec-bridge gate. Run `pnpm ci:check`. Commit as
      `TASK-0209 phase 3: re-ground the wiki`.
