---
name: dnd5e-engine-concentration
description: Concentration, roll-bonus dice and Hold Person in the 5e engine (specs 124, 125) - Combatant.concentration and rollBonuses, the concentration.changed and roll-bonus.granted/ended events, what breaks concentration (cast, replaced, damage Con save, incapacitated, died, expired), bonusDice folded into d20 expressions, and the Bless and Guidance spell.cast path with moreTargetIds and skill. Read before touching concentration.ts or spell effects.
kind: concept
sources:
  - packages/dnd5e-engine/src/concentration.ts
  - packages/dnd5e-engine/src/spells.ts
  - packages/dnd5e-engine/src/commands/spells.ts
  - packages/dnd5e-engine/src/commands/hit-points.ts
  - packages/dnd5e-engine/src/commands/conditions.ts
  - packages/dnd5e-engine/src/commands/encounter.ts
  - packages/dnd5e-engine/src/commands/attacks.ts
  - packages/dnd5e-engine/src/schema/state.ts
  - packages/dnd5e-engine/src/schema/events.ts
  - packages/dnd5e-engine/src/evolve.ts
verified_against: 6a012514832b2b6c386f305dcb9f4ef05269c7a0
---

# 5e engine: concentration and roll bonuses

Part of the 5e engine ([[dnd5e-engine]]). Spec 124 phase 1 (TASK-0226); `src/concentration.ts` holds the helpers.

## State and events

`Combatant.concentration` (`ConcentrationSchema`: `spellId`, `targetIds` at most 20, `expiresAt` an `ExpiryPoint` or null) is the spell the combatant concentrates on. `Combatant.rollBonuses` (`RollBonusSchema`: `spellId`, `casterId`, `die` like `1d4`, `applies` of `attack`, `saving-throw`, `ability-check`, `skill` or null) holds bonus dice a target carries. Both are optional and omitted when empty. Events, applied in `evolve`:

- `concentration.changed` (`before`, `after`, `cause`): `cause` is `cast`, `replaced`, `damage`, `incapacitated`, `died` or `expired`.
- `roll-bonus.granted` (`before` null, `after` the bonus) appends to the target's list.
- `roll-bonus.ended` (`before` the bonus, `after` null, same `cause`) removes the entry matching `spellId` and `casterId`.

## Breaking concentration

`breakConcentrationEvents(state, casterId, cause, reason)` emits `concentration.changed` to null plus one `roll-bonus.ended` for each target still holding that spell's bonus; it is empty when the caster is not concentrating. It runs on:

- a new concentration cast (`replaced`, or `cast` when none was held);
- damage: `damageEvents` takes an optional `state`, and `concentrationDamageEvents` runs after the HP change. A hit that leaves 0 HP ends concentration with no save (`died` if the target went dead, else `incapacitated`). Otherwise one Constitution save per damage instance at DC `min(30, max(10, floor(damage / 2)))` (a `check.resolved` with `kind: "saving-throw"`, folding the usual mode sources and the target's own `bonusDice`); a failure ends it (`damage`). `damage.apply` and `spell.cast` damage pass `state`;
- `condition.apply` of `incapacitated`, `paralyzed`, `petrified`, `stunned` or `unconscious` (`INCAPACITATING_CONDITIONS`; `incapacitated`) and exhaustion death (`died`);
- the turn-advance expiry pass in `commands/encounter.ts`, when `expiresAt` matches the point (`expired`);
- the end-of-turn repeat saves in `turn.advance` (`repeatSaveEvents`): once no target of the caster's concentration spell still holds its `repeatSave` condition, concentration ends (`expired`).

For a repeat-save spell, `breakConcentrationEvents` also emits `condition.removed` (cause `concentration`) for each target's condition sourced from that spell with `repeatSave.casterId` the caster.

## Bonus dice on d20 rolls

`bonusDice(combatant, kind, skill)` returns the dice strings, one per distinct `spellId`; an ability check takes only bonuses with no skill or the checked skill. `withBonusDice(expression, dice)` appends them to the d20 expression. Derived `attack.roll` (kind `attack`), derived `check.roll` (`command.kind`, `command.skill`), a `spell.cast` attack roll and a `spell.cast` save by the target use them; the roll event records the extra terms. An explicit `expression` is left alone.

## Bless and Guidance

`SpellMechanicsSchema` gains an optional `effect` (`kind: "roll-bonus"`, `die`, `applies`, `skillChoice`, `targets: { base, perSlotLevel }`, `concentration: true`, `durationRounds`); an entry needs damage, healing, a condition or an effect. `SPELLS` adds `bless` (level 1, `1d4`, attack and saving throw, 3 targets + 1 per slot level above, 10 rounds) and `guidance` (level 0, `1d4`, ability check, one target, `skillChoice`, 10 rounds), both `castingTime: "action"` with `delivery: { kind: "auto" }`.

`spell.cast` gains `moreTargetIds` (at most 8) and `skill`. For an `effect` spell, `castRollBonus` refuses `INVALID_COMMAND` for a duplicate target, more targets than the cap, a missing skill (Guidance) or a skill on a spell that takes none; unknown ids refuse through `checkNamed`. It expends the slot (levelled spells), breaks prior concentration, emits `concentration.changed` (`cast`) with `expiresAt` set to `round + durationRounds` at the caster's turn start when the caster is in the order (else null), then one `roll-bonus.granted` per target. It draws no dice.

## Hold Person (spec 125)

`effect` is a discriminated union on `kind`; `repeat-save` (`ability`, `condition`, `targets`, `concentration: true`, `durationRounds`) adds `hold-person` (level 2, Wisdom, `paralyzed`, 1 target + 1 per slot level above, 10 rounds, `delivery` save). `castRepeatSave` runs the same target, slot and concentration steps, then each target saves through `rollSave` against the caster's spell save DC. A failure applies the condition with `source` the spell, `expiresAt` null and `repeatSave: { ability, dc, casterId }`; a success applies nothing, but concentration still starts. Each end-of-turn save of the condition holder is in [[dnd5e-engine]].

## Connections

Spell table and `spell.cast` basics: [[dnd5e-engine-derived-rolls]]. Casting-time costs: [[dnd5e-engine-economy]].
