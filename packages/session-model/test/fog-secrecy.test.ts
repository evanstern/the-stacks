import { describe, expect, it } from "vitest";
import { fixtureIds, spatialFog } from "../src/fixtures/index.js";
import { canSee, project, type Viewer } from "../src/index.js";

/** SC-001: nothing a player can see names a zone the players' map lacks. */
const players: Viewer[] = spatialFog.viewers.players;
const dm: Viewer = { role: "dm" };

function secrecy(
  events: typeof spatialFog.events,
  ids: string[],
  names: string[],
) {
  for (const viewer of players) {
    const visible = events.filter((e) => canSee(viewer, e.visibility));
    const text = JSON.stringify(visible);
    const fold = JSON.stringify(project(events, viewer));
    for (const needle of [...ids.map((i) => `"${i}"`), ...names]) {
      expect(text, `rows leak ${needle}`).not.toContain(needle);
      expect(fold, `projection leaks ${needle}`).not.toContain(needle);
    }
  }
}

describe("fog secrecy (SC-001)", () => {
  it("scene start: a fogged zone is absent from rows and projection", () => {
    const events = spatialFog.events.slice(0, 10); // through Ana's move into the house
    secrecy(
      events,
      ["loft", "camp", "marsh", "post", "snag"],
      ["Loft", "Camp", "Marsh", "Post", "Snag"],
    );
  });

  it("after Ana climbs: only the loft is out", () => {
    secrecy(
      spatialFog.events.slice(0, 12),
      ["camp", "marsh", "post", "snag"],
      ["Camp", "Marsh", "Post"],
    );
  });

  it("the whole fixture: the post and the marsh-bound dm moves never leak", () => {
    const events = spatialFog.events;
    for (const viewer of players) {
      const p = project(events, viewer);
      expect(p.spatial.map?.zones.map((z) => z.id)).not.toContain("post");
      expect(p.spatial.placements).not.toHaveProperty("snag", "post");
    }
    secrecy(events, ["post"], ["Post"]);
  });

  it("a dm-visibility row is not delivered to any player", () => {
    const dmRows = spatialFog.events.filter((e) => e.visibility === "dm");
    expect(dmRows.length).toBeGreaterThan(0);
    for (const viewer of players) {
      for (const e of dmRows) expect(canSee(viewer, e.visibility)).toBe(false);
    }
    expect(fixtureIds.dmActor).toBe("ai:dm");
    expect(project(spatialFog.events, dm).spatial.space?.zones).toHaveLength(6);
  });
});
