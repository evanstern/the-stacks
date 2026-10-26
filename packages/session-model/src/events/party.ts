import { z } from "zod";
import {
  ActorIdSchema,
  CombatantIdSchema,
  ReasonSchema,
  RefIdSchema,
} from "../ids.js";

export const ControllerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("player"), userId: z.uuid() }),
  z.object({ kind: z.literal("ai-companion"), actor: ActorIdSchema }),
]);

export const PartyMemberSchema = z.object({
  characterId: RefIdSchema,
  name: z.string().min(1).max(100),
  controller: ControllerSchema,
  combatantId: CombatantIdSchema.nullable(),
});

export const PartyMemberChangedV1 = z
  .object({
    reason: ReasonSchema,
    characterId: RefIdSchema,
    before: PartyMemberSchema.nullable(),
    after: PartyMemberSchema.nullable(),
  })
  .superRefine((p, ctx) => {
    if (p.before === null && p.after === null) {
      ctx.addIssue({
        code: "custom",
        message: "a party change has a before or an after",
      });
    }
    for (const side of ["before", "after"] as const) {
      const member = p[side];
      if (member !== null && member.characterId !== p.characterId) {
        ctx.addIssue({
          code: "custom",
          message: `${side}.characterId matches characterId`,
          path: [side, "characterId"],
        });
      }
    }
  });

export type Controller = z.infer<typeof ControllerSchema>;
export type PartyMember = z.infer<typeof PartyMemberSchema>;
