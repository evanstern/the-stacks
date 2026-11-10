import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  createWorld,
  db,
  loudSkip,
  reachable,
  readRows,
  startScene,
  type World,
} from "./world.js";

/** Spec 100 US4 #2 and FR-022, FR-023, FR-023a: the DM runtime's spatial rows. */
loudSkip("scene-start-space.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

// biome-ignore lint/suspicious/noExplicitAny: event payloads vary by type
type Ev = Record<string, any>;
const ev = (r: { payload: unknown }) => (r.payload as { event: Ev }).event;
const FOGGED = ["loft", "reed-marsh", "reed-camp", "camp-post"];
const FOGGED_NAMES = ["Loft", "Reed marsh", "Reed camp", "Camp post"];

async function resolveTurn(w: World, director: Record<string, unknown>) {
  const { result } = await w.runResolve({ director } as never);
  if (!result.ok) throw new Error(result.error.message);
  w.checkpoint.current = {
    ...w.checkpoint.current,
    submissions: [],
    lastSeq: 0,
  };
  return result.output as ResolveOutput;
}

describe.skipIf(!reachable)(
  "scene start and encounter start rows (spec 100)",
  () => {
    it("scene start: space.defined before the party, placed at the start, nothing fogged shown", async () => {
      const w = await createWorld();
      await startScene(w);
      const rows = await readRows(w);
      const types = rows.map((r) => r.type);
      const space = types.indexOf("space.defined");
      const firstParty = types.indexOf("combatant.added");
      expect(space).toBeGreaterThanOrEqual(0);
      expect(space).toBeLessThan(firstParty);
      expect(rows[space]?.visibility).toBe("dm");
      expect(types[space + 1]).toBe("zone.revealed");
      expect(rows[space + 1]?.visibility).toBe("public");

      const added = rows.filter((r) => r.type === "combatant.added");
      expect(added).toHaveLength(3);
      for (const r of added) {
        expect(ev(r).after.placement).toEqual({ zoneId: "near-bank" });
        expect(r.visibility).toBe("public");
      }

      const dm = await w.projections();
      expect(Object.values(dm.spatial.placements)).toEqual([
        "near-bank",
        "near-bank",
        "near-bank",
      ]);

      // No player-visible row names a fogged zone before its reveal.
      const visible = rows.filter((r) => r.visibility !== "dm");
      const text = JSON.stringify(visible);
      for (const needle of [...FOGGED.map((z) => `"${z}"`), ...FOGGED_NAMES]) {
        expect(text, needle).not.toContain(needle);
      }
    });

    it("encounter start reveals the camp before the first public goblin row and gathers the party", async () => {
      const w = await createWorld({ dice: [15, 12, 9, 14, 11, 8, 6] });
      await startScene(w);
      await resolveTurn(w, {
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
      });
      const rows = await readRows(w);
      const idx = (pred: (r: (typeof rows)[number]) => boolean) =>
        rows.findIndex(pred);
      const firstGoblin = idx(
        (r) =>
          r.type === "combatant.added" &&
          /^(snag|goblin)/.test(ev(r).combatantId),
      );
      expect(firstGoblin).toBeGreaterThan(0);
      const campReveal = idx(
        (r) =>
          r.type === "zone.revealed" &&
          (r.payload as { zones: { id: string }[] }).zones.some(
            (z) => z.id === "reed-camp",
          ),
      );
      expect(campReveal).toBeGreaterThan(0);
      expect(campReveal).toBeLessThan(firstGoblin);
      expect(rows[firstGoblin]?.visibility).toBe("public");
      expect(ev(rows[firstGoblin] as never).after.placement).toEqual({
        zoneId: "reed-camp",
      });

      const placed = rows.filter((r) => r.type === "combatant.placed");
      expect(placed.map((r) => ev(r).combatantId).sort()).toEqual([
        "kestrel",
        "odo",
        "tamsin",
      ]);
      expect(placed.every((r) => ev(r).after.zoneId === "reed-camp")).toBe(
        true,
      );
      const roll = idx((r) => r.type === "encounter.started");
      for (const r of placed) expect(rows.indexOf(r)).toBeLessThan(roll);

      // The party stands with the goblins; no feature zone is a combatant or in initiative.
      const p = await w.projections();
      for (const id of ["tamsin", "odo", "kestrel"]) {
        expect(p.spatial.placements[id]).toBe("reed-camp");
      }
      const featureIds = (p.engine.space?.zones ?? [])
        .filter((z) => z.kind === "feature")
        .map((z) => z.id);
      expect(featureIds).toContain("camp-post");
      for (const id of featureIds) {
        expect(p.engine.combatants[id]).toBeUndefined();
        expect(p.encounter?.order.some((o) => o.combatantId === id)).toBe(
          false,
        );
      }
    });
  },
);
