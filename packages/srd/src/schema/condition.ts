import { z } from "zod";
import { Base } from "./common.js";

// ---- condition ----
export const Condition = z
  .object({
    ...Base,
    text: z.string().min(1),
    effects: z
      .array(
        z.object({ name: z.string().min(1), text: z.string().min(1) }).strict(),
      )
      .min(1),
  })
  .strict();
