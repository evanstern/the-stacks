import type { Band, Edge, Space, ZoneId } from "./schema.js";

/** Nominal distance of each zone-mode band (README, OQ-7). `out` has none. */
export const BAND_FEET = { engaged: 5, near: 30, far: 120 } as const;

type Adj = Map<ZoneId, { to: ZoneId; edge: Edge }[]>;

function adjacency(space: Space): Adj {
  const adj: Adj = new Map();
  for (const z of space.zones) adj.set(z.id, []);
  for (const e of space.edges) {
    if (e.kind === "blocked") continue;
    adj.get(e.from)?.push({ to: e.to, edge: e });
    adj.get(e.to)?.push({ to: e.from, edge: e });
  }
  return adj;
}

/** Feet the walker pays to cross an edge (OQ-8): squeeze and climb cost double. */
function cost(e: Edge): number {
  return e.kind === "squeeze" || e.kind === "climb" ? e.feet * 2 : e.feet;
}

function lexLess(a: string[], b: string[]): boolean {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if ((a[i] as string) !== (b[i] as string)) {
      return (a[i] as string) < (b[i] as string);
    }
  }
  return a.length < b.length;
}

/**
 * Cheapest path over non-blocked edges (Dijkstra), or null. Equal-cost paths
 * tie-break by the lexicographic order of the zone id list.
 */
export function path(
  space: Space,
  from: ZoneId,
  to: ZoneId,
): { zones: ZoneId[]; feet: number } | null {
  const adj = adjacency(space);
  if (!adj.has(from) || !adj.has(to)) return null;
  const dist = new Map<ZoneId, number>([[from, 0]]);
  const route = new Map<ZoneId, ZoneId[]>([[from, [from]]]);
  const done = new Set<ZoneId>();
  // ponytail: O(n^2) selection; fine for the 64-zone cap, swap in a heap if the cap rises.
  for (;;) {
    let u: ZoneId | null = null;
    for (const [id, d] of dist) {
      if (done.has(id)) continue;
      if (u === null || d < (dist.get(u) as number)) u = id;
    }
    if (u === null) break;
    done.add(u);
    if (u === to) break;
    const du = dist.get(u) as number;
    const ru = route.get(u) as ZoneId[];
    for (const { to: v, edge } of adj.get(u) ?? []) {
      if (done.has(v)) continue;
      const nd = du + cost(edge);
      const nr = [...ru, v];
      const cur = dist.get(v);
      if (
        cur === undefined ||
        nd < cur ||
        (nd === cur && lexLess(nr, route.get(v) as ZoneId[]))
      ) {
        dist.set(v, nd);
        route.set(v, nr);
      }
    }
  }
  const feet = dist.get(to);
  if (feet === undefined || !done.has(to)) return null;
  return { zones: route.get(to) as ZoneId[], feet };
}

/** Band by fewest passable edges (BFS): same zone engaged, 1 near, 2 far, else out. */
export function band(space: Space, a: ZoneId, b: ZoneId): Band {
  const adj = adjacency(space);
  if (!adj.has(a) || !adj.has(b)) return "out";
  if (a === b) return "engaged";
  let frontier = [a];
  const seen = new Set<ZoneId>([a]);
  for (let depth = 1; depth <= 2; depth++) {
    const next: ZoneId[] = [];
    for (const u of frontier) {
      for (const { to } of adj.get(u) ?? []) {
        if (seen.has(to)) continue;
        if (to === b) return depth === 1 ? "near" : "far";
        seen.add(to);
        next.push(to);
      }
    }
    frontier = next;
  }
  return "out";
}
