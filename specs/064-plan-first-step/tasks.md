# Tasks: Resolve only the first step of a plan declaration

**Input**: `specs/064-plan-first-step/` (spec.md, plan.md)

**Prerequisites**: the operator rules OQ-1 to OQ-7. The tasks below implement every OQ at (a). A
different ruling changes the phases plan.md names under that OQ.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator, not the implementer.
Each implementer phase ends with `pnpm ci:check` green (DB suites skip without a database) and one
commit led by `TASK-0182:`. Serial hotspot: `nodes/schemas.ts` and the interpret and Director
prompts. No other lane edits them while this branch is open.

## Phase 1: The pure core (card AC #1, #3, #4)

- [ ] T001 In `apps/server/src/dm/nodes/schemas.ts`, add
      `followUps: z.array(z.string().min(1).max(200)).max(6).default([])` to `InterpretReadingSchema`
      (plan D1). Keep the `superRefine`.
- [ ] T002 In `apps/server/src/dm/nodes/adjudicate.ts`, add `followUps: string[]` to `Ruling`. Set
      `[]` where rulings are built. The adjudicate model schema is unchanged.
- [ ] T003 Fix every TypeScript literal of `InterpretReading` or `Ruling` that no longer typechecks.
      Add `followUps: []`; change nothing else.
- [ ] T004 Create `apps/server/src/dm/first-stage.ts` with `firstStage(steps)` (plan D2, OQ-4 (a)).
- [ ] T005 Add `cutPlans({ mode, readings, rulings })` (plan D2, OQ-5 (a)). Never cut the
      `actionId: null` reading. Dedupe follow-ups and cap them at six.
- [ ] T006 Add `holdDirector(director, cutBeat)` (plan D2, OQ-3 (a)). Hold `turn`, trackers and scene
      end. Never hold `free`. Append one `DirectorOverride` per held decision.
- [ ] T007 Create `apps/server/test/dm/first-stage.test.ts`. Cover: a same-skill check run stays
      whole; a different-skill second check is cut; steps after the run are cut with their reasons
      as follow-ups; no check cuts nothing; turn mode cuts nothing; the NPC reading is never cut;
      model-written follow-ups are kept and merged; dedupe and the cap of six.
- [ ] T008 In the same file, cover `holdDirector`: a cut beat holds `turn`, trackers and scene end
      with three overrides; `free` is kept; a non-cut beat returns the input unchanged; holding an
      already-held output adds no override.
- [ ] T009 Run `pnpm ci:check`.

## Phase 2: Runner wiring, prompts, facts (card AC #2, #4)

- [ ] T010 In `apps/server/src/dm/jobs.ts`, add `cut?: boolean` to `TurnCheckpoint`.
- [ ] T011 In `apps/server/src/dm/pipeline/runner.ts`, add the post-planning step after adjudicate
      and before resolve (plan D3). Save cut readings, cut rulings, the held Director and `cut: true`
      in one checkpoint save. Skip the step when `ctx.checkpoint.cut` is true. Log `dm.plan.cut`.
- [ ] T012 Extend `apps/server/test/dm/runner.test.ts`: the step runs once before resolve; resolve
      sees cut readings and the held Director; the checkpoint stores `cut: true`; a reclaim with
      `cut: true` does not cut or hold again; a Director `hold` beat never reaches the step.
- [ ] T013 In `apps/server/src/dm/prompts/interpret.ts`, add the rule line, `"followUps":[str]` in
      the reading shape and `followUps: []` in `EXAMPLE_OUTPUT` (plan D4). Bump to
      `dm.interpret-v5`. Update the version test and the inline snapshot in
      `apps/server/test/dm/interpret-prompt.test.ts`.
- [ ] T014 In `apps/server/src/dm/prompts/director.ts`, add the one rule sentence (plan D4). Bump to
      `dm.director-v4`. Add a test that the system prompt holds the sentence.
- [ ] T015 In `apps/server/src/dm/facts.ts`, add `followUps: string[]` to `FactAction`. Read it from
      the action's ruling when one exists, else its reading. Pass the readings in from
      `apps/server/src/dm/nodes/narrate.ts`.
- [ ] T016 In `apps/server/src/dm/nodes/narrate.ts`, check each follow-up in
      `withholdRefusedInputs` and drop a refused one with a withheld issue (plan D5).
- [ ] T017 In `apps/server/src/dm/prompts/narrate.ts`, render `  not yet attempted: <text>` and add
      the rule line (plan D4). Bump to `dm.narrate-v6`.
- [ ] T018 Extend `apps/server/test/dm/facts.test.ts` and `narrate.test.ts`: the follow-up line
      renders; the rule is in the system prompt; a follow-up naming a dead actor acting is withheld.
- [ ] T019 Run `pnpm ci:check`.

## Phase 3: The fixture and the live script (card AC #5)

- [ ] T020 Create `apps/server/test/dm/scripts/plan-approach.json` (plan D6). Take the post text
      from the playtest log, run 2 item 4. The interpret reading has empty `followUps`.
- [ ] T021 Create `apps/server/test/dm/plan-first-step.integration.test.ts` on a duo scene (pattern:
      `duo.integration.test.ts`). Declare and commit `act-197dae73` for Tamsin. Run the turn on the
      fixture script.
- [ ] T022 Assert: two `check.roll` rows, both `stealth`; no `attack.roll`; no reed-camp
      `combatant.add`; no `initiative.roll`; no `table-mode` row; no `tracker` row; the action
      resolves `applied`; the checkpoint Director overrides hold `turn` and `tracker`; the facts
      carry two follow-ups (the persuasion and the attack reasons).
- [ ] T023 Add the control: `exploration-check.json` still advances `dusk` and stores no `cut`
      follow-ups.
- [ ] T024 Create `apps/server/dm-scripts/greyhollow-plan-approach.json` (plan D8). Extend
      `apps/server/test/dm/dm-scripts.test.ts` to prove it is `scene-start` plus `plan-approach`
      plus chronicle calls.
- [ ] T025 Create `specs/064-plan-first-step/evidence/declare.mjs` from the 053 declare script, with
      action id `act-197dae73` and the run 2 post text.
- [ ] T026 Run `pnpm ci:check`.

## Phase 4: DB suites, mutation guard, live check **[orchestrator]**

- [ ] T027 **[orchestrator]** `pnpm env:up`, migrate both databases by hand, restart the app. Run
      the DM DB suites with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL` exported. Re-run a
      timeout once (TASK-0154) and report it.
- [ ] T028 **[orchestrator]** Mutation guard (plan D7): stub `firstStage`, then `holdDirector`; record
      the failing test count for each; restore; confirm `git diff` is empty.
- [ ] T029 **[orchestrator]** Script-mode live check (plan D8): set
      `DM_FAKE_SCRIPT=greyhollow-plan-approach`, start the duo scene, run `declare.mjs`. Record in
      Brave: free mode after the turn, two stealth dice lines, no encounter, the held overrides on
      the debug page. Commit the evidence under `specs/064-plan-first-step/evidence/`.

## Phase 5: Contracts and wiki re-ground

- [ ] T030 Amend `specs/031-dm-runtime/contracts/nodes.md` (reading `followUps`, the first-stage
      cut), `director.md` (the cut-beat hold row in the legality table) and `node-seam.md` (the
      post-planning step). Mark each amendment "Amended by specs/064-plan-first-step".
- [ ] T031 Amend `specs/034-narration-quality/contracts/narration-facts.md`
      (`FactAction.followUps`, the "not yet attempted" line, narrate v6).
- [ ] T032 Re-ground `docs/wiki/dm-runtime.md`, `dm-turn-jobs.md`, `dm-failure-and-gates.md` and
      `dm-narration-quality.md` (NEEDS-REVIEW) against the diff. Re-pin each honestly.
- [ ] T033 Update `docs/wiki/CAPSULES.md` and the `INDEX.md` state paragraph with one sentence for
      TASK-0182 (specs/064).
- [ ] T034 Add the execution-log row for TASK-0182 to `docs/design/m3-table-sweep-runbook.md`:
      dispatches, OQ rulings, test counts, the mutation-guard result, the live check, no frozen
      contract change, no migration.
- [ ] T035 Run the wiki freshness gate (`OK`), the spec-bridge check (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 1 before Phase 2: the runner and facts use `followUps` and the D2 functions.
- Phase 2 before Phase 3: the fixture asserts the runner step and the facts line.
- Phase 4 after Phase 3; Phase 5 after Phase 4 (the log row carries Phase 4's results).
- TASK-0180 starts after this branch merges. It edits the same prompt files.
