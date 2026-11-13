import { SkillSchema as EngineSkillSchema } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  CONDITION_KEYS,
  EffectSchema,
  InterpretReadingSchema,
  SKILL_KEYS,
} from "../../src/dm/nodes/schemas.js";

/** An Intent check reading: `params` and `beside` overrides. */
const check = (
  params: Record<string, unknown> = {},
  beside: Record<string, unknown> = {},
) => ({
  actionId: "a1",
  stages: [
    {
      intent: {
        kind: "check",
        targets: [],
        params: { skill: "perception", ...params },
      },
      beside: {
        stakes: {
          success: "The attempt works as intended.",
          cost: "It works, at a small price.",
          failure: "The attempt comes to nothing.",
          severe: "It goes badly wrong.",
        },
        ...beside,
      },
    },
  ],
  clarify: null,
});

describe("rules-terms gate", () => {
  it("accepts a listed skill and none", () => {
    expect(InterpretReadingSchema.safeParse(check()).success).toBe(true);
    expect(
      InterpretReadingSchema.safeParse(check({ skill: undefined })).success,
    ).toBe(true);
  });

  it.each(["spotting", "Perception", "sleight of hand"])(
    "the reading schema rejects the skill %s",
    (skill) => {
      expect(InterpretReadingSchema.safeParse(check({ skill })).success).toBe(
        false,
      );
    },
  );

  it("the reading schema rejects an unknown ability", () => {
    expect(
      InterpretReadingSchema.safeParse(check({ ability: "luck" })).success,
    ).toBe(false);
  });

  it("the reading schema rejects the condition spotted-lookout", () => {
    const r = InterpretReadingSchema.safeParse(
      check(
        {},
        {
          onSuccess: [
            {
              effect: "condition",
              op: "apply",
              targetId: "pc-ana",
              condition: "spotted-lookout",
              source: "x",
            },
          ],
        },
      ),
    );
    expect(r.success).toBe(false);
  });

  it("EffectSchema rejects an unknown damage type", () => {
    const r = EffectSchema.safeParse({
      effect: "damage",
      targetId: "pc-ana",
      components: [
        { amount: { kind: "fixed", value: 3 }, damageType: "sonorous" },
      ],
      defenses: null,
    });
    expect(r.success).toBe(false);
  });

  it("the server skill keys equal the engine skill keys", () => {
    expect([...SKILL_KEYS]).toEqual([...EngineSkillSchema.options]);
    expect(SKILL_KEYS).toHaveLength(18);
  });

  it("condition keys exclude exhaustion", () => {
    expect(CONDITION_KEYS).not.toContain("exhaustion");
    expect(CONDITION_KEYS).toContain("prone");
  });
});
