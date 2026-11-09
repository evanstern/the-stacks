import { band } from "./graph.js";
import type { Band, Space, ZoneId } from "./schema.js";

/** A space plus where actors stand. Pure data; the engine builds it. */
export type SpaceView = {
  space: Space | null;
  placements: Readonly<Record<string, ZoneId>>;
};

export function zoneOf(view: SpaceView, actorId: string): ZoneId | null {
  return view.placements[actorId] ?? null;
}

export function occupants(view: SpaceView, zoneId: ZoneId): string[] {
  return Object.keys(view.placements)
    .filter((id) => view.placements[id] === zoneId)
    .sort();
}

export function bandBetween(
  view: SpaceView,
  a: string,
  b: string,
): Band | null {
  const za = zoneOf(view, a);
  const zb = zoneOf(view, b);
  if (view.space === null || za === null || zb === null) return null;
  return band(view.space, za, zb);
}
