---
name: dnd5e-engine
description: The pure 5e rules engine package (packages/dnd5e-engine, TASK-0042) - execute(state, command, rng) returns events or a refusal, seeded/scripted RNG, the roll ledger, refuse-before-draw, the no-I/O boundary rule, and the R8 ruling that the engine owns attack/save/resistance/crit arithmetic. Read before touching engine commands, dice, or state.
kind: concept
sources:
  - packages/dnd5e-engine/README.md
  - packages/dnd5e-engine/package.json
  - packages/dnd5e-engine/src/index.ts
  - packages/dnd5e-engine/src/execute.ts
  - packages/dnd5e-engine/src/evolve.ts
  - packages/dnd5e-engine/src/rng.ts
  - packages/dnd5e-engine/src/dice.ts
  - packages/dnd5e-engine/src/schema/events.ts
  - packages/dnd5e-engine/src/schema/refusals.ts
  - packages/dnd5e-engine/test/purity.test.ts
  - packages/dnd5e-engine/test/coverage.test.ts
  - specs/026-dnd5e-engine/spec.md
verified_against: ad02bc4e9756e74f24dd0b6b8e19f4faaf5546af
---

# 5e engine

`@the-stacks/dnd5e-engine` is a pure TypeScript package holding the 5e rules. It has no
database, network, model, clock or global randomness; its only runtime dependency is `zod`.
Nothing in `apps/` consumes it yet - it is the rules core the DM runtime will call.

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
`exhaustion.adjust`, `initiative.roll/join`, `turn.advance`, `encounter.end`,
`rest.short/long`, `spell-slot.expend/restore`). Each handler lives in `src/commands/`.
`execute` never mutates its inputs. `evolve` applies one event; `replay(events, state)`
folds many. Replaying every event from `emptyState()` reproduces live state.

## RNG

`Rng` is one method, `rollDie(sides)`, returning an integer in `1..sides`. `seededRng(seed)`
is mulberry32 over a 32-bit seed with rejection sampling, so every face is equally likely
(play uses it). It rejects a die size that is not an integer in `1..1000`
(`MAX_SIDES`, matching the dice parser's sides limit) with `RngContractError`. `scriptedRng(faces)` returns a fixed face list and exposes `remaining()` and
`calls()` (tests use it); it throws `ScriptedDiceError` when exhausted or out of range. Dice
parsing (`parseDiceExpression`) supports `NdS`, keep-highest/lowest (`kh`/`kl`), and modifiers,
with hard limits (count 100, sides 1000, 20 terms, 200 characters, modifier +/-1000) that
refuse with `DICE_LIMIT_EXCEEDED`.

## Roll ledger

Every state change is an event that records a `reason` and, for mutations, `before` and
`after` values (for example HP pairs, or `null` to a combatant on add). Roll events record
each term's faces, which were kept, the modifier and the total, so a recorded roll can be
audited without re-running the RNG. Attack and check events also record the AC or DC, its
source and the outcome.

## Refuse before draw

A handler runs every refusal check before it calls `rollDie`. A refused command consumes no
dice, so the RNG stream is unchanged after a refusal. Refusals carry a code from
`RefusalCodeSchema` (for example `TARGET_AC_UNKNOWN`, `D20_TERM_REQUIRED`, `NOT_DYING`,
`NO_SLOT_AVAILABLE`), a message and optional detail. A broken RNG contract (a face outside
`1..sides`, or a die size outside `1..1000`) throws `RngContractError` rather than refusing.

## Boundary rule

The purity rule is enforced twice. `biome.json` has an override scoped to
`packages/dnd5e-engine/src/**` that denies database, network and model packages, `node:*`
and Node builtins, app packages and the `**/apps/**` path (via `noRestrictedImports`), plus
`Date`, `performance`, timers, `fetch`, `WebSocket`, `process`, `crypto` and `require` (via
`noRestrictedGlobals`). `pnpm check:boundaries` proves it fires against fixtures under
`fixtures/boundary-violations/packages/dnd5e-engine/` (see [[ci-pipeline]]), and
`test/purity.test.ts` scans every import specifier under `src/`. `test/coverage.test.ts` is
a meta-test: every command type and refusal code must appear in a test file.

## R8 ruling

Research R8 (spec FR-018 to FR-023): the engine owns the arithmetic for attack, save and
check resolution (natural 20 critical, natural 1 miss, total meets or beats AC/DC),
resistance, immunity and vulnerability per damage component (halve rounding down, double),
and critical damage (dice doubled, modifiers not). Adjudication - the DM runtime or an LLM
node - supplies inputs as data: the expression, roll mode, target AC or DC, a per-command
defense set, or an automatic-failure reason on `check.roll`. It never computes outcomes.
The engine does not derive automatic failure from conditions.

## Connections

Rules context lives in [[overview]] (planned direction). The package sits in the root
project references ([[monorepo-and-toolchain]]) and its tests are a separate project
([[test-suite]] covers the server's).
