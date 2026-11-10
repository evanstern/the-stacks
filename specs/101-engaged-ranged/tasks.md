---
description: "Tasks for spec 101: engaged-only ranged penalty (TASK-0306)"
---

# Tasks: Engaged-only ranged penalty

**Input**: `specs/101-engaged-ranged/` (spec.md, plan.md)

**Tests**: required. Constitution VI requires scripted-dice tests for every changed engine
command.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0306`. Phase 2 runs DB suites with
`REQUIRE_DATABASE=1` on the worktree stack.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency).
- **[Story]**: US1–US3 from spec.md.

## Phase 1: Engine melee pairs (US1, US2, US3)

**Goal**: the engine records melee pairs and the close-combat rule reads them, not zones.

- [x] T001 [US2] Add optional `melee` (sorted id pairs, distinct ids) to `EncounterSchema` in `packages/dnd5e-engine/src/schema/state.ts` (FR-001).
- [x] T002 [US1] In `packages/dnd5e-engine/src/sides.ts`, add `meleeFoes`, `withMeleePair`, `withoutMelee` and `meleePairFor` per plan.md; make `closeCombatFoes` read `meleeFoes` instead of zones and replace its `ponytail:` comment (FR-002, FR-003, FR-007). Export `meleeFoes` from `src/index.ts` (FR-012).
- [x] T003 [US2] In `src/commands/attacks.ts` `handleAttackRoll`, add the pair for a melee use; merge with the reaction's `encounter.changed`; emit nothing for an existing pair (FR-004).
- [x] T004 [US2] In `src/commands/spells.ts`, add the pair for a `range: "melee"` spell attack (FR-005).
- [x] T005 [US3] In `src/commands/move.ts`, drop pairs in `handleMove`'s `encounter.changed` and in `handleCombatantPlace` during an encounter (FR-006). Leave `provokers` unchanged (FR-010).
- [x] T006 [US3] In `src/commands/encounter.ts` `leaveEvents`, drop the leaver's pairs (FR-008).
- [x] T007 [P] [US1] Write `packages/dnd5e-engine/test/commands/melee.test.ts`: every US1–US3 scenario on the reed-camp fixture, with `scriptedRng`, the asserted mode and the draw count. Cite SRD 5.2.1 `playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat` in the describe name.
- [x] T008 [P] [US1] Update `test/sides.test.ts` (`meleeFoes`; same zone without a pair is `[]`), the spec 099 close-combat blocks in `test/commands/attacks.test.ts` and `test/commands/spells.test.ts` (seed a pair; add the no-pair case), and any engine test whose exact event list gains the new `encounter.changed`.
- [x] T009 [US1] Update the close-combat bullet in `packages/dnd5e-engine/README.md`.

**Checkpoint**: engine suite and coverage meta-test green; `provokers` tests unchanged; `pnpm ci:check` green.

---

## Phase 2: Planner fact and server tests (US1 server half, FR-011, FR-013)

**Goal**: the planner fact reports pairs; the reed-camp DB tests draw one d20.

- [x] T010 [US1] In `packages/planner/src/combat.ts`, update the `closeCombatFact` comment to cite spec 101. No code change (FR-011).
- [x] T011 [US1] In `packages/planner/test/combat.test.ts` "close-combat fact", seed a melee pair in the engine state for the positive cases; add a same-zone, no-pair case that reports no fact.
- [x] T012 [US1] Revert the dice in `apps/server/test/dm/derived-numbers.integration.test.ts` to `[...INIT, 15, 4]` and in `apps/server/test/dm/revealed-npc.integration.test.ts` drop the duplicated `s.dice[1]` and its comment (FR-013).
- [x] T013 [US2] Run the server and session-model suites with `REQUIRE_DATABASE=1`. Fix only exact `encounter.changed` payload assertions that now carry `melee` (candidates in plan.md). Report any other failure.

**Checkpoint**: planner, session-model and server suites green under `REQUIRE_DATABASE=1`; `pnpm ci:check` green.

---

## Phase 3: Wiki re-ground

**Goal**: the corpus describes melee pairs and is re-pinned honestly.

- [ ] T014 Review (NEEDS-REVIEW) and update `docs/wiki/dnd5e-engine-sides.md` (melee pairs, `meleeFoes`, the new close-combat rule, the OA divergence) and `docs/wiki/dnd5e-engine-derived-rolls.md` (the close-combat mode source).
- [ ] T015 Review `docs/wiki/dnd5e-engine-reactions.md` (a reaction attack forms a pair in the same `encounter.changed`), `docs/wiki/dnd5e-engine.md` (encounter state field), `docs/wiki/space.md` (band `engaged` is distinct from a melee pair; `move` drops pairs) and `docs/wiki/planner.md` (the fact reports pairs).
- [ ] T016 Update the `dnd5e-engine-sides` and `dnd5e-engine` lines in `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`. Re-pin every reviewed note to the branch head. Run the freshness gate and the spec-bridge gate.

**Checkpoint**: freshness gate prints `OK`; spec-bridge exits 0.
