# Tasks: In-character talk draws a reaction from the world

**Input**: `specs/065-talk-triggers/` (spec.md, plan.md), decision-0027.

**Prerequisites**: the operator rules OQ-1 to OQ-16 and decision-0027 is accepted. The tasks below
implement every OQ at (a). A different ruling changes the phases plan.md names under that OQ.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator, not the implementer.
Each implementer phase ends with `pnpm ci:check` green (DB suites skip without a database) and one
commit led by `TASK-0180:`. Serial hotspot: `pipeline/runner.ts`, `jobs.ts`, `enqueue.ts`. No other
lane edits them while this branch is open.

**Cut line**: plan.md "Cut line". Phase 4 is the first cut if the build will not land before alpha
run 3. The operator decides a cut.

## Phase 1: The pure core (card AC #2, #4)

- [x] T001 Create `apps/server/src/dm/talk-triggers.ts` with `isReadable(row, p)` (plan D1, FR-001).
- [x] T002 Add `capReached(p, cap)` and export `TALK_CHAIN_CAP = 2` (plan D1, FR-012, OQ-10).
- [x] T003 Add `codeTriggers(text, snapshot, seed)` (plan D1, FR-002). Match aliases and seed role
      words as whole words. Drop dead and absent actors.
- [x] T004 Add `needsModel(triggers, text)` and `companionOnly(triggers)` (plan D1, OQ-16, OQ-11).
- [x] T005 In `apps/server/src/dm/nodes/schemas.ts`, add `ReactOutput` with its `superRefine` (plan
      D4).
- [x] T006 Create `apps/server/test/dm/talk-triggers.test.ts`. Cover each `isReadable` condition;
      `capReached` at 0, 1 and 2 rows and its reset by a human row; Odo's run 2 line giving
      `addressed: wenna`; a role word; a shared role word giving `mentioned` twice; a dead NPC
      dropped; `overheard`; `needsModel`; `companionOnly`; each `ReactOutput` refinement.
- [x] T007 Run `pnpm ci:check`.

## Phase 2: Enqueue (card AC #3, #4)

- [x] T008 In `apps/server/src/dm/jobs.ts`, add `"talk"` to `TurnTriggerSchema`. Add optional
      `notBefore` and `firstPostAt` to `TurnJobInput` (plan D2).
- [x] T009 Add `enqueueTalkTurn` (plan D2, OQ-4). Coalesce onto a queued talk turn. Do nothing on
      any other queued turn (OQ-14).
- [x] T010 Change `enqueueTurn`: a conflicting queued talk turn takes the new trigger and seq and
      loses `notBefore` (plan D2, spec US5 #2).
- [x] T011 Add `turn` to the claim query's `notBefore` kinds (plan R3).
- [x] T012 In `apps/server/src/dm/enqueue.ts`, add rule 7 (plan D2) and the `talkQuietMs` and
      `talkMaxWaitMs` deps. Update the header comment's rule list.
- [x] T013 Create `apps/server/test/dm/enqueue-talk.integration.test.ts`. Cover: an IC post queues a
      talk turn with `notBefore`; two posts coalesce; the 10 s cap; OOC, whisper, turn mode, human
      seat and the cap queue nothing; a companion-only post queues a `prompt` companion job; a
      queued commit absorbs a post; a commit converts a queued talk turn.
- [x] T014 Run `pnpm ci:check`.

## Phase 3: The talk path (card AC #3, #4)

- [ ] T015 Create `apps/server/src/dm/prompts/react.ts` with `PROMPT_VERSION = "dm.react-v1"`,
      purpose `dm.narrate` (plan D4). It takes the `PlayerSeedView`, never the full seed.
- [ ] T016 Create `apps/server/src/dm/talk-turn.ts` with `runTalkTurn` steps 1 to 3, 5, 7 and 8
      (plan D3). Store the react output in `TurnCheckpoint.react`.
- [ ] T017 In `apps/server/src/dm/pipeline/runner.ts`, branch to `runTalkTurn` at the empty beat
      when the trigger is `talk` (plan D3). A non-empty beat runs the full pipeline.
- [ ] T018 In `apps/server/src/dm/worker.ts`, record `talk` in the job result and pass the talk
      deps.
- [ ] T019 Create `apps/server/test/dm/react-prompt.test.ts`: version, rules, and the cap line.
      Extend `player-facing-prompts.test.ts` so the react prompt builder rejects the DM-only view.
- [ ] T020 Create `apps/server/test/dm/scripts/talk-reply.json`, `talk-none.json` and
      `talk-chain.json` (plan D6).
- [ ] T021 Create `apps/server/test/dm/talk-turn.integration.test.ts` for reply, none, the
      refused-then-dropped leak, the full-pipeline case with a committed beat, and reclaim reuse.
- [ ] T022 In the same file, cover the chain: two `ai:dm` narration rows, then no talk turn for the
      next companion line; the cap reaction prompts no companion.
- [ ] T023 Extend `apps/server/test/dm/runner.test.ts`: a talk trigger with an empty beat runs the
      talk path; every other trigger still returns `empty-beat`.
- [ ] T024 Create `apps/server/dm-scripts/greyhollow-talk.json` and extend
      `apps/server/test/dm/dm-scripts.test.ts` (plan D8). Create
      `specs/065-talk-triggers/evidence/talk.mjs`.
- [ ] T025 Run `pnpm ci:check`.

## Phase 4: Escalation to turn mode (card AC #5) — cut 1

- [ ] T026 In `apps/server/src/dm/talk-turn.ts`, add `legalEscalation` and `runTalkTurn` steps 4
      and 6 (plan D5, OQ-9). Drive resolve with the synthetic Director output.
- [ ] T027 Create `apps/server/test/dm/scripts/talk-escalate.json` (plan D6).
- [ ] T028 In `talk-turn.integration.test.ts`, cover: escalate writes combatant adds, initiative
      and `table-mode.changed`, then the NPC or companion turn queues; an escalate into a started,
      ended or unknown encounter ships as `scene` and stays free; no tracker or scene-end row.
- [ ] T029 Run `pnpm ci:check`.

## Phase 5: DB suites, mutation guard, live check **[orchestrator]**

- [ ] T030 **[orchestrator]** `pnpm env:up`, migrate both databases by hand, restart the app. Run
      the DM DB suites with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL` exported. Re-run a
      timeout once (TASK-0154) and report it.
- [ ] T031 **[orchestrator]** Mutation guard (plan D7): stub `codeTriggers`, `capReached`, then
      `legalEscalation`. Record the failing test count for each. Restore. Confirm `git diff` is
      empty.
- [ ] T032 **[orchestrator]** Script-mode live check (plan D8) with
      `DM_FAKE_SCRIPT=greyhollow-talk` in Brave. Record Wenna's reply, the debug page's talk
      result, no dice line and free mode. Commit the evidence under
      `specs/065-talk-triggers/evidence/`.

## Phase 6: Contracts and wiki re-ground

- [ ] T033 Amend `specs/031-dm-runtime/contracts/turn-jobs.md` (trigger `talk`, rule 7, turn
      `notBefore`, the talk-turn upsert, the after-turn row), `nodes.md` and `node-seam.md` (the
      talk path), and `purposes.md` (`dm.react-v1` under `dm.narrate`). Mark each "Amended by
      specs/065-talk-triggers".
- [ ] T034 Re-ground `docs/wiki/dm-turn-jobs.md`, `dm-runtime.md`, `dm-narration-quality.md` and
      `session-model.md` (NEEDS-REVIEW) against the diff. Re-pin each honestly.
- [ ] T035 Update `docs/wiki/CAPSULES.md` and the `INDEX.md` state paragraph with one sentence for
      TASK-0180 (specs/065).
- [ ] T036 Add the execution-log row for TASK-0180 to `docs/design/m3-table-sweep-runbook.md`:
      dispatches, OQ rulings, test counts, the mutation-guard result, the live check, no frozen
      contract change, no migration.
- [ ] T037 Run the wiki freshness gate (`OK`), the spec-bridge check (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 1 before Phases 2 and 3: both use `talk-triggers.ts`.
- Phase 2 before Phase 3: the talk path is reached only through the `talk` trigger.
- Phase 3 before Phase 4: escalation extends `runTalkTurn`.
- Phase 5 after Phase 4 (or after Phase 3 under cut 1). Phase 6 after Phase 5.
