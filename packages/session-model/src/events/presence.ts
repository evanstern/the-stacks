import { z } from "zod";
import { RefIdSchema } from "../ids.js";

/**
 * The presence marker (decision-0024, option D): a public `system` row that records which
 * human users were present at the table at the instant a decision was taken. Only
 * `apps/server/src/gate/` appends it. `signoff` and `floor` are reserved for TASK-0049 and
 * TASK-0050; this task writes only `director`.
 */
export const PRESENCE_PURPOSES = ["director", "signoff", "floor"] as const;
export type PresencePurpose = (typeof PRESENCE_PURPOSES)[number];

export const PresenceRecordedV1 = z.object({
  present: z
    .array(z.uuid())
    .max(64)
    .refine(
      (ids) => ids.every((id, i) => i === 0 || (ids[i - 1] as string) < id),
      { message: "present must be sorted ascending and unique" },
    ),
  purpose: z.enum(PRESENCE_PURPOSES),
  actionId: RefIdSchema.optional(),
});

export type PresenceRecorded = z.infer<typeof PresenceRecordedV1>;
