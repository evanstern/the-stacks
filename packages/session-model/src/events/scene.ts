import { z } from "zod";
import { ReasonSchema, RefIdSchema } from "../ids.js";

export const WaySchema = z.object({
  label: z.string().min(1).max(60),
  draft: z.string().min(1).max(200),
});

export const CastEntrySchema = z.object({
  id: RefIdSchema,
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  appearance: z.string().max(300),
});

export const SceneSchema = z.object({
  sceneId: RefIdSchema,
  title: z.string().min(1).max(200),
  summary: z.string().max(4000),
  location: z.string().max(200).nullable(),
  // Spec 091 D1 (R1 (a)): optional, so old rows parse.
  description: z.string().max(1000).optional(),
  ways: z.array(WaySchema).max(6).optional(),
  cast: z.array(CastEntrySchema).max(20).optional(),
});

export const SceneChangedV1 = z
  .object({
    reason: ReasonSchema,
    before: SceneSchema.nullable(),
    after: SceneSchema.nullable(),
  })
  .refine((p) => p.before !== null || p.after !== null, {
    message: "a scene change has a before or an after",
  });

export type Way = z.infer<typeof WaySchema>;
export type CastEntry = z.infer<typeof CastEntrySchema>;
export type Scene = z.infer<typeof SceneSchema>;
