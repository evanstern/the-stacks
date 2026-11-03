# Tasks: No undeclared method

**Input**: `specs/077-no-undeclared-method/` (spec.md, plan.md). Plan research R1 to R10, design D1
to D3 and "Tests" settle every choice. Read them before starting a phase.

**Dispatch**: each phase is one sonnet implementer dispatch. Phases run in order.

**Gates for every phase**: run `pnpm install --frozen-lockfile` in a fresh worktree first.
`pnpm ci:check` is green before the phase commits. Phase 2 needs the worktree stack: `pnpm env:up`,
migrate both databases by hand, restart the app, then run the DB suite with only
`TEST_DATABASE_URL` exported and `REQUIRE_DATABASE=1`.

**Overlap rule**: edit only the files plan "Files the build touches" lists for your phase. Never
edit `prompts/director.ts` or `prompts/interpret.ts`. If a task seems to need another file, stop
and report.

## Phase 1: The rule (card AC #1, #2; US1, US2)

**Goal**: one pure function turns an undeclared manner or another human's roll into a clarify.

**Independent test**: `apps/server/test/dm/plan-gate.test.ts` passes with the new describe.

- [x] T001 [US1] In `apps/server/src/dm/gates/plan-gate.ts`, add `MANNER_SKILLS` as plan D1 states.
      Put the R6 `ponytail:` note on it.
- [x] T002 [US2] In the same file, add `otherPlayerQuestion` and the `Asked` type.
- [x] T003 [US1] [US2] In the same file, add `askUndeclared` with plan D1 rules 1 to 6. Use
      `import type` for `BeatItem` and `Ruling`. Leave `checkPlan` unchanged.
- [x] T004 [P] [US1] [US2] Extend `apps/server/test/dm/plan-gate.test.ts` with plan "Tests" cases
      1 to 15. Build the snapshot from `greyhollowDuo()`.
- [x] T005 Run `pnpm ci:check`. Commit as `TASK-0205 phase 1: askUndeclared rule`.

## Phase 2: Wiring and the run 1 replay (merge condition; US1, US2)

**Goal**: the runner applies the rule before `clarifyHolds`, and the seq 24–30 replay proves it.

**Independent test**: `no-undeclared-method.integration.test.ts`, `runner.test.ts` and
`plan-first-step.integration.test.ts` pass with `REQUIRE_DATABASE=1`.

- [ ] T006 [US1] In `apps/server/src/dm/pipeline/runner.ts`, apply plan D2. Call `askUndeclared`
      after `cutPlans`. Feed its output to `cutBeat`, `clarifyHolds`, the checkpoint and
      `ctx.results`. Add `asked` to the `dm.plan.cut` log line.
- [ ] T007 [P] [US1] Extend `apps/server/test/dm/runner.test.ts` as plan "Tests" states. Give the
      `assembled()` stub a default `snapshot`.
- [ ] T008 [P] [US1] Create `apps/server/test/dm/scripts/approach-reed-camp.json` as plan "Tests"
      states. Use run 1's goal note and reading verbatim.
- [ ] T009 [US1] [US2] Create `apps/server/test/dm/no-undeclared-method.integration.test.ts` with
      plan "Tests" cases 1 to 3. Follow `noncombatant-targets.integration.test.ts`. Name the run 1
      source in the file header.
- [ ] T010 [US2] In `apps/server/test/dm/plan-first-step.integration.test.ts`, change the seed to
      `greyhollow-ford` and the seats to `{ tamsin: TAMSIN_USER }` (plan R8). Keep every assertion.
- [ ] T011 Amend `specs/031-dm-runtime/contracts/nodes.md` as plan D3 states. Mark the change
      "Amended by spec 077 (TASK-0205)".
- [ ] T012 Run `pnpm ci:check` and the DB suite. Commit as
      `TASK-0205 phase 2: the runner asks before an undeclared method`.

## Phase 3: Wiki (re-ground)

**Goal**: every note that pins a changed file is verified against the diff and re-pinned honestly.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs
freshness . docs/wiki` prints `OK`.

- [ ] T013 Run `/grounding-wiki:wiki-update`. Treat `dm-failure-and-gates`, `dm-runtime` and
      `dm-narration-quality` as NEEDS-REVIEW.
- [ ] T014 In `docs/wiki/dm-failure-and-gates.md`, describe `askUndeclared`: its two rules, the
      skip list, and its place between the cut and `clarifyHolds`. Name spec 077.
- [ ] T015 In `docs/wiki/dm-runtime.md`, add the ask to the post-planning step and the `asked` log
      field.
- [ ] T016 In `docs/wiki/dm-narration-quality.md`, state that the fallback voices the ask
      questions as clarify questions (spec 073). Change nothing else.
- [ ] T017 Verify `output-claim-gate`, `seed-npc-presence`, `dm-talk-triggers` and `dm-turn-jobs`
      against the diff. Re-pin each one only when its text still holds.
- [ ] T018 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` (the state paragraph: one
      sentence on TASK-0205).
- [ ] T019 Run the freshness gate and the spec-bridge gate
      (`node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .`). Commit as
      `TASK-0205 phase 3: re-ground the wiki`.

## Dependencies & Execution Order

- Phase 1 has no dependency. Phase 2 needs phase 1. Phase 3 needs phase 2.
- T004, T007 and T008 can run beside the task before them.
- Card AC #3 ticks only after TASK-0113 merges (spec mapping table).

## Constitution Compliance (the-stacks)

- Agent-facing interface exercised by a test (Principle I): T009 drives the pipeline with no UI.
- No event, codex entity, engine command, SRD data or asset change: the other rows do not apply.
