import type { EngineEvent } from "@the-stacks/dnd5e-engine";
import {
  type Edge,
  occupants,
  type Space,
  type SpaceView,
  type Zone,
  type ZoneId,
  zoneOf,
} from "@the-stacks/space";
import type { ZoneRevealed } from "../events/space.js";
import type { Viewer } from "../visibility.js";
import type { SessionProjections } from "./types.js";

/**
 * One viewer's space, the players' map, and the placements that viewer may see
 * (specs/100-spatial-events/contracts/spatial-projection.md). Structurally a `SpaceView`.
 */
export interface SpatialView {
  /** The space this viewer may see: the engine space (DM) or the players' map (player). */
  space: Space | null;
  /** The players' map: the fold of zone.revealed. Identical for every viewer. */
  map: { zones: Zone[]; edges: Edge[] } | null;
  /** Combatant id -> zone id, as this viewer last saw it. */
  placements: Readonly<Record<string, ZoneId>>;
}

export const EMPTY_SPATIAL: SpatialView = {
  space: null,
  map: null,
  placements: {},
};

const pairKey = (e: Edge): string =>
  e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;

function mergeById<T>(
  old: readonly T[],
  incoming: readonly T[],
  key: (t: T) => string,
): T[] {
  const order = old.map(key);
  const byKey = new Map(old.map((t) => [key(t), t]));
  for (const t of incoming) {
    const k = key(t);
    if (!byKey.has(k)) order.push(k);
    byKey.set(k, t);
  }
  return order.map((k) => byKey.get(k) as T);
}

/** Folds one `zone.revealed` row. Every viewer folds the same map. */
export function foldReveal(
  spatial: SpatialView,
  viewer: Viewer,
  payload: ZoneRevealed,
): SpatialView {
  const map = payload.reset
    ? { zones: [...payload.zones], edges: [...payload.edges] }
    : {
        zones: mergeById(spatial.map?.zones ?? [], payload.zones, (z) => z.id),
        edges: mergeById(spatial.map?.edges ?? [], payload.edges, pairKey),
      };
  let placements: Record<string, ZoneId> = { ...spatial.placements };
  if (payload.reset && viewer.role !== "dm") {
    const onMap = new Set(map.zones.map((z) => z.id));
    placements = Object.fromEntries(
      Object.entries(placements).filter(([, zoneId]) => onMap.has(zoneId)),
    );
  }
  Object.assign(placements, payload.occupants);
  return {
    space: viewer.role === "dm" ? spatial.space : { ...map },
    map,
    placements,
  };
}

/** Folds the spatial engine rows a viewer receives into placements (and the DM's space). */
export function foldPlacement(
  spatial: SpatialView,
  viewer: Viewer,
  event: EngineEvent,
): SpatialView {
  switch (event.type) {
    case "space.defined":
      // A player never receives this row: the gate writes it `dm`. Fail closed.
      return viewer.role === "dm"
        ? { ...spatial, space: event.after }
        : spatial;
    case "combatant.added":
      return event.after.placement
        ? {
            ...spatial,
            placements: {
              ...spatial.placements,
              [event.combatantId]: event.after.placement.zoneId,
            },
          }
        : spatial;
    case "combatant.placed":
    case "combatant.moved": {
      const placements = { ...spatial.placements };
      if (event.after === null) delete placements[event.combatantId];
      else placements[event.combatantId] = event.after.zoneId;
      return { ...spatial, placements };
    }
    case "combatant.removed": {
      const placements = { ...spatial.placements };
      delete placements[event.combatantId];
      return { ...spatial, placements };
    }
    default:
      return spatial;
  }
}

/** A viewer's SpatialView, derived from the DM projection `p`. */
export function spatialFor(p: SessionProjections, viewer: Viewer): SpatialView {
  if (viewer.role === "dm") return p.spatial;
  const map = p.spatial.map;
  const onMap = new Set((map?.zones ?? []).map((z) => z.id));
  return {
    space: map ? { zones: map.zones, edges: map.edges } : null,
    map,
    placements: Object.fromEntries(
      Object.entries(p.spatial.placements).filter(([, zoneId]) =>
        onMap.has(zoneId),
      ),
    ),
  };
}

/** Other combatants in the same zone, sorted; [] when unplaced. Zone-mode reach is `engaged`. */
export function reachOf(view: SpaceView, combatantId: string): string[] {
  const zone = zoneOf(view, combatantId);
  if (zone === null) return [];
  return occupants(view, zone).filter((id) => id !== combatantId);
}

export type TargetStatus = "ok" | "unseen" | "unknown";

/** Whether a viewer may name a target. `p` is the DM projection. */
export function targetStatus(
  p: SessionProjections,
  viewer: Viewer,
  ref: { kind: "actor" | "zone" | "entity"; id: string },
): TargetStatus {
  const view = spatialFor(p, viewer);
  const seen = (zoneId: string): boolean =>
    viewer.role === "dm" ||
    (view.space?.zones.some((z) => z.id === zoneId) ?? false);
  if (ref.kind === "actor") {
    const zoneId = p.spatial.placements[ref.id];
    return zoneId === undefined || seen(zoneId) ? "ok" : "unseen";
  }
  const zone = p.engine.space?.zones.find((z) => z.id === ref.id);
  if (!zone || (ref.kind === "entity" && zone.kind !== "feature")) {
    return "unknown";
  }
  return seen(ref.id) ? "ok" : "unseen";
}
