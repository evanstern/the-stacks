import type { Edge, Space, Zone } from "../src/index.js";

export function zone(id: string): Zone {
  return { id, name: id, kind: "room", tags: [], hidden: false };
}

export function mk(
  ids: string[],
  edges: [string, string, number, Edge["kind"]?][],
): Space {
  return {
    zones: ids.map(zone),
    edges: edges.map(([from, to, feet, kind]) => ({
      from,
      to,
      feet,
      kind: kind ?? "open",
    })),
  };
}
