# Tasks: Interpret emits Intents

**Spec**: `specs/104-interpret-intents/spec.md` | **Plan**: `specs/104-interpret-intents/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Do not delete resolve's step paths, the adjudicate node or the gathering block: TASK-0312 owns them.

## Phase 1: Schema and slash parse

- [ ] T001 Add `@the-stacks/planner` as a workspace dependency of `apps/server`. Run `pnpm install` to regenerate `pnpm-lock.yaml`. Never hand-edit the lockfile.
- [ ] T002 In `apps/server/src/dm/nodes/schemas.ts`, add `INTERPRET_KINDS`, `IntentBodySchema`, `BesideSchema` and `InterpretStageSchema` per plan D1. Build each body from `paramsSchemaOf(kind)`; omit `dc` from params.
- [ ] T003 Replace `InterpretReadingSchema` with `{ actionId, stages, clarify, followUps, say }` per spec FR-001. Keep the old schema as `LegacyInterpretReadingSchema` for resumed plans (plan D7).
- [ ] T004 Confirm the new `InterpretOutput` converts through `callJson`'s structured-output path (spec 093 D4). If the union fails conversion, use the flat fallback named in plan D1 and record the choice in the card notes.
- [ ] T005 Write `stampIntent(body, { id, actor, source, commit })` in `apps/server/src/dm/nodes/interpret.ts`. Validate with `IntentSchema`. Build ids per plan D3 and actors per spec FR-005.
- [ ] T006 Write `parseSlashItem(item, actor)` per plan D2. Return a one-stage reading on success. Return a reading with a clarify question and no stage on a parse refusal (spec OQ-5).
- [ ] T007 Write `apps/server/test/dm/interpret-intents.test.ts`. Cover: each interpret kind's fixture body passes the schema; a body with `dc`, an actor field or an unknown kind fails; each stamped Intent passes `IntentSchema`; `parse(toText(i))` deep-equals `i`; a slash item parses; a bad slash item yields a clarify.

## Phase 2: Prompt v17 and interpret node

- [ ] T008 In `apps/server/src/dm/prompts/interpret.ts`, replace `STEP_GRAMMAR` and `OUTPUT_SHAPE` with the Intent body grammar per plan D4. Bump `PROMPT_VERSION` to `dm.interpret-v17`.
- [ ] T009 Replace `EXAMPLE_OUTPUT` with one `search` stage that carries beside data. Keep the first-stage, follow-up and `say` rules.
- [ ] T010 In the interpret node, run the slash pre-pass before the call. Send only non-slash fresh items to the model. Make no call when none remain and no monster turn is due (spec FR-006).
- [ ] T011 Stamp every model body and every parsed item. Return `invalid-output` with the issue path when a stamped Intent fails `IntentSchema`.
- [ ] T012 Delete `seatActorIds`, its `dm.interpret.seat-actor` log event and `apps/server/test/dm/seat-actor-id.test.ts`.
- [ ] T013 Update `apps/server/test/dm/interpret.test.ts` and `interpret-prompt.test.ts`. Add a case: a slash-only beat makes zero `dm.interpret` calls (SC-001).

## Phase 3: Resolve Intent runner and beside data

- [ ] T014 Create `apps/server/src/dm/intent-runner.ts` with `runStages(run, item, stages)` per plan D5. Return the existing `ChainResult` shape.
- [ ] T015 Submit each player or companion stage as `declared` under the item's own proposer, then `confirmed` under `ai:dm` (spec FR-008, OQ-1). Submit a monster-turn stage once, `confirmed`, under `ai:dm`.
- [ ] T016 Read each submission's carrier row. Handle `settled`, `needs_ruling` (AI seat: call `answerRulings`, then continue; human seat: await), a pending proposal and a refusal per spec FR-009, FR-010.
- [ ] T017 For a settled check-kind stage with beside data, read the band with `stepOutcome` and run `effectsForBand` through `runEffects`. Set `reveals` and `revealedText` (spec FR-013, FR-015). Change `effectsForBand` in `stakes.ts` to take the beside fields.
- [ ] T018 When `isFreeRetry` holds, or `beside.autoFail` is set, submit today's `check.roll` mechanics proposal instead of the Intent (spec FR-014).
- [ ] T019 Key each stage submission `act:<actionId>:i<n>` so a resumed turn skips applied stages.
- [ ] T020 In `nodes/resolve.ts` `resolveAction`, route new-shape readings to `runStages` and old-shape resumed readings to `runSteps`. Update `stepActors` for stages. Update `resume.ts` `ResumedPlan.reading` to the union (plan D7).
- [ ] T021 Make `first-stage.ts`, `follow-ups.ts` and `gates/plan-gate.ts` `checkPlan` stage-aware per plan D5. Keep `TURN_HELD` and the undeclared-manner ask. Make `pipeline/runner.ts` `needsAdjudication` false for new-shape readings.
- [ ] T022 Write `apps/server/test/dm/intent-runner.integration.test.ts`. Cover per kind group (check, combat action, movement, deed): `settled`, `needs_ruling` under each seat, planner refusal, engine refusal. Add the compound move-then-attack case, the reaction-drops-mover stop, a `success-at-cost` band, a reveal and a free retry.

## Phase 4: Narrate window

- [ ] T023 Add optional `factsThrough` to `TurnCheckpoint` in `apps/server/src/dm/jobs.ts`.
- [ ] T024 Add `loadEvents(sessionId, { afterSeq, throughSeq, types })` to `NodeDeps` in `pipeline/context.ts`. Wire it in `worker.ts` to the existing event-store read.
- [ ] T025 In `nodes/narrate.ts`, compute `W0` and `W1` per plan D6. Read public `intent.recorded` rows in `(W0, W1]` and flatten their facts in seq order. Replace the `resolve.appendedRows` filter and its `ponytail` comment.
- [ ] T026 Record `factsThrough = W1` in the checkpoint after narrate and on the failure-notice path.
- [ ] T027 Write `apps/server/test/dm/narrate-window.test.ts`. Cover spec User Story 5 scenarios 1–4: a pre-resolve ruling row renders; a narrated row does not repeat; a row landed mid-narration renders next beat; a `dm` row stays out.

## Phase 5: Test and script migration

- [ ] T028 Add a `stages()` helper to `apps/server/test/dm/world.ts` that builds a new-shape reading from Intent bodies and optional beside data.
- [ ] T029 Rescript `apps/server/test/dm/scripts/*.json` (16 files) to the new reading shape.
- [ ] T030 Rescript the integration tests that script readings: run `grep -rl readings apps/server/test`. Keep each test's assertion on rows and outcomes.
- [ ] T031 Update `test/playtest/fixtures/downed-seat.json` and `test/dm/fixtures/task-0203-shapes.ts`. Keep the 2026-10-26 capture fixture as recorded data.
- [ ] T032 Write the SC-002 proxy in `interpret-intents.test.ts`: each declared text in the 2026-10-26 capture gets a scripted reading that validates on attempt 1.
- [ ] T033 Run the full DB suite on the worktree stack. Re-run a known flake once and report it. `pnpm ci:check` green.

## Phase 6: Wiki

- [ ] T034 NEEDS-REVIEW, amend prose then re-pin: `dm-runtime`, `dm-plan-gate`, `dm-failure-and-gates`, `proposal-gate`, `session-model`, `intent-contract`, `planner`, `dm-narration-quality`. Re-pin `ws-protocol` only if its sources moved (no frame change).
- [ ] T035 Update `docs/wiki/INDEX.md` state line and `CAPSULES.md` one-liners for the changed notes.
- [ ] T036 Run the freshness gate until it prints `OK`. Run the spec-bridge check until it exits 0.
