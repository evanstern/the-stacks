# Feature Specification: Repeat-save spells (Hold Person)

**Feature Branch**: `INF-40-task-0228-spells-with-repeat-saves-hold-person-sleep-re-run-on-sonnet-replaces-inf-14`
**Card**: TASK-0228 (milestone m-12). Depends on TASK-0105 (spec 083, Done) and spec 124 (concentration, merged). Re-run on Sonnet (D24-A1, replaces INF-14).
**Status**: Draft
Source: `specs/083-*` OQ-2 — spells whose effect repeats a save each turn are refused `SPELL_UNRESOLVED`.
Scope: `packages/dnd5e-engine` only (plus the server test that pins the spell table to SRD records, if it needs a clause). No Intent, planner, seed or web change.

## SRD 5.2.1 sources

- `spell.json` `hold-person` (level 2, Concentration up to 1 minute): "Choose a Humanoid that you can see within range. The target must succeed on a Wisdom saving throw or have the Paralyzed condition for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success." Higher level: one additional Humanoid per slot level above 2.
- Rules glossary, Concentration (spec 124): ends spell effects when concentration ends.
- `sleep` (level 1) is a two-stage effect (Incapacitated, then Unconscious after a failed second save). **Deferred**: see Out of scope.

## Requirements

- **FR-001** `spell.cast` resolves `hold-person`. `SPELL_UNRESOLVED` no longer fires for it.
- **FR-002** Targets: `targetId` plus optional `moreTargetIds`, at most `1 + (slotLevel - 2)` distinct creatures. Each target rolls its own Wisdom save against the caster's spell save DC (auto-fail rules from spec 119 apply as for any save spell).
- **FR-003** A target that fails gains `paralyzed`, condition `source` = `hold-person`, no `expiresAt`, carrying `repeatSave: { ability, dc, casterId }`.
- **FR-004** The caster starts concentrating (spec 124): replaces prior concentration; `concentration.targetIds` = the targets; 10-round duration when in an encounter. Concentration starts even if every target saves (the spell was cast).
- **FR-005** At the end of an affected target's turn (`turn.advance` outgoing), for each condition with `repeatSave`: the target rolls the save (Wisdom, same DC). On success the condition is removed (cause `save`); on failure it stays.
- **FR-006** When no target of a concentration spell still holds its condition, the caster's concentration ends (cause `expired`). When concentration ends for any cause, every condition whose source is that spell and that carries `repeatSave` is removed from its targets (cause `concentration`).
- **FR-007** Events replay: `evolve` handles the new `repeatSave` slice and the new `condition.removed` causes. No new command, no new refusal code.

## Out of scope (recorded)

- **Sleep** is deferred to a follow-up card: its SRD 5.2.1 text is a two-stage condition chain (Incapacitated until the end of the target's next turn, then a second save into Unconscious) that needs a staged-effect model, not a single repeat save.
- Humanoid restriction, line of sight and range are not modelled (same as spec 083 for every spell).
- Damage-wakes and per-turn saves for spells other than Hold Person; the mechanism is generic (`repeatSave` on the condition) so later spells reuse it.

## Acceptance

- AC #1 (card): Hold Person applies paralyzed; the target repeats its save at the end of each of its turns and the effect ends on a success; engine tests cover it.
