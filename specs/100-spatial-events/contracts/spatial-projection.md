# Contract: the per-viewer spatial projection

**Status**: Draft (spec 100, TASK-0271). Binding once TASK-0271 merges. Extends
`specs/028-session-model/contracts/projections.md` (`SessionProjections`) and `package-api.md`
(exports). Consumers: TASK-0268 (gate, `PlanState`), TASK-0277 (zone chips, `@` targeting), the
DM runtime's actor snapshot, the R5 board.

## 1. Shape

```ts
// packages/session-model/src/projections/spatial.ts
import type { Edge, Space, Zone, ZoneId } from "@the-stacks/space";

export interface SpatialView {
  /** The space this viewer may see: the engine space (DM) or the players' map (player). */
  space: Space | null;
  /** The players' map: the fold of zone.revealed. Identical for every viewer. */
  map: { zones: Zone[]; edges: Edge[] } | null;
  /** Combatant id -> zone id, as this viewer last saw it. */
  placements: Readonly<Record<string, ZoneId>>;
}

export interface SessionProjections {
  // ...existing fields...
  spatial: SpatialView;   // { space: null, map: null, placements: {} } initially
}
```

`SpatialView` is structurally a `SpaceView` (`@the-stacks/space`) plus `map`. Pass it wherever a
`SpaceView` is wanted: `zoneOf`, `occupants`, `bandBetween`, the planner's `space` argument.

`map` is `null` until the first `zone.revealed`. `space` is `null` for a player until then, and
`null` for the DM until the first `space.defined`.

## 2. Fold rules (`project`, `applyEvent`)

| Row (as received) | DM viewer | Player viewer |
|---|---|---|
| `space.defined` | `space` = `after` | never received (`dm`) |
| `zone.revealed` `reset: true` | `map` = `{zones, edges}`; placements merge `occupants` | same; `space` = `map`; placements drop ids whose zone left `map`, then merge `occupants` |
| `zone.revealed` `reset: false` | `map` merges zones and edges by id (last wins); placements merge `occupants` | same; `space` = `map` |
| `combatant.added` with `after.placement` | `placements[id]` = zone | same |
| `combatant.placed` | `placements[id]` = `after.zoneId`, or delete on `null` | same |
| `combatant.moved` | `placements[id]` = `after.zoneId` | same |
| `combatant.removed` | delete `placements[id]` | same |

Edges merge by the unordered pair `{from, to}`. Zones merge by `id`.

The DM's `placements` equals `spaceViewOf(p.engine).placements` after every row. A player's
`placements` never names a zone outside its `map`. Both are invariants the parity test checks.

The ledger gains one `change` row per `zone.revealed`: `type: "zone.revealed"`, `subject: null`,
`before: null`, `after: { zones: <names>, reset }`, `reason` from the payload.

## 3. Reads

```ts
/** A viewer's SpatialView, derived from the DM projection. */
export function spatialFor(p: SessionProjections, viewer: Viewer): SpatialView;

/** Other combatants in the same zone, sorted; [] when unplaced. Zone-mode reach is `engaged`. */
export function reachOf(view: SpaceView, combatantId: string): string[];

export type TargetStatus = "ok" | "unseen" | "unknown";

/** Whether a viewer may name a target. `p` is the DM projection. */
export function targetStatus(
  p: SessionProjections,
  viewer: Viewer,
  ref: { kind: "actor" | "zone" | "entity"; id: string },
): TargetStatus;
```

`spatialFor(p, { role: "dm" })` returns `p.spatial`. For a player it returns:

- `space` and `map`: `p.spatial.map`.
- `placements`: every engine placement whose zone is on `p.spatial.map`.

**Parity.** For every log the gate planned from public proposals, `project(log, player).spatial`
deep-equals `spatialFor(project(log, dm), player)`. A `dm`-visibility proposal may break this on
purpose (spec, Edge Cases). The parity test uses public proposals only.

`targetStatus` rules, in order:

| `ref.kind` | `unknown` when | `unseen` when | else |
|---|---|---|---|
| `zone` | no space, or the id is not in `p.engine.space` | the zone is not on the viewer's `space` | `ok` |
| `entity` | the id is not a `feature` zone in `p.engine.space` | as `zone` | `ok` |
| `actor` | never (the planner's `TARGET_NOT_PRESENT` owns absence) | the combatant is placed in a zone not on the viewer's `space` | `ok` |

An `actor` id with no combatant, or an unplaced combatant, is `ok`: fog hides zones, not actors
who stand nowhere. A DM viewer never gets `unseen`.

TASK-0268 maps `ok` to `seen: true`, `unseen` to `seen: false`, and `unknown` to the planner's
`TARGET_NOT_PRESENT` path.

## 4. Gate exports

```ts
/** Spec 100 fog rule; see zone-revealed.md §3. Pure. */
export function fogRows(p: SessionProjections, rows: readonly PlannedRow[]): PlannedRow[];

/** Spec 100 explicit reveal; see zone-revealed.md §4. Pure. */
export function revealRows(
  p: SessionProjections, actor: string, zoneIds: readonly string[], reason: string,
): { ok: true; rows: PlannedRow[] } | { ok: false; refusal: GateRefusal };
```

## 5. Package exports

`@the-stacks/session-model` main entry gains: `ZoneRevealedV1`, `ZoneRevealed` (type),
`SpatialView` (type), `TargetStatus` (type), `spatialFor`, `reachOf`, `targetStatus`, `fogRows`,
`revealRows`. Nothing else. The fixtures entry gains the `spatialFog` fixture.

## 6. What a player client receives, end to end

1. The gate plans rows from the DM projection and passes them through `fogRows`.
2. `appendSessionEvents` writes them with their visibility. Nothing in the append seam changes.
3. The registry's `broadcast` and the replay loop call `canSee(viewer, row.visibility)`. A `dm` row
   is never sent to a player connection. Nothing in `ws/` changes.
4. The client folds what it receives with `project(events, viewer)` and reads `spatial`.

No client-side filter exists or is needed. The secrecy boundary is the row visibility the gate
writes.
