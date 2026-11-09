import { describe, expect, it } from "vitest";
import { SpaceSchema } from "../src/index.js";
import { mk } from "./helpers.js";

describe("SpaceSchema", () => {
  it("accepts a valid space and defaults tags/hidden", () => {
    const r = SpaceSchema.parse({
      zones: [{ id: "a", name: "A", kind: "room" }],
      edges: [],
    });
    expect(r.zones[0]).toMatchObject({ tags: [], hidden: false });
  });
  it("refuses duplicate zone ids", () => {
    expect(SpaceSchema.safeParse(mk(["a", "a"], [])).success).toBe(false);
  });
  it("refuses edges to unknown zones", () => {
    expect(SpaceSchema.safeParse(mk(["a"], [["a", "z", 5]])).success).toBe(
      false,
    );
  });
  it("refuses self-edges", () => {
    expect(SpaceSchema.safeParse(mk(["a"], [["a", "a", 5]])).success).toBe(
      false,
    );
  });
  it("refuses duplicate pairs in either direction", () => {
    const s = mk(
      ["a", "b"],
      [
        ["a", "b", 5],
        ["b", "a", 10],
      ],
    );
    expect(SpaceSchema.safeParse(s).success).toBe(false);
  });
  it("refuses feet that are not a multiple of 5 or out of 5-1000", () => {
    for (const feet of [7, 0, 1005]) {
      expect(
        SpaceSchema.safeParse(mk(["a", "b"], [["a", "b", feet]])).success,
      ).toBe(false);
    }
  });
  it("caps zones at 64 and edges at 256", () => {
    const ids = Array.from({ length: 65 }, (_, i) => `z${i}`);
    expect(SpaceSchema.safeParse(mk(ids, [])).success).toBe(false);
    const many = Array.from({ length: 64 }, (_, i) => `z${i}`);
    const edges: [string, string, number][] = [];
    for (let i = 0; i < 64 && edges.length < 257; i++)
      for (let j = i + 1; j < 64 && edges.length < 257; j++)
        edges.push([`z${i}`, `z${j}`, 5]);
    expect(SpaceSchema.safeParse(mk(many, edges)).success).toBe(false);
    expect(SpaceSchema.safeParse(mk(many, edges.slice(0, 256))).success).toBe(
      true,
    );
  });
  it("refuses a bad zone id", () => {
    expect(SpaceSchema.safeParse(mk(["Bad Id"], [])).success).toBe(false);
  });
});
