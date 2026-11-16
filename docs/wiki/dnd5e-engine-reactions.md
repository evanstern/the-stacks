---
name: dnd5e-engine-reactions
description: Reactions in the 5e engine (SRD 5.2.1 p. 10) - the reactionsSpent list, the reaction flag on attack.roll, its refusals, and which commands clear it, plus how turn.advance and initiative.leave also end a Dodge (spec 117). Read before touching reaction spending, turn.advance, or initiative.leave.
kind: concept
sources:
  - packages/dnd5e-engine/src/commands/attacks.ts
  - packages/dnd5e-engine/src/commands/encounter.ts
  - packages/dnd5e-engine/src/commands/move.ts
  - packages/dnd5e-engine/src/schema/state.ts
verified_against: 06fd49610a6fa7d116af98f64c22a494de2b97ba
---

# 5e engine: reactions

Part of the 5e engine ([[dnd5e-engine]]); the command entry point and refusal rules are there.

`EncounterSchema` carries an optional `reactionsSpent`: the ids whose Reaction is spent
until the start of their next turn (SRD 5.2.1 p. 10). `attack.roll` with `reaction: true`
is the only command that spends one. It refuses `NO_ACTIVE_ENCOUNTER` outside an encounter,
`INVALID_COMMAND` with no attacker, `UNKNOWN_COMBATANT` for an attacker outside the order,
and `REACTION_SPENT` when the attacker already spent its Reaction. On success it emits the
`attack.resolved` event with `reaction: true` and an `encounter.changed` event that adds the
attacker to `reactionsSpent`. `turn.advance` clears the incoming combatant's id from
`reactionsSpent` and from `dodging` ([[dnd5e-engine-economy]]) with one `encounter.changed`, emitted when either list holds it, so a Dodge ends in the same event that returns the Reaction. `initiative.leave` clears both lists for the
leaver and the incoming combatant (`combatant.depart` composes the same `leaveEvents`, [[dnd5e-engine]]). `encounter.end` drops the encounter, and with it `reactionsSpent` and `dodging`.

Spec 117: an `attack.roll` with `reaction: true` against a dodger rolls with disadvantage like any attack on it ([[dnd5e-engine-economy]]). A Reaction is not an Action or Bonus Action, so it never touches the `economy` record.

Spec 094 adds zone checks. When both combatants are placed, an `attack.roll` with an attack entry checks the band between them ([[space]]): a melee entry (or melee-or-ranged at the engaged band) needs the engaged band and refuses `OUT_OF_REACH` otherwise; a ranged use refuses `OUT_OF_RANGE` beyond `rangeFt.long` and gains disadvantage beyond `rangeFt.normal`. Spec 099 adds a further disadvantage source for a ranged use: a hostile in a melee pair with the attacker (`closeCombatFoes`, [[dnd5e-engine-derived-rolls]]); spec 101 makes a reaction attack form that pair in the same `encounter.changed` that spends the Reaction. `provokers` still reads zones. With either side unplaced, no check runs. `provokers` (`src/commands/move.ts`) names who may take an opportunity attack when a mover leaves a zone: it skips anyone whose id is in `reactionsSpent` ([[dnd5e-engine]]).

Spec 119: a reaction `attack.roll` that hits a `paralyzed` or `unconscious` target with a melee use resolves `critical-hit`, like any derived attack ([[dnd5e-engine-derived-rolls]]).
