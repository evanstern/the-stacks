---
name: dnd5e-engine-sides
description: Sides in the 5e engine (spec 099, TASK-0274) - the optional combatant side, combatant.side, combatant.depart and stand, the four selectors (areHostile, hostilesStanding, encounterOver, closeCombatFoes) and the engine close-combat ranged-disadvantage rule. Read before touching sides, departures, standing from prone, or the end-of-fight check.
kind: concept
sources:
  - packages/dnd5e-engine/src/sides.ts
  - packages/dnd5e-engine/src/commands/combatants.ts
  - packages/dnd5e-engine/src/commands/encounter.ts
  - packages/dnd5e-engine/src/commands/move.ts
  - packages/dnd5e-engine/src/commands/attacks.ts
  - packages/dnd5e-engine/src/commands/spells.ts
verified_against: 6ae46ed20335a69754372878a551bd8ea3ceb1da
---

Part of the 5e engine ([[dnd5e-engine]]); the command entry point and refusal rules are there.

A `Combatant` may carry `side`: `party`, `hostile` or `neutral` (`SideSchema`); `combatant.add`
accepts it and a missing side stays missing. `combatant.side` sets it and emits `combatant.sided`
(`v: 1`, `before` side or null, `after`); it refuses `UNKNOWN_COMBATANT` and `INVALID_COMMAND` for no
change. `combatant.depart` takes a combatant out of the order and its zone in one command: it emits the
`initiative.leave` events (`leaveEvents`), or the `encounter.end` events (`endEvents`) when leave would
refuse `NO_ELIGIBLE_COMBATANT`, then `combatant.placed` with `after: null` when it was placed. It
refuses `UNKNOWN_COMBATANT`, and `INVALID_COMMAND` when the combatant is neither in the order nor
placed. `stand` (`src/commands/move.ts`) removes `prone` (cause `command`); in an encounter it also
costs `floor(effectiveSpeed / 2)` feet of the actor's turn and refuses `MOVE_OFF_TURN`,
`STAT_UNDEFINED`, and `MOVE_OVER_SPEED` (Speed 0 gives `details.reason: "speed-zero"`);
`CONDITION_NOT_PRESENT` when not prone. None of the three draws dice.

`src/sides.ts` exports four pure selectors: `areHostile` (party against hostile, either way round),
`hostilesStanding` (conscious hostiles in the order), `encounterOver` (an encounter with at least one sided
combatant in its order and no hostile standing) and `closeCombatFoes(state, attackerId)` (opposed,
conscious, not unable, not blinded combatants in the attacker's zone; empty for an invisible, unplaced or
sideless attacker). The ranged-attacks-in-close-combat rule (SRD 5.2.1) is engine code: `attack.roll`
with a derived attack and `spell.cast` attack spells fold `disadvantage` through
`closeCombatSources` when the attack is ranged (a melee-or-ranged entry is ranged only outside the
engaged band) and a close-combat foe exists. With no sides the rule is off. `ponytail:` "within 5
feet" is "same zone" until grid mode.

