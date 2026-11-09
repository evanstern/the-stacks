import { z } from "zod";

// Same pattern as the engine's CombatantIdSchema. space must not import the
// engine (the engine imports space), so the regex is copied.
export const ZoneIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);

export const ZoneKindSchema = z.enum(["room", "area", "feature"]);

export const ZoneSchema = z.object({
  id: ZoneIdSchema,
  name: z.string().min(1).max(120),
  kind: ZoneKindSchema,
  tags: z.array(z.string().min(1).max(40)).max(16).default([]),
  hidden: z.boolean().default(false),
});

export const EdgeKindSchema = z.enum([
  "open",
  "door",
  "squeeze",
  "climb",
  "blocked",
]);

export const EdgeSchema = z.object({
  from: ZoneIdSchema,
  to: ZoneIdSchema,
  kind: EdgeKindSchema,
  feet: z
    .number()
    .int()
    .min(5)
    .max(1000)
    .refine((n) => n % 5 === 0, "feet must be a multiple of 5"),
});

export const MAX_ZONES = 64;
export const MAX_EDGES = 256;

export const SpaceSchema = z
  .object({
    zones: z.array(ZoneSchema).max(MAX_ZONES),
    edges: z.array(EdgeSchema).max(MAX_EDGES),
  })
  .superRefine((space, ctx) => {
    const ids = new Set<string>();
    for (const [i, z] of space.zones.entries()) {
      if (ids.has(z.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["zones", i, "id"],
          message: `duplicate zone id ${z.id}`,
        });
      }
      ids.add(z.id);
    }
    const pairs = new Set<string>();
    for (const [i, e] of space.edges.entries()) {
      if (e.from === e.to) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", i],
          message: `self-edge on ${e.from}`,
        });
      }
      for (const end of [e.from, e.to]) {
        if (!ids.has(end)) {
          ctx.addIssue({
            code: "custom",
            path: ["edges", i],
            message: `edge names unknown zone ${end}`,
          });
        }
      }
      const key = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;
      if (pairs.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", i],
          message: `duplicate edge between ${e.from} and ${e.to}`,
        });
      }
      pairs.add(key);
    }
  });

export const PlacementSchema = z.object({ zoneId: ZoneIdSchema });

export const BandSchema = z.enum(["engaged", "near", "far", "out"]);

export type ZoneId = z.infer<typeof ZoneIdSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Space = z.infer<typeof SpaceSchema>;
export type Placement = z.infer<typeof PlacementSchema>;
export type Band = z.infer<typeof BandSchema>;
