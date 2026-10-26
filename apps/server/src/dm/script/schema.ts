import { z } from "zod";
import { DM_PURPOSES } from "../purposes.js";

const ErrorKindSchema = z.enum([
  "config",
  "auth",
  "rate_limit",
  "refusal",
  "upstream",
  "cancelled",
]);

/**
 * The DM script document (specs/031-dm-runtime contracts/fake-gateway-script.md).
 * Binding for TASK-0048: its CI case reuses this format and loader unchanged.
 */
export const DmScriptSchema = z.object({
  v: z.literal(1),
  name: z.string().min(1).max(100),
  dice: z.array(z.number().int().min(1).max(1000)).max(2000),
  calls: z
    .array(
      z.object({
        purpose: z.enum(DM_PURPOSES),
        note: z.string().max(200).optional(),
        respond: z.discriminatedUnion("type", [
          z.object({ type: z.literal("json"), value: z.unknown() }),
          z.object({ type: z.literal("text"), value: z.string() }),
          z.object({
            type: z.literal("error"),
            kind: ErrorKindSchema,
            message: z.string(),
          }),
        ]),
        usage: z
          .object({
            inputTokens: z.number().int().min(0),
            outputTokens: z.number().int().min(0),
          })
          .default({ inputTokens: 0, outputTokens: 0 }),
      }),
    )
    .max(2000),
  embed: z.literal("hash").default("hash"),
});

export type DmScript = z.infer<typeof DmScriptSchema>;
