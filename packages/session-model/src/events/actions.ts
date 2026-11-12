import { RefusalCodeSchema } from "@the-stacks/dnd5e-engine";
import { IntentSchema } from "@the-stacks/intent";
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

/** One line of a DM confirm: the DM's wording and the Intent a 👍 plans (spec 066 D1). */
export const SuggestionItemV1 = z.object({
  itemId: z.string().regex(/^i[1-4]$/),
  text: z.string().min(1).max(500),
  intent: IntentSchema,
});

/** The DM's confirm row: 1 to 4 `declared` Intents the players may 👍 (spec 066 FR-011). */
export const ActionSuggestedV1 = z
  .object({
    suggestionId: RefIdSchema,
    /** The seq of the latest readable post the read took. */
    readSeq: z.number().int().min(0),
    items: z.array(SuggestionItemV1).min(1).max(4),
  })
  .superRefine((p, ctx) => {
    if (p.items.some((i) => i.intent.commit !== "declared")) {
      ctx.addIssue({
        code: "custom",
        message: "a suggestion item carries a declared Intent",
        path: ["items"],
      });
    }
    if (new Set(p.items.map((i) => i.itemId)).size !== p.items.length) {
      ctx.addIssue({
        code: "custom",
        message: "item ids are unique",
        path: ["items"],
      });
    }
  });
export type SuggestionItem = z.infer<typeof SuggestionItemV1>;
export type ActionSuggested = z.infer<typeof ActionSuggestedV1>;
