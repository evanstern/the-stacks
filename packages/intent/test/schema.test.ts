import { describe, expect, it } from "vitest";
import { INVALID, VALID } from "../src/fixtures/index.js";
import {
  INTENT_GROUPS,
  INTENT_KINDS,
  IntentRefusalCodeSchema,
  IntentSchema,
  KIND_RULES,
  paramsSchemaOf,
} from "../src/index.js";
import { schemaRefusalCode } from "../src/refusals.js";

describe("kinds", () => {
  it("has 57 kinds in 13 groups, all covered by KIND_RULES, params and VALID", () => {
    expect(INTENT_KINDS.length).toBe(57);
    expect(new Set(Object.values(INTENT_GROUPS)).size).toBe(13);
    for (const k of INTENT_KINDS) {
      expect(KIND_RULES[k], k).toBeDefined();
      expect(paramsSchemaOf(k), k).toBeDefined();
      expect(VALID[k].length, k).toBeGreaterThan(0);
    }
  });

  it("group sizes match contract §6", () => {
    const n: Record<string, number> = {};
    for (const g of Object.values(INTENT_GROUPS)) n[g] = (n[g] ?? 0) + 1;
    expect(n).toEqual({
      speech: 3,
      meta: 4,
      deed: 1,
      check: 3,
      combat: 12,
      movement: 3,
      reaction: 1,
      turn: 3,
      resource: 7,
      roll: 2,
      advancement: 1,
      dm: 14,
      session: 3,
    });
  });
});

describe("valid fixtures", () => {
  for (const k of INTENT_KINDS)
    it(`${k} validates and re-parses to itself`, () => {
      for (const i of VALID[k]) expect(IntentSchema.parse(i)).toEqual(i);
    });

  it("fills a fixed channel and defaults", () => {
    const say = VALID.say[0];
    expect(say?.channel).toEqual({ kind: "scene" });
    const say_to = VALID.say_to[0];
    expect(say_to?.channel).toEqual({ kind: "to", id: "innkeeper" });
    expect(VALID.check[0]?.params).toMatchObject({ mode: "normal" });
  });
});

describe("invalid fixtures", () => {
  for (const f of INVALID.filter((x) => x.input !== undefined))
    it(`${f.code}: ${f.name}`, () => {
      const r = IntentSchema.safeParse(f.input);
      expect(r.success).toBe(false);
      if (!r.success)
        expect(schemaRefusalCode(r.error.issues as never)).toBe(f.code);
    });

  it("covers every schema refusal code", () => {
    for (const c of [
      "INTENT_SCHEMA",
      "INTENT_CHANNEL_MISMATCH",
      "MODEL_NUMBER",
    ] as const)
      expect(
        INVALID.some((f) => f.code === c && f.input !== undefined),
        c,
      ).toBe(true);
  });

  it("refusal enum holds the contract's codes", () => {
    expect(IntentRefusalCodeSchema.options.length).toBe(27);
  });
});

describe("rules", () => {
  it("human DM may carry numbers the AI DM may not", () => {
    expect(
      IntentSchema.safeParse({ ...VALID.set_dc[0], actor: { kind: "ai:dm" } })
        .success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({ ...VALID.set_dc[0], actor: { kind: "dm" } })
        .success,
    ).toBe(true);
  });
  it("rejects a nested amend carrying a model number from ai:dm", () => {
    const base = VALID.ruling[1];
    const bad = {
      ...base,
      actor: { kind: "ai:dm" },
      params: {
        ...base?.params,
        amend: {
          kind: "apply_damage",
          targets: [{ kind: "actor", id: "g" }],
          params: { amount: { kind: "fixed", value: 4 }, damageType: "fire" },
        },
      },
    };
    expect(IntentSchema.safeParse(bad).success).toBe(false);
  });
});
