# Tasks: A roll reason the DM model writes cannot contradict actor state

**Input**: `specs/058-roll-reason-plan-gate/` (spec.md, plan.md, contracts/plan-reason-gate.md)

**Prerequisites**: the operator has ruled OQ-1 to OQ-3. The tasks below assume the recommended
defaults (OQ-1 (a), OQ-2 (a), OQ-3 (a)). A different ruling changes the tasks marked with its OQ.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator, not the implementer.
Each implementer phase ends with `pnpm ci:check` green (DB suites skip without a database) and one
commit led by `TASK-0161:`.

## Phase 1: Evidence fixture and failing tests (card AC #2, #3 evidence)

- [ ] T001 Add `snapshotAt(logPath, seq)` to `apps/server/test/dm/claim-fixtures.ts`. Return the
      `buildSnapshot` of the folded projections at `seq` with the `greyhollow-ford` seed. Reuse
      `projectionsAt`.
- [ ] T002 Create `apps/server/test/dm/plan-reason-fixtures.ts`. Export `M2_SEQ221_S0`
      (`snapshotAt(M2_LOG, 220)`). Export `M2_SEQ221_REASON`, read from the seq 221 `dice.rolled`
      row with the ` [<jobId>#<n>]` marker stripped. Do not hand-type the reason.
- [ ] T003 In the same file, export `m2Seq221Reading(reason)`: an NPC reading (`actionId: null`,
      intent `attack`) with one `attack` step, `attackerId: "goblin-2"`, `targetId: "tamsin"`,
      `expression: "1d20+4"`, one `onHit` damage effect on `tamsin`, and the given reason.
- [ ] T004 Export `M2_SEQ221_CONTROL`: the recorded reason with the clause ", shouting that two kin
      have fallen" removed.
- [ ] T005 Add a sanity test: at seq 220 `goblin-3` is `dead`, `goblin-2` and `snag` are not down,
      and no party actor is down.
- [ ] T006 Add to `apps/server/test/dm/plan-gate.test.ts` a `describe("checkPlan: roll reasons")`
      with the M2 seq 221 case as `it.fails`: the NPC verdict is refused at step 0, field `reason`,
      with a `count` issue whose `matched` holds "two kin have fallen". Confirm it fails as plain
      `it` against today's `checkPlan`, then mark it `it.fails`.
- [ ] T007 Add the control case as plain `it`: `M2_SEQ221_CONTROL` gives
      `{ actionId: null, ok: true }`. It passes today and must keep passing.
- [ ] T008 Run `pnpm ci:check`. Report the `it.fails` count and the controls.

## Phase 2: The reason check in `checkPlan` (card AC #1, #2, #3)

- [ ] T009 In `apps/server/src/dm/gates/plan-gate.ts`, add `arriving` and `resumed` to `PlanInput`,
      the `ReasonFailure` type and the third `PlanVerdict` variant, as
      `contracts/plan-reason-gate.md` states. Update every `checkPlan` caller and test helper to pass
      `arriving: []` and `resumed: []`.
- [ ] T010 Export `REASON_REFUSAL_CODE = "REASON_CONTRADICTS_STATE"` (OQ-2). Type it as a string
      literal here; Phase 3 ties it to the engine enum.
- [ ] T011 Add the internal `stepTexts(step)`: the step `reason`, then `autoFail.reason` for a
      `check` step. Under OQ-3 (a) add each `condition` effect's `source` in `effects`, `onSuccess`,
      `onFailure` and `onHit`, with its path as the field.
- [ ] T012 Add the internal `plannedDiff(snapshot, groups, arriving)` (contract rule 5). Use
      `REASON_TO_PRESENCE` from `@the-stacks/session-model` for the `after` value.
- [ ] T013 Export the pure `arrivingNpcs(seed, enc, scenePresence)`: NPC ids the encounter's beat
      declares `present` whose logged presence is not `present`. Return `[]` with no encounter.
- [ ] T014 Wire the walk into `checkPlan` after the id loop (contract rules 2, 3, 4 and 6). Call
      `checkClaims` from `../claims.js`. Add no word list or matcher.
- [ ] T015 Flip T006 from `it.fails` to `it`.
- [ ] T016 Add unit tests: an `arrived` presence effect on absent Pell with reason "Pell staggers out
      of the reeds" passes, and the same reason with no presence effect is refused `act`.
- [ ] T017 Add unit tests: an id in `arriving` exempts that NPC from the act rule; a resumed action
      id with a refused reason gives `ok: true`; a resumed action id with an absent target is still
      refused `UNKNOWN_COMBATANT`.
- [ ] T018 Add unit tests: an `autoFail.reason` is checked (field `autoFail.reason`); a ruling's
      steps replace the reading's (the reading's bad reason is not checked); a clarify reading is
      not checked; an id failure wins over a reason failure in the same group; only the first
      refused text is reported.
- [ ] T019 Add a unit test that a passing verdict leaves the reading object deep-equal to its input
      (the gate never rewrites text).
- [ ] T020 Add a unit test for `arrivingNpcs` over the `greyhollow-ford` seed.
- [ ] T021 Run `pnpm ci:check`.

## Phase 3: Resolve wiring, the refusal code, DB tests, contracts (card AC #1, #2, #3)

- [ ] T022 In `apps/server/src/dm/nodes/resolve.ts`, pass `arriving` (via `encounterToStart` and
      `arrivingNpcs` over `assembled.projections.scenePresence`) and `resumed`
      (`assembled.resumed` action ids) to `checkPlan`.
- [ ] T023 In `resolveAction`, take `refusalCode` from the refused verdict's `code`.
- [ ] T024 OQ-2 (a): append `REASON_CONTRADICTS_STATE` to
      `packages/dnd5e-engine/src/schema/refusals.ts`. Change the count in
      `packages/dnd5e-engine/test/execute.test.ts` from 27 to 28. Add a `PLAN_GATE_ONLY` list to
      `packages/dnd5e-engine/test/coverage.test.ts`, exclude it from the expectRefusal check, and
      assert each listed code is in the enum. Type `REASON_REFUSAL_CODE` as `RefusalCode`.
- [ ] T025 Add to `apps/server/test/dm/resolve.integration.test.ts`, under "plan gate": an NPC group
      with the M2 seq 221 reason runs no step, writes no `attack.resolved` and no row holding the
      reason, and the turn still advances.
- [ ] T026 Add: an action group with a refused reason resolves `refused` with
      `REASON_CONTRADICTS_STATE`, `out.planGate` holds the reason verdict, and no step row lands.
- [ ] T027 Add: an action group with a passing reason applies, and its `dice.rolled` reason equals
      the step reason plus the existing marker.
- [ ] T028 Amend `specs/031-dm-runtime/contracts/resolve.md` step 0 and
      `specs/051-output-claim-gate/contracts/claim-gate.md` with the text in
      `contracts/plan-reason-gate.md`.
- [ ] T029 OQ-2 (a): add the row to `specs/026-dnd5e-engine/contracts/refusals.md`.
- [ ] T030 Run `pnpm ci:check` without a database. Report it; the DB cases skip.

## Phase 4: DB suites and the mutation guard **[orchestrator]**

- [ ] T031 **[orchestrator]** On the worktree stack (`pnpm env:up`, migrate both databases, restart
      the app), run with `REQUIRE_DATABASE=1`: `resolve.integration`, `encounter-end-resolves`,
      `human-dm-roll-resume`, `full-turn`, `duo`, `script-env`, `scene` and `worker` integration
      suites. Export only `TEST_DATABASE_URL` from the worktree `.env`.
- [ ] T032 **[orchestrator]** Triage any scripted suite that fails on a refused reason. A genuine
      contradiction: dispatch a script-text fix. A false positive: stop and raise it to the operator.
- [ ] T033 **[orchestrator]** Mutation guard (plan D4): stub the reason walk, run `plan-gate.test`
      and `resolve.integration`, and confirm the seq 221 case, the refusal cases of T016 to T018,
      and T025 and T026 fail. Restore; `git diff` is empty. Record the result
      on the card.

## Phase 5: Wiki re-ground

- [ ] T034 Re-verify and re-pin `docs/wiki/dm-failure-and-gates.md` (plan gate paragraph: the
      reason check, `plannedDiff`, the resumed skip, the code).
- [ ] T035 Re-verify and re-pin `docs/wiki/output-claim-gate.md` (callers: the plan gate) and
      `docs/wiki/dm-turn-jobs.md` (resolve order sentence on the plan gate).
- [ ] T036 Re-verify and re-pin `docs/wiki/dm-runtime.md` and, under OQ-2 (a),
      `docs/wiki/dnd5e-engine.md` (the plan-gate-only code).
- [ ] T037 Regenerate `docs/wiki/CAPSULES.md` for every changed `description:`. Add one sentence on
      spec 058 to `docs/wiki/INDEX.md`'s state paragraph.
- [ ] T038 Add a TASK-0161 "(this PR)" row to the execution log in
      `docs/design/m3-table-sweep-runbook.md`, in the TASK-0168 row's shape.
- [ ] T039 Run the wiki freshness gate
      (`node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      prints `OK`) and the spec-bridge check (exits 0). Run `pnpm ci:check`.

## Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Strictly serial: every phase edits the plan gate or
its tests.
