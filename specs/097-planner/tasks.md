---
description: "Tasks for spec 097: deterministic planner (TASK-0267)"
---

# Tasks: Deterministic planner

**Input**: `specs/097-planner/` (spec.md, plan.md, contracts/planner.md)

**Tests**: required. Constitution II requires a planner test per outcome for each kind.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0267`. No file under `apps/` changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency).
- **[Story]**: US1–US3 from spec.md.

## Phase 1: Package skeleton, types, boundary and kind table (AC #1)

**Goal**: `@the-stacks/planner` exists, is pure, is boundary-checked, and refuses every kind it
does not serve.

- [x] T001 Create `packages/planner/{package.json,tsconfig.json,vitest.config.ts,README.md}` per plan "Source Code". Runtime deps: `@the-stacks/intent`, `@the-stacks/space`, `@the-stacks/dnd5e-engine` (`workspace:*`), `zod` `^4.6.5`.
- [x] T002 Add `packages/planner` and `packages/planner/test` to root `tsconfig.json` references. Run `pnpm install` to update `pnpm-lock.yaml`.
- [x] T003 Add `isUnable` to the `./commands/attacks.js` export line in `packages/dnd5e-engine/src/index.ts`.
- [x] T004 Write `packages/planner/src/types.ts`: the types and Zod schemas of contract §2–§5 (`PlanStateSchema`, `PlanFactSchema`, `RulingRequestSchema`, `PlannedCommand`, `PlanRefusal`, `PlanResult`, `StepOutcome`).
- [x] T005 Write `packages/planner/src/kinds.ts`: `PLAN_KINDS` per spec "Served kinds", with an `owner` card id per unserved kind (`dodge`→`"spec-097-OQ-3"` until the orchestrator cards it, then that card id; `ready`/`react`/`roll`/`request_roll`→`"TASK-0276"`, `delay`→`"Q5"`, resource gaps→`"N-17"`, `concentration_drop`→`"TASK-0227"`, `level_choice`→`"N-18"`, not-planned→`"gate"`).
- [x] T006 Write `packages/planner/src/outcome.ts` (`stepOutcome`, FR-006) and `src/plan.ts`: dispatch on `intent.kind`; refuse `KIND_UNSERVED` from `PLAN_KINDS`; the reason helper of FR-004. Served kinds return `KIND_UNSERVED` until later phases fill them.
- [x] T007 Write `packages/planner/src/refs.ts`: actor and target resolution (FR-009–FR-012), the able-actor check via `isUnable`, pull-in commands, `hostilesStanding`.
- [x] T008 Write `packages/planner/src/index.ts` with the FR-037 exports only.
- [x] T009 Add the `biome.json` override per plan "Boundary override". Add `fixtures/boundary-violations/packages/planner/src/{bad-app,bad-session-model,bad-clock,bad-model}.ts`, one violation each.
- [x] T010 [P] Write `packages/planner/test/tsconfig.json`, `test/fixtures.ts` (PlanState builders: a three-zone space A–B–C, Thorin and Kestrel `party`, goblin-2 and Snag `hostile`, a cleric caster, an NPC init) and `test/purity.test.ts` (import allowlist, modelled on `packages/dnd5e-engine/test/purity.test.ts`).
- [x] T011 [P] Write `packages/planner/test/kinds.test.ts`: every `INTENT_KINDS` entry has a `PLAN_KINDS` row; each Unserved and Not-planned kind refuses `KIND_UNSERVED` with its owner; `refs.ts` cases for `UNKNOWN_COMBATANT`, `ACTOR_UNABLE`, `TARGET_NOT_PRESENT`, `TARGET_UNSEEN`, pull-in.

**Checkpoint**: `pnpm check:boundaries` flags the four fixtures. `pnpm ci:check` green.

## Phase 2: Checks and the ruling loop (US2, AC #2)

**Goal**: checks, saves, contests, search and hide plan or ask; rulings replan.

- [ ] T012 [US2] Write `packages/planner/src/checks.ts`: `check`, `save` (FR-013, FR-014), `contest` (FR-015), `search` (FR-016), `hide` (FR-017), with house rules, mode and `STAT_UNDEFINED` (FR-018).
- [ ] T013 [US2] Write `packages/planner/src/rulings.ts`: `attempt`, `use_object` (FR-033); `ruling` accept, reject, amend (FR-034); `set_dc` (FR-035); re-ask keys (FR-036). Wire both modules into `plan.ts`.
- [ ] T014 [P] [US2] Write `packages/planner/test/checks.test.ts`: a golden result per kind and outcome: tier from an `npc`, player DC ignored with fact `ignored`, `influence` and `unarmed-strike` contests, contest with no covering rule, search ask, hide at `medium`, `STAT_UNDEFINED`.
- [ ] T015 [P] [US2] Write `packages/planner/test/rulings.test.ts`: both asks; accept with tier, accept with `dc` from `dm`, accept on `outcome` (`no-roll`), reject, amend to `contest`, amend to `attempt` (new request id), `set_dc`, `REQUEST_NOT_OPEN`, re-ask on a tierless accept.

**Checkpoint**: US2 scenarios 1–4 pass. `pnpm ci:check` green.

## Phase 3: Combat actions (US1, AC #2)

**Goal**: attack, cast, help, grapple and shove plan engine commands.

- [ ] T016 [US1] Write `packages/planner/src/combat.ts`: `attack` (FR-019, reach and range with `bandBetween`, `reachCovers`, `rangeOf`; fact `reach`), `cast` (FR-020, port of `spellGap`; `ponytail:` comment for OQ-9), `help` (FR-021), `grapple` (FR-022), `shove` (FR-023, FR-024). Wire into `plan.ts`.
- [ ] T017 [P] [US1] Write `packages/planner/test/combat.test.ts`: golden lists for melee hit/crit guards, ranged normal and long, `OUT_OF_REACH`, `OUT_OF_RANGE`, unplaced skip, `STAT_UNDEFINED` (no entry; `unarmed` per OQ-12); each of the six engine spells; `SPELL_UNKNOWN`, `SPELL_NOT_PREPARED`, `SPELL_UNRESOLVED` (bad slot, zone target, two targets); help both assists; grapple save choice; shove prone; shove push `KIND_UNSERVED`.

**Checkpoint**: US1 scenarios 1, 2 and 4 pass. `pnpm ci:check` green.

## Phase 4: Movement, turn, resources and DM control (US1, US3, AC #2)

**Goal**: every remaining served kind plans.

- [ ] T018 [US1] Write `packages/planner/src/movement.ts`: `move` (FR-025 probe with `execute` and `scriptedRng([])`; FR-026 reactions from `provokers` filtered by side; `NO_MOVEMENT_LEFT`; squares `KIND_UNSERVED`), `dash`, `disengage`, `stand`, `drop_prone`, `end_turn` (FR-027).
- [ ] T019 [US1] Write `packages/planner/src/resources.ts`: `rest_short`, `rest_long`, `roll_free` (FR-028).
- [ ] T020 [US3] Write `packages/planner/src/dm.ts`: `apply_damage`, `apply_heal`, `apply_condition` (FR-029), `start_combat`, `end_combat` (FR-030), `add_combatant`, `move_token` (FR-031), the `ai:dm` seat rules (FR-032). Wire all three modules into `plan.ts`.
- [ ] T021 [P] [US1] Write `packages/planner/test/movement.test.ts`: move with no reactor, with one hostile reactor (reaction attack and guarded damage before `move`), disengaged (none), a party ally in the zone (none), engine pass-through `MOVE_BLOCKED` and `MOVE_OVER_SPEED`, `NO_MOVEMENT_LEFT`, free-mode move; dash, disengage, stand, drop_prone, end_turn.
- [ ] T022 [P] [US3] Write `packages/planner/test/dm.test.ts`: each DM kind from `dm`; `temp` heal; exhaustion adjust; start_combat with and without targets; add_combatant with count 2, zone and encounter join; move_token; `DM_SEAT_REQUIRED` cases from `ai:dm`; and `rest_short`, `rest_long`, `roll_free` goldens.

**Checkpoint**: every served kind has a golden test. `pnpm ci:check` green.

## Phase 5: Legality, coverage and determinism (US3, AC #2, AC #3)

**Goal**: the card's legality criteria and coverage gates hold.

- [ ] T023 [US3] Write `packages/planner/test/legality.test.ts`. TASK-0145 #1: run 183818Z seq 260-265 as Intents (Snag standing → `end_combat` from `ai:dm` refused; Snag `yielded` → `encounter.end`). TASK-0147 #1: M2 seq 296-301 (`ai:dm` `apply_condition` on a party actor refused; Kestrel's intimidation `contest` plans an `influence` roll against goblin-2). TASK-0147 #2: a willing ally's healing spell and help assist plan with no roll against the ally. TASK-0147 #3: M2 seq 304 "I grab the clapper" as `attempt` → ask `outcome` → accept → `no-roll`. TASK-0147 #4: the formulation-3 invariant over every served player-seat fixture, and `text` changes nothing. Cite the evidence paths in comments (`specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/`, `docs/design/m2-demo/demo-session/transcript.jsonl`).
- [ ] T024 [P] Write `packages/planner/test/refusals.test.ts`: a table of every contract §6 planner-source code and every listed engine-source code to one golden case; the test fails when a code has no case.
- [ ] T025 [P] Write `packages/planner/test/determinism.test.ts`: for every valid fixture in `@the-stacks/intent/fixtures`, plan twice against one `PlanState` and assert deep-equal; plan with `text` changed and assert deep-equal; assert each call under 5 ms on a 64-zone space (single warm-up, median of 20).

**Checkpoint**: SC-001–SC-006 hold. `pnpm ci:check` green.

## Phase 6: Wiki re-ground

**Goal**: the corpus describes the planner and passes the freshness gate.

- [ ] T026 Merge `origin/main` into the branch first, so wiki edits land on the current notes.
- [ ] T027 Write a new note `docs/wiki/planner.md`: the contract, `PlanState`, the served-kind table, guarded commands and the execution rule, facts and the spec 098 seam, ruling requests and adjudication, the seat rules, the boundary. Sources: `packages/planner/**` files used. Record OQ-1 (the `PlanState` delta from target-architecture §2).
- [ ] T028 [P] Review `docs/wiki/intent-contract.md` (who raises the planner codes), `docs/wiki/space.md` (planner as a consumer), `docs/wiki/dnd5e-engine.md` (`isUnable` export), `docs/wiki/dm-plan-gate.md` (which checks the planner ports; resolve and plan-gate unchanged until TASK-0269), `docs/wiki/monorepo-and-toolchain.md` (new package, references, boundary override) and `docs/wiki/overview.md` (one sentence for TASK-0267).
- [ ] T029 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md` for the new `planner` note and the changed notes.
- [ ] T030 Re-pin every touched note's `verified_against` honestly. Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki` until it prints `OK`.

**Checkpoint**: freshness `OK`; spec-bridge check exits 0; `pnpm ci:check` green.

## Constitution Compliance (the-stacks)

- Planner-outcome tests per kind (Principle II): T011, T014, T015, T017, T021, T022.
- Agent-facing Intents exercised by tests (Principle I): the `ai:dm` and `companion` actors in T015, T022, T023.
- Cross-plane boundary check for the new package (Principle IV): T009.
- No engine command changes, so no new scripted-dice test is owed (Principle VI). T003 is an export only.
- Plan-time bound (Principle IX): T025.

## Dependencies & Execution Order

- Phase 1 blocks every later phase.
- Phases 2, 3 and 4 each edit `plan.ts` wiring; run them in order.
- Phase 5 needs phases 2–4. Phase 6 runs last.
