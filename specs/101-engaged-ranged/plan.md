# Implementation Plan: Engaged-only ranged penalty

**Branch**: `task-0306-engaged-ranged` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/101-engaged-ranged/spec.md`

## Summary

Add `Encounter.melee`, a list of hostile id pairs. A melee attack in one zone adds a pair; a
placement change, a leave or the encounter's end removes it. `closeCombatFoes` reads pairs
instead of zones. Every caller of `closeCombatSources` (`attack.roll`, `spell.cast`, the
planner's close-combat fact) follows without a signature change. `provokers` is untouched.

## Technical Context

**Language/Version**: TypeScript (repo toolchain), Zod schemas.

**Primary Dependencies**: none new. `@the-stacks/space` and Zod are already installed.

**Storage**: none. Engine state rides existing `encounter.changed` events.

**Testing**: vitest, scripted dice (`scriptedRng`), DB integration with `REQUIRE_DATABASE=1`.

**Target Platform**: the pure `dnd5e-engine` package; server tests consume it.

**Performance Goals**: O(pairs) per ranged roll; pairs are bounded by combatants squared.

**Constraints**: engine stays pure (constitution VI). No new event type, command or refusal code.

**Scale/Scope**: one PR, three phases.

## Design

### State

`packages/dnd5e-engine/src/schema/state.ts`, `EncounterSchema`:

```ts
// Spec 101: hostile pairs engaged in melee (the operator's "engaged"). Sorted ids, unique.
melee: z.array(z.tuple([CombatantIdSchema, CombatantIdSchema])).optional(),
```

Add a `superRefine` issue for a pair with equal ids. Order and uniqueness are the helpers' job.

### Selectors and helpers (`src/sides.ts`)

- `meleeFoes(state, id): string[]`: ids paired with `id` in `state.encounter?.melee`. Exported.
- `withMeleePair(enc, a, b): Encounter | null`: the encounter with the sorted pair added; `null`
  when the pair already exists. Internal.
- `withoutMelee(enc, id): Pick<Encounter, "melee">`: the `melee` slice with every pair holding
  `id` removed; `{}` when `melee` is missing. Internal. Mirrors `withoutSpent` in
  `encounter.ts`.
- `meleePairFor(state, attackerId, targetId): boolean`: FR-007 (active encounter, both placed in
  one zone, `areHostile`). Internal.
- `closeCombatFoes`: replace the zone filter with membership in `meleeFoes`. Keep the other
  filters and the invisible-attacker check. Replace the `ponytail:` comment:
  `ponytail: "within 5 feet" is a melee pair (spec 101); grid mode (R5) measures feet.`

### Commands

- `src/commands/attacks.ts` `handleAttackRoll`: after the roll, when `command.attack` is set,
  the use is melee (`!isRangedUse(...)`), and `meleePairFor` holds, compute `withMeleePair`. With
  `reaction`, build one `encounter.changed` whose `after` carries both the spent Reaction and the
  pair. Without `reaction`, push `encounter.changed` only when `withMeleePair` is non-null.
- `src/commands/spells.ts`: in the attack branch, for `d.range === "melee"`, the same rule and a
  separate `encounter.changed` when the pair is new.
- `src/commands/move.ts` `handleMove`: fold `withoutMelee(enc, c.id)` into the existing `after`.
  `handleCombatantPlace`: in an encounter, when `withoutMelee` changes the list, push
  `encounter.changed`.
- `src/commands/encounter.ts` `leaveEvents`: fold `withoutMelee(enc, id)` into its `after`.
  `endEvents` needs no edit: the encounter becomes `null`.
- `src/index.ts`: export `meleeFoes`.

### Planner

No source change. `packages/planner/src/combat.ts` `closeCombatFact` reads
`closeCombatSources`, which now reports pairs. Update its comment to cite spec 101.

### Event shape

`encounter.changed` `before`/`after` already use `EncounterSchema`. The optional field is
additive; `v` stays 1; older logs replay. The session-model catalog needs no edit.

## Files touched

Engine (Phase 1):

- `packages/dnd5e-engine/src/schema/state.ts`
- `packages/dnd5e-engine/src/sides.ts`
- `packages/dnd5e-engine/src/commands/attacks.ts`
- `packages/dnd5e-engine/src/commands/spells.ts`
- `packages/dnd5e-engine/src/commands/move.ts`
- `packages/dnd5e-engine/src/commands/encounter.ts`
- `packages/dnd5e-engine/src/index.ts`
- `packages/dnd5e-engine/README.md`
- `packages/dnd5e-engine/test/commands/melee.test.ts` (new: US1–US3 golden dice)
- `packages/dnd5e-engine/test/sides.test.ts`
- `packages/dnd5e-engine/test/commands/attacks.test.ts` (the "ranged attacks in close combat
  (spec 099)" block)
- `packages/dnd5e-engine/test/commands/spells.test.ts` (the "spell attacks in close combat
  (spec 099)" block)
- Any engine test whose exact event list for a sided, placed melee attack in an encounter gains
  the new `encounter.changed` (likely `opportunity.test.ts`, `reactions.test.ts`): adjust the
  expectation, do not change behaviour.

Planner and server (Phase 2):

- `packages/planner/src/combat.ts` (comment only)
- `packages/planner/test/combat.test.ts` ("close-combat fact": seed a pair; add a same-zone,
  no-pair case with no fact)
- `apps/server/test/dm/derived-numbers.integration.test.ts` (dice back to `[...INIT, 15, 4]`)
- `apps/server/test/dm/revealed-npc.integration.test.ts` (drop the duplicated `s.dice[1]` and
  the spec 099 comment)
- Any server or session-model test whose exact `encounter.changed` payload for a melee attack
  now carries `melee` (check `opportunity-attack.integration.test.ts`,
  `mid-fight-arrival.integration.test.ts`, `resolve.integration.test.ts`,
  `packages/session-model/test/ledger.test.ts`, `gate-plan.test.ts`).

Wiki (Phase 3):

- `docs/wiki/dnd5e-engine-sides.md`, `docs/wiki/dnd5e-engine-derived-rolls.md`,
  `docs/wiki/dnd5e-engine-reactions.md`, `docs/wiki/dnd5e-engine.md`, `docs/wiki/space.md`,
  `docs/wiki/planner.md`, `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`.

No migration. No new runtime dependency.

## Test strategy

- **Golden dice** (`melee.test.ts`): a one-zone `reed-camp` space plus a `camp-post` zone 5 ft
  away; Kestrel (party, Shortbow, Dagger, a ranged spell attack via stats) and four goblins
  (hostile, Scimitar) placed in `reed-camp`; an active encounter. Scenarios US1.1–US1.2,
  US2.1–US2.6, US3.1–US3.7, each with `scriptedRng` and an asserted mode and draw count.
- **Selectors** (`sides.test.ts`): `meleeFoes` with none, one, several pairs, and no encounter;
  `closeCombatFoes` same-zone without a pair is `[]`; each spec 099 filter on a paired foe.
- **Back-compat**: a state with no `melee` field parses and reads as no pairs; `provokers`
  tests pass unchanged.
- **DB**: the two `c57d756b` tests pass with one d20 under `REQUIRE_DATABASE=1`.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0.

- [x] **I. Agent-operable**: pairs form through the `attack` and `cast` Intents every seat sends.
- [x] **II. One Intent vocabulary**: no new Intent kind or write path.
- [x] **III. Event sourcing**: pairs change only through versioned `encounter.changed` events;
      an additive optional field keeps old logs replayable.
- [x] **IV. Data planes**: session-plane engine state only.
- [x] **V. Many views, one state**: pairs have one store, the engine encounter. No view caches
      them.
- [x] **VI. Engine owns the numbers**: the pair rule and the mode are engine code; the planner
      only reports. Scripted-dice tests cover every changed command.
- [x] **VII. Narration around facts**: the roll mode is an existing fact row.
- [x] **IX. UX quality bar**: O(pairs) per roll. No UI change.
- [x] **XI. Operator-owned content**: SRD 5.2.1 rule ids only.
- [x] **XIII. Just-in-time**: R1 card; deferrals are open questions for the orchestrator to card
      (OQ-1, OQ-4).
- VIII, X, XII: not applicable.

**Stack conformance**: Zod is the single schema source. **Complexity Tracking**: none.
