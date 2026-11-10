import { describe, expect, it } from "vitest";
import {
  project,
  reachOf,
  spatialFor,
  targetStatus,
  type Viewer,
} from "../src/index.js";
import {
  anaCombatant,
  engineRows,
  goblinCombatant,
  makeRows,
  space,
  zone,
} from "./spatial-helpers.js";

const dm: Viewer = { role: "dm" };
const pl: Viewer = {
  role: "player",
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

const reveal = (zones: unknown[], reset = false) => ({
  type: "zone.revealed",
  payload: { reason: "r", reset, zones, edges: [], occupants: {} },
});

function build(revealed: unknown[]) {
  const specs = [
    ...engineRows([
      {
        command: { type: "space.define", space, reason: "r" },
        visibility: "dm",
      },
      {
        command: {
          type: "combatant.add",
          combatant: { ...anaCombatant, placement: { zoneId: "bank" } },
          reason: "r",
        },
      },
      {
        command: {
          type: "combatant.add",
          combatant: { ...goblinCombatant, placement: { zoneId: "camp" } },
          reason: "r",
        },
        visibility: "dm",
      },
    ]),
    ...(revealed.length > 0 ? [{ ...reveal(revealed, true), opts: {} }] : []),
  ];
  return project(makeRows(specs), dm);
}

describe("targetStatus", () => {
  const p0 = build([zone("bank", "area")]);
  const p1 = build([
    zone("bank", "area"),
    zone("camp", "area", false),
    zone("post", "feature"),
  ]);

  it("zone: unknown, unseen, ok", () => {
    expect(targetStatus(p0, pl, { kind: "zone", id: "nowhere" })).toBe(
      "unknown",
    );
    expect(targetStatus(p0, pl, { kind: "zone", id: "camp" })).toBe("unseen");
    expect(targetStatus(p0, pl, { kind: "zone", id: "bank" })).toBe("ok");
    expect(targetStatus(p1, pl, { kind: "zone", id: "camp" })).toBe("ok");
  });

  it("feature zone as entity: unseen then ok; area as entity: unknown", () => {
    expect(targetStatus(p0, pl, { kind: "entity", id: "post" })).toBe("unseen");
    expect(targetStatus(p1, pl, { kind: "entity", id: "post" })).toBe("ok");
    expect(targetStatus(p1, pl, { kind: "entity", id: "camp" })).toBe(
      "unknown",
    );
    expect(targetStatus(p0, pl, { kind: "entity", id: "ghost" })).toBe(
      "unknown",
    );
  });

  it("no space is unknown for zone refs", () => {
    const p = project([], dm);
    expect(targetStatus(p, pl, { kind: "zone", id: "bank" })).toBe("unknown");
  });

  it("actor: unseen in a fogged zone, ok when revealed, unplaced or missing", () => {
    expect(targetStatus(p0, pl, { kind: "actor", id: "goblin" })).toBe(
      "unseen",
    );
    expect(targetStatus(p0, pl, { kind: "actor", id: "ana" })).toBe("ok");
    expect(targetStatus(p0, pl, { kind: "actor", id: "ghost" })).toBe("ok");
    expect(targetStatus(p1, pl, { kind: "actor", id: "goblin" })).toBe("ok");
  });

  it("the DM is never unseen", () => {
    for (const ref of [
      { kind: "zone", id: "loft" },
      { kind: "entity", id: "post" },
      { kind: "actor", id: "goblin" },
    ] as const) {
      expect(targetStatus(p0, dm, ref)).toBe("ok");
    }
  });
});

describe("reachOf and spatialFor", () => {
  it("reachOf lists other occupants of the zone, sorted", () => {
    const view = {
      space: null,
      placements: { a: "x", b: "x", c: "y", d: "x" },
    };
    expect(reachOf(view, "a")).toEqual(["b", "d"]);
    expect(reachOf(view, "c")).toEqual([]);
    expect(reachOf(view, "nobody")).toEqual([]);
  });

  it("spatialFor the DM is the DM spatial; for a player it filters to the map", () => {
    const p = build([zone("bank", "area")]);
    expect(spatialFor(p, dm)).toBe(p.spatial);
    const s = spatialFor(p, pl);
    expect(s.placements).toEqual({ ana: "bank" });
    expect(s.space?.zones.map((z) => z.id)).toEqual(["bank"]);
  });
});
