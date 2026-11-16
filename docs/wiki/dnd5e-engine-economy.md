---
name: dnd5e-engine-economy
description: Action economy and Dodge in the 5e engine (spec 117, TASK-0304) - the Encounter economy record and its stale-read reset, action.spend and ACTION_SPENT, actionsLeft, the dodging list, the dodge command, isDodging with its computed Incapacitated and Speed 0 rule, the four roll sources, and castingTime. Read before touching action.spend, dodge, or Dodge roll modes.
kind: concept
sources:
  - packages/dnd5e-engine/src/commands/economy.ts
  - packages/dnd5e-engine/src/schema/state.ts
  - packages/dnd5e-engine/src/schema/commands.ts
  - packages/dnd5e-engine/src/schema/refusals.ts
  - packages/dnd5e-engine/src/commands/encounter.ts
  - packages/dnd5e-engine/src/commands/attacks.ts
  - packages/dnd5e-engine/src/commands/spells.ts
  - packages/dnd5e-engine/src/spells.ts
  - packages/dnd5e-engine/test/commands/economy.test.ts
verified_against: b3c2ff987287c2b17e50b48e64f522973d81a5a5
---

# 5e engine: action economy and Dodge

Part of the 5e engine ([[dnd5e-engine]]); the command entry point and refusal rules are there. The planner decides which Intents cost an Action and appends `action.spend` ([[planner]]); the engine only records and reads.

## Economy record

`EncounterSchema` carries an optional `economy`: `{ combatantId, round, actionUsed, bonusActionUsed }` for the active combatant's turn. It has no reset event. A record reads as nothing used when its `combatantId` is not the active combatant or its `round` is not the current round (`currentEconomy`, the same stale-read rule as the movement budget, [[space]]). `actionsLeft(state, combatantId)` returns `{ action, bonusAction }` booleans, or `null` outside an encounter or for an id not in the order. It is exported from `src/index.ts`.

## action.spend

`action.spend` takes `combatantId`, `cost` (`action` or `bonus-action`) and `reason`. It refuses before any draw: `UNKNOWN_COMBATANT`, `NO_ACTIVE_ENCOUNTER`, `MOVE_OFF_TURN` when the id is not the active combatant, `ACTOR_UNABLE` (`actorUnable` with role `actor`, [[dnd5e-engine]]), and `ACTION_SPENT` when that slot is already used (details `combatantId`, `cost`). On success it emits one `encounter.changed` that sets the slot in a fresh or current `economy` record. It draws no dice.

## Dodge

`dodge` takes `combatantId` and `reason`, passes the same turn gate as `action.spend`, and emits one `encounter.changed` adding the id once to `encounter.dodging`. It spends nothing; the planner appends `action.spend`. The Dodge lasts until the start of the dodger's next turn (SRD 5.2.1): `turn.advance` removes the incoming combatant from `dodging` in the same `encounter.changed` that returns its Reaction, `initiative.leave` removes the leaver, and `encounter.end` drops the list ([[dnd5e-engine-reactions]]).

`isDodging(state, combatantId)` is true when the id is in `dodging`, and the combatant is not unable (`isUnable`) and `effectiveSpeed` is not 0. The Incapacitated and Speed 0 rule is computed, not removed: if either condition ends before the dodger's next turn, the benefit returns (`ponytail:` comment in the source). It is exported from `src/index.ts`.

## Roll sources

`isDodging` feeds four roll sources, each through `foldMode` ([[dnd5e-engine-derived-rolls]]): disadvantage on an `attack.roll` against the dodger (reaction attacks included), disadvantage on a `spell.cast` attack spell against it, advantage on the dodger's Dexterity `check.roll` saving throw, and advantage on a `spell.cast` Dexterity save by the dodger.

## castingTime

Each `SPELLS` entry (`src/spells.ts`) has `castingTime`, `action` or `bonus-action`. `healing-word` is `bonus-action`; the other five are `action`. The engine does not enforce it; the planner costs a `cast` with it.
