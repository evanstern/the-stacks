import { z } from "zod";
import { RefIdSchema } from "../ids.js";

export const JournalEntryAddedV1 = z.object({
  entryId: RefIdSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  sourceActionIds: z.array(RefIdSchema).max(50),
});
