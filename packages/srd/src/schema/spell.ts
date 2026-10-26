import { z } from "zod";
import { Base, RecordId } from "./common.js";

// ---- spell ----
export const Spell = z
  .object({
    ...Base,
    level: z.number().int().min(0).max(9),
    school: z.enum([
      "Abjuration",
      "Conjuration",
      "Divination",
      "Enchantment",
      "Evocation",
      "Illusion",
      "Necromancy",
      "Transmutation",
    ]),
    classes: z.array(RecordId).min(1),
    castingTime: z.string().min(1),
    ritual: z.boolean(),
    reactionTrigger: z.string().optional(),
    range: z.string().min(1),
    components: z
      .object({
        v: z.boolean(),
        s: z.boolean(),
        m: z.boolean(),
        material: z.string().optional(),
      })
      .strict(),
    concentration: z.boolean(),
    duration: z.string().min(1),
    text: z.string().min(1),
    higherLevels: z.string().optional(),
  })
  .strict();
