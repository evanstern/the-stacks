---
name: zone-fog
description: Zone fog and the per-viewer spatial projection (spec 100, TASK-0271) - the gate's pure fog rule (fogRows, revealRows), the public zone.revealed event, SessionProjections.spatial, spatialFor, reachOf, targetStatus, and why a client never receives a hidden position. Read before changing spatial rows, reveals or zone targeting.
kind: component
sources:
  - packages/session-model/src/gate/fog.ts
  - packages/session-model/src/events/space.ts
  - packages/session-model/src/projections/spatial.ts
  - packages/session-model/src/gate/plan.ts
  - packages/session-model/src/fixtures/spatial-fog.ts
verified_against: 17849584ad75728e4df27bee4a34d3e35cb86229
---

# Zone fog

Fog is zone-granular and party-wide ([[space]] holds the geometry, [[session-model]] the fold). The **players' map** is the fold of public `zone.revealed` rows, so every viewer holds the same map. A zone is **fogged** when the engine space holds it and the map does not. Secrecy is row visibility: the gate writes a row that names a fogged zone as `dm`, so `canSee` never delivers it to a player ([[subscriber-registry]]). Nothing in `ws/` filters zones.

## The event

`zone.revealed` v1 (`src/events/space.ts`; `state-change`, catalog visibility `any`, gate-written, always `public`) holds `{ reason, reset, zones, edges, occupants }`: zone records with `hidden: false`, engine edges with an end in `zones`, and combatant-to-zone placements. It has no `before` or `after`. `reset: true` replaces the map; `false` merges by zone id and edge pair. A client `send` of it refuses `CATALOG_TYPE_REQUIRES_GATE`. The package depends on `@the-stacks/space` for `ZoneSchema` and `EdgeSchema`.

## The fog rule

`fogRows(p, rows)` (`gate/fog.ts`; pure; `p` is the DM projection) runs inside `planProposal` after the plan and before validation (operator ruling 2026-11-09, spec 100 OQ-1; `specs/029-proposal-gate/contracts/gate-api.md` amended). It tracks the engine state and the map across a plan's rows. A `dm` or whisper row is never loosened. `space.defined` is written `dm`, then one reset reveal with the fixed reason "The party's view of the scene" (zones not hidden, already on the map, or holding a party combatant; no re-hiding). A spatial row naming no fogged zone is unchanged. A `combatant.added`, a party-subject row, or a row also naming a map zone reveals the fogged zones first (public `zone.revealed`, then the public row). Any other row naming fog is written `dm`. A non-DM projection fails closed. Mechanics envelope `index` and `count` do not change. `revealRows(p, actor, zoneIds, reason)` plans an explicit reveal for the `reveal` Intent (TASK-0268) and refuses an unknown zone `INVALID_PROPOSAL`.

## The projection

`SessionProjections.spatial` is `{ space, map, placements }`, a `SpaceView` plus `map`, folded from `zone.revealed` and the spatial engine rows (`projections/spatial.ts`). For the DM, `space` is the engine space and `placements` equal `spaceViewOf(engine).placements`. For a player both come from the map. Each reveal adds one ledger `change` row. `spatialFor(p, viewer)` derives a viewer's view from the DM projection; a player's folded view equals it for any log planned from public proposals (a `dm` proposal breaks parity on purpose). `reachOf(view, id)` lists others in the zone (zone-mode reach is `engaged`). `targetStatus(p, viewer, ref)` returns `ok`, `unseen` or `unknown` for an `actor`, `zone` or `entity` ref; a `feature` zone is an entity, an `area` as entity is `unknown`, the DM is never `unseen`.

Spec 099 events: `combatant.depart` plans a `combatant.placed` row with `after: null`; its `before` zone is named, so a hostile leaving a fogged zone stays `dm` and no zone reaches a player (`gate-fog.test.ts`). `combatant.side` names no zone and needs no fog rule.

## Consumers

Seeds declare zones and the DM runtime defines, places and gathers ([[seed-npc-presence]], [[dm-runtime]]); the snapshot renders zone and reach per view ([[actor-snapshot]]). The `spatialFog` fixture is built by planning proposals. Contracts: `specs/100-spatial-events/contracts/`.
