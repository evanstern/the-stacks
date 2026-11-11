import type { EngineCommand } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { spatialFog } from "../src/fixtures/index.js";
import {
  fogRows,
  mechanicsProposal,
  type PlannedRow,
  planProposal,
  project,
  revealRows,
  type SessionProjections,
  type Viewer,
} from "../src/index.js";

const dm: Viewer = { role: "dm" };
const player: Viewer = {
  role: "player",
  userId: "00000000-0000-4000-8000-000000000001",
};
const rng = { rollDie: () => 1 };

/** The DM projection of the fixture's first `n` rows (8: space, party and bank placed). */
const at = (n: number): SessionProjections =>
  project(spatialFog.events.slice(0, n), dm);

function plan(
  p: SessionProjections,
  command: unknown,
  visibility: "public" | "dm" = "public",
): PlannedRow[] {
  const r = planProposal(
    p,
    { kind: "ai", actor: "ai:dm" },
    mechanicsProposal(command as EngineCommand, { visibility }),
    rng,
    { batchId: "t" },
    null,
  );
  if (!r.ok) throw new Error(JSON.stringify(r.refusal));
  return r.rows;
}
const shape = (rows: PlannedRow[]) =>
  rows.map((r) => `${r.type}:${r.visibility}`);
const goblin = (zoneId: string) => ({
  id: "goblin",
  name: "Goblin",
  hp: { max: 7 },
  zeroHpRule: "dies",
  ac: 12,
  placement: { zoneId },
});

describe("fogRows (zone.revealed contract section 3)", () => {
  const base = at(8);

  it("rule 2: space.defined is dm and followed by a reset reveal with a fixed reason", () => {
    const empty = project([], dm);
    const rows = plan(empty, {
      type: "space.define",
      space: {
        zones: [
          { id: "a", name: "A", kind: "room", tags: [], hidden: false },
          { id: "b", name: "Secret B", kind: "room", tags: [], hidden: true },
        ],
        edges: [{ from: "a", to: "b", kind: "open", feet: 10 }],
      },
      reason: "Secret B lies beyond",
    });
    expect(shape(rows)).toEqual(["space.defined:dm", "zone.revealed:public"]);
    const p = rows[1]?.payload as {
      reset: boolean;
      reason: string;
      zones: { id: string }[];
      edges: unknown[];
    };
    expect(p.reset).toBe(true);
    expect(p.zones.map((z) => z.id)).toEqual(["a"]);
    expect(p.edges).toEqual([]);
    expect(p.reason).toBe("The party's view of the scene");
    expect(JSON.stringify(rows[1])).not.toContain("Secret B");
  });

  it("rule 2: a second define keeps revealed zones and zones holding the party", () => {
    const rows = plan(base, {
      type: "space.define",
      space: {
        zones: [
          { id: "bank", name: "Bank", kind: "area", tags: [], hidden: true },
          { id: "house", name: "House", kind: "room", tags: [], hidden: true },
          {
            id: "cellar",
            name: "Cellar",
            kind: "room",
            tags: [],
            hidden: true,
          },
        ],
        edges: [{ from: "bank", to: "house", kind: "open", feet: 20 }],
      },
      reason: "Re-laid",
    });
    const p = rows[1]?.payload as {
      zones: { id: string }[];
      occupants: object;
    };
    expect(p.zones.map((z) => z.id)).toEqual(["bank", "house"]);
    expect(p.occupants).toEqual({ ana: "bank", cade: "bank" });
  });

  it("rule 3: a row that names no fogged zone is unchanged", () => {
    expect(
      shape(
        plan(base, {
          type: "move",
          combatantId: "ana",
          toZoneId: "house",
          reason: "r",
        }),
      ),
    ).toEqual(["combatant.moved:public"]);
  });

  it("rule 4: a party move into a fogged zone reveals it first, in the same plan", () => {
    const p = at(10);
    const rows = plan(p, {
      type: "move",
      combatantId: "ana",
      toZoneId: "loft",
      reason: "Ana climbs",
    });
    expect(shape(rows)).toEqual([
      "zone.revealed:public",
      "combatant.moved:public",
    ]);
    const rev = rows[0]?.payload as {
      zones: { id: string; hidden: boolean }[];
      edges: { from: string; to: string }[];
      reason: string;
    };
    expect(rev.zones).toMatchObject([{ id: "loft", hidden: false }]);
    expect(rev.edges).toEqual([
      { from: "house", to: "loft", kind: "climb", feet: 10 },
    ]);
    expect(rev.reason).toBe("Ana climbs");
  });

  it("rule 4: arrival reveals the zone with occupants already standing there", () => {
    const p = at(11);
    const rows = plan(p, {
      type: "combatant.add",
      combatant: goblin("camp"),
      reason: "Goblins arrive",
    });
    expect(shape(rows)).toEqual([
      "zone.revealed:public",
      "combatant.added:public",
    ]);
    expect(
      ((rows[0] as PlannedRow).payload as { occupants: object }).occupants,
    ).toEqual({
      snag: "camp",
    });
  });

  it("spec 099: a hostile departing a fogged zone stays dm; its side change names no zone", () => {
    const p = at(11);
    expect(p.engine.combatants.snag?.placement?.zoneId).toBe("camp");
    const rows = plan(p, {
      type: "combatant.depart",
      combatantId: "snag",
      reason: "slips away",
    });
    const placed = rows.filter((r) => r.type === "combatant.placed");
    expect(placed.length).toBe(1);
    for (const r of placed) expect(r.visibility).toBe("dm");
    const side = plan(p, {
      type: "combatant.side",
      combatantId: "snag",
      side:
        p.engine.combatants.snag?.side === "hostile" ? "neutral" : "hostile",
      reason: "yields",
    });
    expect(JSON.stringify(side)).not.toContain("camp");
  });

  it("rule 4: a crossing from a revealed zone reveals the fogged one", () => {
    const p = at(14);
    const rows = plan(p, {
      type: "move",
      combatantId: "goblin",
      toZoneId: "marsh",
      reason: "flees",
    });
    expect(shape(rows)).toEqual([
      "zone.revealed:public",
      "combatant.moved:public",
    ]);
  });

  it("a path through a fogged zone between two revealed zones reveals it", () => {
    const p = project(spatialFog.events.slice(0, 13), dm);
    // camp revealed, post fogged: a move camp -> post reveals the post.
    const rows = plan(p, {
      type: "combatant.place",
      combatantId: "ana",
      zoneId: "camp",
      reason: "r",
    });
    expect(shape(rows)).toEqual(["combatant.placed:public"]);
  });

  it("rule 5: a public row wholly inside fog becomes dm and reveals nothing", () => {
    const p = at(9); // snag (dm) stands in fogged camp
    const rows = plan(p, {
      type: "combatant.place",
      combatantId: "snag",
      zoneId: "marsh",
      reason: "r",
    });
    expect(shape(rows)).toEqual(["combatant.placed:dm"]);
  });

  it("FR-009: removed, placed (before and after) and moved name their zones", () => {
    const p = at(9); // snag (dm) in fogged camp
    expect(
      shape(
        plan(p, { type: "combatant.remove", combatantId: "snag", reason: "r" }),
      ),
    ).toEqual(["combatant.removed:dm"]);
    expect(
      shape(
        plan(p, {
          type: "combatant.place",
          combatantId: "snag",
          zoneId: null,
          reason: "r",
        }),
      ),
    ).toEqual(["combatant.placed:dm"]);
    expect(
      shape(
        plan(p, {
          type: "combatant.place",
          combatantId: "snag",
          zoneId: "post",
          reason: "r",
        }),
      ),
    ).toEqual(["combatant.placed:dm"]);
  });

  it("a dm proposal is never loosened and never reveals", () => {
    const rows = plan(
      at(10),
      { type: "move", combatantId: "ana", toZoneId: "loft", reason: "r" },
      "dm",
    );
    expect(shape(rows)).toEqual(["combatant.moved:dm"]);
  });

  it("a non-DM projection fails closed: zone-naming rows go dm, nothing reveals", () => {
    const rows: PlannedRow[] = plan(at(10), {
      type: "move",
      combatantId: "ana",
      toZoneId: "loft",
      reason: "r",
    });
    const asPlayer = { ...at(10), viewer: player };
    const out = fogRows(
      asPlayer,
      rows.filter((r) => r.type === "combatant.moved"),
    );
    expect(shape(out)).toEqual(["combatant.moved:dm"]);
  });

  it("envelope index and count are unchanged by an inserted reveal", () => {
    const rows = plan(at(10), {
      type: "move",
      combatantId: "ana",
      toZoneId: "loft",
      reason: "r",
    });
    const mech = rows.filter((r) => r.type !== "zone.revealed");
    mech.forEach((r, i) => {
      const pl = r.payload as { index: number; count: number };
      expect(pl.index).toBe(i);
      expect(pl.count).toBe(mech.length);
    });
  });

  it("is pure: it does not mutate its inputs", () => {
    const p = at(10);
    const before = JSON.stringify(p);
    plan(p, {
      type: "move",
      combatantId: "ana",
      toZoneId: "loft",
      reason: "r",
    });
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe("revealRows (section 4)", () => {
  const p = at(13); // camp revealed; marsh, post, loft... loft revealed too

  it("builds one public non-reset reveal for the fogged zones", () => {
    const r = revealRows(
      p,
      "ai:dm",
      ["post", "bank"],
      "The party spots the post",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(shape(r.rows)).toEqual(["zone.revealed:public"]);
    const pl = r.rows[0]?.payload as {
      reason: string;
      zones: { id: string }[];
      reset: boolean;
    };
    expect(pl.zones.map((z) => z.id)).toEqual(["post"]);
    expect(pl.reset).toBe(false);
    expect(pl.reason).toBe("The party spots the post");
  });

  it("is a no-op when every zone is already on the map", () => {
    expect(revealRows(p, "ai:dm", ["bank", "camp"], "r")).toEqual({
      ok: true,
      rows: [],
    });
  });

  it("refuses an unknown zone and a missing space", () => {
    const bad = revealRows(p, "ai:dm", ["nowhere"], "r");
    expect(bad).toMatchObject({
      ok: false,
      refusal: {
        code: "INVALID_PROPOSAL",
        source: "gate",
        details: { zoneId: "nowhere" },
      },
    });
    expect(revealRows(project([], dm), "ai:dm", ["bank"], "r")).toMatchObject({
      ok: false,
      refusal: { code: "INVALID_PROPOSAL" },
    });
  });
});
