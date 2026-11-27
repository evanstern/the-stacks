# Implementation Plan: Concentration and roll-bonus spells

**Spec**: `specs/124-spell-concentration-bless-guidance/spec.md` | **Card**: TASK-0226

## Design

- **State** (`schema/state.ts`, optional fields, no schema-version bump): `Combatant.concentration?: { spellId, targetIds[], expiresAt: ExpiryPoint|null }` and `Combatant.rollBonuses?: { spellId, casterId, die, applies: ("attack"|"saving-throw"|"ability-check")[], skill: Skill|null }[]`.
- **Events** (`schema/events.ts`, `evolve.ts`): `concentration.changed {combatantId, before, after, cause: cast|replaced|damage|incapacitated|died|expired}`, `roll-bonus.granted {combatantId, after}`, `roll-bonus.ended {combatantId, before, cause}`.
- **Spell table** (`spells.ts`): `SpellMechanics.effect?: { kind: "roll-bonus", die, applies, skillChoice, targets: {base, perSlotLevel}, concentration: true, durationRounds }`; the "needs damage/healing/condition" refine accepts an effect. Add `bless` and `guidance` entries. `spell.cast` gains optional `moreTargetIds` and `skill`.
- **New `src/concentration.ts`**: `breakConcentrationEvents(state, casterId, cause, reason)` (concentration.changed to null plus a roll-bonus.ended per target), `concentrationSaveEvents(...)` (Con save on damage, break on failure), `bonusDice(c, kind, skill)` (deduped by spellId).
- **Hooks**: `damageEvents` (hit-points.ts) calls the save/break after its hp events; `handleConditionApply` and `appliedEvent` callers for incapacitating conditions break concentration; `expiring` (encounter.ts) breaks on expiry; `handleSpellCast` effect branch grants bonuses and replaces prior concentration. Bonus dice appended in `attacks.ts` (attack, check) and `spells.ts` (attack, save).
- **Server pin test**: `apps/server/test/dm/spell-mechanics.test.ts` asserts `rec.concentration === Boolean(m.effect?.concentration)` and checks effect clauses against record text.

## Constitution check
VI (engine owns numbers): pass; dice are engine-rolled with scripted RNG tests. III: new events replay through `evolve`. No Intent/contract change.

## Tests (the oracle)
`packages/dnd5e-engine/test/commands/spell-effects.test.ts` + replay case: cast both, bonus on attack/save/check, upcast target count, one-concentration replacement, Con save pass/fail (DC 10 floor, half-damage DC, cap 30), 0 HP and incapacitated breaks, expiry, non-stacking, refusals, replay.
