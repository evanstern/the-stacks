# Tasks: Engine opportunity attack

**Input**: `specs/079-engine-opportunity-attack/` (spec.md, plan.md). Plan research R1 to R11 and
design D1 to D9 settle every choice. Read them before you start a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Run the phases in order.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first. Get
`pnpm ci:check` green before the phase commits. Phase 2 needs the worktree stack: run
`pnpm env:up`, migrate both databases by hand, and restart the app. Then run the DB suite with only
`TEST_DATABASE_URL` exported and `REQUIRE_DATABASE=1`.

**Before Phase 1**: merge `origin/main` into the branch. Confirm TASK-0113 (spec 074) and
TASK-0205 (spec 077) have merged. Read their changes to `prompts/interpret.ts`, `prompts/narrate.ts`,
`facts.ts`, `nodes/audit.ts` and `gates/plan-gate.ts`. Record in plan.md D5 which refusal code
OQ-4 uses.

**Overlap rule**: edit only the files plan "Files" lists for your phase. In `fallback.ts`, edit
only `rollSentences`. Bump each changed prompt's version one past `main`. If a task seems to need
another file, stop and report.

## Phase 1: The engine owns reactions (card AC #1, engine part; US1 scenarios 3 and 4)

**Goal**: the engine spends a reaction on a reaction attack, refuses a spent one, and resets it at
the reactor's turn start.

**Independent test**: `packages/dnd5e-engine/test/commands/reactions.test.ts`, `coverage.test.ts`
and `replay.test.ts` pass.

- [x] T001 [US1] In `packages/dnd5e-engine/src/schema/state.ts`, add the optional
      `reactionsSpent` to `EncounterSchema` (plan D1).
- [x] T002 [US1] In `src/schema/commands.ts`, `src/schema/events.ts` and `src/schema/refusals.ts`,
      add `attack.roll.reaction`, `attack.resolved.reaction` and `REACTION_SPENT` (plan D1, D2).
- [x] T003 [US1] In `src/commands/attacks.ts`, apply plan D1 to `handleAttackRoll`. Refuse before
      any draw. Emit the spend as `encounter.changed` after `attack.resolved`.
- [x] T004 [US1] In `src/commands/encounter.ts`, apply plan D1 to `handleTurnAdvance` and
      `handleInitiativeLeave`.
- [x] T005 [US1] Add one bullet to `packages/dnd5e-engine/README.md` (plan D1).
- [x] T006 [P] [US1] Create `test/commands/reactions.test.ts` with the plan "Tests" engine cases.
      Use `expectRefusedBeforeDraw` for each refusal.
- [x] T007 Amend `specs/026-dnd5e-engine/contracts/engine-api.md`, `commands.md`, `events.md` and
      `refusals.md` (plan "Contracts"). Mark each change "Amended by spec 079 (TASK-0208)".
- [x] T008 Run `pnpm ci:check`. Commit as `TASK-0208 phase 1: the engine owns reactions`.

## Phase 2: A move away draws the engine's reaction (card AC #1 and #2, merge condition; US1, US2)

**Goal**: interpret plans a `move` step, resolve runs the opportunity attack from the SRD record,
and the plan gate refuses a foreign actor's step.

**Independent test**: `opportunity-attack.integration.test.ts`, `reactions.test.ts`,
`plan-gate.test.ts`, `interpret-prompt.test.ts` and `dm-scripts.test.ts` pass.

- [x] T009 [US1] In `apps/server/src/dm/nodes/schemas.ts`, add the `move` step (plan D3).
- [x] T010 [US1] In `prompts/step-grammar.ts`, add the `move` line (plan D3). Bump
      `prompts/adjudicate.ts`'s version.
- [x] T011 [US1] In `prompts/interpret.ts`, add the D6 sentence to `OUTPUT_SHAPE`. Bump the version.
- [x] T012 [US1] Create `apps/server/src/dm/reactions.ts` with `meleeAttackOf` and `reactors`
      (plan D4).
- [x] T013 [US1] In `gates/plan-gate.ts`, add the `move` cases and the actor rule (plan D3, D5).
      Add the OQ-4 code to the engine refusal enum and `PLAN_GATE_ONLY` only when spec 077 added
      none.
- [x] T014 [US1] [US2] In `nodes/resolve.ts`, add `case "move"` to `runSteps`, the `move` no-op in
      `presenceTargets`, and the `actors` input to `checkPlan` (plan D4, D5).
- [x] T015 [P] [US1] Create `apps/server/test/dm/reactions.test.ts` (plan "Tests").
- [x] T016 [P] [US1] Extend `apps/server/test/dm/plan-gate.test.ts` (plan "Tests"), including the
      `plan-approach.json` case from plan R4.
- [x] T017 [US1] [US2] Create `apps/server/test/dm/opportunity-attack.integration.test.ts` with
      plan "Tests" cases 1 to 4. Seat Kestrel human on `greyhollow-ford-reed-camp`, as
      `attack-anyone.integration.test.ts` seats her on the duo seed. Name the run 1 source in the
      file header.
- [x] T018 [P] [US1] In `interpret-prompt.test.ts`, pin both new versions, update the step-grammar
      inline snapshot, and assert the D6 sentence.
- [x] T019 Amend `specs/031-dm-runtime/contracts/resolve.md` (plan "Contracts"). Mark the change
      "Amended by spec 079 (TASK-0208)".
- [ ] T020 Run `pnpm ci:check` and the DB suite. Commit as
      `TASK-0208 phase 2: a move away draws the engine's reaction`.

## Phase 3: The reader sees whose attack it was (card AC #2 and #3; US2 scenario 4, US3)

**Goal**: facts mark the reaction, narrate renders it apart, the fallback names the roller, and the
audit stops pairing the mover with the reactor's outcome.

**Independent test**: `fallback.test.ts`, `audit.test.ts`, `facts.test.ts`, `narrate.test.ts` and
`ledger-format.test.mjs` pass with the new cases.

- [ ] T021 [US2] In `apps/server/src/dm/facts.ts`, add `FactRoll.reaction` and set it in
      `collectFacts` (plan D7).
- [ ] T022 [US2] In `prompts/narrate.ts`, add the reaction branch to `rollEntry`. Bump the version.
      Bump `prompts/audit.ts`'s version.
- [ ] T023 [US3] In `fallback.ts`, change `rollSentences` to name the roller (plan D7). Change no
      other function.
- [ ] T024 [US3] In `nodes/audit.ts`, make the opposite-outcome check read the character's own rolls
      (plan D7).
- [ ] T025 [US2] In `apps/web/app/play/ledger-format.ts`, add the `Reaction: ` prefix (plan D9).
- [ ] T026 [P] [US3] Extend `apps/server/test/dm/fallback.test.ts` with the `run 1 seq 154-161`
      case and the own-check case. Keep the property test green.
- [ ] T027 [P] [US3] Extend `audit.test.ts` (plan "Tests").
- [ ] T028 [P] [US2] Extend `facts.test.ts` and `narrate.test.ts` for the reaction flag, the
      reaction line and the new versions.
- [ ] T029 [P] [US2] Extend `apps/web/test/play/ledger-format.test.mjs`.
- [ ] T030 Amend `specs/034-narration-quality/contracts/fallback-summary.md` and
      `narration-facts.md` (the `reaction` field). Mark each change "Amended by spec 079 (TASK-0208)".
- [ ] T031 Run `pnpm ci:check`. Commit as `TASK-0208 phase 3: the reader sees whose attack it was`.

## Phase 4: A followUp stays undone in later beats (card AC #4; US4)

**Goal**: a party member's open followUps reach every later beat's narration until that member
declares again.

**Independent test**: `follow-ups.test.ts` and `narrate.test.ts` pass with the new cases.

- [ ] T032 [US4] Create `apps/server/src/dm/follow-ups.ts` with `openFollowUps` (plan D8).
- [ ] T033 [US4] In `facts.ts`, add `NarrationFacts.openFollowUps` and the `BuildFactsInput` field
      (plan D7).
- [ ] T034 [US4] In `nodes/narrate.ts`, load prior turns, call `openFollowUps`, pass the result,
      and filter it in `withholdRefusedInputs` (plan D7, D8). Add the `ponytail:` comment.
- [ ] T035 [US4] In `prompts/narrate.ts`, render each open followUp and replace the
      not-yet-attempted rule text (plan D7). Keep the Phase 3 version bump; bump again only if
      `main` moved past it.
- [ ] T036 [P] [US4] Create `apps/server/test/dm/follow-ups.test.ts` (plan "Tests").
- [ ] T037 [P] [US4] Extend `narrate.test.ts` with US4 scenarios 2 and 4.
- [ ] T038 Amend `specs/034-narration-quality/contracts/narration-facts.md` (`openFollowUps`).
      Mark the change "Amended by spec 079 (TASK-0208)".
- [ ] T039 Run `pnpm ci:check`. Commit as `TASK-0208 phase 4: a followUp stays undone in later beats`.

## Phase 5: Wiki upkeep

**Goal**: the grounding wiki describes reactions, the `move` step, the actor rule and the open
followUps, re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T040 Run `/grounding-wiki:wiki-update`. Review these notes against the diff (NEEDS-REVIEW):
      `dnd5e-engine`, `dm-runtime`, `dm-failure-and-gates`, `dm-narration-quality`.
- [ ] T041 In `dnd5e-engine.md`, describe `reactionsSpent`, the `reaction` flag, `REACTION_SPENT`
      and the turn-start reset. In `dm-runtime.md`, describe the `move` step and resolve's
      opportunity attack from the SRD record. In `dm-failure-and-gates.md`, describe the plan
      gate's actor rule and its code. In `dm-narration-quality.md`, describe the roller as fallback
      subject, the reaction line, open followUps and the new prompt versions.
- [ ] T042 Re-pin every other note that lists a touched file as a source (for example
      `dm-turn-jobs`, `party-panel`, `seed-npc-presence`, `turn-floor`, `dm-talk-triggers`,
      `srd-data`, `output-claim-gate`, `play-route`). Read each changed hunk first. Edit the note
      when a claim changed.
- [ ] T043 Update the `CAPSULES.md` lines for every note edited in T041. Add one sentence to
      `INDEX.md`'s state paragraph naming TASK-0208 and specs/079.
- [ ] T044 Run the freshness gate and the spec-bridge gate. Run `pnpm ci:check`. Commit as
      `TASK-0208 phase 5: re-ground the wiki`.
