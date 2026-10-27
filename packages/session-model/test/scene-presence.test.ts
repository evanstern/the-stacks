import { describe, expect, it } from "vitest";
import { project } from "../src/index.js";
import { makeRows, PLAYER_A, type RowSpec } from "./helpers.js";

const change = (
  actorId: string,
  before: string,
  after: string,
  reason: string,
): RowSpec => ({
  type: "scene-presence.changed",
  payload: { actorId, before, after, reason, actionId: null },
});

describe("scenePresence projection (TASK-0141)", () => {
  it("is empty without a row", () => {
    expect(project(makeRows([]), { role: "dm" }).scenePresence).toEqual({});
  });

  it("folds a row to presence, reason and seq", () => {
    const p = project(
      makeRows([change("goblin-1", "present", "absent", "fled")]),
      { role: "dm" },
    );
    expect(p.scenePresence["goblin-1"]).toEqual({
      presence: "absent",
      reason: "fled",
      seq: 1,
    });
    expect(p.diagnostics.beforeMismatches).toBe(0);
  });

  it("lets the latest row win", () => {
    const p = project(
      makeRows([
        change("goblin-1", "present", "absent", "fled"),
        change("goblin-1", "absent", "present", "arrived"),
      ]),
      { role: "dm" },
    );
    expect(p.scenePresence["goblin-1"]).toMatchObject({
      presence: "present",
      reason: "arrived",
      seq: 2,
    });
  });

  it("shows the row to a player viewer", () => {
    const p = project(
      makeRows([change("goblin-1", "present", "yielded", "surrendered")]),
      { role: "player", userId: PLAYER_A },
    );
    expect(p.scenePresence["goblin-1"]?.presence).toBe("yielded");
  });

  it("counts a before mismatch and still applies", () => {
    const p = project(
      makeRows([change("goblin-1", "yielded", "absent", "left")]),
      { role: "dm" },
    );
    expect(p.diagnostics.beforeMismatches).toBe(1);
    expect(p.scenePresence["goblin-1"]?.presence).toBe("absent");
  });
});
