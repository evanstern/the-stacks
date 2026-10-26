import { z } from "zod";

/** Who holds the DM seat: the AI DM, or one human (contracts/proposals.md). */
export const DmSeatSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ai") }),
  z.object({ kind: z.literal("human"), userId: z.uuid() }),
]);

export type DmSeat = z.infer<typeof DmSeatSchema>;
