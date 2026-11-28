# Implementation Plan: Repeat-save spells (Hold Person)

**Spec**: `specs/125-spell-repeat-saves-hold-person/spec.md` | **Card**: TASK-0228

## Design

- **State** (`schema/state.ts`): `ConditionInstanceSchema` gains optional `repeatSave: { ability, dc, casterId }` (optional, no schema bump).
- **Events** (`schema/events.ts`): `condition.removed.cause` gains `save` and `concentration`. `evolve` already removes by instance.
- **Spell table** (`spells.ts`): `SpellMechanics.effect` becomes a discriminated union on `kind`: `roll-bonus` (existing) and `repeat-save` `{ ability, condition, targets: {base, perSlotLevel}, concentration: true, durationRounds }`. Add `hold-person` (level 2, wis, paralyzed, base 1, +1 per slot level, 10 rounds).
- **Cast** (`commands/spells.ts`): new `castRepeatSave` beside `castRollBonus`: validate targets, expend slot, break/replace concentration, set concentration, roll each target's save (reuse the save roll/auto-fail logic), apply the condition with `repeatSave` on failure.
- **Turn end** (`commands/encounter.ts` `handleTurnAdvance`): after `expiring` for the outgoing combatant, roll each `repeatSave` condition's save (needs `rng`; handler currently ignores it); remove on success; break caster concentration when no holder remains.
- **Concentration break** (`concentration.ts` `breakConcentrationEvents`): also remove `repeatSave` conditions sourced from the spell on its targets.
- Extract the save-roll piece of `handleSpellCast` into a shared helper if that avoids duplication.

## Tests (the oracle)
`packages/dnd5e-engine/test/commands/spell-repeat-save.test.ts` (scripted dice only): fail applies paralyzed with repeatSave, success applies nothing but concentration starts, upcast target count and refusals, end-of-turn repeat save fail keeps / success removes, last holder freed ends concentration, concentration break (damage, replaced) removes condition, paralyzed auto-fail interaction, replay determinism, outside-encounter cast.
