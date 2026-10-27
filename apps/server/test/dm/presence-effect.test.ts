import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DirectorOutput,
  EffectSchema,
  StepSchema,
} from "../../src/dm/nodes/schemas.js";
import { STEP_GRAMMAR } from "../../src/dm/prompts/step-grammar.js";

/** Spec 048: the presence effect in the step grammar (User Stories 2 and 5). */

const presence = (over: Record<string, unknown> = {}) => ({
  effect: "presence",
  targetId: "goblin-2",
  reason: "fled",
  ...over,
});

const check = (over: Record<string, unknown> = {}) => ({
  step: "check",
  reason: "Intimidate the goblin",
  combatantId: "tamsin",
  kind: "ability-check",
  ability: "cha",
  skill: "intimidation",
  expression: "1d20+4",
  mode: "normal",
  dc: 12,
  autoFail: null,
  onSuccess: [],
  onFailure: [],
  ...over,
});

describe("presence effect schema", () => {
  it("accepts a presence effect with every reason", () => {
    for (const reason of [
      "arrived",
      "left",
      "fled",
      "removed",
      "surrendered",
      "conceded",
    ]) {
      expect(EffectSchema.safeParse(presence({ reason })).success).toBe(true);
    }
  });

  it("accepts it in an effect step, onSuccess, onFailure and onHit", () => {
    const e = presence();
    expect(
      StepSchema.safeParse({ step: "effect", reason: "r", effects: [e] })
        .success,
    ).toBe(true);
    expect(StepSchema.safeParse(check({ onSuccess: [e] })).success).toBe(true);
    expect(StepSchema.safeParse(check({ onFailure: [e] })).success).toBe(true);
    expect(
      StepSchema.safeParse({
        step: "attack",
        reason: "r",
        attackerId: "tamsin",
        targetId: "goblin-2",
        expression: "1d20+5",
        mode: "normal",
        targetAc: null,
        onHit: [e],
      }).success,
    ).toBe(true);
  });

  it("refuses an unknown reason and an after field", () => {
    expect(
      EffectSchema.safeParse(presence({ reason: "vanished" })).success,
    ).toBe(false);
    expect(EffectSchema.safeParse(presence({ after: "absent" })).success).toBe(
      false,
    );
  });

  it("renders the effect, the six reasons and the two placement rules", () => {
    expect(STEP_GRAMMAR).toContain('{"effect":"presence"');
    for (const reason of [
      "arrived",
      "left",
      "fled",
      "removed",
      "surrendered",
      "conceded",
    ]) {
      expect(STEP_GRAMMAR).toContain(reason);
    }
    expect(STEP_GRAMMAR).toContain(
      "Put another actor's presence change in onSuccess, onFailure or onHit",
    );
    expect(STEP_GRAMMAR).toContain(
      "The acting actor's own presence change may stand in an effect step",
    );
  });
});

describe("no Director presence field (User Story 5)", () => {
  const keys = (schema: z.core.$ZodType, out: string[] = []): string[] => {
    const json = z.toJSONSchema(schema as z.ZodType, {
      io: "input",
      unrepresentable: "any",
    });
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const n of node) walk(n);
      } else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          if (k === "properties" && v && typeof v === "object") {
            out.push(...Object.keys(v));
          }
          walk(v);
        }
      }
    };
    walk(json);
    return out;
  };

  it("has no key matching /presence/i", () => {
    const found = keys(DirectorOutput);
    expect(found.length).toBeGreaterThan(5);
    expect(found.filter((k) => /presence/i.test(k))).toEqual([]);
  });
});
