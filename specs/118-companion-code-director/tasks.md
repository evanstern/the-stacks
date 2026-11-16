# Tasks: Code Director for a companion's own turn

**Spec**: `specs/118-companion-code-director/spec.md` | **Plan**: `specs/118-companion-code-director/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Do not edit `packages/*`, `nodes/director.ts`, `prompts/director.ts`, `companion.ts`, `nodes/resolve.ts`, `intent-runner.ts`, `rulings.ts`, `worker.ts`, `jobs.ts` or `enqueue.ts`.

## Phase 1: Runner code Director and its direct tests (FR-001–FR-008; AC #1)

- [ ] T001 In `pipeline/runner.ts`, add `COMPANION_DIRECTOR` and `companionOwnBeat`, and the runner check after the spec 107 D4 check (plan D1). Read the `tableMode` type first.
- [ ] T002 Extend `test/dm/runner.test.ts` with the FR-005 cases (plan D2).
- [ ] T003 In `test/dm/companion-turn-intents.integration.test.ts`, drop the scripted `dm.director` reply and assert no `dm.director` call per case (FR-006).
- [ ] T004 Add the FR-007 case: a companion's killing blow ends the fight in code with no Director call (plan D2).
- [ ] T005 In `test/dm/scripts/ai-round-4v4.json`, drop the `beat 1`–`beat 3` Director replies. In `test/ai-round.bench-test.ts`, assert one `dm.director` call (FR-008). Run `pnpm check:timing`.
- [ ] T006 In `test/dm/scripts/turn-floor-round.json`, drop "Odo's committed action". Run `turn-floor-round`, `duo`, `trio` and `floor-jobs` integration tests.
- [ ] T007 Append the D5 amendment to `specs/031-dm-runtime/contracts/director.md`.

## Phase 2: Fight segment and the scripts that copy it (FR-009–FR-011)

- [ ] T008 Merge `origin/main` into the branch.
- [ ] T009 Rework `test/dm/scripts/fight-round.json`: drop "companion action", move the scene end to Tamsin's round-2 turn, script the monster turns between (plan D3, Flags). Read order and dice from a run.
- [ ] T010 Copy the new segment into `greyhollow-ford-full.json` and `greyhollow-ford-deeds.json`. Drop the companion-beat Director in `test/playtest/fixtures/downed-seat.json`.
- [ ] T011 Update `scene.integration.test.ts` (one more strike, new counts), `playtest.integration.test.ts` (segment count) and `playtests/fixtures/greyhollow-ford.audit.json` (plan D4). Re-run the downed-seat harness case.
- [ ] T012 Check `dm-scripts/runbook-a-reed-camp.json` and `runbook-b-reed-camp.json` for turn-mode companion-beat Director replies; drop each one. State every changed count and dropped reply in the commit message.

## Phase 3: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` list a file this card touches (NEEDS-REVIEW):

- [ ] T013 `docs/wiki/dm-runtime.md` (`pipeline/runner.ts`): beside the spec 107 D4 sentence, add the spec 118 companion code Director and what it gives up.
- [ ] T014 `docs/wiki/dm-turn-jobs.md` (`pipeline/runner.ts`): a companion's own turn job makes no Director call.
- [ ] T015 `docs/wiki/test-suite.md` (`ai-round.bench-test.ts`, `scene.integration.test.ts`): the 4v4 bench now expects one Director call; the scene test plays Tamsin's round-2 strike.
- [ ] T016 Re-verify and re-pin the notes that list a touched file but need no prose change unless the diff says otherwise: `dm-plan-gate.md`, `dm-failure-and-gates.md`, `dm-talk-triggers.md` (`pipeline/runner.ts`); `playtest-harness.md`, `m2-demo.md` (`playtest.integration.test.ts`).
- [ ] T017 Update the changed notes' lines in `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`. Run the freshness gate (prints `OK`) and the spec-bridge gate (exits 0).

## Post-merge (not a build task)

- AC #2: re-measure the hosted combat round after deploy (spec FR-012, SC-006). Record round time and each companion turn's calls on TASK-0321.
