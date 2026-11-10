---
name: dnd5e-engine
description: The pure 5e rules engine package (packages/dnd5e-engine, TASK-0042) - execute(state, command, rng) returns events or a refusal, seeded/scripted RNG, the roll ledger, refuse-before-draw, the no-I/O boundary rule, the R8 ruling that the engine owns attack/save/resistance/crit arithmetic, and sides with `combatant.depart`, `stand` and the close-combat rule (spec 099). Read before touching engine commands, dice, or state.
kind: concept
sources:
  - packages/dnd5e-engine/README.md
  - packages/dnd5e-engine/package.json
  - packages/dnd5e-engine/src/index.ts
  - packages/dnd5e-engine/src/execute.ts
  - packages/dnd5e-engine/src/evolve.ts
  - packages/dnd5e-engine/src/rng.ts
  - packages/dnd5e-engine/src/dice.ts
  - packages/dnd5e-engine/src/derive.ts
  - packages/dnd5e-engine/src/schema/events.ts
  - packages/dnd5e-engine/src/schema/state.ts
  - packages/dnd5e-engine/src/schema/commands.ts
  - packages/dnd5e-engine/src/schema/refusals.ts
  - packages/dnd5e-engine/src/commands/move.ts
  - packages/dnd5e-engine/src/space.ts
  - packages/dnd5e-engine/test/purity.test.ts
  - packages/dnd5e-engine/test/coverage.test.ts
  - specs/026-dnd5e-engine/spec.md
verified_against: 2707677c72373882afd5868a4ed10eca26f85dd6
---

# 5e engine

`@the-stacks/dnd5e-engine` is a pure TypeScript package holding the 5e rules. It has no
database, network, model, clock or global randomness; its only runtime dependencies are `zod` and the pure `@the-stacks/space` package ([[space]]).
The DM runtime ([[dm-runtime]]) is its caller; the server derives its closed rules-term lists from the engine's enums (see Skills).

## Entry point

```ts
const result = execute(state, command, rng);
if (result.ok) state = replay(result.events, state);
```

`execute` (in `src/execute.ts`) returns `{ ok: true, events }` or `{ ok: false, refusal }`.
It validates `state` against `EngineStateSchema` (refusal `INVALID_STATE`), then `command`
against `EngineCommandSchema` (`INVALID_COMMAND`), then dispatches by `command.type` through a
handler map (`roll`, `combatant.add/remove`, `damage.apply`, `healing.apply`, `temp-hp.grant`,
`death-save.roll`, `stabilize`, `attack.roll`, `check.roll`, `condition.apply/remove`,
`exhaustion.adjust`, `initiative.roll/join/leave`, `turn.advance`, `encounter.end`, the spec 099 trio,
`rest.short/long`, `spell-slot.expend/restore`, `spell.cast`, `help.grant`, and the four zone-mode commands below). Each handler lives in `src/commands/`.
`evolve` applies one event; `replay(events, state)`
folds many. Replaying all events from `emptyState()` reproduces state.

`initiative.leave` (`handleInitiativeLeave`, `src/commands/encounter.ts`) removes a combatant from the
encounter order and keeps its state. It refuses `NO_ACTIVE_ENCOUNTER` without an encounter,
`UNKNOWN_COMBATANT` for an unknown id or one outside the order (detail `reason: "not-in-order"`),
and `NO_ELIGIBLE_COMBATANT` when the leaver is the last entry or the active leaver would hand
the turn to an all-dead order. When the active combatant leaves, the leave is the turn
transition, as in `turn.advance`: the leaver's turn-end conditions expire, dead entries are
skipped, the next live entry becomes active (wrapping to index 0 and a new round), and its
turn-start conditions expire. A leaver before the active entry shifts `turnIndex` down by one.
The command emits `encounter.changed` and draws no dice. A leaver's id is removed from
`reactionsSpent` (below) in the same event.

## Sides, depart and stand (spec 099, TASK-0274)

Optional combatant `side`, `combatant.side`, `combatant.depart`, `stand`, five selectors, melee pairs (spec 101) and the close-combat rule: [[dnd5e-engine-sides]].

`isUnable` is the able-actor predicate [[planner]] reuses.

## Space and movement

Spec 094 (TASK-0270). The engine holds an optional `space`, per-combatant `placement` and `speed`, and four commands: `space.define`, `combatant.place`, `move`, `movement.action`. Their rules, refusals and the speed budget are in [[space]].

## RNG

`Rng` is one method, `rollDie(sides)`, returning an integer in `1..sides`. `seededRng(seed)`
is mulberry32 over a 32-bit seed with rejection sampling, so every face is equally likely
(play uses it). It rejects a die size that is not an integer in `1..1000`
(`MAX_SIDES`) with `RngContractError`. `scriptedRng(faces)` returns a fixed face list and exposes `remaining()` and
`calls()` (tests use it); it throws `ScriptedDiceError` when exhausted or out of range. Dice
parsing (`parseDiceExpression`) supports `NdS`, keep-highest/lowest (`kh`/`kl`), and modifiers,
with hard limits (count 100, sides 1000, 20 terms, 200 characters, modifier +/-1000) that
refuse with `DICE_LIMIT_EXCEEDED`.

## Skills

`SkillSchema` (`src/schema/state.ts`, exported with `type Skill`) is a closed enum of the 18 SRD
5.2.1 skills as lowercase kebab-case keys (`acrobatics`, `animal-handling`, ... `sleight-of-hand`,
`stealth`, `survival`). It is the only literal skill list. The `check.roll` command takes
`skill: SkillSchema.nullable().default(null)`. The event schema keeps `check.resolved.skill` as
a nullable string, so stored events with older skill spellings still parse. The server derives
its own gate and prompt lists from this enum ([[dm-runtime]]).

## Roll ledger

Every state change is an event that records a `reason` and, for mutations, `before` and
`after` values (for example HP pairs, or `null` to a combatant on add). Roll events record
each term's faces, which were kept, the modifier and the total, so a recorded roll can be
audited without re-running the RNG. Attack and check events also record the AC or DC, its
source and the outcome.

Spec 070: `check.resolved` records optional `margin` and `band` (`success`, `success-at-cost`,
`failure`, `severe-failure`). `bandOf` decides: with `naturals`, nat 20 succeeds and nat 1 fails; with
`outcomeBands`, an ability check missing by 1-2 is `success-at-cost`, by 5+ `severe-failure`. `outcome` stays two-valued.

## Refuse before draw

A handler runs every refusal check before it calls `rollDie`. A refused command consumes no
dice, so the RNG stream is unchanged after a refusal. Refusals carry a code from
`RefusalCodeSchema` (for example `TARGET_AC_UNKNOWN`, `D20_TERM_REQUIRED`, `NOT_DYING`,
`NO_SLOT_AVAILABLE`, `REACTION_SPENT`, `STAT_UNDEFINED`, `NOT_PROFICIENT`, and the zone codes `SPACE_UNDEFINED`, `ZONE_UNKNOWN`, `ZONE_IN_USE`, `NOT_PLACED`, `MOVE_BLOCKED`, `MOVE_OVER_SPEED`, `MOVE_OFF_TURN`, `OUT_OF_REACH`, `OUT_OF_RANGE`), a message and optional detail (43 codes). The DM plan gate alone raises `REASON_CONTRADICTS_STATE` (spec 058).
`attack.roll` and ability-check `check.roll` refuse an unable actor with `ACTOR_UNABLE` (`commands/attacks.ts`): lifeState `unconscious` or `stable`, or an `incapacitated`, `paralyzed`, `petrified`, `stunned` or `unconscious` condition. The detail names `combatantId`, `role`, `lifeState` and `conditions`. Saving throws and attack targets are never checked, so a dying actor can still roll its death save. A broken RNG contract (a face outside
`1..sides`, or a die size outside `1..1000`) throws `RngContractError` rather than refusing. `encounter.end` keeps combatants in state; it is not what refused the actions in the TASK-0110 repro, whose cause was resolve order ([[dm-runtime]]), not an engine rule.

## Boundary rule

The purity rule is enforced twice. `biome.json` has an override scoped to
`packages/dnd5e-engine/src/**` that denies database, network and model packages, `node:*`
and Node builtins, app packages and the `**/apps/**` path (via `noRestrictedImports`), plus
`Date`, `performance`, timers, `fetch`, `WebSocket`, `process`, `crypto` and `require` (via
`noRestrictedGlobals`). `pnpm check:boundaries` proves it fires against fixtures under
`fixtures/boundary-violations/packages/dnd5e-engine/` (see [[ci-pipeline]]), and
`test/purity.test.ts` scans every import specifier under `src/` and allows only `zod`, `@the-stacks/space` and relative imports. `test/coverage.test.ts` is
a meta-test: every command type and refusal code must appear in a test file.

## R8 ruling

Research R8 (spec FR-018 to FR-023): the engine owns the arithmetic for attack, save and
check resolution (natural 20 critical, natural 1 miss, total meets or beats AC/DC),
resistance, immunity and vulnerability per damage component (halve rounding down, double),
and critical damage (dice doubled, modifiers not). Adjudication - the DM runtime or an LLM
node - supplies inputs as data: steps name a tier or entry (below); code may send an expression, roll mode, target AC or DC, a per-command
defense set, or on `check.roll` an automatic-failure reason, an `autoSuccess` reason and `houseRules` (default false). It never computes outcomes.
The engine does not derive automatic failure from conditions.

## Connections

Rules context lives in [[overview]] (planned direction). The package sits in the root
project references ([[monorepo-and-toolchain]]) and its tests are a separate project
([[test-suite]] covers the server's).

Stats-derived rolls, `spell.cast` and assists are in [[dnd5e-engine-derived-rolls]]; reactions are in [[dnd5e-engine-reactions]]. The zone package is [[space]].
