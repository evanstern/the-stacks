// Copied enums must equal the engine's (contract §1). Dev-only engine import.
import {
  AbilitySchema as EAbility,
  AmountSchema as EAmount,
  DamageTypeSchema as EDamage,
  DifficultySchema as EDifficulty,
  SkillSchema as ESkill,
} from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  AbilitySchema,
  AmountSchema,
  ConditionSchema,
  DamageTypeSchema,
  DifficultySchema,
  RollModeSchema,
  SkillSchema,
} from "../src/scalars.js";

describe("engine drift", () => {
  it("enums match by value", () => {
    expect(AbilitySchema.options).toEqual(EAbility.options);
    expect(SkillSchema.options).toEqual(ESkill.options);
    expect(DifficultySchema.options).toEqual(EDifficulty.options);
    expect(DamageTypeSchema.options).toEqual(EDamage.options);
  });

  it("Condition and RollMode match the engine's accepted values", () => {
    // Engine exports ConditionInstanceSchema, not the bare key enum.
    for (const c of ConditionSchema.options)
      expect(ConditionInstanceOk(c), `engine rejects condition ${c}`).toBe(
        true,
      );
    expect(RollModeSchema.options).toEqual([
      "normal",
      "advantage",
      "disadvantage",
    ]);
  });

  it("Amount accepts and rejects the same shapes", () => {
    const cases = [
      { kind: "fixed", value: 0 },
      { kind: "fixed", value: 10000 },
      { kind: "fixed", value: 10001 },
      { kind: "fixed", value: 1.5 },
      { kind: "roll", expression: "1d6" },
      { kind: "roll", expression: "" },
      { kind: "roll", expression: "x".repeat(201) },
      { kind: "other" },
    ];
    for (const c of cases)
      expect(AmountSchema.safeParse(c).success).toBe(
        EAmount.safeParse(c).success,
      );
  });
});

import { ConditionInstanceSchema } from "@the-stacks/dnd5e-engine";

function ConditionInstanceOk(condition: string): boolean {
  return ConditionInstanceSchema.safeParse({
    instanceId: "x",
    condition,
    level: null,
    source: "t",
    expiresAt: null,
  }).success;
}
