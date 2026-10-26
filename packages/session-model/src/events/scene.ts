import { z } from "zod";
import { ReasonSchema, RefIdSchema } from "../ids.js";

export const SceneSchema = z.object({
  sceneId: RefIdSchema,
  title: z.string().min(1).max(200),
  summary: z.string().max(4000),
  location: z.string().max(200).nullable(),
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

export type Scene = z.infer<typeof SceneSchema>;
