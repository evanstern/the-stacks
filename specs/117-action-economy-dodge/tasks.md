# Tasks: Engine action economy and Dodge

**Spec**: `specs/117-action-economy-dodge/spec.md` | **Plan**: `specs/117-action-economy-dodge/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Commit each phase in one commit led by `TASK-0304`. Tests use scripted dice and the fake gateway
only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Do not edit `packages/session-model/src`, `apps/server/src`, `apps/web`, the seeds, the prompts or the playtest harness.

## Phase 1: Engine economy, Dodge and casting time (FR-001–FR-013; AC #1, #3)

- [ ] T001 In `packages/dnd5e-engine/src/schema/state.ts`, add `economy` and `dodging` to `EncounterSchema` with their comments (plan D1).
- [ ] T002 In `src/schema/commands.ts`, add `action.spend` and `dodge`. In `src/schema/refusals.ts`, append `ACTION_SPENT` (plan D2).
- [ ] T003 Write `src/commands/economy.ts` with `actionsLeft`, `isDodging`, `handleActionSpend` and `handleDodge` (plan D3). Widen the `actorUnable` `role` union with `"actor"`. Register both handlers in `src/execute.ts`. Export `actionsLeft` and `isDodging` from `src/index.ts`.
- [ ] T004 In `src/commands/encounter.ts`, extend `withoutSpent` to clear `dodging`, and widen the `turn.advance` guard to fire on a dodging incoming combatant (plan D4).
- [ ] T005 Add the four Dodge mode sources in `src/commands/attacks.ts` and `src/commands/spells.ts` (plan D5).
- [ ] T006 Add `castingTime` to `SpellMechanicsSchema` and the six entries in `src/spells.ts`. Assert it against the SRD record in `apps/server/test/dm/spell-mechanics.test.ts` (plan D6).
- [ ] T007 Write `packages/dnd5e-engine/test/commands/economy.test.ts` with every SC-001 and SC-002 case. Confirm the coverage meta-test passes.
- [ ] T008 Amend `specs/026-dnd5e-engine/contracts/commands.md`, `refusals.md` (row 36), `engine-api.md` and `events.md` (plan D11).

## Phase 2: Planner economy, Dodge and the hosted replay (FR-014–FR-024; AC #2, #4)

- [ ] T009 Merge `origin/main` into the branch.
- [ ] T010 Write `packages/planner/src/economy.ts` with `actionCostOf` and `activeSpender`. Export `actionCostOf` and `ActionCost` from `src/index.ts` (plan D7).
- [ ] T011 In `src/plan.ts` `planCtx`, add the economy check before the handler and the `action.spend` append after it (plan D7).
- [ ] T012 Move `dodge` to `served` in `src/kinds.ts`. Add the `dodge` handler to `src/movement.ts` and register it in `HANDLERS`. Set `dodge` to `engine("served", "dodge")` in `packages/intent/src/kinds.ts` (plan D8).
- [ ] T013 Write `packages/planner/test/economy.test.ts` with every SC-003 case. Add both codes to `test/refusals.test.ts` (SC-004). Update `test/kinds.test.ts` (SC-006).
- [ ] T014 Update the planner and gate tests whose exact command or row lists gain `action.spend` or its `encounter.changed` row (plan D10). Switch the gate `KIND_UNSERVED` test to `delay`.
- [ ] T015 Add the FR-023 replay to `packages/session-model/test/gate-intents.test.ts`.
- [ ] T016 Add the FR-024 replay to `apps/server/test/gate.intent.integration.test.ts`. Run it with `REQUIRE_DATABASE=1` on the worktree's stack.
- [ ] T017 Run the full DB suite with `REQUIRE_DATABASE=1`, including `test/playtest/playtest.integration.test.ts`. Fix any fixture that settles two costed Intents for one combatant in one turn (spec OQ-4). List each changed fixture in the commit message.
- [ ] T018 Amend `specs/097-planner/contracts/planner.md` section 6 and its served-kinds count, and add the economy rule. Amend the `dodge` row in `specs/092-intent-contract/contracts/intent-schema.md` (plan D11).
- [ ] T019 Run `node scripts/check-boundaries.mjs` (exits 0) and `pnpm ci:check` (green).

## Phase 3: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` list a file this card touches (NEEDS-REVIEW):

- [ ] T020 Merge `origin/main` into the branch. Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/<version>/gates/cli.mjs plan . docs/wiki` and work every entry it prints.
- [ ] T021 `docs/wiki/dnd5e-engine-reactions.md` (`state.ts`, `attacks.ts`, `encounter.ts`, `move.ts`): behaviour changed. `turn.advance` now also ends Dodge in the same `encounter.changed` that returns the Reaction, and `initiative.leave` clears a leaver's Dodge. Link the new economy note.
- [ ] T022 Write `docs/wiki/dnd5e-engine-economy.md` (new, `kind: concept`): the `economy` record and its stale-read reset, `action.spend` and `ACTION_SPENT`, `actionsLeft`, the `dodging` list, the `dodge` command, `isDodging` with its computed Incapacitated and Speed 0 rule, the four roll sources, and `castingTime`. Sources: `src/commands/economy.ts`, `src/schema/state.ts`, `src/schema/commands.ts`, `src/schema/refusals.ts`, `src/commands/encounter.ts`, `src/commands/attacks.ts`, `src/commands/spells.ts`, `src/spells.ts`, `test/commands/economy.test.ts`.
- [ ] T023 `docs/wiki/planner.md` (`kinds.ts`, `plan.ts`, `movement.ts`, `index.ts`, `contracts/planner.md`): behaviour changed. Served counts become 29 served and 11 unserved. `dodge` plans the engine `dodge` command. The economy rule: the cost table, `NO_ACTION_LEFT` and `NO_BONUS_ACTION_LEFT` before the handler, and `action.spend` last for the active combatant. Add `packages/planner/src/economy.ts` to its `sources:`.
- [ ] T024 `docs/wiki/dnd5e-engine.md` (`commands.ts`, `refusals.ts`, `execute.ts`, `index.ts`, `test/`): the two new commands, the refusal, the new exports, and a link to the economy note.
- [ ] T025 `docs/wiki/dnd5e-engine-derived-rolls.md` (`state.ts`, `spells.ts`): the Dodge sources on derived attack, spell and Dex-save rolls, and `castingTime` on spell entries.
- [ ] T026 `docs/wiki/intent-contract.md` (`packages/intent/src/kinds.ts`): `dodge` is engine-served.
- [ ] T027 Re-verify and re-pin the notes that list a touched file but need no prose change unless the diff says otherwise: `dnd5e-engine-sides.md` (`encounter.ts`, `attacks.ts`, `spells.ts`, `move.ts`); `space.md` (`move.ts`).
- [ ] T028 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md`: add the economy note, and update the planner, engine and reactions lines. Run the wiki plan (prints nothing), the freshness gate (prints `OK`) and the spec-bridge gate (exits 0).
