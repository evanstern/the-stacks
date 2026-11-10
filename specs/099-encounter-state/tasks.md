---
description: "Tasks for spec 099: encounter state machine (TASK-0274)"
---

# Tasks: Encounter state machine

**Input**: `specs/099-encounter-state/` (spec.md, plan.md, contracts/engine-surface.md)

**Tests**: required. Constitution VI requires scripted-dice tests for every engine command.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0274`. Phases 4 and 5 run DB integration
suites with `REQUIRE_DATABASE=1` on the worktree stack.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency).
- **[Story]**: US1–US6 from spec.md.

## Phase 1: Engine sides and selectors (US5 engine half, foundation for US2–US4)

**Goal**: combatants carry an optional side; the four selectors exist and are exported.

- [x] T001 [US5] Add `SideSchema`, `Side` and optional `CombatantSchema.side` in `packages/dnd5e-engine/src/schema/state.ts`; add optional `side` to `CombatantInit` in `src/schema/commands.ts`.
- [x] T002 [US5] Add the `combatant.side` command (`src/schema/commands.ts`) and the `combatant.sided` event (`src/schema/events.ts`) per `contracts/engine-surface.md`; add the `evolve` case in `src/evolve.ts`.
- [x] T003 [US5] In `src/commands/combatants.ts`, copy `side` in `handleCombatantAdd`; write `handleCombatantSide` (FR-002); register it in `src/execute.ts`.
- [x] T004 [US5] Write `src/sides.ts`: `areHostile`, `hostilesStanding`, `encounterOver`, `closeCombatFoes` (FR-003–FR-006), with the `ponytail:` comment from the contract. Export them and `Side` from `src/index.ts` (FR-009).
- [x] T005 [P] [US5] Write `packages/dnd5e-engine/test/sides.test.ts`: each selector's true and false cases, including sideless combatants, neutral, blinded, incapacitated, invisible attacker, other zone, no encounter.
- [x] T006 [P] [US5] Extend `test/commands/combatants.test.ts` (side on add; `combatant.side` with `scriptedRng([])`, `UNKNOWN_COMBATANT`, `INVALID_COMMAND`) and `test/replay.test.ts` (`combatant.sided` replays).
- [x] T007 [US5] Extend `packages/session-model/test/helpers.ts` `engineExamples()` with `combatant.sided`; raise the mechanics and catalog counts in `packages/session-model/test/catalog.test.ts` by one.

**Checkpoint**: engine coverage meta-test green; session-model tests green; `pnpm ci:check` green.

---

## Phase 2: Engine depart and stand (US2 engine half, US6, AC #5)

**Goal**: `combatant.depart` drops a combatant from the order and its zone; `stand` costs half
Speed.

- [x] T008 [US2] In `src/commands/encounter.ts`, extract `leaveEvents(state, id, reason)` from `handleInitiativeLeave` and `endEvents(state, reason)` from `handleEncounterEnd`. Both handlers keep their behaviour; the existing encounter and initiative-leave tests pass unchanged.
- [x] T009 [US2] Add the `combatant.depart` command schema and `handleCombatantDepart` (FR-007) in `src/commands/encounter.ts`; register it in `src/execute.ts`.
- [x] T010 [US6] Add the `stand` command schema and `handleStand` (FR-008) in `src/commands/move.ts`, reusing `effectiveSpeed`, `movementLeft` and `withMovement`; register it in `src/execute.ts`.
- [x] T011 [P] [US2] Write `packages/dnd5e-engine/test/commands/depart.test.ts`: placed and unplaced, active and not active, last living combatant ends the encounter, not in order but placed, neither (`INVALID_COMMAND`), unknown; parity with `initiative.leave` for each state in `test/commands/initiative-leave.test.ts`; `scriptedRng([])` everywhere.
- [x] T012 [P] [US6] Extend `packages/dnd5e-engine/test/commands/move.test.ts` with every US6 scenario, cite SRD 5.2.1 condition `prone` in the describe name.
- [x] T013 [US2] Add README bullets for `combatant.side`, `combatant.depart`, `stand` and the selectors in `packages/dnd5e-engine/README.md`.

**Checkpoint**: engine coverage meta-test green; `pnpm ci:check` green.

---

## Phase 3: Presence mapping in the gate (US2, US3 gate half)

**Goal**: a flee drops the combatant through `combatant.depart`; a hostile's surrender makes it
neutral.

- [x] T014 [US2] In `packages/session-model/src/gate/plan.ts` `scene-presence`, replace the `initiative.leave` branch with `combatant.depart` (in order or placed, FR-010); add the `yielded` branch (FR-011). Keep the `arrived` branch (FR-012).
- [x] T015 [US2] Update `packages/session-model/test/gate-plan.test.ts` "scene-presence planner": depart rows for `fled` in an encounter and for a placed combatant in free mode; a `surrendered` hostile gets `combatant.sided`; a sideless or `party` yield gets only the presence row; `arrived` unchanged.
- [x] T016 [US2] Run the server presence tests (`apps/server/test/dm/presence-effect.test.ts`, `apps/server/test/dm/reclaim.integration.test.ts`). Fix any assertion on the old leave event list; on 2026-11-09 only `gate-plan.test.ts` names `initiative.leave`.

**Checkpoint**: session-model and server unit suites green; `pnpm ci:check` green.

---

## Phase 4: Server sides, phases and resume (US1, US2 server half, AC #1)

**Goal**: every added combatant has a side; the Director resumes an ended encounter; no start
rolls for an absent or yielded monster.

- [x] T017 [US1] Add the `side` parameter to `combatantFromSrd` in `apps/server/src/dm/seed/combatants.ts`; set sides at every `combatant.add` in `apps/server/src/dm/nodes/resolve.ts` (FR-013).
- [x] T018 [US1] In `apps/server/src/dm/gates/plan-gate.ts`, add `encounterPhase`, `eligibleMonsters`, `startableEncounterIds`; make `joiningCombatants` and `arrivingNpcs` return `[]` for an `ended` encounter (FR-014–FR-016, FR-018). Update their callers.
- [x] T019 [US1] In `apps/server/src/dm/nodes/director.ts`, use `startableEncounterIds` in legality and in the prompt input; add the "no foe of the encounter can fight" override reason.
- [x] T020 [US1] In `apps/server/src/dm/prompts/director.ts`, add the `(resume)` suffix; bump `PROMPT_VERSION` to `dm.director-v12`; update the pin in `apps/server/test/dm/assemble.test.ts`.
- [x] T021 [US1] In `directorOpening` (`nodes/resolve.ts`), branch on `encounterPhase`: filter participants by eligibility; skip adds and the seed-presence group on resume; skip the roll when no monster is eligible (FR-017, FR-018).
- [x] T022 [P] [US1] Extend `apps/server/test/dm/director.test.ts` and `apps/server/test/dm/plan-gate.test.ts`: phase derivation, startable list, resume legality, dead/absent/yielded override, resume joiners empty. Extend `apps/server/test/dm/seed-stats.test.ts` for the side parameter.
- [x] T023 [US1] Write `apps/server/test/dm/encounter-resume.integration.test.ts`: start, Director `free`, then `turn` on `reed-camp`; assert one `initiative.roll` over eligible ids, no `combatant.add`, no encounter-start `scene-presence` row, turn mode set.
- [x] T024 [US2] Write `apps/server/test/dm/fled-combatant.integration.test.ts`: the lookout flees in free mode (seq 40 shape), the encounter starts without it; in a second case it flees mid-fight and the batch holds `combatant.depart`; no NPC turn for it follows (seq 161-164).

**Checkpoint**: server unit and DB integration suites green on the worktree stack; `pnpm ci:check` green.

---

## Phase 5: Code-owned end and mid-fight arrivals (US3, US4, AC #3)

**Goal**: the fight ends when no foe stands; a turn-mode arrival joins with one roll.

- [ ] T025 [US3] In `directorClosing` (`nodes/resolve.ts`), load fresh projections after the table-mode decision; apply FR-020 through `endEncounter` and `setMode`; confirm the turn advance group skips once `local.encounterActive` is false.
- [ ] T026 [US4] In `apps/server/src/dm/gates/plan-gate.ts` add `joinableMonsters`; in `nodes/director.ts` keep turn-mode arrivals in it; in `prompts/director.ts` list them in turn mode; in `arriveOne` (`nodes/resolve.ts`) follow a turn-mode add with `initiative.join` (FR-021). Make the plan gate's `joining` input include them.
- [ ] T027 [P] [US3] Write `apps/server/test/dm/encounter-auto-end.integration.test.ts`: last hostile killed; last hostile surrenders; party down with a hostile standing (no end); a sideless order (no end).
- [ ] T028 [P] [US4] Write `apps/server/test/dm/mid-fight-arrival.integration.test.ts`: `goblin-4` arrives in turn mode; one `combatant.add` with side `hostile`, one `initiative.join`, one initiative `dice.rolled`; the active combatant is unchanged.
- [ ] T029 [US4] Extend `apps/server/test/dm/director.test.ts`: turn-mode arrival of a joinable monster kept; of a non-encounter monster or an existing combatant dropped.

**Checkpoint**: server unit and DB integration suites green on the worktree stack; `pnpm ci:check` green.

---

## Phase 6: Planner rules (US5, US6 mapping, AC #4) — REPLACED, not run

**Operator ruling 2026-11-09 (OQ-1):** the close-combat rule lives in the engine. It shipped in
Phase 1: `closeCombatSources` in `src/sides.ts`, read by `attack.roll` and `spell.cast`. The planner
does not fold it; it reports the rule as a fact (TASK-0267). The `stand` mapping belongs to
TASK-0267. This phase does not run. The text below is kept for history.

**Goal**: the planner gives ranged attacks close-combat disadvantage and maps `stand`.

**Precondition**: TASK-0267 is merged. Merge `origin/main` into the branch first. If the operator
has ruled OQ-1 for the engine, do T030 in the engine instead (`src/derive.ts`
`attackModeSources` gains the state-aware close-combat source; `src/commands/attacks.ts` and
`src/commands/spells.ts` pass it) and skip the planner half of T032.

- [ ] T030 [US5] In the planner's `attack` mapping module (named in spec 097's plan), fold `disadvantage` when `closeCombatFoes` is non-empty and the attack is ranged (FR-022), using the engine's `foldMode`.
- [ ] T031 [US6] In the planner's `stand` mapping, emit the engine `stand` command (FR-023).
- [ ] T032 [P] [US5] Add planner golden tests for every US5 scenario and for the `stand` mapping, in the planner's test layout.

**Checkpoint**: planner tests green; `pnpm ci:check` green.

---

## Phase 7: Wiki re-ground

**Goal**: the corpus describes the merged code and passes the freshness gate.

- [ ] T033 Merge `origin/main` into the branch first.
- [ ] T034 Review `docs/wiki/dnd5e-engine.md` (sides, `combatant.side`, `combatant.depart`, `stand`, `leaveEvents`/`endEvents`); add `src/sides.ts` to its sources. Review `docs/wiki/dnd5e-engine-derived-rolls.md` for the close-combat rule wherever it landed.
- [ ] T035 [P] Review `docs/wiki/session-model.md` and `docs/wiki/proposal-gate.md` (presence mapping, new event type, catalog counts).
- [ ] T036 [P] Review `docs/wiki/dm-runtime.md`, `docs/wiki/dm-turn-jobs.md` and `docs/wiki/seed-npc-presence.md` (encounter phases, resume, eligibility, code-owned end, turn-mode arrivals, director-v12).
- [ ] T037 [P] Review the planner note TASK-0267 created, if Phase 6 touched the planner.
- [ ] T038 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md` for the changed notes (one TASK-0274 sentence in INDEX).
- [ ] T039 Re-pin every touched note's `verified_against` honestly; run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki` until it prints `OK`.
- [ ] T040 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .` and confirm exit 0.

**Checkpoint**: freshness `OK`; spec-bridge exit 0; `pnpm ci:check` green.

---

### Constitution Compliance (the-stacks)

Carried by the phases above:

- Scripted-dice tests cover every new engine command (VI): T006, T011, T012.
- Event type versioned (`v: 1`), visibility `any` (III): T002, T007.
- Projection tolerates the new event type (III): T007 (catalog derives it; ledger default row).
- Engine stays pure; selectors read state only (VI): T004.
- SRD 5.2.1 ids cited, no book text (XI): T004, T012.

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7.
- Phase 2 needs Phase 1's schema edits. Phase 3 needs `combatant.depart` and `combatant.side`.
  Phase 4 needs sides on combatants. Phase 5 needs `encounterOver` and the Phase 4 helpers.
- Phase 6 needs TASK-0267 merged. If it is not, hold after Phase 5 and tell the orchestrator.
- Within a phase, `[P]` tasks touch different files.

## Implementation Strategy

Phase 2 satisfies AC #5. Phases 2-4 satisfy AC #2. Phase 4 satisfies AC #1. Phase 5 satisfies
AC #3 and R1 exit 6 "end". Phase 6 satisfies AC #4. Phase 7 makes the task done. One PR carries
all seven phases.
