import { z } from "zod";
import { ActorIdSchema, ReasonSchema, RefIdSchema } from "../ids.js";

export const TableModeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("free") }),
  z.object({
    mode: z.literal("turn"),
    activeActor: ActorIdSchema,
    activeCharacterId: RefIdSchema.nullable(),
  }),
]);

export const TableModeChangedV1 = z.object({
  reason: ReasonSchema,
  before: TableModeSchema,
  after: TableModeSchema,
});

export type TableMode = z.infer<typeof TableModeSchema>;
