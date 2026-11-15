import { describe, expect, it } from "vitest";
import { IntentBodySchema } from "../../src/dm/nodes/schemas.js";
import { stripParams } from "../../src/dm/react-params.js";
import {
  RECONSTRUCTED_F1,
  RECONSTRUCTED_F2,
} from "./fixtures/react-params-hosted.js";

const reply = (body: unknown) => ({ confirm: [{ characterId: "t", body }] });
const paramsOf = (r: { json: unknown }) =>
  (r.json as { confirm: { body: { params: unknown } }[] }).confirm[0]?.body
    .params;

describe("stripParams (spec 116 SC-002)", () => {
  it("strips F1 and F2 to {} and lists each key", () => {
    const a = stripParams(RECONSTRUCTED_F1);
    expect(paramsOf(a)).toEqual({});
    expect(a.strips).toEqual([
      { kind: "params-stripped", item: 0, bodyKind: "move", key: "skill" },
    ]);
    const b = stripParams(RECONSTRUCTED_F2);
    expect(paramsOf(b)).toEqual({});
    expect(b.strips.map((s) => s.key)).toEqual(["ready", "caution"]);
  });

  it("keeps a known key, drops an unknown one", () => {
    const r = stripParams(
      reply({ kind: "search", params: { skill: "perception", caution: 1 } }),
    );
    expect(paramsOf(r)).toEqual({ skill: "perception" });
  });

  it("does not hide a bad value on a known key", () => {
    const r = stripParams(
      reply({ kind: "search", params: { skill: "stealth" } }),
    );
    expect(paramsOf(r)).toEqual({ skill: "stealth" });
    expect(r.strips).toEqual([]);
  });

  it("drops a model-written dc on a check", () => {
    const r = stripParams(
      reply({ kind: "check", params: { skill: "x", dc: 15 } }),
    );
    expect(paramsOf(r)).toEqual({ skill: "x" });
  });

  it("keeps a nested value unchanged", () => {
    const params = { assist: { kind: "check", skill: "athletics", extra: 1 } };
    expect(paramsOf(stripParams(reply({ kind: "help", params })))).toEqual(
      params,
    );
  });

  it("passes odd shapes through", () => {
    for (const j of [
      null,
      "x",
      { outcome: "none" },
      reply({ kind: "teleport", params: { a: 1 } }),
      reply({ kind: "move", params: "x" }),
      reply(undefined),
    ]) {
      const r = stripParams(j);
      expect(r.json).toBe(j);
      expect(r.strips).toEqual([]);
    }
  });

  it("does not mutate its input", () => {
    const input = structuredClone(RECONSTRUCTED_F2);
    stripParams(input);
    expect(input).toEqual(RECONSTRUCTED_F2);
  });

  it("every IntentBodySchema member has a strict params object", () => {
    for (const m of IntentBodySchema.options) {
      const r = m.shape.params.safeParse({ zzInvented: 1 });
      expect(r.success, m.shape.kind.value).toBe(false);
    }
  });
});
