---
description: "Task list for scene presence as tracked actor state, with a producer (TASK-0141, decision-0025 U2 plus the U6 absent halves)"
---

# Tasks: Scene presence as tracked actor state, with a producer

**Input**: `specs/048-scene-presence/` (spec.md, plan.md). Binding: decision-0025 (D17) Terms,
§1.2, §2.1, §3.1, §3.2. The operator rulings of 2026-10-27 (OQ-1 to OQ-4, all (a)) are quoted
in spec.md "Operator rulings".

**Tests**: required. Each card AC is proven by a named test (spec.md "Card acceptance criteria
mapping"; card numbering of 6affe8d).

**Dispatch unit**: each phase is one implementer dispatch (sonnet). Run the phases in order:
1, 2, 3, 4, 5.
- Phase 1 may start before PR #71 (TASK-0112) merges. Phases 2 to 4 may not.
- Phases 3 and 4 both edit TASK-0112's `apps/server/src/dm/gates/plan-gate.ts` area and
  `resolve.ts` callers. Never run them in parallel.
- Phases 2 and 4 run the DB suites. Never run them in parallel.

**Gate for every code phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`.
- Phases 2 and 4 also run the DB suites.
- Phase 4 also runs `pnpm ci:check`.

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
- Add only the event type (`scene-presence.changed`), proposal kind (`scene-presence`), engine
  command (`initiative.leave`) and prompt-version bumps that plan.md names. Add no ws frame,
  engine event type, refusal code, migration or dependency.
- Edit frozen contract text only where a task below names it. Each such edit carries the line
  "Amended 2026-10-27 (TASK-0141, operator ruling OQ-n)", with the ruling quoted.
- Tests use the fake gateway and scripted dice. No paid run.
- UI: no modals.
- Never use the backlog MCP tools. Touch no file under `backlog/`.
- No "for now" without a card (decision-0020). Report any deferral as an open question.

**Commits**: one or more per phase. Each message starts with `TASK-0141:` and ends with the
Co-Authored-By trailer. Push after each phase.

## Phase 1: Engine `initiative.leave` (card AC #7, User Story 3 engine half)

**Goal**: The engine takes a combatant out of the active encounter's order, keeps its state, and
hands the turn on exactly once when the leaver is active.

**Independent test**: `pnpm --filter @the-stacks/dnd5e-engine test`. The new cases fail before
T004 and pass after it.

- [x] T001 Run `pnpm install --frozen-lockfile`. Merge `origin/main` into the branch as a merge
      commit when main has moved. Resolve no conflict by hand in `backlog/`; report one if it
      appears.
- [x] T002 [P] [US3] Create `packages/dnd5e-engine/test/commands/initiative-leave.test.ts` with
      failing cases (plan R3, R4):
      - a non-active combatant leaves: one `encounter.changed`, order without it, `turnIndex`
        still on the same active combatant, state kept in `combatants`;
      - the active combatant leaves mid-order: the next entry is active, the round is unchanged;
      - the active combatant leaves at the end of the order: `turnIndex` 0, round + 1, and the
        outgoing combatant's turn-end condition expiries are emitted;
      - refusals: no encounter (`NO_ACTIVE_ENCOUNTER`), unknown id (`UNKNOWN_COMBATANT`), not in
        the order (`UNKNOWN_COMBATANT`, `details.reason: "not-in-order"`), last entry
        (`NO_ELIGIBLE_COMBATANT`);
      - each refusal asserts `scriptedRng([]).calls() === 0`;
      - `replay` of the events from the pre-state equals the post-state.
- [x] T003 [US3] Add `{ type: "initiative.leave", combatantId, reason }` to
      `EngineCommandSchema` in `packages/dnd5e-engine/src/schema/commands.ts`.
- [x] T004 [US3] Add `handleInitiativeLeave` to `packages/dnd5e-engine/src/commands/encounter.ts`
      per plan D1, R3 and R4. Reuse the module's `expiring` helper for the turn-end expiry.
      Register it in `packages/dnd5e-engine/src/execute.ts`.
- [x] T005 [US3] Confirm `packages/dnd5e-engine/test/coverage.test.ts` passes with the new
      command. List the command in `packages/dnd5e-engine/README.md`.
- [x] T006 [US3] Amend `specs/026-dnd5e-engine/contracts/commands.md`: add `initiative.leave`
      (fields, refusals of R3, the active-leaver rule of R4, event `encounter.changed`). Note
      "Amended 2026-10-27 (TASK-0141, operator ruling OQ-3)".

**Checkpoint**: the engine suite is green, and the coverage meta-test names the command.

## Phase 2: Session model — event, projection, `scene-presence` kind, declare gate (card AC #1, #4, #6 gate half)

**Goal**: A presence change is a catalogued, public, folded row. Only the DM may propose it. The
planner lands it with its engine order rows in one batch. The declare gate refuses an absent
character.

**Independent test**: `pnpm --filter @the-stacks/session-model test`, plus the DB
`apps/server/test/gate.integration.test.ts` cases.

- [x] T007 Confirm PR #71 (TASK-0112) has merged: `gh api repos/evanstern/the-stacks/pulls/71 --jq .merged`
      prints `true`. If not, STOP and report. Merge `origin/main` into the branch as a merge
      commit. Confirm `CHARACTER_UNABLE_REASONS`, `checkPlan` and `PlanFailureReason` exist as
      plan.md describes; report any difference before coding.
- [x] T008 [P] [US1] In `packages/session-model/test/catalog.test.ts`, add failing cases:
      `scene-presence.changed` v1 is catalogued (`state-change`, `any`, current); a valid payload
      parses for each of the six reasons; a payload whose `after` does not match its `reason`
      fails; a payload with `before === after` fails.
- [x] T009 [P] [US1] Add a projection fold test beside the existing ones in
      `packages/session-model/test/` (spec User Story 1, scenarios 1, 2, 5): a row folds to
      `{ presence, reason, seq }`; no row gives no entry; a player viewer sees the row; a
      `before` mismatch bumps the diagnostic and still applies.
- [x] T010 [P] [US1] In `packages/session-model/test/gate-plan.test.ts`, add failing cases for
      the `scene-presence` planner (plan D2):
      - a free-mode `fled` lands one presence row only;
      - turn mode, combatant in the order, `fled`: the presence row plus the `initiative.leave`
        mechanics rows, in that order, in one plan;
      - turn mode, absent combatant out of the order, `arrived`: the presence row plus the
        `initiative.join` rows (scripted initiative die);
      - `yielded` in turn mode: presence row only, order unchanged;
      - same value: `INVALID_PROPOSAL`; unknown `actionId`: `UNKNOWN_ACTION`;
      - an engine refusal (the last entry leaves) returns source `engine` and no rows;
      - a player or companion proposer is refused by permissions.
- [x] T011 [P] [US6] In `packages/session-model/test/gate-plan.test.ts`, add failing declare cases
      (spec User Story 6, scenarios 1 to 5): character scope absent refuses with
      `CHARACTER_UNABLE` and `details: { characterId, reason: "absent" }`; party scope with
      every controlled member absent or unable refuses, with `reason` `absent` when any is
      absent; a `yielded` character declares; an arrived character declares; an unauthorised
      proposer still gets `NOT_AUTHORIZED`.
- [x] T012 [US1] Create `packages/session-model/src/events/scene-presence.ts` with
      `ScenePresenceSchema`, `PresenceReasonSchema`, `REASON_TO_PRESENCE` and
      `ScenePresenceChangedV1` (plan D2). Catalogue it in `packages/session-model/src/catalog.ts`.
- [x] T013 [US1] Add `scenePresence` to `SessionProjections` in
      `packages/session-model/src/projections/types.ts`. Fold `scene-presence.changed` in
      `packages/session-model/src/projections/apply.ts` (empty `{}` initial state).
- [x] T014 [US1] Add the `scene-presence` kind to `ProposalKindSchema` in
      `packages/session-model/src/gate/proposals.ts` (14 kinds; `DmProposalKindSchema` 12; fix
      the stale "eleven" comment). Make it DM-only in `src/gate/permissions.ts`. Add
      `"scene-presence": "ask"` in `src/gate/policy.ts`.
- [x] T015 [US1] Add `case "scene-presence"` to `packages/session-model/src/gate/plan.ts` per plan
      D2, steps 1 to 5 (no actor-existence check, R2; engine rows through `execute` and
      `mechanicsRows`).
- [x] T016 [US6] Add `"absent"` to `CHARACTER_UNABLE_REASONS` in
      `packages/session-model/src/gate/refusals.ts`. Add the absent check to the
      `action.declare` case in `packages/session-model/src/gate/plan.ts` per plan D3.
- [x] T017 [US1] Export the new schemas, `REASON_TO_PRESENCE` and the reason list from
      `packages/session-model/src/index.ts`.
- [x] T018 [P] [US1] Add `case "scene-presence"` to `apps/web/app/play/proposals.ts` per plan D6
      (actor, reason, new value, visibility "Everyone"). Add or extend its unit test. No modal.
- [x] T019 [US6] In `apps/server/test/gate.integration.test.ts`, add DB cases: a declare for an
      absent character through `gate.handle` is refused with `CHARACTER_UNABLE`
      (`reason: "absent"`) and the log is unchanged; a `scene-presence` `fled` proposal through
      `gate.submit` as `ai:dm` in turn mode appends the presence row and the `encounter.changed`
      row with consecutive seqs in one batch.
- [x] T020 [US1] Amend `specs/028-session-model/contracts/session-events.md`: add the
      `scene-presence.changed` v1 section (payload, reason-to-value rule, `before !== after`,
      visibility `any`, kind state-change). Note "Amended 2026-10-27 (TASK-0141, operator
      ruling OQ-1)".
- [x] T021 [US1] Amend `specs/028-session-model/contracts/projections.md`: add the
      `scenePresence` view and its fold rule, including the `before` mismatch diagnostic.
- [x] T022 [US1] Amend frozen `specs/029-proposal-gate/contracts/proposals.md`: add the
      `scene-presence` kind and its schema; the kind count 13 becomes 14 and the DM kind count
      11 becomes 12; state that the gate fills `before` and `after` from the projection and the
      reason; state its visibility is always `public`; add `scene-presence` to the permission
      matrix row with `action.resolve`, `mechanics` and the other DM kinds. Add the amendment
      line quoting OQ-1.
- [x] T023 [US1] Amend frozen `specs/029-proposal-gate/contracts/policy-and-authority.md`: add the
      `"scene-presence": "ask"` row to the default policy table. Add the amendment line quoting
      OQ-1.
- [x] T024 [US1] Amend frozen `specs/029-proposal-gate/contracts/gate-api.md` §1: add a
      `scene-presence` row to the rows table (one `scene-presence.changed`, plus the engine
      `initiative.leave` or `initiative.join` rows; checks `UNKNOWN_ACTION`, and
      `INVALID_PROPOSAL` for no change). Add the amendment line quoting OQ-1.
- [x] T025 [US6] Amend frozen `specs/029-proposal-gate/contracts/gate-api.md` §1, the
      `action.declare` row: add `reason: "absent"` beside `life-state`. Update the §2 comment
      that says "TASK-0141 adds absent" to state that it is added. Add the amendment line
      (TASK-0141, the TASK-0112 OQ-1 open-reason ruling).

**Checkpoint**: the session-model and web suites are green, the gate DB cases are green, and
every 028 and 029 amendment is in place.

## Phase 3: Snapshot from the log, plan gate absent reason (card AC #2, #5)

**Goal**: Every snapshot carries the logged presence. The plan gate refuses a step naming an
S0-absent actor, under `UNKNOWN_COMBATANT` with reason `absent`.

**Independent test**: `pnpm --filter server test -- test/dm/snapshot test/dm/plan-gate` (unit,
no DB).

- [x] T026 [P] [US4] In the snapshot build and diff tests under `apps/server/test/dm/`, add failing
      cases (spec User Story 4, scenarios 1 to 5): an absent monster, a party member keyed by
      character id, a joined NPC keyed by NPC id, the S0-to-S1 `presence` diff entry, the
      `fiction` cap compressing an absent actor, and an entry for an unknown id ignored.
- [x] T027 [US4] Replace the three `presence: "present"` literals in
      `apps/server/src/dm/snapshot/build.ts` with `presenceOf(projections, id)` per plan D4.
- [x] T028 [US4] Amend `specs/040-actor-snapshot/contracts/actor-snapshot.md`: rule 7 says
      presence comes from the `scenePresence` projection (default `present`); the extension
      table marks TASK-0141 built and records the plan gate's `absent` reason.
- [x] T029 [P] [US7] In `apps/server/test/dm/plan-gate.test.ts`, add failing cases (spec User Story
      7, scenarios 1, 3, 4): an absent id as `targetId`, `attackerId`, a check `combatantId`,
      and an `onHit` effect target, each failing with `reason: "absent"` and the right
      `field`; a presence effect with reason `arrived` on an absent actor passing; a `yielded`
      target passing; a presence effect on a seed NPC with no combatant passing; an unknown id
      still `not-in-snapshot`.
- [x] T030 [US7] Extend `apps/server/src/dm/gates/plan-gate.ts` per plan D4: `PlanFailureReason`
      gains `"absent"`; `absentIds`; the presence-effect target rule; the verdict code stays
      `UNKNOWN_COMBATANT`. The presence effect type comes from `nodes/schemas.ts` in Phase 4,
      so write the presence branch against a local type guard on `effect === "presence"` and
      let Phase 4 tighten it if the type moves.

**Checkpoint**: the snapshot and plan-gate unit suites are green, and the 040 contract is
amended.

## Phase 4: Step grammar, resolve, facts, no Director field (card AC #3, #5 resolve half, #6, #7 resolve half)

**Goal**: Interpret and adjudicate can propose a presence change, under a roll's outcome.
Resolve applies it only through a `scene-presence` proposal. A fled active combatant hands the
turn on once. The Director cannot write presence.

**Independent test**: the DB `apps/server/test/dm/resolve.integration.test.ts` cases, plus the
unit schema, grammar, facts and write-boundary tests.

- [ ] T031 [P] [US2] Add failing schema and grammar tests (the existing schema and step-grammar
      test files under `apps/server/test/dm/`): `EffectSchema` accepts
      `{ effect: "presence", targetId, reason }` in an effect step, `onSuccess`, `onFailure` and
      `onHit`; it refuses an unknown reason and an `after` field; the rendered grammar lists the
      effect, the six reasons and the two placement rules (spec User Story 2, scenario 5).
- [ ] T032 [P] [US5] Add a failing test that walks `DirectorOutput` (`apps/server/src/dm/nodes/schemas.ts`)
      and asserts no key matches `/presence/i` (spec User Story 5, scenario 1).
- [ ] T033 [US2] Add the presence effect to `EffectSchema` in `apps/server/src/dm/nodes/schemas.ts`,
      importing the reason schema from `@the-stacks/session-model` (plan R6 decides the
      `targetId` schema). Render it in `apps/server/src/dm/prompts/step-grammar.ts` per plan D5.
      Bump the `dm.interpret` and `dm.adjudicate` prompt versions.
- [ ] T034 [US2] In `apps/server/src/dm/nodes/resolve.ts`, add the presence-effect branch per plan
      D5: submit a `scene-presence` proposal through `run.submit` as `ai:dm`, in effect order,
      recording the result as any effect does.
- [ ] T035 [US3] In `apps/server/src/dm/nodes/resolve.ts`, record the active combatant at the
      start of the turn. In the turn-advance group, skip `turn.advance` when that combatant is
      no longer in the order. Still run TASK-0112 settling and the table-mode submit.
- [ ] T036 [P] [US2] In `apps/server/test/dm/facts.test.ts`, add a failing case: a landed
      `scene-presence.changed` row yields a `presence` fact with name, value and reason, and the
      fallback line names it.
- [ ] T037 [US2] Map `scene-presence.changed` to the `presence` fact in `apps/server/src/dm/facts.ts`
      (and `apps/server/src/dm/fallback.ts` if it renders facts itself). Keep the edit additive.
- [ ] T038 [US2] In `apps/server/test/dm/resolve.integration.test.ts`, add DB cases with the fake
      gateway and scripted dice:
      - Intimidation success with `onSuccess` presence `fled` on `goblin-1`: one
        `scene-presence` submission, S1 absent (US2 scenario 1; SC-001);
      - the same check failing: no presence row, S1 present (US2 scenario 2);
      - an adjudicate ruling's effect step with a presence effect (US2 scenario 3);
      - turn mode, `goblin-1` flees on its own NPC turn: the next combatant is active once, no
        double advance, and the goblin takes no later turn across two rounds (US3 scenario 2;
        SC-003);
      - a fled active NPC followed in the order by a downed party member: settling still runs
        (plan Risks);
      - an attack on an S0-absent goblin: `action.resolved` `refused` with
        `UNKNOWN_COMBATANT`, the checkpoint verdict says `absent`, and no row of the group lands
        (US7 scenario 2; SC-005).
- [ ] T039 [US5] In `apps/server/test/dm/resolve.integration.test.ts`, assert across the existing
      Director fixtures that no submission has kind `scene-presence` (US5 scenario 2; SC-002).
      In `apps/server/test/write-boundary.test.ts`, pin that only `apps/server/src/dm/nodes/resolve.ts`
      builds a `scene-presence` proposal (US5 scenario 3).
- [ ] T040 [US2] Amend `specs/031-dm-runtime/contracts/resolve.md`: the presence effect and its
      `scene-presence` submission, the skipped second advance, and the plan gate's `absent`
      reason.
- [ ] T041 Run `pnpm ci:check`. Re-run the shipped scenario's ci case and confirm it still ends
      `ended` with a passing report (SC-006). Report the result in the commit message.

**Checkpoint**: the full suite and `pnpm ci:check` are green, and the 031 contract is amended.

## Phase 5: Wiki re-ground (runbook expected reviews)

**Goal**: The grounding wiki describes the merged behaviour, with honest re-pins.

**Independent test**: the freshness gate prints `OK`, and the spec-bridge check exits 0.

- [ ] T042 NEEDS-REVIEW `docs/wiki/actor-snapshot.md`: presence read from the log, the projection
      key rules, the extension point built. Re-pin it.
- [ ] T043 NEEDS-REVIEW `docs/wiki/dnd5e-engine.md`: the `initiative.leave` command in the handler
      list, its refusals and the active-leaver rule. Re-pin it.
- [ ] T044 NEEDS-REVIEW `docs/wiki/dm-failure-and-gates.md`: the plan gate's `absent` reason under
      `UNKNOWN_COMBATANT`, and the presence effect as a closed-list rules term. Re-pin it.
- [ ] T045 NEEDS-REVIEW `docs/wiki/session-model.md`: `scene-presence.changed` in the catalog table,
      the `scenePresence` projection, and the declare gate's `absent` reason. Add
      `packages/session-model/src/events/scene-presence.ts` to its sources. Re-pin it.
- [ ] T046 Review `docs/wiki/proposal-gate.md` (14 kinds, 12 DM kinds, the `scene-presence`
      policy) and `docs/wiki/dm-runtime.md` (the presence effect, the skipped second advance).
      Update and re-pin each note whose sources changed.
- [ ] T047 Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed. Update the
      `docs/wiki/INDEX.md` state paragraph with one sentence for scene presence.
- [ ] T048 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      (it must print `OK`). Run
      `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
      (it must exit 0).

**Checkpoint**: the wiki is fresh, and the bridge is clean.

## Dependencies

- Phase 1 → Phase 2. The planner's engine rows need `initiative.leave`.
- PR #71 merged → Phase 2 (T007). Phases 2 to 4 build on `CHARACTER_UNABLE_REASONS`,
  `checkPlan` and settling.
- Phase 2 → Phase 3. The snapshot reads the `scenePresence` projection.
- Phase 3 → Phase 4. Resolve's absent refusal needs the plan-gate reason, and both phases edit
  the plan-gate area.
- Phases 1 to 4 → Phase 5.
- Within a phase, `[P]` test tasks can be written beside the implementation. They must fail
  before it.

## Story map

| Story | Card AC | Phases |
|---|---|---|
| US1 event and kind | #1 | 2 |
| US2 presence effect | #6 | 4 |
| US3 order leave | #7 | 1, 4 |
| US4 snapshot from the log | #2 | 3 |
| US5 no Director field | #3 | 4 |
| US6 declare gate absent | #4 | 2 |
| US7 plan gate absent | #5 | 3, 4 |

## Implementation strategy

The MVP is Phases 1 and 2: presence is a logged, gated fact, and the declare gate reads it.
Phase 3 makes every prompt see it. Phase 4 gives the models the producer. No phase is a
catch-all; each ends green on its own gate.
