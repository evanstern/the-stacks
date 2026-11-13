import { describe, expect, it } from "vitest";
import {
  COMPANION_TURN_KINDS,
  INTERPRET_KINDS,
} from "../../src/dm/nodes/schemas.js";
import { rulingReplySchema } from "../../src/dm/rulings.js";

// Spec 109 AC #1 guard: no AI producer can emit a number-bearing kind or field.
// Deeper coverage already exists: interpret-intents.test.ts (a body `dc` is refused) and the
// packages/intent MODEL_NUMBER fixtures. Do not duplicate them here.
const NUMBER_KINDS = [
  "roll_free",
  "apply_damage",
  "apply_heal",
  "set_dc",
  "request_roll",
];

describe("AI producers carry no model-written numbers (spec 109)", () => {
  it("interpret and companion kinds hold no number-bearing kind", () => {
    for (const list of [INTERPRET_KINDS, COMPANION_TURN_KINDS] as const) {
      for (const k of NUMBER_KINDS)
        expect(list as readonly string[]).not.toContain(k);
    }
  });

  it("the rulings reply schema has no numeric field and drops dc and amend", () => {
    const schema = rulingReplySchema(false);
    const out = schema.parse({
      decision: "accept",
      dc: 15,
      amend: { amount: 9 },
    }) as Record<string, unknown>;
    expect(out).toEqual({ decision: "accept" });
    const inner = (schema as unknown as { shape: Record<string, unknown> })
      .shape;
    expect(Object.keys(inner).sort()).toEqual([
      "decision",
      "difficulty",
      "reason",
    ]);
    for (const f of Object.values(inner)) {
      expect(
        JSON.stringify((f as { _zod: { def: unknown } })._zod.def),
      ).not.toMatch(/"type":"(number|int)"/);
    }
  });
});
