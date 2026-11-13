import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DirectorOutput,
  EffectSchema,
  InterpretReadingSchema,
} from "../../src/dm/nodes/schemas.js";

/** Spec 048: the presence effect in the effect grammar (User Stories 2 and 5). */

const presence = (over: Record<string, unknown> = {}) => ({
  effect: "presence",
  targetId: "goblin-2",
  reason: "fled",
  ...over,
});

/** An Intent check stage whose beside block carries the given effect lists. */
const checkStage = (beside: Record<string, unknown> = {}) => ({
  actionId: "a1",
  stages: [
    {
      intent: { kind: "check", targets: [], params: { skill: "intimidation" } },
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

  it("accepts it in a beside onSuccess and onFailure", () => {
    const e = presence();
    const ok = (b: Record<string, unknown>) =>
      InterpretReadingSchema.safeParse(checkStage(b)).success;
    expect(ok({ onSuccess: [e] })).toBe(true);
    expect(ok({ onFailure: [e] })).toBe(true);
  });

  it("refuses an unknown reason and an after field", () => {
    expect(
      EffectSchema.safeParse(presence({ reason: "vanished" })).success,
    ).toBe(false);
    expect(EffectSchema.safeParse(presence({ after: "absent" })).success).toBe(
      false,
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
