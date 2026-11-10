import { describe, expect, it } from "vitest";
import { buildSnapshot, renderSnapshot } from "../../src/dm/snapshot/index.js";
import { greyhollowFight } from "./snapshot-fixtures.js";

const z = (id: string, name: string, kind = "area", hidden = false) => ({
  id,
  name,
  kind,
  tags: [],
  hidden,
});
const space = {
  zones: [
    z("bank", "Near bank"),
    z("camp", "Reed camp", "area", true),
    z("marsh", "Reed marsh", "area", true),
  ],
  edges: [
    { from: "bank", to: "camp", kind: "open" as const, feet: 60 },
    { from: "camp", to: "marsh", kind: "squeeze" as const, feet: 30 },
  ],
};

function scenario() {
  const { projections: p, seed } = greyhollowFight();
  const placements = {
    tamsin: "camp",
    "goblin-2": "camp",
    odo: "bank",
    "goblin-3": "marsh",
  };
  p.engine = { ...p.engine, space };
  // The players' map holds only the bank; camp and marsh stay fogged.
  p.spatial = {
    space,
    map: { zones: [space.zones[0] as never], edges: [] },
    placements,
  };
  return { p, seed };
}
const lines = (view: "dm" | "seat" | "fiction", s = scenario()) => {
  const r = renderSnapshot(buildSnapshot(s.p, s.seed), { view, cap: 5000 });
  if (!r.ok) throw new Error("overflow");
  return r.lines.join("\n");
};

describe("snapshot zones and reach (spec 100, US3)", () => {
  it("builds zone and reach per actor and zones per stage", () => {
    const { p, seed } = scenario();
    const snap = buildSnapshot(p, seed);
    const by = (id: string) => snap.actors.find((a) => a.id === id);
    expect(by("tamsin")).toMatchObject({ zone: "camp", reach: ["goblin-2"] });
    expect(by("odo")).toMatchObject({ zone: "bank", reach: [] });
    expect(by("kestrel")).toMatchObject({ zone: null, reach: [] });
    expect(snap.stage.zones?.map((x) => [x.id, x.revealed])).toEqual([
      ["bank", true],
      ["camp", false],
      ["marsh", false],
    ]);
  });

  it("dm view lists every zone, marks fogged ones, and gives zone and reach", () => {
    const out = lines("dm");
    expect(out).toContain('camp "Reed camp" area (hidden)');
    expect(out).toMatch(/tamsin[^\n]*zone camp; reach goblin-2/);
    expect(out).toMatch(/odo[^\n]*zone bank; reach none/);
  });

  it("seat and fiction views omit fogged zones and the actors in them", () => {
    for (const view of ["seat", "fiction"] as const) {
      const out = lines(view);
      expect(out, view).not.toMatch(
        /Reed marsh|Reed camp|"camp"|"marsh"|zone camp|zone marsh|in camp/i,
      );
      expect(out).not.toContain("goblin-3 zone");
    }
    expect(lines("seat")).toContain('bank "Near bank" area');
    expect(lines("seat")).toMatch(/odo[^\n]*zone bank; reach none/);
    const fiction = lines("fiction");
    expect(fiction).toContain("Places: Near bank.");
    expect(fiction).toMatch(/Brother Odo[^\n]*in Near bank/);
  });

  it("a scene with no space renders no zones line and no zone text", () => {
    const { projections: p, seed } = greyhollowFight();
    const snap = buildSnapshot(p, seed);
    expect(snap.stage.zones).toBeNull();
    for (const view of ["dm", "seat", "fiction"] as const) {
      const out = lines(view, { p, seed });
      expect(out).not.toMatch(/Zones:|Places:|zone |reach /);
    }
  });
});
