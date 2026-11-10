import { describe, expect, it } from "vitest";
import { spatialFog } from "../src/fixtures/index.js";
import { project, spatialFor } from "../src/index.js";

/** SC-002: a player's folded spatial equals the one derived from the DM projection. */
describe("spatial parity (SC-002)", () => {
  const dm = { role: "dm" } as const;
  for (const viewer of spatialFog.viewers.players) {
    it(`holds for every prefix as ${viewer.role === "player" ? viewer.userId : "dm"}`, () => {
      // The last row is a deliberate dm-visibility move (spec 100 Edge Cases): it breaks parity.
      for (let n = 0; n < spatialFog.events.length; n++) {
        const prefix = spatialFog.events.slice(0, n);
        const derived = spatialFor(project(prefix, dm), viewer);
        const folded = project(prefix, viewer).spatial;
        expect(folded, `prefix ${n}`).toEqual(derived);
      }
    });
  }

  it("a dm-visibility move after a reveal diverges on purpose", () => {
    const viewer = spatialFog.viewers
      .players[0] as (typeof spatialFog.viewers.players)[number];
    const all = spatialFog.events;
    expect(all[all.length - 1]?.visibility).toBe("dm");
    expect(project(all, viewer).spatial).not.toEqual(
      spatialFor(project(all, dm), viewer),
    );
  });
});
