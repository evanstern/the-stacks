import { z } from "zod";
import { ReasonSchema, RefIdSchema } from "../ids.js";

export const TrackerSchema = z
  .object({
    trackerId: RefIdSchema,
    name: z.string().min(1).max(100),
    segments: z.number().int().min(2).max(12),
    filled: z.number().int().min(0),
    note: z.string().max(1000).nullable(),
  })
  .refine((t) => t.filled <= t.segments, {
    message: "filled does not exceed segments",
    path: ["filled"],
  });

export const TrackerChangedV1 = z
  .object({
    reason: ReasonSchema,
    trackerId: RefIdSchema,
    before: TrackerSchema.nullable(),
    after: TrackerSchema.nullable(),
  })
  .superRefine((p, ctx) => {
    if (p.before === null && p.after === null) {
      ctx.addIssue({
        code: "custom",
        message: "a tracker change has a before or an after",
      });
    }
    for (const side of ["before", "after"] as const) {
      const tracker = p[side];
      if (tracker !== null && tracker.trackerId !== p.trackerId) {
        ctx.addIssue({
          code: "custom",
          message: `${side}.trackerId matches trackerId`,
          path: [side, "trackerId"],
        });
      }
    }
  });

export type Tracker = z.infer<typeof TrackerSchema>;
