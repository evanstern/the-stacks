import { z } from "zod";
import { RefIdSchema } from "../ids.js";

export const TalkV1 = z.object({
  text: z.string().min(1).max(4000),
  channel: z.enum(["ic", "ooc"]),
  characterId: RefIdSchema.nullable(),
});

export const NarrationV1 = z.object({
  text: z.string().min(1).max(8000),
  actionIds: z.array(RefIdSchema).max(20),
});

export type Talk = z.infer<typeof TalkV1>;
export type Narration = z.infer<typeof NarrationV1>;
