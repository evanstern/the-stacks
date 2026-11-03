import { SkillSchema as EngineSkillSchema } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  CONDITION_KEYS,
  EffectSchema,
  SKILL_KEYS,
  StepSchema,
} from "../../src/dm/nodes/schemas.js";

const check = (over: Record<string, unknown> = {}) => ({
  step: "check",
  reason: "r",
  combatantId: "pc-ana",
  kind: "ability-check",
  ability: "wis",
  skill: "perception",
  difficulty: "medium",
  circumstance: null,
  autoFail: null,
  onSuccess: [],
  onFailure: [],
  stakes: {
    success: "The attempt works as intended.",
    cost: "It works, at a small price.",
    failure: "The attempt comes to nothing.",
    severe: "It goes badly wrong.",
  },
  onCost: [],
  onSevere: [],
  newRisk: null,
  ...over,
});

describe("rules-terms gate", () => {
  it("accepts a listed skill and null", () => {
    expect(StepSchema.safeParse(check()).success).toBe(true);
    expect(StepSchema.safeParse(check({ skill: null })).success).toBe(true);
  });

  it.each(["spotting", "Perception", "sleight of hand"])(
    "StepSchema rejects the skill %s",
    (skill) => {
      expect(StepSchema.safeParse(check({ skill })).success).toBe(false);
    },
  );

  it("StepSchema rejects an unknown ability", () => {
    expect(StepSchema.safeParse(check({ ability: "luck" })).success).toBe(
      false,
    );
  });

  it("StepSchema rejects the condition spotted-lookout", () => {
    const r = StepSchema.safeParse(
      check({
        onSuccess: [
          {
            effect: "condition",
            op: "apply",
            targetId: "pc-ana",
            condition: "spotted-lookout",
            source: "x",
          },
        ],
      }),
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
