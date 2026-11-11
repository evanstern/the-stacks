---
name: planner
description: The deterministic planner package (packages/planner, spec 097, TASK-0267) - plan(state, space, intent) returns guarded engine commands, a refusal or a ruling request with no model and no I/O; PlanState, the served-kind table, facts, the ruling loop, the ai:dm seat rules and the boundary. Read before the gate (TASK-0268) or interpret (TASK-0269) calls it, or before serving a new Intent kind.
kind: component
sources:
  - packages/planner/package.json
  - packages/planner/src/index.ts
  - packages/planner/src/types.ts
  - packages/planner/src/kinds.ts
  - packages/planner/src/plan.ts
  - packages/planner/src/refs.ts
  - packages/planner/src/checks.ts
  - packages/planner/src/combat.ts
  - packages/planner/src/movement.ts
  - packages/planner/src/resources.ts
  - packages/planner/src/dm.ts
  - packages/planner/src/rulings.ts
  - packages/planner/src/outcome.ts
  - packages/planner/test/purity.test.ts
  - specs/097-planner/contracts/planner.md
verified_against: 4f0383cb9c20dfb8dbcbb561ed416616d5fbaae9
---

# Planner

`@the-stacks/planner` holds `plan(state, space, intent): PlanResult`. It is pure and synchronous: no model, clock, randomness or I/O, and it never reads `intent.text`. Its runtime dependencies are `@the-stacks/intent` ([[intent-contract]]), `@the-stacks/space` ([[space]]), `@the-stacks/dnd5e-engine` ([[dnd5e-engine]]) and `zod`. A Biome override forbids anything else ([[ci-pipeline]]). No server code imports it yet; the gate (TASK-0268) will be its only caller. The normative contract is `specs/097-planner/contracts/planner.md`.

## Result

`PlanResult` is `commands`, `refusal` or `needs_ruling`, each with `facts`. A `PlannedCommand` is an engine command plus an optional guard `when: { step, outcomes }` on an earlier step. The execution rule: run in order, skip a guarded command whose step outcome is not listed, refuse the Intent when the first command refuses, stop at the first later refusal and keep earlier events (OQ-7). `stepOutcome(events)` reads an executed step's `attack.resolved` outcome, else the `check.resolved` band. A refusal is `source: "planner"` (an `IntentRefusalCode`) or `source: "engine"` (an engine `RefusalCode`, pre-checked with engine helpers). Every command's `reason` is the Intent's text form without its body, cut to 500 characters.

## PlanState (OQ-1 delta)

Target-architecture section 2 types the state as `SessionProjections`. The gate lives in `session-model`, which will import the planner, so the planner takes a narrow read model instead, `PlanState`: engine state, actors (side, presence, `seen`, controller, combatant id), casters, SRD spell ids, combatant inits (pull-in and `add_combatant` sources), open ruling requests and table rules. TASK-0268 builds it. `PlanStateSchema`, `PlanFactSchema` and `RulingRequestSchema` are exported.

## Served kinds

`PLAN_KINDS` classes all 57 kinds: 28 served, 2 ruling-only (`attempt`, `use_object`), 12 unserved and 15 not planned. An unserved or not-planned kind refuses `KIND_UNSERVED`; the details name the owner card (`dodge` TASK-0304, `ready`/`react`/`roll`/`request_roll` TASK-0276, the rest N-17, N-18, Q5, TASK-0227; not-planned kinds `gate`). Partial service: `shove` push, `move` and `move_token` to squares and `add_combatant` to squares refuse `KIND_UNSERVED`; `cast` with a zone, point or two targets refuses `SPELL_UNRESOLVED`; `stand` plans the engine `stand` command (TASK-0274; the engine owns the half-Speed cost). The close-combat ranged disadvantage is the engine's rule, not the planner's: the planner never folds the mode, and `attack` and `cast` only report it as a `rule` fact when `closeCombatSources` is non-empty.

Pre-checks match the old plan gate: unknown or absent actor `UNKNOWN_COMBATANT`, unable actor `ACTOR_UNABLE`, unknown target `TARGET_NOT_PRESENT`, `seen: false` `TARGET_UNSEEN`, and an NPC with an init but no combatant pulled in with `combatant.add` (and `initiative.join` in an encounter). `attack` checks reach and range by band (`OUT_OF_REACH`, `OUT_OF_RANGE`; skipped when either side is unplaced) and plans `attack.roll` then guarded `damage.apply` on `hit` and `critical-hit`. `move` probes the engine `move` command with a scripted RNG that holds no dice, then plans hostile reaction attacks for a party mover before the move. `grapple` and `shove prone` plan the target's better Strength or Dexterity save against the `unarmed-strike` opposition DC, then a guarded condition.

## Facts

`PlanFact` is code-chosen data (rule (the close-combat fact reports the engine's melee pairs, spec 101, not zones), dc, reach, pull-in, reaction, ruling, no-roll, ignored, unserved), never model text, so a "why" row renders from code. Spec 098's fact sheet names its own row type `FactRow`; TASK-0268 stores `PlanFact`s on the Intent outcome carrier event.

## Rulings

`check`, `save`, `contest` and `search` with no DC source return `needs_ruling` with ask `difficulty` and the roll the planner will make. A DC comes from an `npc` actor's own `difficulty`/`dc`, a `ruling` or `set_dc`, or an engine opposition rule. A `dc` or `difficulty` from a `pc` or `companion` is ignored (fact `ignored`) and the planner asks. `attempt` and `use_object` ask `outcome`. `requestId` is the id of the Intent being planned, so the gate needs no id generator. A `ruling` (accept, reject, amend) or `set_dc` looks up `state.openRequests` (`REQUEST_NOT_OPEN` if missing) and plans the stored Intent again with the answer. The replanned commands cite the stored Intent as their reason. A tierless accept on a difficulty ask asks again.

## Seat rules

An `ai:dm` actor is refused `DM_SEAT_REQUIRED` for `apply_damage`, `apply_condition add` or `move_token` on a `party` actor, and for `end_combat` while `hostilesStanding(state)`. The `dm` seat is never refused so. This is formulation 3 of the actor-state gate: a change to another actor follows a roll naming it or an SRD beneficial rule. `test/legality.test.ts` replays the evidence sequences as Intents.

## Boundary

Seat, turn, policy and held-companion checks stay in the gate. `resolve.ts` and the plan gate are unchanged until TASK-0269 ([[dm-plan-gate]]). Spell range is unchecked (OQ-9, TASK-0227). Unarmed strikes refuse `STAT_UNDEFINED` until TASK-0223 derives the entry (OQ-12).
