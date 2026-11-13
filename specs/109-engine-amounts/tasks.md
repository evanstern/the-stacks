# Tasks: Roll steps and effect amounts derive from the engine

**Spec**: `specs/109-engine-amounts/spec.md` | **Plan**: `specs/109-engine-amounts/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use scripted dice and the fake gateway only. Do not edit `resolve.ts`, `plan-gate.ts`,
the adjudicate node or `step-grammar.ts`: TASK-0312 owns them. Do not edit `BesideSchema` or
`intent-runner.ts`: TASK-0313 owns them.

## Phase 1: Engine Unarmed Strike (AC #2)

- [ ] T001 In `packages/dnd5e-engine/src/derive.ts`, add `unarmedStrike(stats)` per plan D1. Return it from `findAttack` when the name is `Unarmed Strike` (case-insensitive) and no stored entry matches. Keep the `ponytail:` comment for the 0 floor.
- [ ] T002 In `packages/dnd5e-engine/test/derive.test.ts`, add `findAttack` cases: derived entry for Str +3 and PB +2 (`toHit` 5, fixed 4 bludgeoning); a stored `Unarmed Strike` wins; missing `str` gives `missing: "str modifier"`; Str −3 gives damage 0.
- [ ] T003 In `packages/dnd5e-engine/test/commands/attacks.test.ts`, add scripted-dice tests: `attack.roll` with `attack: "Unarmed Strike"` totals d20 + 5; a hit then `damage.apply` applies 4 and draws no damage die; a critical hit still applies 4; a combatant without Str refuses `STAT_UNDEFINED`.
- [ ] T004 In `packages/planner/test/combat.test.ts`, split the "refuses STAT_UNDEFINED … unarmed (OQ-12)" test. `Warhammer` still refuses. `unarmed` plans `attack.roll` with `attack: "Unarmed Strike"` and guarded `damage.apply` on `hit` and `critical-hit`, each with a fixed bludgeoning component.
- [ ] T005 Grep `apps/server/test` for tests that expect an unarmed attack to refuse. Update any to the derived result. Run `pnpm ci:check`.

## Phase 2: AC #1 guard test

- [ ] T006 Write `apps/server/test/dm/model-numbers.test.ts` per plan D3: `INTERPRET_KINDS` and `COMPANION_TURN_KINDS` hold none of `roll_free`, `apply_damage`, `apply_heal`, `set_dc`, `request_roll`.
- [ ] T007 In the same file, assert the rulings model reply schema refuses `dc` and `amend`. Export the schema from `apps/server/src/dm/rulings.ts` only if it is not reachable; change no behavior. Add a comment that links the existing `interpret-intents.test.ts` and `packages/intent` `MODEL_NUMBER` coverage. Run `pnpm ci:check`.

## Phase 3: Wiki

- [ ] T008 Review `docs/wiki/dnd5e-engine-derived-rolls.md` (NEEDS-REVIEW: source `derive.ts`). Add the derived Unarmed Strike rule (stored entry wins, 0 floor, `STAT_UNDEFINED` on missing Str). Re-pin honestly through `/grounding-wiki:wiki-update`.
- [ ] T009 Review `docs/wiki/planner.md` (NEEDS-REVIEW). Replace "Unarmed strikes refuse `STAT_UNDEFINED` until TASK-0223 derives the entry (OQ-12)" with the served behavior. Review `docs/wiki/dnd5e-engine.md` and `docs/wiki/test-suite.md` if any pinned source changed. `docs/wiki/srd-data.md` needs no review: no `packages/srd` source changes.
- [ ] T010 Update `docs/wiki/INDEX.md` state line and `docs/wiki/CAPSULES.md` for TASK-0223 (spec 109). Run the freshness gate until it prints `OK`. Run the spec-bridge check until it exits 0. Run `pnpm ci:check`.
