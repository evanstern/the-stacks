# Tasks: NPC turn narration

**Input**: `specs/071-npc-turn-narration/` (spec.md, plan.md). Plan research R1 to R6 and design
D1 to D6 settle every choice; read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. No DB is needed: every test here uses the
scripted fake gateway or pure functions.

**Overlap rule**: do not edit `dm/nodes/resolve.ts`, `dm/gates/plan-gate.ts`,
`dm/snapshot/build.ts`, `dm/nodes/schemas.ts` or `dm/prompts/interpret.ts`. If a task seems to
need one, stop and report.

## Phase 1: The plan and the turn reach narrate, audit and the fallback (card AC #1, #2; US1, US2)

**Goal**: the monster's planned action and the turn marking are in the facts, the prompts and the
fallback.

**Independent test**: `facts.test.ts`, `fallback.test.ts` and `narrate.test.ts` pass with the new
cases.

- [X] T001 [US1] In `apps/server/src/dm/facts.ts`, apply plan D1. Add `plan` to `FactNpcTurn`,
      optional `turn` to `NarrationFacts`, and optional `npcPlan` and `turnActorId` to
      `BuildFactsInput`. Derive `held` from `input.resolve.planGate` (verdict for `null`,
      `ok: false`) or an empty step list. Keep every existing field and behavior.
- [X] T002 [US1] In `apps/server/src/dm/nodes/narrate.ts`, apply plan D2. Pass `npcPlan` from the
      `actionId: null` reading, with a `null` ruling's steps replacing the reading's. Pass
      `turnActorId` only when the table was in turn mode at the start.
- [X] T003 [US2] In `apps/server/src/dm/prompts/narrate.ts`, apply plan D3. Set
      `PROMPT_VERSION` to `dm.narrate-v7`. Write the `Turn:`, `Next:`, `planned:`, `held:` and
      no-rules-effect lines. Add the one new rule after "Cover every Event line.".
- [X] T004 [US2] In `apps/server/src/dm/prompts/audit.ts`, apply plan D4. Set `PROMPT_VERSION`
      to `dm.audit-v4`. Add definition 6.
- [X] T005 [US1] In `apps/server/src/dm/fallback.ts`, apply plan D5. Split out
      `reasonSpeakable`. Voice the first speakable planned reason, else the intent sentence,
      else the hold sentence. Remove "makes a move".
- [X] T006 [P] [US1] Extend `apps/server/test/dm/facts.test.ts`: `plan` and `turn` from the new
      inputs; a refused `null` verdict sets `held`; absent inputs give today's facts plus the
      empty plan.
- [X] T007 [P] [US1] Extend `apps/server/test/dm/fallback.test.ts`: replace the "makes a move"
      expectation; one exact-string case per intent sentence and the hold sentence; a planned
      reason with a digit or system word is not voiced. Extend the property generator with
      monster plans; the property still passes.
- [X] T008 [P] [US2] In `apps/server/test/dm/narrate.test.ts`, pin `dm.narrate-v7` and
      `dm.audit-v4`. Add one case: turn-mode facts render the `Turn:` and `Next:` lines in both
      the narrate and audit prompts; free-mode facts render neither.
- [X] T009 Amend `specs/034-narration-quality/contracts/fallback-summary.md` and
      `narration-facts.md` as plan "Contracts" says. Mark each change "Amended by spec 071
      (TASK-0193)".
- [X] T010 Run `pnpm ci:check`. Commit as `TASK-0193 phase 1: NPC plan and turn in narration facts`.

## Phase 2: The run 3 replay (card AC #3, merge condition; US1, US2)

**Goal**: a fake-gateway test replays run 3 seq 150–157 and ships a described Snag action.

**Independent test**: `npc-turn-narration.test.ts` passes.

- [ ] T011 [US1] Create `apps/server/test/dm/npc-turn-narration.test.ts` as plan "Tests" says.
      Build the beat from the `greyhollow-ford-duo` seed and the run 3 log, finding 15. State
      that source in the file header (OQ-1 (a)). Follow the
      `narration-quality-repro.test.ts` pattern: scripted DM, real gateway, `narrate` then
      `audit` nodes.
- [ ] T012 [US2] Case 1: the narrate prompt holds `Turn: Snag acts in this beat.`, the
      `Next: Kestrel …` line, the `planned:` line and the new rule. The audit prompt holds the
      turn lines and definition 6.
- [ ] T013 [US1] Case 2: scripted prose describing Snag's parley and an audit `pass` ship that
      prose with `fallback: false`.
- [ ] T014 [US1] Case 3: three refused audits (`invented-mechanics`, then `ledger-mismatch`,
      then `ledger-mismatch`) ship the fallback. The shipped text holds Snag's planned reason
      and does not hold "makes a move".
- [ ] T015 [US1] Case 4: a refused `null` plan verdict ships "Snag holds back, watching." in the
      fallback.
- [ ] T016 Run `pnpm ci:check`. Commit as `TASK-0193 phase 2: run 3 NPC turn replay`.

## Phase 3: A passed turn says why (card note, finding 14; US3)

**Goal**: an absence pass reads as an absence, not a skipped turn.

**Independent test**: the new `view-model.test.mjs` cases pass.

- [ ] T017 [US3] In `packages/session-model/src/gate/turn.ts`, export `ABSENCE_PASS_REASON`
      with the exact text in plan D6. Re-export it from `packages/session-model/src/index.ts`.
- [ ] T018 [US3] In `apps/server/src/dm/floor.ts`, use `ABSENCE_PASS_REASON` for the floor
      proposal reason. The text does not change.
- [ ] T019 [US3] In `apps/web/app/play/view-model.ts`, apply plan D6 in the floor loop. Only an
      `ai:dm` row with that reason and a `before` holding an `activeCharacterId` gets the new
      text.
- [ ] T020 [US3] Extend `apps/web/test/play/view-model.test.mjs`: an absence pass row reads
      "<absent> is away; the turn passes to <holder>." for another viewer and
      "<absent> is away; your turn." for the new holder. A normal turn advance keeps
      "<name>'s turn".
- [ ] T021 Run `pnpm ci:check`. Commit as `TASK-0193 phase 3: absence pass floor line`.

## Phase 4: Wiki re-ground

**Goal**: every note citing a changed file is re-verified and re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T022 Run `/grounding-wiki:wiki-update`. Review `dm-narration-quality.md` (NEEDS-REVIEW):
      add `dm.narrate-v7` and `dm.audit-v4` to the prompt-version list with one sentence each,
      and describe the planned-action fallback and the turn lines. Keep `dm.companion-v6`.
- [ ] T023 Review `dm-runtime.md` (NEEDS-REVIEW): narrate now reads the monster reading and the
      turn holder.
- [ ] T024 Review `turn-floor.md` and `play-route.md`: the absence-pass floor line. Re-pin
      `presence.md`, `test-suite.md`, `session-model.md` and `proposal-gate.md` after checking
      their claims against the diff.
- [ ] T025 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` for any changed note summary.
- [ ] T026 Run the freshness gate and `pnpm ci:check`. Commit as `TASK-0193 phase 4: wiki re-ground`.

## Dependencies

- Phase 2 needs Phase 1. Phase 3 is independent of Phases 1 and 2 but runs after them (one
  dispatch at a time). Phase 4 runs last.
- Inside Phase 1, T001 precedes T002, T003 and T005. T006 to T008 run after T001 to T005.
