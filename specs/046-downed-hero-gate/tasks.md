---
description: "Task list for the downed hero gate and able-actor gates (TASK-0112, decision-0025 U6)"
---

# Tasks: Downed hero gate and able-actor gates

**Input**: `specs/046-downed-hero-gate/` (spec.md, plan.md). Binding: decision-0025 §3.1 and
§3.2. The operator rulings of 2026-10-27 are quoted in spec.md "Operator rulings".

**Tests**: required. Each card AC is proven by a named test (spec.md "Card acceptance criteria
mapping"; card numbering after the 2026-10-27 amendment).

**Dispatch unit**: each phase is one implementer dispatch (sonnet). Run the phases in order:
1, 2, 3, 4, 5, 6.
- Phases 3 and 4 both edit `apps/server/src/dm/nodes/resolve.ts`. Never run them in parallel.
- Phases 3, 4 and 5 run the DB suites. Never run them in parallel.

**Gate for every code phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`.
- Phases 3, 4 and 5 also run the DB suites.
- Phase 5 also runs `pnpm ci:check`.

**Database suites**: run on the worktree's own stack.
1. Run `pnpm env:up`.
2. Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098).
3. Restart the app.
4. Export only `TEST_DATABASE_URL` from the worktree `.env`. Never `source` the whole file.
5. Run the suites with `REQUIRE_DATABASE=1`.
6. Leave the stack up. The orchestrator runs `pnpm env:down`.

**Known flakes**: the WebSocket gateway integration tests flake. DB scene and playtest tests can
hit the 5 s timeout under full-suite load (TASK-0154). Re-run once. Do not fix them. Record each
re-run in the phase's commit message.

**Rules for every phase**:
- Follow spec.md and plan.md exactly. A needed deviation is a STOP: report it.
- Change no prompt, `PROMPT_VERSION`, gateway purpose, model call count or call order.
- Add no event type, ws frame, proposal kind, migration or dependency.
- Edit frozen contract text only where a task below names it. Each such edit carries the line
  "Amended 2026-10-27 (TASK-0112, operator ruling)".
- Tests use the fake gateway and scripted dice. No paid run.
- Never use the backlog MCP tools. Touch no file under `backlog/`.
- No "for now" without a card (decision-0020). Report any deferral as an open question.

**Commits**: one or more per phase. Each message starts with `TASK-0112:` and ends with the
Co-Authored-By trailer. Push after each phase.

## Phase 1: Main merge, turn-jobs fix, engine `ACTOR_UNABLE` (card AC #3)

**Goal**: The branch carries TASK-0110's resolve order. The engine refuses an unable attacker
or ability checker before any die is drawn.

**Independent test**: `pnpm --filter @the-stacks/dnd5e-engine test`. The new cases fail before
T005 and pass after it.

- [x] T001 Run `pnpm install --frozen-lockfile`. Merge `origin/main` into the branch as a merge
      commit. Resolve no conflict by hand in `backlog/`; report one if it appears.
- [x] T002 In `specs/031-dm-runtime/contracts/turn-jobs.md` "Resolve order", replace the
      sentence saying the opening/closing split is the reading "the operator has not yet
      ratified (spec 045, OQ-1)". State that the operator approved it on 2026-10-27
      ("Approved"). Change nothing else in the section.
- [x] T003 [P] In `packages/dnd5e-engine/test/commands/attacks.test.ts`, add failing cases for
      spec User Story 4, scenarios 1 to 7:
      - an unconscious attacker and a stable attacker;
      - an attacker with each condition `incapacitated`, `paralyzed`, `petrified`, `stunned`,
        `unconscious`;
      - an unable ability checker;
      - an unable saving thrower (accepted);
      - a dead attacker (still `TARGET_DEAD`);
      - null ids (no check);
      - an unconscious target (accepted).
      Each refusal case asserts `scriptedRng(...).calls() === 0` and the `details` shape.
- [x] T004 Append `"ACTOR_UNABLE"` to `RefusalCodeSchema` in
      `packages/dnd5e-engine/src/schema/refusals.ts`.
- [x] T005 In `packages/dnd5e-engine/src/commands/attacks.ts`, add `INCAPACITATING` and
      `isUnable`. Refuse in `handleAttackRoll` and `handleCheckRoll` (ability checks only) after
      `checkNamed`, per plan D1.
- [x] T006 Confirm `test/coverage.test.ts` passes with the new code. Name the rule in
      `packages/dnd5e-engine/README.md` beside the dead-actor refusals.
- [x] T007 In `packages/session-model/test/catalog.test.ts`, add a case: an `action.resolved`
      payload with `outcome: "refused"` and `refusalCode: "ACTOR_UNABLE"` parses.
- [x] T008 Amend `specs/026-dnd5e-engine/contracts/refusals.md`: add row 27 `ACTOR_UNABLE`
      (when: an unable attacker or ability checker; commands: `attack.roll`, `check.roll`), and
      set the header count to 27.
- [x] T009 Amend `specs/029-proposal-gate/contracts/gate-api.md` §2: "the engine's 26
      `RefusalCode`s" becomes 27.
- [x] T010 Amend `specs/028-session-model/contracts/session-events.md` at
      `action.resolved.refusalCode`. Note that the set follows the engine enum, that
      `ACTOR_UNABLE` was added 2026-10-27 (TASK-0112), and that the payload stays v1.

**Checkpoint**: the engine suite is green, the session-model catalog test is green, and the
contracts carry 27 engine codes.

## Phase 2: Declare gate `CHARACTER_UNABLE` (card AC #5)

**Goal**: The gate refuses a declaration for a non-conscious character before any row lands.

**Independent test**: `pnpm --filter @the-stacks/session-model test`. The new
`gate-plan.test.ts` cases pass.

- [x] T011 [P] In `packages/session-model/test/gate-plan.test.ts`, add failing cases for spec
      User Story 2, scenarios 1 to 4:
      - character scope with `unconscious`, `stable` and `dead`;
      - a conscious character (accepted);
      - a member with `combatant: null` (accepted);
      - party scope with every controlled character down (refused);
      - party scope with one controlled character conscious (accepted);
      - an unauthorised proposer for a downed character (still `NOT_AUTHORIZED`).
      Assert `source: "gate"`, `code: "CHARACTER_UNABLE"` and
      `details: { characterId, reason: "life-state", lifeState }`.
- [x] T012 Append `"CHARACTER_UNABLE"` to `GateRefusalCodeSchema` in
      `packages/session-model/src/gate/refusals.ts`. Export
      `CHARACTER_UNABLE_REASONS = ["life-state"] as const`.
- [x] T013 Implement the check in the `action.declare` case of
      `packages/session-model/src/gate/plan.ts`, after the control check, per plan D2.
- [x] T014 Add one server test through `gate.handle`: a human seat declaring for an unconscious
      character is refused and the log is unchanged. Put it in
      `apps/server/test/gate.integration.test.ts`. It is DB-gated; run it under Phase 3's stack if
      this phase has no stack. Say which in the commit.
- [x] T015 Amend `specs/029-proposal-gate/contracts/gate-api.md`. In the §1 Rows table, the
      `action.declare` row adds "character able (`CHARACTER_UNABLE`)". In §2, the gate code
      list gains `CHARACTER_UNABLE`, with `details.reason` named as an open set
      (`life-state`; TASK-0141 adds `absent`).

**Checkpoint**: the session-model suite is green, and gate-api.md lists 16 gate codes.

## Phase 3: Plan gate against S0 (card AC #6)

**Goal**: A step naming an id that is not a combatant in S0 refuses its whole group before any
row of that group lands.

**Independent test**: `apps/server/test/dm/plan-gate.test.ts` (unit) and the new resolve
integration cases.

- [x] T016 [P] Write `apps/server/test/dm/plan-gate.test.ts` over S0 built with
      `test/dm/snapshot-fixtures.ts`. Cover spec User Story 5, scenarios 1, 2, 4 and 6:
      - an effect on `pell` (`not-a-combatant`);
      - an unknown id (`not-in-snapshot`);
      - an alias that is not mapped;
      - nested `onHit`, `onSuccess` and `onFailure` targets;
      - a ruling overriding a reading;
      - the NPC group;
      - the `joining` ids for an ambush;
      - an all-valid plan.
- [x] T017 Implement `apps/server/src/dm/gates/plan-gate.ts` (`checkPlan`, `PlanVerdict`,
      `PlanFailure`) per plan D3. Extract the "monsters an encounter start adds" helper so that
      `directorOpening` and `checkPlan` share it.
- [x] T018 Wire `checkPlan` into `apps/server/src/dm/nodes/resolve.ts`:
      - call it once at the top, before `directorOpening`;
      - a refused action group submits `action.resolve` `refused` with `UNKNOWN_COMBATANT`
        and runs no step;
      - a refused NPC group runs no step and lets the turn advance.
- [x] T019 Add `planGate?: PlanVerdict[]` to `TurnCheckpoint` in `apps/server/src/dm/jobs.ts`.
      Fill it where resolve's checkpoint is written.
- [x] T020 Add resolve integration cases in `apps/server/test/dm/resolve.integration.test.ts`
      for User Story 5, scenarios 3 and 5:
      - step 0 valid and step 1 on `pell`: no row from step 0, outcome `refused`;
      - a refused NPC group: the turn still advances.
      Re-run spec 045's ambush case (SC-003) unchanged.
- [x] T021 Confirm `apps/server/test/dm/boundary.test.ts` passes: narrate's import closure
      does not include `plan-gate.ts`.
- [x] T022 Amend `specs/031-dm-runtime/contracts/resolve.md` "Order of work" to put the plan
      gate first. Amend `specs/040-actor-snapshot/contracts/actor-snapshot.md` "Extension
      points": the TASK-0112 plan gate is built, and TASK-0141 adds the absent reason.

**Checkpoint**: the unit and DB suites are green, and the existing DM suite passes with no
prompt fixture change.

## Phase 4: Death-save turns by settling (card AC #4)

**Goal**: A downed party member's turn runs its engine death save with no declaration, and
the turn passes.

**Independent test**: the new resolve integration cases and the facts test.

- [x] T023 [P] Add resolve integration cases in `apps/server/test/dm/resolve.integration.test.ts`
      for spec User Story 3, scenarios 1 to 6, with scripted dice:
      - an unconscious party combatant (one `death-save.roll`, then an advance);
      - a stable combatant (no roll);
      - a natural 20 (back to 1 HP, conscious, table mode on it, no further advance);
      - a third failure (dead, the turn passes);
      - an encounter start whose first active combatant is downed;
      - an unconscious non-party combatant (passed, no NPC turn job);
      - the one-lap bound when every non-dead combatant is unable.
- [x] T024 Implement `apps/server/src/dm/nodes/settle.ts` (`settleTurn`) per plan D4. Use the
      engine command fields `{ type: "death-save.roll", targetId, mode: "normal", reason }`.
      Use stable submission keys `settle:<n>:save` and `settle:<n>:advance`.
- [x] T025 Call `settleTurn` from the turn-advance group (it replaces the direct
      `advance:table-mode` submit) and from `directorOpening`'s encounter start in
      `resolve.ts`. Keep `nextJob`'s rule.
- [x] T026 [P] Add a test in `apps/server/test/dm/facts.test.ts` over a settled death-save
      batch. It must yield a narration fact and a dice line for the roll and its outcome. If it
      fails, add the `death-saves` fact in `apps/server/src/dm/facts.ts` and its rebuild in
      `apps/server/src/playtest/auditor/render.ts` (plan D5). Keep the edit additive.
- [x] T027 Add a reclaim case: re-running the job finds the landed settle submissions and
      writes nothing twice (pattern: `apps/server/test/dm/reclaim.integration.test.ts`).
- [x] T028 Amend `specs/031-dm-runtime/contracts/resolve.md`: settling runs in the turn
      advance and the encounter start, with its stop rules and the lap bound.

**Checkpoint**: the DB suites are green. Report any existing fixture whose rows changed
(plan "Risks").

## Phase 5: Driver and harness (card AC #1)

**Goal**: The scripted seat never declares for a downed character. A downed seat in free mode
ends the run with `stallReason: "seat-downed"`.

**Independent test**: `apps/server/test/playtest/driver.test.ts` and the new harness case.

- [x] T029 [P] Add driver cases in `apps/server/test/playtest/driver.test.ts` for spec User
      Story 1, scenarios 1 to 3:
      - free mode with HP 0 returns `"done"`;
      - turn mode with another combatant active returns `"wait"`;
      - a conscious-again seat declares;
      - a seat with `combatant: null` declares.
- [x] T030 Implement `seatDowned` and `STALL_REASON_SEAT_DOWNED` in
      `apps/server/src/playtest/driver.ts`, and record the reason in
      `apps/server/src/playtest/harness.ts`, per plan D6. `stallReason` stays `z.string()` in
      `auditor/schema.ts`.
- [x] T031 Add the fixture `apps/server/test/playtest/fixtures/downed-seat.json` and its fake
      gateway DM script. A monster attack and the scripted dice drop the seat in round 1.
- [x] T032 Add a case in `apps/server/test/playtest/harness.integration.test.ts` for User
      Story 1, scenario 4:
      - no `action.declared` row names the seat while it is at 0 HP;
      - the manifest records no declare refusal for the seat;
      - at least one engine death-save roll lands;
      - when the fight ends with the seat down, the outcome is `stalled` with
        `stallReason: "seat-downed"`.
- [x] T033 Re-run the shipped `greyhollow-ford` ci case
      (`apps/server/test/playtest/playtest.integration.test.ts`). It must still end `ended`
      with a passing report (SC-007).
- [x] T034 Amend `specs/032-playtest-harness/contracts/scenario.md` "Driver" with the downed
      rule and the `seat-downed` stall reason.
- [x] T035 Run `pnpm ci:check`. It must be green.

**Checkpoint**: every suite is green, and `pnpm ci:check` passes.

## Phase 6: Wiki re-ground (runbook expected reviews)

**Goal**: The grounding wiki describes the merged behaviour, with honest re-pins.

**Independent test**: the freshness gate prints `OK`, and the spec-bridge check exits 0.

- [x] T036 For each staled note, classify it against
      `git diff <old-pin>..HEAD -- <sources>` as RE-PIN-ONLY or NEEDS-REVIEW. Amend prose
      before bumping any NEEDS-REVIEW pin.
- [x] T037 NEEDS-REVIEW `docs/wiki/playtest-harness.md`: the downed-seat rule,
      `seat-downed`, the new fixture.
- [x] T038 NEEDS-REVIEW `docs/wiki/dm-failure-and-gates.md`: the plan gate (`checkPlan`, the
      `UNKNOWN_COMBATANT` group refusal, `checkpoint.planGate`) and the declare gate's
      `CHARACTER_UNABLE`.
- [x] T039 NEEDS-REVIEW `docs/wiki/dnd5e-engine.md`: `ACTOR_UNABLE`, the unable rule, the
      saving-throw exemption, 27 codes.
- [x] T040 Review `docs/wiki/dm-runtime.md` (settling, death-save turns), `docs/wiki/proposal-gate.md`
      (`CHARACTER_UNABLE`) and `docs/wiki/actor-snapshot.md` (the extension point is built).
      Classify each and amend if its sources changed.
- [x] T041 Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed. Update the
      `docs/wiki/INDEX.md` state paragraph with one sentence for the able-actor gates.
- [x] T042 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      (it must print `OK`). Run
      `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
      (it must exit 0).

**Checkpoint**: the wiki is fresh, and the bridge is clean.

## Dependencies

- Phase 1 → Phase 2. The session-model test in T007 needs the engine code, and Phase 2 builds
  on the merged branch.
- Phase 2 → Phase 3 → Phase 4. Both of the later phases edit `resolve.ts`.
- Phase 4 → Phase 5. The harness case needs settling, or the downed seat stalls the fight.
- Phases 1 to 5 → Phase 6.
- Within a phase, `[P]` test tasks can be written beside the implementation. They must fail
  before it.
