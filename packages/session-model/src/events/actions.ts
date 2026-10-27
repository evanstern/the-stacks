import { RefusalCodeSchema } from "@the-stacks/dnd5e-engine";
import { z } from "zod";
import { RefIdSchema } from "../ids.js";

export const ActionDeclaredV1 = z
  .object({
    actionId: RefIdSchema,
    characterId: RefIdSchema.nullable(),
    scope: z.enum(["character", "party"]),
    text: z.string().min(1).max(2000),
  })
  .refine((p) => p.scope === "party" || p.characterId !== null, {
    message: "a character-scope action names its character",
  });

export const ActionCommentedV1 = z
  .object({
    actionId: RefIdSchema,
    stance: z.enum(["comment", "approve", "object"]),
    text: z.string().max(2000),
  })
  .refine((p) => p.stance !== "comment" || p.text.length > 0, {
    message: "a comment carries text",
  });

export const ActionCommittedV1 = z.object({
  actionId: RefIdSchema,
  authority: z.enum(["declarer", "active-player", "group", "dm"]),
});

export const ActionWithdrawnV1 = z.object({
  actionId: RefIdSchema,
});

export const ActionResolvedV1 = z
  .object({
    actionId: RefIdSchema,
    outcome: z.enum(["applied", "refused", "no-effect"]),
    batchIds: z.array(RefIdSchema).max(20),
    refusalCode: RefusalCodeSchema.nullable(),
  })
  .superRefine((p, ctx) => {
    if (p.outcome === "applied") {
      if (p.batchIds.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "an applied action names at least one batch",
          path: ["batchIds"],
        });
      }
      if (p.refusalCode !== null) {
        ctx.addIssue({
          code: "custom",
          message: "an applied action has no refusal code",
          path: ["refusalCode"],
        });
      }
    } else if (p.outcome === "refused") {
      if (p.refusalCode === null) {
        ctx.addIssue({
          code: "custom",
          message: "a refused action carries a refusal code",
          path: ["refusalCode"],
        });
      }
      if (p.batchIds.length !== 0) {
        ctx.addIssue({
          code: "custom",
          message: "a refused action names no batch",
          path: ["batchIds"],
        });
      }
    } else {
      if (p.batchIds.length !== 0) {
        ctx.addIssue({
          code: "custom",
          message: "a no-effect action names no batch",
          path: ["batchIds"],
        });
      }
      if (p.refusalCode !== null) {
        ctx.addIssue({
          code: "custom",
          message: "a no-effect action has no refusal code",
          path: ["refusalCode"],
        });
      }
    }
  });
