import { describe, expect, it } from "vitest";
import { bandBetween, occupants, zoneOf } from "../src/index.js";
import { mk } from "./helpers.js";

const space = mk(
  ["a", "b", "c", "d"],
  [
    ["a", "b", 20],
    ["b", "c", 20],
  ],
);
const view = { space, placements: { x: "a", y: "a", w: "b", v: "c" } };

describe("SpaceView", () => {
  it("zoneOf", () => {
    expect(zoneOf(view, "x")).toBe("a");
    expect(zoneOf(view, "nobody")).toBeNull();
  });
  it("occupants are sorted", () => {
    expect(occupants(view, "a")).toEqual(["x", "y"]);
    expect(occupants(view, "d")).toEqual([]);
  });
  it("bandBetween", () => {
    expect(bandBetween(view, "x", "y")).toBe("engaged");
    expect(bandBetween(view, "x", "w")).toBe("near");
    expect(bandBetween(view, "x", "v")).toBe("far");
  });
  it("bandBetween is null when unplaced or no space", () => {
    expect(bandBetween(view, "x", "nobody")).toBeNull();
    expect(
      bandBetween({ space: null, placements: view.placements }, "x", "y"),
    ).toBeNull();
  });
});
