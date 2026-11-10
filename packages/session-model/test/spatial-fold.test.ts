import { spaceViewOf } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  emptyProjections,
  project,
  type SpatialView,
  type Viewer,
} from "../src/index.js";
import { row, run } from "./helpers.js";
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

const reveal = (over: Record<string, unknown>) => ({
  reason: "r",
  reset: false,
  zones: [],
  edges: [],
  occupants: {},
  ...over,
});

const log = (rows: { type: string; payload: unknown; visibility?: string }[]) =>
  makeRows(
    rows.map((r) => ({
      type: r.type,
      payload: r.payload,
      opts: { visibility: r.visibility ?? "public" },
    })),
  );

describe("spatial fold", () => {
  it("starts empty", () => {
    expect(emptyProjections(dm).spatial).toEqual({
      space: null,
      map: null,
      placements: {},
    });
  });

  it("zone.revealed reset replaces the map; non-reset merges by id and pair", () => {
    const rows = log([
      {
        type: "zone.revealed",
        payload: reveal({
          reset: true,
          zones: [zone("bank", "area"), zone("house")],
          edges: [{ from: "bank", to: "house", kind: "open", feet: 20 }],
        }),
      },
      {
        type: "zone.revealed",
        payload: reveal({
          zones: [{ ...zone("house"), name: "House 2" }, zone("loft")],
          edges: [
            { from: "house", to: "bank", kind: "door", feet: 25 },
            { from: "house", to: "loft", kind: "climb", feet: 10 },
          ],
        }),
      },
    ]);
    for (const v of [dm, pl]) {
      const s = project(rows, v).spatial;
      expect(s.map?.zones.map((z) => z.name)).toEqual([
        "Bank",
        "House 2",
        "Loft",
      ]);
      expect(s.map?.edges).toHaveLength(2);
      expect(s.map?.edges[0]?.kind).toBe("door");
    }
    expect(project(rows, pl).spatial.space).toEqual(
      project(rows, pl).spatial.map,
    );
    expect(project(rows, dm).spatial.space).toBeNull();
  });

  it("a player reset drops placements whose zone left the map, then merges occupants", () => {
    const rows = log([
      {
        type: "zone.revealed",
        payload: reveal({
          reset: true,
          zones: [zone("bank", "area"), zone("house")],
          occupants: { ana: "house", odo: "bank" },
        }),
      },
      {
        type: "zone.revealed",
        payload: reveal({
          reset: true,
          zones: [zone("bank", "area")],
          occupants: { cade: "bank" },
        }),
      },
    ]);
    expect(project(rows, pl).spatial.placements).toEqual({
      odo: "bank",
      cade: "bank",
    });
    expect(project(rows, dm).spatial.placements).toEqual({
      ana: "house",
      odo: "bank",
      cade: "bank",
    });
  });

  it("DM placements equal spaceViewOf(engine) across every spatial row", () => {
    const specs = engineRows([
      { command: { type: "space.define", space, reason: "r" } },
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
          combatant: goblinCombatant,
          reason: "r",
        },
      },
    ]);
    const all = [...makeRows(specs)];
    for (const command of [
      {
        type: "combatant.place",
        combatantId: "goblin",
        zoneId: "camp",
        reason: "r",
      },
      { type: "move", combatantId: "ana", toZoneId: "house", reason: "r" },
      {
        type: "combatant.place",
        combatantId: "goblin",
        zoneId: null,
        reason: "r",
      },
      { type: "combatant.remove", combatantId: "goblin", reason: "r" },
    ]) {
      const folded = project(all, dm);
      const ex = run(folded.engine, command);
      const rows = makeRows(
        ex.events.map((event, index) => ({
          type: event.type,
          payload: {
            batchId: `x${all.length}`,
            index,
            count: ex.events.length,
            actionId: null,
            proposalId: null,
            event,
          },
        })),
        all.length + 1,
      );
      all.push(...rows);
      const after = project(all, dm);
      expect(after.spatial.placements).toEqual(
        spaceViewOf(after.engine).placements,
      );
      expect(after.spatial.space).toEqual(after.engine.space);
    }
    expect(project(all, dm).spatial.placements).toEqual({ ana: "house" });
  });

  it("a player never folds a dm row, so a hidden placement stays unseen", () => {
    const specs = engineRows([
      {
        command: { type: "space.define", space, reason: "r" },
        visibility: "dm",
      },
      {
        command: {
          type: "combatant.add",
          combatant: { ...goblinCombatant, placement: { zoneId: "camp" } },
          reason: "r",
        },
        visibility: "dm",
      },
    ]);
    const p = project(makeRows(specs), pl);
    expect(p.spatial).toEqual({ space: null, map: null, placements: {} });
  });

  it("writes one ledger change row per zone.revealed and tolerates unknown types", () => {
    const rows = [
      ...log([
        {
          type: "zone.revealed",
          payload: reveal({ reset: true, zones: [zone("bank", "area")] }),
        },
      ]),
      row("future.thing", { x: 1 }, { seq: 2 }),
    ];
    const p = project(rows, pl);
    const changes = p.ledger.filter((l) => l.kind === "change");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      type: "zone.revealed",
      subject: null,
      before: null,
      after: { zones: ["Bank"], reset: true },
    });
    expect(p.diagnostics.skippedUnknownType).toBe(1);
  });

  it("is a SpatialView shape", () => {
    const s: SpatialView = emptyProjections(pl).spatial;
    expect(Object.keys(s).sort()).toEqual(["map", "placements", "space"]);
  });
});
