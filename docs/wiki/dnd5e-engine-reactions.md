---
name: dnd5e-engine-reactions
description: Reactions in the 5e engine (SRD 5.2.1 p. 10) - the reactionsSpent list, the reaction flag on attack.roll, its refusals, and which commands clear it. Read before touching reaction spending, turn.advance, or initiative.leave.
kind: concept
sources:
  - packages/dnd5e-engine/src/commands/attacks.ts
  - packages/dnd5e-engine/src/commands/encounter.ts
  - packages/dnd5e-engine/src/schema/state.ts
verified_against: 3a617d4a10e572a061aa5be87b3f9711fd7910ae
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
`reactionsSpent` with its own `encounter.changed`, and `initiative.leave` clears both the
leaver and the incoming combatant. `encounter.end` drops the encounter, and with it `reactionsSpent`.
