import type { LedgerRow } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import {
  consequenceFor,
  effectsForBand,
  isFreeRetry,
} from "../../src/dm/stakes.js";

const eff = (id: string) =>
  ({
    effect: "condition",
    op: "apply",
    targetId: id,
    condition: "prone",
    source: "s",
  }) as never;
const step = {
  onSuccess: [eff("s")],
  onCost: [eff("c")],
  onFailure: [eff("f")],
  onSevere: [eff("v")],
};
const ids = (l: unknown[]) =>
  l.map((e) => (e as { targetId: string }).targetId);

describe("effectsForBand", () => {
  it("orders effects per band", () => {
    expect(ids(effectsForBand(step, "success"))).toEqual(["s"]);
    expect(ids(effectsForBand(step, "success-at-cost"))).toEqual(["s", "c"]);
    expect(ids(effectsForBand(step, "failure"))).toEqual(["f"]);
    expect(ids(effectsForBand(step, "severe-failure"))).toEqual(["f", "v"]);
  });
  it("reads an unknown or missing band as failure", () => {
    expect(ids(effectsForBand(step, null))).toEqual(["f"]);
  });
});

const failed = (over: Record<string, unknown> = {}): LedgerRow =>
  ({
    kind: "outcome",
    seq: 5,
    outcome: {
      type: "check.resolved",
      kind: "ability-check",
      combatantId: "tamsin",
      ability: "str",
      skill: "athletics",
      outcome: "failure",
      ...over,
    },
  }) as unknown as LedgerRow;
const sceneChange = { kind: "change", seq: 9, type: "scene.changed" } as never;
const base = {
  kind: "ability-check" as const,
  combatantId: "tamsin",
  ability: "str" as const,
  skill: "athletics" as never,
  newRisk: null,
  autoFail: null,
};

describe("isFreeRetry", () => {
  it("is true after the same failed check in this scene", () => {
    expect(isFreeRetry(base, [failed()])).toBe(true);
  });
  it("is false for each broken FR-014 condition", () => {
    expect(isFreeRetry({ ...base, combatantId: null }, [failed()])).toBe(false);
    expect(isFreeRetry({ ...base, newRisk: "r" }, [failed()])).toBe(false);
    expect(
      isFreeRetry({ ...base, autoFail: { reason: "x" } as never }, [failed()]),
    ).toBe(false);
    expect(isFreeRetry({ ...base, kind: "saving-throw" }, [failed()])).toBe(
      false,
    );
    expect(isFreeRetry({ ...base, ability: "dex" }, [failed()])).toBe(false);
    expect(isFreeRetry({ ...base, skill: null }, [failed()])).toBe(false);
    expect(isFreeRetry(base, [failed({ combatantId: "odo" })])).toBe(false);
    expect(isFreeRetry(base, [failed({ outcome: "success" })])).toBe(false);
    expect(isFreeRetry(base, [])).toBe(false);
  });
  it("ignores a failure from an earlier scene", () => {
    expect(isFreeRetry(base, [failed(), sceneChange])).toBe(false);
    expect(isFreeRetry(base, [sceneChange, failed()])).toBe(true);
  });
});

describe("consequenceFor", () => {
  const stakes = { success: null, cost: "C", failure: "F", severe: "V" };
  it("returns the declared text per band", () => {
    expect(consequenceFor(stakes, "success")).toBeNull();
    expect(consequenceFor(stakes, "success-at-cost")).toBe("C");
    expect(consequenceFor(stakes, "failure")).toBe("F");
    expect(consequenceFor(stakes, "severe-failure")).toBe("V");
    expect(consequenceFor(null, "failure")).toBeNull();
    expect(consequenceFor(stakes, null)).toBeNull();
  });
});
