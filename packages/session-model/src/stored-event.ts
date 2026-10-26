import { z } from "zod";
import { ActorIdSchema, VisibilitySchema } from "./ids.js";

/** The in-memory form of one row of the M0 events table. */
export const StoredEventSchema = z.object({
  sessionId: z.uuid(),
  seq: z.number().int().min(1),
  actor: ActorIdSchema,
  type: z.string().min(1).max(100),
  payload: z.unknown(),
  payloadVersion: z.number().int().min(1),
  visibility: VisibilitySchema,
  ts: z.iso.datetime({ offset: true }),
});
export type StoredEvent = z.infer<typeof StoredEventSchema>;
