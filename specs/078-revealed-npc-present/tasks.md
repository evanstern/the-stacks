# Tasks: An NPC the DM reveals is present in the state

**Input**: `specs/078-revealed-npc-present/` (spec.md, plan.md)

**Prerequisites**: TASK-0113 (spine #3) and TASK-0210 (#112) are merged to `main`. The operator
rules OQ-1 to OQ-4; the tasks below implement every OQ at (a). A different ruling changes the
plan.md design section named under that OQ.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and
the branch commits. Each phase ends with `pnpm ci:check` green (DB suites skip without a
database) and one commit led by `TASK-0206:`. Edit only the `resolve.ts` hunks plan D3 and D4
name.

## Phase 1: The Director's arrivals, resolve and the plan gate (card AC #1, #2)

- [x] T001 Merge `origin/main` into the branch. Confirm `prompts/director.ts` holds TASK-0113's
      `dm.director-v5` and `agencyRule`. Stop and report if it does not.
- [x] T002 In `apps/server/src/dm/nodes/schemas.ts`, add the optional `arrivals` field to
      `DirectorOutput` (plan D1).
- [x] T003 In `apps/server/src/dm/nodes/director.ts`, add `offstageNpcIds`, the `arrivals`
      override kind and the legality rules (plan D1).
- [x] T004 In `apps/server/src/dm/prompts/director.ts`, apply plan D2 hunks 1–4. Pass
      `offstageNpcs` from the director node.
- [x] T005 In `apps/server/src/dm/nodes/resolve.ts`, add the arrivals group and the fresh load in
      `directorOpening` (plan D3). Merge the arrivals into the `checkPlan` `arriving` argument
      (plan D4).
- [x] T006 In `apps/server/src/dm/gates/plan-gate.ts`, skip arriving ids when building
      `absentIds` (plan D4). Update the `PlanInput.arriving` comment.
- [x] T007 Apply the plan D7 rows for `director.test.ts`, `assemble.test.ts`,
      `trio-views.test.ts` and `plan-gate.test.ts`.
- [x] T008 Append the plan D6 amendments to `specs/031-dm-runtime/contracts/director.md` and
      `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`.
- [x] T009 Run `pnpm ci:check`.

## Phase 2: The chronicle and the run 1 seq 40–45 replay (card AC #1, #2, #3; merge condition)

- [x] T010 In `apps/server/src/dm/prompts/chronicle.ts`, apply plan D5. Run
      `narration-quality-repro.test.ts` and `player-facing-prompts.test.ts`; fix any assertion
      that expects an absent actor in the chronicle state.
- [x] T011 Create `apps/server/test/dm/chronicle-prompt.test.ts` with spec Story 3 scenarios 1–3.
- [x] T012 Create `apps/server/test/dm/scripts/reveal-snag.json` from `shoot-snag.json` (plan D8).
      Take the reveal text from `docs/playtests/2026-11-02-runbook-a-playtest.md` finding 6.
- [x] T013 Create `apps/server/test/dm/revealed-npc.integration.test.ts` with the three plan D8
      cases. Declare Kestrel's action through Kestrel's player.
- [x] T014 Run the DB suites with `REQUIRE_DATABASE=1` on the worktree stack (dispatch rules).
- [x] T015 Run both plan D9 mutation guards. Record each failing test name in the commit message.
      Restore both changes.
- [x] T016 Run `pnpm ci:check`.

## Phase 3: Wiki re-ground

- [x] T017 Review `docs/wiki/presence.md` (NEEDS-REVIEW): add the Director arrivals path to the
      scene-presence paragraph.
- [x] T018 Review `docs/wiki/seed-npc-presence.md` (NEEDS-REVIEW): add the arrivals group, the
      fresh load before the encounter-start group, and the arriving absent rule.
- [x] T019 Review `docs/wiki/dm-runtime.md` (NEEDS-REVIEW): the Director output field, its
      legality row, the prompt versions, and the chronicle state filter.
- [x] T020 Re-pin every other note that lists a touched source: `dm-failure-and-gates.md`
      (arriving rule), `output-claim-gate.md`, `dm-turn-jobs.md`, `party-panel.md`,
      `turn-floor.md`, `dm-talk-triggers.md`, `srd-data.md`. Edit text only where the diff
      changes what the note says.
- [x] T021 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md` for the changed notes. Add one
      INDEX sentence for spec 078.
- [x] T022 Run the wiki freshness gate and the spec-bridge gate (dispatch rules "Gates").

## Dependencies

- Phase 1 → Phase 2 → Phase 3, strictly serial.
- Phase 2's DB test needs Phase 1's resolve and gate changes.
- Phase 3 needs the final source tree.
