---
name: dnd5e-engine-sides
description: Sides in the 5e engine (spec 099, TASK-0274) - the optional combatant side, combatant.side, combatant.depart and stand, the five selectors (areHostile, hostilesStanding, encounterOver, meleeFoes, closeCombatFoes) and the engine close-combat ranged-disadvantage rule. Read before touching sides, departures, standing from prone, or the end-of-fight check.
kind: concept
sources:
  - packages/dnd5e-engine/src/sides.ts
  - packages/dnd5e-engine/src/commands/combatants.ts
  - packages/dnd5e-engine/src/commands/encounter.ts
  - packages/dnd5e-engine/src/commands/move.ts
  - packages/dnd5e-engine/src/commands/attacks.ts
  - packages/dnd5e-engine/src/commands/spells.ts
verified_against: 2707677c72373882afd5868a4ed10eca26f85dd6
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

`src/sides.ts` exports five pure selectors (`meleeFoes` below): `areHostile` (party against hostile, either way round),
`hostilesStanding` (conscious hostiles in the order), `encounterOver` (an encounter with at least one sided
combatant in its order and no hostile standing) and `closeCombatFoes(state, attackerId)` (the attacker's melee-pair partners that are opposed,
conscious, not unable, not blinded; empty for an invisible, unplaced or sideless attacker). Spec 101
(TASK-0306) moves "engaged" from zones to melee pairs: `Encounter.melee` holds sorted, distinct hostile
id pairs and `meleeFoes(state, id)` lists an id's partners (`[]` with no encounter). A resolved melee
`attack.roll` (a `melee` entry, or melee-or-ranged at the engaged band; a reaction attack counts) or a
`range: "melee"` spell attack forms a pair when both combatants are placed in one zone and hostile, inside
an active encounter. The pair rides `encounter.changed`: a reaction attack carries it with the spent
Reaction in one event, and an existing pair emits nothing. `move`, `combatant.place`, `initiative.leave`
and `combatant.depart` drop the combatant's pairs; the encounter's end clears them. `turn.advance`,
Dash, Disengage and `combatant.side` leave pairs alone, so Disengage then a move to another zone clears
the penalty. A downed, unable or blinded foe makes a pair inert at read time; the pair stays in state.
Same zone with no pair is no penalty, and so is any ranged attack outside an encounter. Opportunity
attacks deliberately keep the same-zone rule (`provokers`, spec 094); narrowing them is TASK-0305. The ranged-attacks-in-close-combat rule (SRD 5.2.1) is engine code: `attack.roll`
with a derived attack and `spell.cast` attack spells fold `disadvantage` through
`closeCombatSources` when the attack is ranged (a melee-or-ranged entry is ranged only outside the
engaged band) and a close-combat foe exists. With no sides the rule is off. `ponytail:` "within 5
feet" is a melee pair until grid mode (R5).

