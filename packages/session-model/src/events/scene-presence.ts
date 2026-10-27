import { z } from "zod";
import { RefIdSchema } from "../ids.js";

/** Whether an actor takes part in the scene (decision-0025 Terms). */
export const ScenePresenceSchema = z.enum(["present", "yielded", "absent"]);
export type ScenePresence = z.infer<typeof ScenePresenceSchema>;

/** The closed list of reasons a presence changes. The reason fixes the new value. */
export const PresenceReasonSchema = z.enum([
  "arrived",
  "left",
  "fled",
  "removed",
  "surrendered",
  "conceded",
]);
export type PresenceReason = z.infer<typeof PresenceReasonSchema>;

/** The presence value each reason produces. */
export const REASON_TO_PRESENCE: Readonly<
  Record<PresenceReason, ScenePresence>
> = {
  arrived: "present",
  left: "absent",
  fled: "absent",
  removed: "absent",
  surrendered: "yielded",
  conceded: "yielded",
};

export const ScenePresenceChangedV1 = z
  .object({
    /** The id the snapshot uses: a character id, an NPC id or a combatant id. */
    actorId: RefIdSchema,
    before: ScenePresenceSchema,
    after: ScenePresenceSchema,
    reason: PresenceReasonSchema,
    /** The resolving action, or null for the NPC group. */
    actionId: RefIdSchema.nullable(),
  })
  .refine((p) => p.after === REASON_TO_PRESENCE[p.reason], {
    message: "after does not match the reason",
    path: ["after"],
  })
  .refine((p) => p.before !== p.after, {
    message: "a presence change changes the value",
    path: ["after"],
  });
export type ScenePresenceChanged = z.infer<typeof ScenePresenceChangedV1>;
