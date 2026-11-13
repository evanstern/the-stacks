# Tasks: Resolve loses planner-owned step paths

**Spec**: `specs/110-resolve-cleanup/spec.md` | **Plan**: `specs/110-resolve-cleanup/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Do not edit `dm/intent-runner.ts`, `dm/purposes.ts` or `dm/rulings.ts`. Follow plan D6 for tests.

## Phase 1: Throw-stub probe (no deletion)

- [x] T001 Replace each entry point listed in plan D1 with `throw new Error("TASK-0312 probe: <symbol>")`. Do not commit the stubs.
- [x] T002 Run `pnpm --filter @the-stacks/server test` and the scripted fake-gateway runs. Capture every failing test file and test name.
- [x] T003 Write `specs/110-resolve-cleanup/probe.md`: one row per failure with the stubbed symbol and the legacy input the test injects. Stop and report if any failure injects no legacy input.
- [x] T004 Revert the stubs (`git diff --stat` shows only `probe.md`). Commit `probe.md`.

## Phase 2: Encounter-start gathering (deferred to TASK-0327)

Operator ruling 2026-11-12: keep gathering for now. Removing it left the party out of reach on the greyhollow seeds (two squeeze edges into reed-camp), so fights opened at range on the CP-7 seed. The attempt (77e74f18) is reverted in 767fed0b. AC #2 moved to TASK-0327.

## Phase 3: Adjudicate node (C-GATE approved 2026-11-12)

- [x] T007 Delete `dm/nodes/adjudicate.ts`, `dm/prompts/adjudicate.ts`, `dm/prompts/step-grammar.ts` and `AdjudicateModelOutput`.
- [x] T008 In `pipeline/runner.ts`, delete `needsAdjudication` and the skip branch. Remove `"adjudicate"` from `CHECKPOINTED`. Move the post-planning block to run after interpret per plan D3.
- [x] T009 In `pipeline/context.ts`, `jobs.ts`, `worker.ts` and `talk-turn.ts`, remove the node name, output, checkpoint field and wiring. Remove `retrieve` and `minSimilarity` from `NodeDeps` if no reader remains.
- [x] T010 In `resolve.ts`, delete the ruling group and every `ctx.results.adjudicate` read. In `narrate.ts`, `facts.ts`, `follow-ups.ts` and `prompts/narrate.ts`, delete the ruling reads and the `rulings` fact.
- [x] T011 Delete `test/dm/adjudicate.integration.test.ts`. Update `runner.test.ts`, `helpers.ts`, `world.ts` and `presence-effect.test.ts` (drop the `STEP_GRAMMAR` render case).
- [x] T012 Amend `specs/031-dm-runtime/contracts/node-seam.md` and `contracts/turn-jobs.md` per plan D3. Quote the C-GATE ruling in the commit message.
- [x] T013 Confirm `PURPOSE_OF.adjudicate`, `playtest/budget.ts`, `schema/jobs.ts` and `apps/web/app/debug/*` are unchanged.

## Phase 4: Step paths in resolve and the plan gate (AC #1)

- [ ] T014 In `resolve.ts`, delete `runSteps` (all cases, `effect` included), `hitDamage`, `pullIn` and `pullBatchIds` per plan D4.
- [ ] T015 Make `resolveAction` and the NPC group run only `runStages`. Delete `actionGroup`'s steps branch, the `stepActors` use and the `Intent:` rationale branch.
- [ ] T016 Delete the Step loop and `rulings` param of `presenceTargets`. Drop the `steps` param of `splitArrivals`.
- [ ] T017 Delete `dm/reactions.ts` and `test/dm/reactions.test.ts`.
- [ ] T018 In `plan-gate.ts`, cut `checkPlan` to the `TURN_HELD` branch per plan D4. Delete the D8 symbols and the unused `PlanInput` fields. Cut `askUndeclared` to the Intent branch.
- [ ] T019 In `first-stage.ts`, delete `firstStage` and the steps and ruling branches. In `stakes.ts`, retype `isFreeRetry` with `FreeRetryCheck`. In `facts.ts`, delete the `pullBatchIds` read.
- [ ] T020 Migrate the tests per plan D6: `plan-gate.test.ts`, `resolve.integration.test.ts`, `opportunity-attack.integration.test.ts`, `first-stage.test.ts`, `reveal-waits.test.ts` and the rest typecheck flags. Append ported cases to the card notes.

## Phase 5: Schemas and old checkpoints (AC #3)

- [ ] T021 In `schemas.ts`, delete the Step and legacy-reading symbols per plan D5. Narrow `InterpretResult.readings` to `InterpretReading[]`.
- [ ] T022 In `resume.ts`, accept only `InterpretReadingSchema` readings in `findResumedPlans`. Delete `ResumedPlan.ruling`.
- [ ] T023 Add `dropLegacyPlan` in `resume.ts` and call it on `loadCheckpoint(job)` in `worker.ts`. Log `dm.checkpoint.legacy-dropped`.
- [ ] T024 Add the two tests in `test/dm/resume.test.ts` per plan D5 (SC-005). Delete the legacy fixtures from `test/dm/world.ts` and fix the remaining test files.
- [ ] T025 Run the SC-001 grep. It must return nothing.

## Phase 6: Wiki

- [ ] T026 Run `/grounding-wiki:wiki-update`. Re-verify `dm-runtime`, `dm-plan-gate`, `dm-failure-and-gates` and `dm-turn-jobs` against the diff. Drop deleted files from every note's `sources`. Update `INDEX.md` and `CAPSULES.md`.
- [ ] T027 Run the freshness gate and the spec-bridge check. Both must pass.
