---
name: space
description: The zone-mode space package (packages/space, spec 094, TASK-0270) - pure zod Space, Zone, Edge, Placement and Band schemas, cheapest-path and band graph rules, reach and range rules, and SpaceView. Read before touching zones, movement, band checks, or the engine's placement state.
kind: component
sources:
  - packages/space/package.json
  - packages/space/src/index.ts
  - packages/space/src/schema.ts
  - packages/space/src/graph.ts
  - packages/space/src/rules.ts
  - packages/space/src/view.ts
  - packages/dnd5e-engine/src/space.ts
  - packages/dnd5e-engine/src/commands/move.ts
verified_against: f1676535f62847ef4ac0571639c6ca60b993bb94
---

# Space

`@the-stacks/space` holds the zone-mode geometry as pure data and pure functions. Its only runtime dependency is `zod`. A Biome override on `packages/space/src/**` forbids the engine, session model, intent, app packages, node modules, `Date`, `fetch`, `process` and DOM globals ([[monorepo-and-toolchain]], [[ci-pipeline]]). The engine imports space, never the reverse, so `ZoneIdSchema` copies the engine's id pattern (`^[a-z0-9][a-z0-9_.:-]{0,63}$`).

## Schemas

- `SpaceSchema`: `zones` (at most 64) and `edges` (at most 256). It refuses a duplicate zone id, a self-edge, an edge naming an unknown zone and two edges between the same pair.
- `ZoneSchema`: `id`, `name`, `kind` (`room`, `area`, `feature`), `tags` (default empty), `hidden` (default false).
- `EdgeSchema`: `from`, `to`, `kind` (`open`, `door`, `squeeze`, `climb`, `blocked`) and `feet` (a multiple of 5, 5..1000). Edges are undirected.
- `PlacementSchema` is `{ zoneId }`. `BandSchema` is `engaged`, `near`, `far`, `out`.

## Rules

- `path(space, from, to)` is the cheapest path over non-blocked edges (Dijkstra), or `null`. Squeeze and climb edges cost double feet. Equal-cost paths tie-break by the lexicographic order of the zone id list. The result is `{ zones, feet }`. The non-blocked adjacency list is cached per `Space` object (a `WeakMap`; spaces are immutable values), and routes are rebuilt from predecessor links only on a cost tie and for the result.
- `band(space, a, b)` counts the fewest passable edges: same zone `engaged`, one edge `near`, two `far`, else (or an unknown zone) `out`. `BAND_FEET` gives the nominal distance: engaged 5, near 30, far 120.
- `reachCovers(band, reachFt)` is true only at `engaged` with reach of at least 5 ft.
- `rangeOf(band, { normal, long })` returns `normal`, `long` (disadvantage) or `out` by comparing the band's nominal feet.

## SpaceView

`SpaceView` is `{ space, placements }`, a space (or null) plus an actor-to-zone record. `zoneOf`, `occupants` (sorted ids) and `bandBetween` (null when the space or either placement is missing) read it. The engine builds it in one place, `spaceViewOf` in `src/space.ts`, from combatant placements ([[dnd5e-engine]]).

## Engine movement (spec 094)

Spec 094 (TASK-0270). `EngineState.space` holds the scene's zone graph ([[space]]); a `Combatant` may carry `placement` (`{ zoneId }`) and `speed` (feet, 0..200); `combatant.add` accepts both. A state with a placement but no space, or in an unknown zone, fails `INVALID_STATE`.
Four commands (`src/commands/move.ts`): `space.define` sets or replaces the space and refuses `ZONE_IN_USE` when a placed combatant's zone is dropped; `combatant.place` sets or clears a placement with no edge or speed check (`SPACE_UNDEFINED`, `ZONE_UNKNOWN`); `move` walks a placed combatant to `toZoneId` along the cheapest open path and refuses `NOT_PLACED`, `MOVE_BLOCKED`, `MOVE_OFF_TURN`, `MOVE_OVER_SPEED` and, in an encounter, `STAT_UNDEFINED` without a speed; `movement.action` records `dash` or `disengage` on the active combatant's turn. Events: `space.defined`, `combatant.placed`, `combatant.moved` (with `path` and `feet`), all `v: 1`.
Speed budget: `effectiveSpeed` is 0 under grappled, paralyzed, petrified, restrained or unconscious, else speed minus 5 ft per exhaustion level. A move costs the path feet, doubled when prone. `movementLeft` is speed times (1 + dashes) minus `Encounter.movement.usedFt`; a record for another combatant or round reads as nothing used. Outside an encounter a move has no budget. A move in an encounter also emits `encounter.changed` carrying the new `movement`.
`provokers(state, moverId, toZoneId)` lists who may take an opportunity attack when a mover leaves: conscious, able, same origin zone, Reaction unspent, with a non-ranged attack, in initiative order; none after a disengage. Only the origin zone provokes. The engine knows no sides, so callers filter by hostility.
`spaceViewOf(state)` (`src/space.ts`) is the one place the engine builds a `SpaceView`. `attack.roll` with an attack entry uses it for band checks ([[dnd5e-engine-reactions]]).

## Fog (spec 100)

Fog, `zone.revealed`, the per-viewer `spatial` projection, `spatialFor`, `reachOf` and `targetStatus` are built in [[zone-fog]] on top of `SpaceView`.

## Boundary

Space knows no combatants, speed, turns or dice. The engine owns the commands (`space.define`, `combatant.place`, `move`, `movement.action`), the speed budget, opportunity-attack `provokers` and the band checks on attacks ([[dnd5e-engine]], [[dnd5e-engine-reactions]]). Grid mode is not built; band distances and origin-zone-only provocation are zone-mode simplifications marked `ponytail:` in code.

The planner ([[planner]]) is a consumer: it reads `bandBetween`, `reachCovers` and `rangeOf` for attack and help reach, and passes the engine's `spaceViewOf` view into `plan()`.
