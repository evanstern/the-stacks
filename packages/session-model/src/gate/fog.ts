import { type EngineEvent, evolve } from "@the-stacks/dnd5e-engine";
import type { Edge, Space, Zone } from "@the-stacks/space";
import { MECHANICS_EVENT_TYPES } from "../catalog.js";
import { type ZoneRevealed, ZoneRevealedV1 } from "../events/space.js";
import { DM_ONLY, PUBLIC } from "../ids.js";
import type { SessionProjections } from "../projections/types.js";
import type { PlannedRow } from "./plan.js";
import type { GateRefusal } from "./refusals.js";

/** The fixed reason of a reset reveal: it never copies a `space.defined` reason. */
export const RESET_REASON = "The party's view of the scene";

type EngineState = SessionProjections["engine"];
type Map_ = { zones: Zone[]; edges: Edge[] } | null;

const SPATIAL = new Set([
  "space.defined",
  "combatant.added",
  "combatant.removed",
  "combatant.placed",
  "combatant.moved",
]);
const MECHANICS = new Set(MECHANICS_EVENT_TYPES);

const pairKey = (e: Edge): string =>
  e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;

function engineEventOf(row: PlannedRow): EngineEvent | null {
  if (!MECHANICS.has(row.type)) return null;
  const event = (row.payload as { event?: EngineEvent } | null)?.event;
  return event && typeof event === "object" ? event : null;
}

/** The zones a spatial engine event names (FR-009). */
function namedZones(event: EngineEvent): string[] {
  switch (event.type) {
    case "space.defined":
      return event.after.zones.map((z) => z.id);
    case "combatant.added":
      return event.after.placement ? [event.after.placement.zoneId] : [];
    case "combatant.removed":
      return event.before.placement ? [event.before.placement.zoneId] : [];
    case "combatant.placed":
      return [event.before?.zoneId, event.after?.zoneId].filter(
        (z): z is string => z !== undefined,
      );
    case "combatant.moved":
      return [event.before.zoneId, event.after.zoneId, ...event.path];
    default:
      return [];
  }
}

function occupantsIn(
  engine: EngineState,
  inZones: ReadonlySet<string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of Object.values(engine.combatants)) {
    const zoneId = c.placement?.zoneId;
    if (zoneId !== undefined && inZones.has(zoneId)) out[c.id] = zoneId;
  }
  return out;
}

function reveal(
  actor: string,
  payload: ZoneRevealed,
  reason?: string,
): PlannedRow {
  return {
    actor,
    type: "zone.revealed",
    visibility: PUBLIC,
    payload: ZoneRevealedV1.parse(
      reason === undefined ? payload : { ...payload, reason },
    ),
  };
}

/** A non-reset reveal of `fogged` zones (zone.revealed contract, section 3 rule 4). */
function revealPayload(
  engine: EngineState,
  map: Map_,
  fogged: ReadonlySet<string>,
  reason: string,
): ZoneRevealed {
  const space = engine.space as Space;
  const mapIds = new Set((map?.zones ?? []).map((z) => z.id));
  const zones = space.zones
    .filter((z) => fogged.has(z.id))
    .map((z) => ({ ...z, hidden: false }));
  const edges = space.edges.filter((e) => {
    const a = fogged.has(e.from);
    const b = fogged.has(e.to);
    return (a && (b || mapIds.has(e.to))) || (b && mapIds.has(e.from));
  });
  return {
    reason,
    reset: false,
    zones,
    edges,
    occupants: occupantsIn(engine, fogged),
  };
}

function mergeMap(map: Map_, payload: ZoneRevealed): Map_ {
  if (payload.reset) {
    return { zones: [...payload.zones], edges: [...payload.edges] };
  }
  const zones = [...(map?.zones ?? [])];
  for (const z of payload.zones) {
    const i = zones.findIndex((x) => x.id === z.id);
    if (i === -1) zones.push(z);
    else zones[i] = z;
  }
  const edges = [...(map?.edges ?? [])];
  for (const e of payload.edges) {
    const i = edges.findIndex((x) => pairKey(x) === pairKey(e));
    if (i === -1) edges.push(e);
    else edges[i] = e;
  }
  return { zones, edges };
}

/**
 * The fog rule (specs/100-spatial-events/contracts/zone-revealed.md section 3). Pure. `p` is
 * the DM projection the gate loads. Sets the visibility of every spatial engine row and
 * writes the `zone.revealed` rows it needs. A `dm` or whisper row is never loosened.
 */
export function fogRows(
  p: SessionProjections,
  rows: readonly PlannedRow[],
): PlannedRow[] {
  const party = new Set(
    p.party.flatMap((m) => (m.combatantId === null ? [] : [m.combatantId])),
  );
  const guard = p.viewer.role !== "dm";
  let engine = p.engine;
  let map: Map_ = p.spatial.map;
  const out: PlannedRow[] = [];

  for (const row of rows) {
    const event = engineEventOf(row);
    const advance = () => {
      if (!event) return;
      try {
        engine = evolve(engine, event);
      } catch {
        // The engine produced this event a moment ago; a throw here leaves state as is.
      }
    };
    if (!event || !SPATIAL.has(row.type) || row.visibility !== PUBLIC) {
      out.push(row);
      advance();
      continue;
    }
    if (guard) {
      out.push(
        namedZones(event).length > 0 ? { ...row, visibility: DM_ONLY } : row,
      );
      advance();
      continue;
    }

    if (event.type === "space.defined") {
      const onMap = new Set((map?.zones ?? []).map((z) => z.id));
      const partyZones = new Set(
        Object.values(engine.combatants).flatMap((c) =>
          party.has(c.id) && c.placement ? [c.placement.zoneId] : [],
        ),
      );
      const zones = event.after.zones
        .filter((z) => !z.hidden || onMap.has(z.id) || partyZones.has(z.id))
        .map((z) => ({ ...z, hidden: false }));
      const ids = new Set(zones.map((z) => z.id));
      const edges = event.after.edges.filter(
        (e) => ids.has(e.from) && ids.has(e.to),
      );
      const payload: ZoneRevealed = {
        reason: RESET_REASON,
        reset: true,
        zones,
        edges,
        occupants: occupantsIn(engine, ids),
      };
      out.push({ ...row, visibility: DM_ONLY }, reveal(row.actor, payload));
      map = mergeMap(map, payload);
      advance();
      continue;
    }

    const space = engine.space;
    const mapIds = new Set((map?.zones ?? []).map((z) => z.id));
    const held = new Set((space?.zones ?? []).map((z) => z.id));
    const named = namedZones(event);
    const fogged = new Set(named.filter((z) => held.has(z) && !mapIds.has(z)));
    if (fogged.size === 0) {
      out.push(row);
      advance();
      continue;
    }
    const subject =
      "combatantId" in event && typeof event.combatantId === "string"
        ? event.combatantId
        : null;
    const reveals =
      event.type === "combatant.added" ||
      (subject !== null && party.has(subject)) ||
      named.some((z) => mapIds.has(z));
    if (!reveals) {
      out.push({ ...row, visibility: DM_ONLY });
      advance();
      continue;
    }
    const payload = revealPayload(engine, map, fogged, event.reason);
    out.push(reveal(row.actor, payload), row);
    map = mergeMap(map, payload);
    advance();
  }
  return out;
}

/**
 * An explicit reveal (zone.revealed contract, section 4). `p` is the DM projection. Returns
 * no row when every zone is already on the players' map.
 */
export function revealRows(
  p: SessionProjections,
  actor: string,
  zoneIds: readonly string[],
  reason: string,
): { ok: true; rows: PlannedRow[] } | { ok: false; refusal: GateRefusal } {
  const refuse = (
    message: string,
    details?: Record<string, unknown>,
  ): { ok: false; refusal: GateRefusal } => ({
    ok: false,
    refusal: {
      source: "gate",
      code: "INVALID_PROPOSAL",
      message,
      ...(details ? { details } : {}),
    },
  });
  const space = p.engine.space;
  if (!space) return refuse("the scene has no space");
  const held = new Set(space.zones.map((z) => z.id));
  for (const zoneId of zoneIds) {
    if (!held.has(zoneId)) return refuse("no such zone", { zoneId });
  }
  const mapIds = new Set((p.spatial.map?.zones ?? []).map((z) => z.id));
  const fogged = new Set(zoneIds.filter((z) => !mapIds.has(z)));
  if (fogged.size === 0) return { ok: true, rows: [] };
  return {
    ok: true,
    rows: [
      reveal(actor, revealPayload(p.engine, p.spatial.map, fogged, reason)),
    ],
  };
}
