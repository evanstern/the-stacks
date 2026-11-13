import { describe, expect, it } from "vitest";
import { SceneChangedV1 } from "../src/index.js";

const base = { sceneId: "s", title: "T", summary: "S", location: "L" };
const way = (i: number) => ({ label: `w${i}`, draft: `/do w${i}` });
const parse = (after: object) =>
  SceneChangedV1.safeParse({ reason: "r", before: null, after });

describe("scene fields (spec 091 D1)", () => {
  it("parses an old scene.changed row", () => {
    expect(parse(base).success).toBe(true);
  });
  it("parses a row with description, ways and cast", () => {
    const r = parse({
      ...base,
      description: "A ford.",
      ways: [way(1)],
      cast: [{ id: "wenna", name: "Wenna", role: "ferrier", appearance: "" }],
    });
    expect(r.success).toBe(true);
  });
  it("refuses seven ways", () => {
    const ways = [1, 2, 3, 4, 5, 6, 7].map(way);
    expect(parse({ ...base, ways }).success).toBe(false);
  });
});
