---
description: "Task list for turn-mode floor passing between players (TASK-0050, decision-0016 turn-mode row, TASK-0049 ruling Q5)"
---

# Tasks: Turn-mode floor passing between players

**Input**: `specs/049-turn-floor/` (spec.md, plan.md, research.md, data-model.md, contracts/,
quickstart.md). The operator rulings of 2026-10-27 (FT-1 to FT-5, Q1 to Q6, all recommended
defaults) are quoted in spec.md "Operator rulings".

**Tests**: required. Each card AC is proven by a named test (spec.md "AC mapping").

**Dispatch unit**: each phase is one implementer dispatch (sonnet). Run the phases in order:
1, 2, 3, 4, 5, 6, 7.
- Phases 1 and 2 both edit `packages/session-model/src/gate/plan.ts` and `proposals.ts`. Never
  run them in parallel.
- Phases 3, 4 and 5 run the DB suites and edit `apps/server/src/dm/`. Never run them in parallel.
- Phase 6 needs Phases 1 and 2 only. It still runs after Phase 5 (serial sweep lane).

**Gate for every code phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`.
- Phases 3, 4 and 5 also run the DB suites.
- Phases 5 and 6 also run `pnpm ci:check`.

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
- Follow spec.md, plan.md and the contracts exactly. A needed deviation is a STOP: report it.
- Add only what plan.md names: the proposal kind `floor`, the `action.commit` field
  `override: "stall"`, the refusal codes `FLOOR_NOT_HELD`, `TURN_MOVED`, `NOT_TURN_MODE`, the
  job kind `floor`, migration `0007`. Add no event type, ws frame, engine command or dependency.
- Edit frozen contract text only where a task below names it. Each such edit carries the line
  "Amended 2026-10-27 (TASK-0050, operator ruling <item>)" and quotes the operator: "TASK-0050:
  I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the frozen-contract
  amendments to 029, 031 and 044 and the one jobs migration."
- Tests use the fake gateway and scripted dice. No paid run.
- UI: no modals and no confirmation dialogs. Use inline controls or slide-out panels. Browser
  automation uses Brave.
- Never use the backlog MCP tools. Touch no file under `backlog/`.
- No "for now" without a card (decision-0020). Report any deferral as an open question.

**Commits**: one or more per phase. Each message starts with `TASK-0050:` and ends with the
Co-Authored-By trailer. Stage and commit in separate Bash calls with
`git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0050`. Push after each phase.

## Phase 1: Turn rules and the `floor` kind (card AC #1, #3, #5; User Stories 1, 2, 3 gate half)

**Goal**: The pure gate plans End turn, Pass, Take floor and Return floor as atomic batches, with
one shared settling rule and one `activeActorFor`.

**Independent test**: `pnpm --filter @the-stacks/session-model test`. The new cases fail before
T004 to T008 and pass after them.

- [x] T001 [P] [US2] Write `packages/session-model/test/gate-turn.test.ts`: `activeActorFor`
      (player, companion, monster), `canAct`, `nextSettleStep` (dying → `death-save.roll`;
      stable, dead or unable → `turn.advance`; able → null), `floorHeld`, `currentTurn`
      (research R1, R2, R6).
- [x] T002 [P] [US2] Extend `packages/session-model/test/gate-plan.test.ts` with a two-human,
      one-companion, one-monster projection: `end` by the active human plans one mechanics
      batch then a `table-mode.changed` naming the next holder; `end` with a dying next
      combatant includes `death-save.roll` (scripted dice: a fail, then a natural 20); each
      refusal in research R5 order (`NOT_TURN_MODE`, `TURN_MOVED`, `FLOOR_NOT_HELD`,
      `INVALID_PROPOSAL` for take-while-held and return-while-not-held, `NOT_AUTHORIZED` for an
      `ai:dm` end on a present human); `ai:dm` end on an absent human prepends a `floor` marker
      with `PlanContext.present`; `take` and `return` rows; a refusal plans no rows.
- [x] T003 [P] [US1] Extend `packages/session-model/test/gate-authority.test.ts`: in turn mode
      with two humans, the active human commits `active-player`, the other human is
      `COMMIT_NOT_ALLOWED`; while the DM holds the floor, both humans are `COMMIT_NOT_ALLOWED`
      and the DM is `dm` (FR-001, FR-002).
- [x] T004 [US2] Create `packages/session-model/src/gate/turn.ts` with `activeActorFor`,
      `canAct` (with the `INCAPACITATING` list), `nextSettleStep`, `floorHeld`, `currentTurn`.
      Export them from `packages/session-model/src/index.ts`. Do not change server code yet.
- [x] T005 [US2] In `packages/session-model/src/gate/proposals.ts` add the `floor` schema
      (data-model.md); kinds 14 → 15, DM kinds 12 → 13, `GATE_REQUEST_KINDS` 18 → 19; fix the
      counting comments. Extend `packages/session-model/test/gate-schemas.test.ts`.
- [x] T006 [US3] In `packages/session-model/src/gate/permissions.ts` add the `floor` matrix from
      `contracts/floor-request.md`; in `src/gate/policy.ts` add `floor: "ask"`; in
      `src/gate/refusals.ts` add `FLOOR_NOT_HELD`, `TURN_MOVED`, `NOT_TURN_MODE`. Extend
      `test/gate-permissions.test.ts` and `test/gate-policy.test.ts`.
- [x] T007 [US2] In `packages/session-model/src/gate/plan.ts` add `case "floor"` per research R3
      to R5: the checks in order, `execute` + `evolve` for `turn.advance` and each
      `nextSettleStep` (at most one lap), one `mechanicsRows` batch, the `table-mode.changed`
      row with `reason` from the proposal, the `ai:dm` `floor` marker first.
- [x] T008 [US3] Amend `specs/029-proposal-gate/contracts/proposals.md` (the `floor` kind,
      counts), `policy-and-authority.md` (the permission rows and `floor: "ask"`) and
      `gate-api.md` (rows-table rows for the three ops, §2 codes) with the amendment line
      (FT-1, FT-2).

**Checkpoint**: the session-model suite is green; the server still compiles against the
unchanged resolve.

## Phase 2: Stall override and the `turn-floor` fixture (TASK-0049 Q5 gate half; card AC #6 fixture)

**Goal**: `ai:dm` can commit a stalled party action with a `signoff` marker, and one fixture walks
the whole floor.

**Independent test**: `pnpm --filter @the-stacks/session-model test`, including the replay check
over the new fixture.

- [x] T009 [P] [US4] Extend `packages/session-model/test/gate-plan.test.ts`: `action.commit` with
      `override: "stall"` from `ai:dm` plans `[presence.recorded(signoff), action.committed(dm)]`;
      from a human, on a character action, or with one party human → `INVALID_PROPOSAL`; with a
      quorum member objecting → `GROUP_SIGNOFF_REQUIRED` with `objecting`; a plain `dm` commit
      still writes no marker (research R11).
- [x] T010 [US4] In `packages/session-model/src/gate/proposals.ts` add `override:
      z.literal("stall").optional()` to `action.commit`; in `src/gate/plan.ts` add the override
      branch (research R11).
- [x] T011 [US2] Create `packages/session-model/src/fixtures/turn-floor.ts` (`turnFloor`) with the
      steps in `contracts/floor-request.md` "Fixture"; register it in
      `packages/session-model/src/fixtures/index.ts`. Extend `test/fixtures.test.ts`.
- [x] T012 [US4] Extend the SC-006 replay check in `packages/session-model/test/gate-authority.test.ts`
      per `contracts/floor-request.md` "Replay check" (stall commits and `floor`-marker batches).
- [x] T013 [US4] Amend `specs/029-proposal-gate/contracts/fixtures.md` (the `turn-floor` row and
      the replay additions; FT-4), `proposals.md` and `gate-api.md` (the stall override and the
      exception to "a `dm` commit writes no marker"; FT-5), and add a note to
      `specs/044-group-signoff/contracts/signoff.md` pointing at spec 049's stall override.

**Checkpoint**: the session-model suite is green, the replay check covers `turn-floor`.

## Phase 3: Server wiring — resolve guard, shared rules, follow-ups (card AC #3, #5; User Stories 2, 3)

**Goal**: End turn and Pass work end to end through `createGate`; resolve never advances a turn
that already moved; a human's floor row queues the AI follow-up once.

**Independent test**: `REQUIRE_DATABASE=1 pnpm --filter server test -- gate.floor resolve`.

- [x] T014 [P] [US2] Write `apps/server/test/gate.floor.integration.test.ts` (DB, two human seats
      and a seated human DM): End turn by the active human lands one batch; the other human is
      refused `FLOOR_NOT_HELD` with the log unchanged; a stale `turn` is `TURN_MOVED`; Pass, Take
      floor, Return floor by the DM; a player commit while held is `COMMIT_NOT_ALLOWED`; every
      subscriber receives the `table-mode.changed` row.
- [x] T015 [US2] Make `apps/server/src/dm/nodes/resolve.ts` and `apps/server/src/dm/nodes/settle.ts`
      import `activeActorFor`, `canAct` and `nextSettleStep` from `@the-stacks/session-model`;
      delete the local copies. Keep settle's checkpoint keys. The spec 046 settle tests stay green.
- [x] T016 [US2] In `apps/server/src/dm/nodes/resolve.ts` extend spec 048's `activeAtStart` to a
      turn `{ round, activeCombatantId }` and add the `moved` and `held` skips to the turn-advance
      group (research R7, `contracts/floor-jobs.md` "Resolve").
- [x] T017 [P] [US2] Extend `apps/server/test/dm/resolve.integration.test.ts`: End turn lands
      while a turn job resolves the same action → exactly one `turn.advance` for that turn; a held
      floor → no advance; spec 048's fled-active case is unchanged.
- [x] T018 [US2] In `apps/server/src/dm/enqueue.ts` queue the follow-up for a turn-mode
      `table-mode.changed` row whose actor is a human: `ai:dm` → `enqueueTurn("npc-turn")`;
      `ai:companion:<id>` → companion job reason `turn` (research R8).
- [x] T019 [P] [US2] Test T018 in `apps/server/test/dm/jobs.integration.test.ts` (or a new
      `apps/server/test/dm/enqueue-floor.integration.test.ts`): a human row queues one follow-up;
      an `ai:dm` row (resolve's) queues none.
- [x] T020 [US3] Confirm `apps/server/src/gate/gate.ts` fills `PlanContext.present` for `floor` and
      `action.commit`; change it only if it does not.
- [x] T021 [US2] Amend `specs/031-dm-runtime/contracts/resolve.md` (the one "turn moved" guard,
      shared rules) and the `turn-jobs.md` enqueue table (the human-row follow-up) with the
      amendment line (FT-1, FT-3, Q6).

**Checkpoint**: server suites green on the worktree stack.

## Phase 4: Full round with two humans and one AI companion (card AC #6)

**Goal**: The runbook merge condition: a DB test with two human seats proves floor passing
through the gate on the task's own stack.

**Independent test**: `REQUIRE_DATABASE=1 pnpm --filter server test -- turn-floor-round`.

- [x] T022 [US2] Write `apps/server/test/dm/turn-floor-round.integration.test.ts`, using
      `apps/server/test/dm/worker-world.ts` and the fake gateway: order Ana (human), Bram (human),
      Pip (AI companion), goblin. Ana ends her turn; Bram declares, commits, and the turn job
      resolves and advances; Pip's companion `turn` job acts; the goblin's `npc-turn` acts. Assert
      the `table-mode.changed` holders Ana → Bram → Pip → `ai:dm` → Ana and `encounter.round` 2
      (FR-024, SC-001).
- [x] T023 [US1] In the same file, assert AC #1 and #2 on the live stack: Bram's commit during
      Ana's turn is `COMMIT_NOT_ALLOWED`; Bram's comment on Ana's action lands for both viewers.
- [x] T024 [US2] Add the scripted fake-gateway steps the round needs under
      `apps/server/test/dm/scripts/` (or the helper the worker tests already use). Bump no
      prompt version.

**Checkpoint**: the round test is green twice in a row.

## Phase 5: The `floor` job kind and migration (TASK-0049 Q5; decision-0024 absent wait; User Story 4)

**Goal**: Under an AI seat, the AI DM passes an absent human's turn after 30 s and commits an
unopposed stalled party action after 120 s, in code, with the present set logged.

**Independent test**: `REQUIRE_DATABASE=1 pnpm --filter server test -- floor-jobs jobs`.

- [x] T025 [US4] In `apps/server/src/schema/jobs.ts` add `floor` to `jobs_kind_valid` and the
      session-required CHECK, add `floor` to `jobs_session_running_key`, and add
      `jobs_floor_queued_key` (research R13). Run `pnpm --filter server db:generate` to create
      `apps/server/drizzle/0007_*.sql`. Never hand-edit `meta/_journal.json`. Migrate the
      worktree databases.
- [x] T026 [US4] In `apps/server/src/dm/jobs.ts` add `FloorJobInput`, `FloorJobResult`, the kind
      priority (turn 1, floor 2, companion 3, chronicle 4), the `notBefore` claim filter for
      `floor`, `enqueueFloorCheck` (insert, or move `notBefore` and `stanceSeq`),
      `cancelFloorCheck`, the constants `FLOOR_ABSENCE_WAIT_MS` 30 000 and
      `FLOOR_STALL_WINDOW_MS` 120 000, and floor reconcile (`contracts/floor-jobs.md`).
- [x] T027 [US4] Create `apps/server/src/dm/floor.ts` with `runFloorJob(deps, job)` per
      `contracts/floor-jobs.md` "The run". It makes no model call and writes only through
      `gate.submit` as `ai:dm`.
- [x] T028 [US4] Dispatch `floor` jobs in `apps/server/src/dm/worker.ts`; run floor reconcile at
      worker start.
- [x] T029 [US4] Arm the waits in `apps/server/src/dm/enqueue.ts` (rows in
      `contracts/floor-jobs.md` "Enqueue table additions") and subscribe
      `presence.reader.onChange` in `apps/server/src/index.ts`. Make both waits injectable.
- [x] T030 [US4] Add a case to `apps/server/test/write-boundary.test.ts`: only `dm/floor.ts` builds
      a `floor` proposal or a `stall` override under `apps/server/src`.
- [x] T031 [P] [US4] Write `apps/server/test/dm/floor-jobs.integration.test.ts` with an injected
      clock and presence reader: absent active human passed after the wait with a `floor`
      marker; a return inside the wait → `noop`; a present human never passed; stall commit with
      a `signoff` marker; an objection → no commit; a stance change restarts the window; a human
      seat → `skipped`; reconcile re-arms after a restart (spec US 4; FR-013 to FR-018, FR-025).
- [x] T032 [P] [US4] Extend `apps/server/test/dm/jobs.integration.test.ts`: claim priority, one
      queued `floor` per `(session, check, actionId)`, serialisation with `turn`/`companion`.
- [x] T033 [US4] Amend `specs/031-dm-runtime/contracts/turn-jobs.md` (kinds table, enqueue
      additions, reconcile, constants) with the amendment line (FT-3).

**Checkpoint**: server suites and `pnpm ci:check` green on the worktree stack.

## Phase 6: Play route (card AC #2, #4, #5 UI; User Stories 1, 3, 5)

**Goal**: Every viewer sees whose turn it is and who is next; the active player ends a turn and
the DM passes, takes and returns the floor in one click; no modal.

**Independent test**: `pnpm --filter web test`; `apps/web/test/no-dialog.test.mjs` stays green;
`play/fixtures` → `turn-floor` renders in Brave.

- [ ] T034 [P] [US5] Extend `apps/web/test/play/view-model.test.mjs`: `ModeView.held`, `order`
      (active, next, you), `FloorControls` per viewer, `floor` transcript items, card
      `commitsOnOwnTurn` and `suggest` (data-model.md "View model").
- [ ] T035 [US5] Implement them in `apps/web/app/play/view-model.ts`, using `activeActorFor`,
      `floorHeld` and `currentTurn` from `@the-stacks/session-model`.
- [ ] T036 [US3] Add `floorFrame` to `apps/web/app/play/frames.ts`, `floor(input)` to
      `TableSource` in `apps/web/app/play/source.ts`, the live path in `use-live-table.ts`, the
      fixture path (`localEventOf`) in `use-fixture-table.ts` or `local-log.ts`, refusal labels in
      `labels.ts`, and `case "floor"` in `proposals.ts`. Extend `apps/web/test/play/frames.test.mjs`
      and `proposals.test.mjs`.
- [ ] T037 [US5] Add the header controls to `apps/web/app/play/components/table-header.tsx`, the held
      text to `components/mode-badge.tsx`, new `components/turn-order.tsx`, the floor line to
      `components/transcript.tsx`, and wire them in `table-view.tsx` (`contracts/ui-floor.md`).
- [ ] T038 [US1] In `apps/web/app/play/components/action-card.tsx` show "Commits on your turn" and
      the "Suggest an alternative" label (FR-003, FR-004).
- [ ] T039 [P] [US5] Component tests: `apps/web/test/play/mode-badge.test.tsx`,
      `action-card.test.tsx`, `table-view.test.tsx`, new `turn-order.test.tsx` (End turn sends
      one `floor` request with the current `turn`; DM controls; no dialog element).
- [ ] T040 [US5] List `turn-floor` on the operator fixture route. Take Brave screenshots of the
      fixture at an active-player step and a held-floor step, light and dark, under
      `specs/049-turn-floor/evidence/`.
- [ ] T041 [US5] Amend `specs/030-play-route/contracts/ui-surfaces.md` with the floor surfaces
      (additive; Q1, Q2).

**Checkpoint**: web suite and `pnpm ci:check` green.

## Phase 7: Wiki re-ground (runbook expected reviews)

**Goal**: The grounding wiki describes the merged behaviour, with honest re-pins.

**Independent test**: the freshness gate prints `OK`, and the spec-bridge check exits 0.

- [ ] T042 NEEDS-REVIEW `docs/wiki/proposal-gate.md`: the `floor` kind (15 kinds, 13 DM kinds, 19
      request kinds), its permission, policy, refusal codes and batch; the stall override and its
      `signoff` marker; `floor` no longer reserved. Add `packages/session-model/src/gate/turn.ts`
      to its sources. Re-pin it.
- [ ] T043 NEEDS-REVIEW `docs/wiki/session-model.md`: the turn rules in the gate core, the
      `turn-floor` fixture (ten fixtures), the `floor` marker purpose now written. Add
      `src/gate/turn.ts` and `src/fixtures/turn-floor.ts` to its sources. Re-pin it.
- [ ] T044 NEEDS-REVIEW `docs/wiki/play-route.md`: the header floor controls, the turn-order strip,
      transcript floor lines, the card text and the suggestion label. Add the new component to its
      sources. Re-pin it.
- [ ] T045 Review `docs/wiki/dm-turn-jobs.md` (the `floor` kind, priority, arming, reconcile, the
      human-row follow-up), `docs/wiki/dm-runtime.md` (the "turn moved" guard, shared rules),
      `docs/wiki/presence.md` (the `floor` marker and the absence wait; `onChange` consumer),
      `docs/wiki/database-schema.md` and `docs/wiki/migrations.md` (migration 0007), and
      `docs/wiki/websocket-gateway.md` (19 request kinds). Update and re-pin each note whose
      sources changed.
- [ ] T046 Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed. Update the
      `docs/wiki/INDEX.md` state paragraph with one sentence for turn-mode floor passing.
- [ ] T047 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      (it must print `OK`). Run
      `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
      (it must exit 0).

**Checkpoint**: the wiki is fresh, and the bridge is clean.

## Dependencies

- Phase 1 → Phase 2: both edit `plan.ts` and `proposals.ts`; the fixture uses the `floor` kind.
- Phases 1, 2 → Phase 3: the server imports the turn rules and plans `floor`.
- Phase 3 → Phase 4: the round needs the follow-ups and the resolve guard.
- Phase 3 → Phase 5: the floor job reuses the follow-up rule and the enqueuer.
- Phases 1, 2 → Phase 6: the web uses the pure rules, the schema and the fixture.
- Phases 1 to 6 → Phase 7.
- Within a phase, `[P]` test tasks can be written beside the implementation. They must fail
  before it.

## Story map

| Story | Card AC | Phases |
|---|---|---|
| US1 only the active player commits; others suggest | #1, #2 | 1, 4, 6 |
| US2 ending a turn passes in order | #3, #6 | 1, 2, 3, 4 |
| US3 the DM passes or reclaims | #5 | 1, 3, 6 |
| US4 the AI DM does not wait forever | TASK-0049 Q5; decision-0024 | 2, 5 |
| US5 every viewer sees whose turn | #4 | 6 |

## Implementation strategy

The MVP is Phases 1 to 4: the floor passes between two humans and an AI companion through the
gate, proven by the merge-condition round test. Phase 5 removes the AI DM's stalls. Phase 6
makes the floor visible and one click away. No phase is a catch-all; each ends green on its own
gate.
