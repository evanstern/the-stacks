import { EdgeSchema, ZoneIdSchema, ZoneSchema } from "@the-stacks/space";
import { z } from "zod";
import { CombatantIdSchema, ReasonSchema } from "../ids.js";

/**
 * The party's view of the space grows (specs/100-spatial-events/contracts/zone-revealed.md).
 * Only the gate writes it, always `public`. It carries the zone records themselves so a
 * player who never received `space.defined` can build the map.
 */
export const ZoneRevealedV1 = z
  .object({
    reason: ReasonSchema,
    /** true: `zones` and `edges` replace the players' map. false: they merge into it. */
    reset: z.boolean(),
    /** Revealed zones, as the engine space holds them, with `hidden: false`. */
    zones: z.array(ZoneSchema).max(64),
    /** Engine-space edges with at least one end in `zones`. */
    edges: z.array(EdgeSchema).max(256),
    /** Combatant id -> zone id, for every combatant standing in a revealed zone. */
    occupants: z.record(CombatantIdSchema, ZoneIdSchema),
  })
  .superRefine((p, ctx) => {
    const ids = new Set<string>();
    for (const [i, z] of p.zones.entries()) {
      if (z.hidden) {
        ctx.addIssue({
          code: "custom",
          path: ["zones", i, "hidden"],
          message: `revealed zone ${z.id} is hidden`,
        });
      }
      if (ids.has(z.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["zones", i, "id"],
          message: `duplicate zone id ${z.id}`,
        });
      }
      ids.add(z.id);
    }
    for (const [i, e] of p.edges.entries()) {
      const both = ids.has(e.from) && ids.has(e.to);
      const some = ids.has(e.from) || ids.has(e.to);
      if (p.reset ? !both : !some) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", i],
          message: p.reset
            ? "a reset edge has both ends in zones"
            : "an edge has an end in zones",
        });
      }
    }
    for (const [id, zoneId] of Object.entries(p.occupants)) {
      if (!ids.has(zoneId)) {
        ctx.addIssue({
          code: "custom",
          path: ["occupants", id],
          message: `occupant ${id} stands outside the revealed zones`,
        });
      }
    }
    if (!p.reset && p.zones.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["zones"],
        message: "a non-reset reveal has at least one zone",
      });
    }
  });
export type ZoneRevealed = z.infer<typeof ZoneRevealedV1>;
