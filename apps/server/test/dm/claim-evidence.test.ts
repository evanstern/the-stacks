import { describe, expect, it } from "vitest";
import {
  foldThrough,
  loadLog,
  M2_LOG,
  narrationAt,
  RUN_192319Z_LOG,
  stateAt,
  withPresence,
} from "./claim-fixtures.js";

/**
 * Spec 051 Phase 1/2: the recorded evidence, executable.
 */

describe("claim evidence: fixture state sanity", () => {
  const life = (s: ReturnType<typeof stateAt>, id: string) =>
    s.snapshot.actors.find((a) => a.id === id);

  it("M2 seq 224: goblin-3 is dead, goblin-2 and Snag stand", () => {
    const s = stateAt(M2_LOG, 220, 224);
    expect(life(s, "goblin-3")?.lifeState).toBe("dead");
    expect(life(s, "goblin-2")?.lifeState).toBe("conscious");
    expect(life(s, "snag")?.presence).toBe("present");
  });

  it("run 192319Z seq 160: Tamsin is unconscious with no life-state change in the diff", () => {
    const s = stateAt(RUN_192319Z_LOG, 155, 160);
    expect(life(s, "tamsin")?.lifeState).toBe("unconscious");
    expect(s.diff?.actors.filter((c) => c.actorId === "tamsin")).toEqual([]);
  });

  it("withPresence holds Snag absent with an empty diff", () => {
    const s = withPresence(M2_LOG, 306, ["snag"]);
    expect(life(s, "snag")?.presence).toBe("absent");
    expect(s.diff?.actors).toEqual([]);
  });

  it("narrationAt strips dice lines", () => {
    expect(narrationAt(M2_LOG, 225)).not.toContain("→");
    expect(narrationAt(M2_LOG, 225)).toContain("Two down!");
  });
});

describe("claim evidence: both logs fold cleanly (T007)", () => {
  it.each([
    ["M2", M2_LOG, 333],
    ["run 192319Z", RUN_192319Z_LOG, 222],
  ])("%s parses every row with no diagnostics", (_n, path, rows) => {
    const events = loadLog(path);
    expect(events).toHaveLength(rows);
    const d = foldThrough(events, []).final.diagnostics;
    expect(d.skippedUnknownType).toBe(0);
    expect(d.skippedUnknownVersion).toBe(0);
    expect(d.skippedInvalid).toBe(0);
    expect(d.outOfOrder).toBe(0);
    expect(d.engineRejected).toBe(0);
    expect(d.incompleteBatches).toEqual([]);
  });
});
