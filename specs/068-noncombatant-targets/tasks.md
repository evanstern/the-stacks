# Tasks: Acting on anyone outside the turn order pulls them in

**Input**: `specs/068-noncombatant-targets/` (spec.md, plan.md)

**Prerequisites**: the operator rules OQ-1 to OQ-5. The tasks below implement every OQ at (a). A
different ruling changes the plan.md design section named under that OQ.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator, not the implementer.
Each implementer phase ends with `pnpm ci:check` green (DB suites skip without a database) and one
commit led by `TASK-0194:`. Shared files: `dm/nodes/resolve.ts` (TASK-0193) and
`dm/snapshot/build.ts` (TASK-0164). The orchestrator holds the other lane per the runbook rule.

## Phase 1: The gate and the snapshot, pure (card AC #1, #2, #4)

- [x] T001 In `apps/server/src/dm/gates/plan-gate.ts`, add `pullable: boolean` to `NamedId` (plan
      D1). Set it true for a `check` step's `combatantId` and for `condition` and `heal` effect
      targets. Set it false for `attack` ids and `damage` effect targets.
- [x] T002 In `checkPlan`, pass a non-presence id that is an exact S0 `npc` actor id with no
      combatant when `pullable` is true. Keep today's failure otherwise. Keep the absent check after
      it, unchanged.
- [x] T003 Compute the group's pull ids (plan D1). Add `pull?: string[]` to the ok verdict. Set it
      only when non-empty.
- [x] T004 In `apps/server/src/dm/snapshot/build.ts`, link a seed NPC to an engine combatant whose
      id equals the NPC id when `identity.combatant` is null (plan D2).
- [x] T005 Extend `apps/server/test/dm/plan-gate.test.ts` with every case plan D5 lists under
      "Unit tests". Keep the existing damage-on-`pell` test unchanged.
- [x] T006 Extend `apps/server/test/dm/snapshot.test.ts`: an engine combatant `pell` builds one
      `npc` actor with `combatantId: "pell"`, and no `ACTOR_ID_COLLISION`.
- [x] T007 Run `pnpm ci:check`.

## Phase 2: The pull in resolve and the run 3 replay (card AC #3, #4; merge condition)

- [x] T008 In `apps/server/src/dm/nodes/resolve.ts`, add `pullIn(run, ctx, prefix, ids)` (plan
      D3). Use `combatantFromSrd` with the NPC's `srdMonsterId`, else `commoner`. Gate the join on
      an active encounter, not in order, `canAct` and presence `present`.
- [x] T009 Call `pullIn` before `runSteps` in `resolveAction` for an ok, non-clarify verdict. Call
      it before the NPC group's `runSteps`. Pass `ctx` into `resolveAction`.
- [x] T010 Create `apps/server/test/dm/scripts/free-pell.json` (plan D5). Take the post text from
      run 3 seq 118 (`docs/playtests/2026-11-01-two-browser-alpha-run-3.md` item 11).
- [x] T011 Create `apps/server/test/dm/noncombatant-targets.integration.test.ts` on a duo scene.
      Write the free-Pell replay case (plan D5 case 1). This is the merge condition, part one.
- [x] T012 In the same file, write the attack control (plan D5 case 2). This is the merge
      condition, part two.
- [x] T013 In the same file, write the reclaim case (plan D5 case 3).
- [x] T014 Run `pnpm ci:check`. Mark T011 to T013 "written, not yet run on a database" if no stack
      is up.

## Phase 3: DB suites and mutation guard **[orchestrator]**

- [X] T015 **[orchestrator]** `pnpm env:up`, migrate both databases by hand, restart the app. Run
      the DM DB suites with `REQUIRE_DATABASE=1` and only `TEST_DATABASE_URL` exported. Re-run a
      timeout once (TASK-0154) and report it.
- [X] T016 **[orchestrator]** Mutation guard (plan D6): stub `pullIn`, then revert the `pullable`
      pass. Record the failing test count for each. Restore. Confirm `git diff` is empty.
      Result 2026-11-02: T015 DM DB suites 69 files, 826 passed, no timeouts. T016 stub `pullIn`: 2 of 3
      new tests fail; revert `pullable`: 2 of 3 fail; restored, `git diff` empty.

## Phase 4: Contracts and wiki re-ground

- [x] T017 Amend `specs/031-dm-runtime/contracts/resolve.md` (the pull before a group's steps),
      `specs/040-actor-snapshot/contracts/actor-snapshot.md` (rule 3) and
      `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md` (`pull` on the ok verdict).
      Mark each amendment "Amended by specs/068-noncombatant-targets".
- [x] T018 Re-ground `docs/wiki/dm-failure-and-gates.md` and `docs/wiki/dm-runtime.md`
      (NEEDS-REVIEW, runbook list) against the diff. Re-pin each honestly.
- [x] T019 Re-pin the other notes whose sources the diff touches: `actor-snapshot.md`,
      `seed-npc-presence.md`, `dm-turn-jobs.md`, `turn-floor.md`, `output-claim-gate.md`. Edit text
      only where it is now wrong.
- [x] T020 Leave `docs/wiki/dnd5e-engine.md` unchanged: the engine is untouched. Confirm its
      sources are not in the diff.
- [x] T021 Update `docs/wiki/CAPSULES.md` and the `INDEX.md` state paragraph with one sentence for
      TASK-0194 (specs/068).
- [x] T022 Run the wiki freshness gate (`OK`), the spec-bridge check (exit 0) and `pnpm ci:check`.

## Dependencies

- Phase 1 before Phase 2: resolve reads `verdict.pull`, and the pulled NPC needs the D2 link.
- Phase 3 after Phase 2. Phase 4 after Phase 3.
- TASK-0193 implements after this branch merges if its plan touches `dm/nodes/resolve.ts`.
- TASK-0164 implements after this branch merges if its plan touches `dm/snapshot/build.ts`.
