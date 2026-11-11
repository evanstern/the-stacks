import { INTENT_KINDS } from "@the-stacks/intent";
import { VALID } from "@the-stacks/intent/fixtures";
import { describe, expect, it } from "vitest";
import { plan } from "../src/index.js";
import { baseState, intent, sansText, tgt, view } from "./fixtures.js";

const fixtures = INTENT_KINDS.flatMap((k) => VALID[k]);

describe("determinism", () => {
  it("plans every valid fixture twice to deep-equal results", () => {
    for (const i of fixtures) {
      const s = baseState();
      expect(plan(s, view(s), i), i.kind).toEqual(plan(s, view(s), i));
    }
  });

  it("is insensitive to text", () => {
    for (const i of fixtures) {
      const s = baseState();
      const other = {
        ...i,
        text: i.text === undefined ? undefined : "other words",
      };
      expect(sansText(plan(s, view(s), other as typeof i)), i.kind).toEqual(
        sansText(plan(s, view(s), i)),
      );
    }
  });

  it("does not mutate its inputs", () => {
    const s = baseState();
    const before = structuredClone(s);
    for (const i of fixtures) plan(s, view(s), i);
    expect(s).toEqual(before);
  });
});
