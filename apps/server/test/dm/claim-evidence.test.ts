import { describe, expect, it } from "vitest";
import { checkClaims } from "../../src/dm/claims.js";
import {
  foldThrough,
  loadLog,
  M2_LOG,
  narrationAt,
  ROW162_ACTING,
  ROW162_STATE,
  RUN_192319Z_LOG,
  SEQ201_NEGATED,
  stateAt,
  withPresence,
} from "./claim-fixtures.js";

/**
 * Spec 051 Phase 1/2: the recorded evidence, executable.
 */

describe("claim evidence: refusals", () => {
  it("M2 seq 225: 'Two down' is a count issue (US3.1)", () => {
    const r = checkClaims(stateAt(M2_LOG, 220, 224), narrationAt(M2_LOG, 225));
    expect(r.pass).toBe(false);
    const c = r.issues.find((i) => i.claim === "count");
    expect(c?.matched).toContain("Two down");
  });

  it("F52, M2 seq 307: 'No goblins left' is a count issue (US3.2)", () => {
    const r = checkClaims(stateAt(M2_LOG, 306, 306), narrationAt(M2_LOG, 307));
    expect(r.pass).toBe(false);
    const c = r.issues.find((i) => i.claim === "count");
    expect(c?.matched).toContain("No goblins left");
  });

  it("run 192319Z row 162: unconscious Tamsin acts (US1.1)", () => {
    const r = checkClaims(stateAt(RUN_192319Z_LOG, 155, 160), ROW162_ACTING);
    expect(r.pass).toBe(false);
    const a = r.issues.find((i) => i.claim === "act");
    expect(a?.detail).toContain("Tamsin Vale");
  });

  it("seq 225 alias variant: dead goblin-3 speaks (US1.5)", () => {
    const r = checkClaims(
      stateAt(M2_LOG, 220, 224),
      "The goblin lookout shrieks at Snag.",
    );
    expect(r.pass).toBe(false);
    const s = r.issues.find((i) => i.claim === "speech");
    expect(s?.actorIds).toContain("goblin-3");
  });

  it("Snag absent: Snag laughs from the reeds (US1.6)", () => {
    const r = checkClaims(
      withPresence(M2_LOG, 306, ["snag"]),
      "Snag laughs from the reeds.",
    );
    expect(r.pass).toBe(false);
    expect(r.issues.some((i) => i.claim === "act")).toBe(true);
  });
});

describe("claim evidence: controls", () => {
  it("F52 with goblin-2, goblin-4 and Snag absent passes (US3.3)", () => {
    const r = checkClaims(
      withPresence(M2_LOG, 306, ["goblin-2", "goblin-4", "snag"]),
      narrationAt(M2_LOG, 307),
    );
    expect(r.pass).toBe(true);
  });

  it("ROW162_STATE passes (US1.2)", () => {
    const r = checkClaims(stateAt(RUN_192319Z_LOG, 155, 160), ROW162_STATE);
    expect(r.pass).toBe(true);
  });

  it("SEQ201_NEGATED passes (US1.3)", () => {
    const r = checkClaims(stateAt(RUN_192319Z_LOG, 155, 160), SEQ201_NEGATED);
    expect(r.pass).toBe(true);
  });

  it("shipped seq 225 prose raises no act or speech issue (US1.4)", () => {
    const r = checkClaims(stateAt(M2_LOG, 220, 224), narrationAt(M2_LOG, 225));
    expect(
      r.issues.filter((i) => i.claim === "act" || i.claim === "speech"),
    ).toEqual([]);
  });

  it("M2 seq 220 passes (US2.2)", () => {
    const r = checkClaims(stateAt(M2_LOG, 213, 219), narrationAt(M2_LOG, 220));
    expect(r.pass).toBe(true);
  });
});

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
