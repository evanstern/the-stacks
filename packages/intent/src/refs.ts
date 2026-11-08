// Contract §2–§5: Source, Commit, ActorRef, Channel, TargetRef.
import { z } from "zod";
import { IdSchema } from "./scalars.js";

export const SourceSchema = z.enum([
  "composer",
  "bar",
  "sheet",
  "map",
  "tracker",
  "console",
  "ai",
  "adapter",
]);
export const CommitSchema = z.enum(["draft", "declared", "confirmed"]);

export const ActorRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("pc"), id: IdSchema }),
  z.strictObject({ kind: z.literal("companion"), id: IdSchema }),
  z.strictObject({ kind: z.literal("npc"), id: IdSchema }),
  z.strictObject({ kind: z.literal("dm") }),
  z.strictObject({ kind: z.literal("ai:dm") }),
]);

export const RecipientSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("pc"), id: IdSchema }),
  z.strictObject({ kind: z.literal("dm") }),
]);

export const ChannelSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("scene") }),
  z.strictObject({ kind: z.literal("to"), id: IdSchema }),
  z.strictObject({ kind: z.literal("dm") }),
  z.strictObject({ kind: z.literal("party") }),
  z.strictObject({
    kind: z.literal("whisper"),
    to: z.array(RecipientSchema).min(1).max(8),
  }),
]);

export const TargetRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("actor"), id: IdSchema }),
  z.strictObject({ kind: z.literal("entity"), id: IdSchema }),
  z.strictObject({ kind: z.literal("item"), id: IdSchema }),
  z.strictObject({ kind: z.literal("zone"), id: IdSchema }),
  z.strictObject({
    kind: z.literal("square"),
    x: z.number().int().min(0).max(999),
    y: z.number().int().min(0).max(999),
  }),
  z.strictObject({
    kind: z.literal("point"),
    x: z.number().min(0).max(4995),
    y: z.number().min(0).max(4995),
  }),
]);

export type Source = z.infer<typeof SourceSchema>;
export type Commit = z.infer<typeof CommitSchema>;
export type ActorRef = z.infer<typeof ActorRefSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type TargetRef = z.infer<typeof TargetRefSchema>;
