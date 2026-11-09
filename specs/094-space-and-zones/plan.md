# Implementation Plan: Space package and zones in the engine

**Branch**: `task-0270-space-zones` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/094-space-and-zones/spec.md`

The spec holds the seam contracts, so this plan has no separate data-model.md, research.md,
contracts/ or quickstart.md.

## Summary

Add `packages/space`: Zod schemas for a zone graph, cheapest paths, range bands, and reach and
range rules, plus the `SpaceView` read model. Give the engine an optional `space` and per-combatant
`placement` and `speed`. Add `space.define`, `combatant.place`, `move` and `movement.action`.
Check reach and range by band in `attack.roll`. Add `provokers()` for opportunity attacks. Map
speed, reach and range from SRD data in the server seed code. No planner, gate, session event,
projection or UI work.

## Technical Context

**Language/Version**: TypeScript, Node 22, ES2022 target, as the repo.

**Primary Dependencies**: `zod ^4.6.5` only. **No new third-party dependency.** Path search is a
hand-written Dijkstra over at most 64 zones; no graph library.

**Workspace dependency added**: `@the-stacks/dnd5e-engine` → `@the-stacks/space` (`workspace:*`).
target-architecture §8 draws this edge ("space → dnd5e-engine").

**Storage**: none. **No migration.** Engine events ride the existing mechanics envelope.

**Testing**: Vitest under `packages/space/test/` and `packages/dnd5e-engine/test/`, scripted dice.

**Target Platform**: pure library; importable by server and browser.

**Project Type**: monorepo packages.

**Performance Goals**: `path`/`band` < 1 ms on 64 zones (SC-005). Serves the fact-row budget
(constitution IX: fact rows < 1 s p95).

**Constraints**: pure; no clock, no I/O, no `node:*`, no renderer, no React (constitution V, VI).

**Scale/Scope**: about 5 space source files, 4 engine source files changed, 2 new engine command
files, 1 biome override, 4 boundary fixtures, about 6 test files, 2 server seed files.

## Design

### `packages/space` layout

```
packages/space/
  package.json         # "@the-stacks/space"; deps: zod; devDeps: vitest, @types/node
  tsconfig.json        # extends ../../tsconfig.base.json; rootDir src; no references
  vitest.config.ts     # include test/**/*.test.ts
  README.md            # band convention (OQ-7), edge costs (OQ-8), versioning note
  src/
    index.ts           # the exports in spec "Seam contracts", nothing more
    schema.ts          # ZoneIdSchema, ZoneSchema, EdgeSchema, SpaceSchema, PlacementSchema, BandSchema
    graph.ts           # path(), band(), BAND_FEET
    rules.ts           # reachCovers(), rangeOf()
    view.ts            # SpaceView type, zoneOf(), occupants(), bandBetween()
  test/
    tsconfig.json
    schema.test.ts     # refinements: duplicates, unknown zones, self-edges, caps
    graph.test.ts      # paths, costs, blocked, ties, bands, a 64-zone timing test
    view.test.ts       # view queries, null space, unplaced actors
    purity.test.ts     # imports only zod or relative; package.json deps === ["zod"]
```

`ZoneIdSchema` copies the engine's id regex. space must not import the engine (the engine imports
space). A copy keeps the dependency one-way.

`band()` counts edges on the fewest-edge passable path (BFS). `path()` minimises feet (Dijkstra).
The two can disagree on a route. Bands describe distance; feet describe movement (OQ-7).

### Engine changes

**`src/schema/state.ts`**

- `CombatantSchema` gains `placement: PlacementSchema.optional()` and
  `speed: z.number().int().min(0).max(200).optional()`.
- `AttackEntrySchema` gains `reachFt: z.number().int().min(5).max(30).optional()` and
  `rangeFt: z.object({ normal, long }).optional()` (feet, 5–1000, `normal <= long`).
- `EncounterSchema` gains optional `movement: { combatantId, round, usedFt, dashes, disengaged }`.
  A record whose `round`/`combatantId` differs from the active turn reads as zero movement used.
  So `turn.advance` needs no edit.
- `EngineStateSchema` gains `space: SpaceSchema.optional()`. Its superRefine checks each placement
  names a zone of the space, and that no placement exists without a space.

**`src/schema/commands.ts`**: add `space.define`, `combatant.place`, `move`, `movement.action`
(shapes in spec "Engine commands"). `CombatantInit` gains optional `placement` and `speed`.

**`src/schema/events.ts`**: add `space.defined`, `combatant.placed`, `combatant.moved` (shapes in
spec "Engine events"). Each carries `before`/`after`, so the ledger's default change row and
session-model's derived `MECHANICS_EVENT_TYPES` take them with no edit.

**`src/schema/refusals.ts`**: add the nine codes in spec "New engine refusal codes".

**`src/evolve.ts`**: three new cases: set `state.space`; set or delete `combatants[id].placement`.

**New `src/commands/move.ts`**: `handleSpaceDefine`, `handleCombatantPlace`, `handleMove`,
`handleMovementAction`. Also `effectiveSpeed`, `movementLeft` and `provokers`:

- `effectiveSpeed(c)`: `null` without `speed`; 0 under grappled, paralyzed, petrified, restrained
  or unconscious; else `max(0, speed − 5 × exhaustion level)`.
- `movementLeft(state, id)`: `null` outside an encounter; else
  `effectiveSpeed × (1 + dashes) − usedFt` for the active combatant's current record.
- `handleMove` order: mover exists and able (`UNKNOWN_COMBATANT`, `ACTOR_UNABLE`) → space and
  placement (`SPACE_UNDEFINED`, `NOT_PLACED`, `ZONE_UNKNOWN`, same zone `INVALID_COMMAND`) →
  `path()` (`MOVE_BLOCKED`) → in an encounter: active check (`MOVE_OFF_TURN`), speed
  (`STAT_UNDEFINED`), cost × 2 if prone, budget (`MOVE_OVER_SPEED`) → emit `combatant.moved`,
  then `encounter.changed` with the updated movement record (encounter only).
- `provokers` filters per FR-023 and returns ids in `encounter.order` order. It carries a
  `ponytail:` comment for OQ-2 (origin zone only; grid mode lifts it).

**New `src/space.ts`**: `spaceViewOf(state)`, the one place the engine builds a `SpaceView`.

**`src/commands/combatants.ts`**: `combatant.add` copies `placement` and `speed`; refuses
`ZONE_UNKNOWN` (or `SPACE_UNDEFINED` when a placement is given with no space).
`combatant.remove` needs no change (the placement leaves with the combatant).

**`src/commands/attacks.ts`**: after the entry is found and before any draw, when the state has a
space and both combatants are placed: compute `band`; apply FR-020, FR-021, FR-021a. A long-range
use adds `"disadvantage"` to the mode sources. Explicit-expression attacks skip the check.

**`src/execute.ts`**: register the four handlers (one line each).

**`src/index.ts`**: export the new functions; re-export `Space`, `Zone`, `Placement`, `Band`,
`SpaceView` types from `@the-stacks/space` so engine consumers need no second import for types.

**`package.json`**: add `"@the-stacks/space": "workspace:*"` to `dependencies`.
**`tsconfig.json`**: add `references: [{ "path": "../space" }]`.
**`test/purity.test.ts`**: allow the `@the-stacks/space` specifier beside `zod` and relative paths.
**`README.md`**: one bullet each for `move`, `combatant.place`, `space.define`, `movement.action`.

### Server seed mapping (`apps/server/src/dm/seed/`)

- `combatants.ts` `combatantFromSrd`: `speed: monster.speed.walk`.
- `combatants.ts` `statsFromSrd`: `reachFt: atk.reach`, `rangeFt: atk.range` when the SRD record
  has them.
- `combatants.ts` `statsFromCharacter`: `rangeFt` from the SRD weapon's `range`; `reachFt: 10`
  when the weapon's properties include `Reach`, else 5.
- Seed PCs: `CombatantInitSchema` derives from the engine, so `speed` is accepted with no
  `schema.ts` edit. Add `speed` to each PC's `combatant` in `apps/server/seeds/*.json`
  (4 files; 30 unless the sheet says otherwise).
- No zones in seeds. TASK-0271 adds them.

Resolve's spec-079 `move` step and `dm/reactions.ts` stay untouched. With no space in any seed,
no attack takes a band check in play, so play behaviour is unchanged (SC-004).

### Root and tooling

- `tsconfig.json` (root): add `packages/space` and `packages/space/test` references.
- `biome.json`: one override for `packages/space/src/**` and
  `fixtures/boundary-violations/packages/space/**`, `noRestrictedImports`:
  paths `react`, `react-dom`, `pixi.js`, `@pixi/react`, `@the-stacks/dnd5e-engine`,
  `@the-stacks/session-model`, `@the-stacks/intent`, `@the-stacks/server`, `@the-stacks/web`,
  `@the-stacks/shared`, `pg`, `ws`, `hono`, `openai`, `@anthropic-ai/sdk`;
  patterns `node:*`, `**/apps/**`, `fs`, `http`, `https`, `net`.
  `noRestrictedGlobals`: `Date`, `fetch`, `process`, `window`, `document`.
  Messages cite constitution V.
- `fixtures/boundary-violations/packages/space/src/`: `bad-react.ts`, `bad-pixi.ts`,
  `bad-engine.ts`, `bad-clock.ts`. `scripts/check-boundaries.mjs` finds them with no edit.
- `pnpm-lock.yaml`: regenerate with `pnpm install`. Never hand-merge it (runbook).

### Merge reconcile (runbook spine row 5)

TASK-0266 (`packages/intent`) also edits `biome.json`, root `tsconfig.json` and the lockfile.
Whichever merges second takes both overrides and both references, then reruns `pnpm install`.
TASK-0231 already split `docs/wiki/dnd5e-engine.md` on main: merge `origin/main` before the wiki
phase and edit the split notes.

## Files touched

| File | Change |
|---|---|
| `packages/space/**` (new, 13 files listed above) | new package |
| `packages/dnd5e-engine/package.json`, `tsconfig.json`, `README.md` | dependency, reference, bullets |
| `packages/dnd5e-engine/src/schema/{state,commands,events,refusals}.ts` | schema additions |
| `packages/dnd5e-engine/src/{evolve,execute,index}.ts` | cases, handlers, exports |
| `packages/dnd5e-engine/src/space.ts` (new) | `spaceViewOf` |
| `packages/dnd5e-engine/src/commands/move.ts` (new) | four handlers, speed, provokers |
| `packages/dnd5e-engine/src/commands/{combatants,attacks}.ts` | placement on add; band checks |
| `packages/dnd5e-engine/test/purity.test.ts` | allow `@the-stacks/space` |
| `packages/dnd5e-engine/test/commands/{move,opportunity}.test.ts` (new) | US1, US3 |
| `packages/dnd5e-engine/test/commands/{attacks,combatants}.test.ts` | US2, placement on add |
| `packages/dnd5e-engine/test/replay.test.ts` | new events replay |
| `packages/session-model/test/helpers.ts`, `catalog.test.ts` | engine examples for 3 new types; count 20 → 23, 39 → 42 |
| `apps/server/src/dm/seed/combatants.ts` | speed, reachFt, rangeFt |
| `apps/server/seeds/*.json` (4) | PC `speed` |
| `apps/server/test/dm/seed-stats.test.ts` | speed, reach, range mapping |
| `biome.json`, root `tsconfig.json`, `pnpm-lock.yaml` | boundary, references, lockfile |
| `fixtures/boundary-violations/packages/space/src/*.ts` (4 new) | boundary fixtures |
| `docs/wiki/space.md` (new), `dnd5e-engine*.md`, `monorepo-and-toolchain.md`, `overview.md`, `srd-data.md`, `INDEX.md`, `CAPSULES.md` | wiki phase |

`apps/server/test/gate.integration.test.ts:1022` counts log rows, not event types; it needs no
edit. `apps/server/test/session.integration.test.ts` reads `MECHANICS_EVENT_TYPES` dynamically.

## Test strategy

- **Scripted dice for every new command** (constitution VI). `move`, `combatant.place`,
  `space.define` and `movement.action` draw no dice; their tests assert `scriptedRng([])` is never
  called, as `initiative.leave` tests do.
- **Golden OA test** (`opportunity.test.ts`): a fixed sequence and fixed faces produce a fixed
  event list, compared with `toEqual`. Covers hit, miss, drop-to-0 then refused move, disengage,
  and spent Reaction.
- **Coverage meta-test** must pass: every new command type in a command test file; every new
  refusal code asserted by `expectRefusal`.
- **Back-compat**: every existing engine and session-model test passes unchanged.
- **Space**: property-style test over a seeded random graph (mulberry32 in the test file):
  `band(a,b) === band(b,a)`, `path` cost is minimal against a brute-force check on ≤ 8 zones.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0.

- [x] **I. Agent-operable**: the engine commands serve every seat alike; the planner (TASK-0267)
      maps `move`, `move_token`, `dash`, `disengage` Intents onto them.
- [x] **II. One Intent vocabulary**: no write path added; no surface calls the engine.
- [x] **III. Event sourcing**: positions change only by versioned engine events through the gate
      as mechanics rows. Hidden zones carry `hidden`; TASK-0271 filters per viewer.
- [x] **IV. Data planes**: all new state is session-plane engine state.
- [x] **V. Many views, one state**: geometry lives in renderer-free `space`; positions have one
      store (engine state); `SpaceView` is a projection.
- [x] **VI. Engine owns the numbers**: speed, cost, reach, range and OA eligibility are engine
      code; scripted-dice tests ship; purity test and boundary lint extend to `space`.
- [x] **IX. UX quality bar**: pure synchronous math well inside the fact-row budget (SC-005).
- [x] **XI. Operator-owned content**: SRD 5.2.1 ids cited; no book text.
- [x] **XIII. Just-in-time**: R1 card; every deferral is an open question for the orchestrator
      to card (OQ-3, OQ-4, OQ-10).
- VII, VIII, X, XII: not applicable.

**Quality gate "Engine tests"**: met by the scripted-dice and golden tests above.

**Stack conformance**: Zod is the single schema source; `space` is a declared package seam
(Architecture Constraints, "Package seams"). **Complexity Tracking**: none.
