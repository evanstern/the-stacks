import { describe, expect, it } from "vitest";
import { project, type StoredEvent } from "../src/index.js";
import { makeRows, PLAYER_A, type RowSpec } from "./helpers.js";

const dm = { role: "dm" } as const;
const declared = (id: string, text = "Do it."): RowSpec => ({
  type: "action.declared",
  payload: { actionId: id, characterId: "ana", scope: "character", text },
  opts: { actor: PLAYER_A },
});
const commented = (id: string, stance = "comment", text = "ok"): RowSpec => ({
  type: "action.commented",
  payload: { actionId: id, stance, text },
});
const committed = (id: string): RowSpec => ({
  type: "action.committed",
  payload: { actionId: id, authority: "declarer" },
});
const resolved = (id: string): RowSpec => ({
  type: "action.resolved",
  payload: {
    actionId: id,
    outcome: "no-effect",
    batchIds: [],
    refusalCode: null,
  },
});

const fold = (specs: RowSpec[]) =>
  project(makeRows(specs) as StoredEvent[], dm);

describe("action lifecycle (AC #1)", () => {
  it("declared -> discussed -> committed -> resolved", () => {
    const p = fold([
      declared("a"),
      commented("a"),
      committed("a"),
      resolved("a"),
    ]);
    const a = p.actions[0];
    expect(a?.status).toBe("resolved");
    expect(a?.declaredSeq).toBe(1);
    expect(a?.actor).toBe(PLAYER_A);
    expect(a?.comments).toHaveLength(1);
    expect(a?.committed?.seq).toBe(3);
    expect(a?.resolved?.outcome).toBe("no-effect");
    expect(p.diagnostics.ignoredTransitions).toBe(0);
    expect(p.transcript).toHaveLength(4);
  });

  it("allows commit straight from declared and repeated comments", () => {
    const p = fold([
      declared("a"),
      commented("a"),
      commented("a", "approve", ""),
      committed("a"),
    ]);
    expect(p.actions[0]?.status).toBe("committed");
    expect(p.actions[0]?.comments).toHaveLength(2);
  });

  const disallowed: [string, RowSpec[]][] = [
    ["resolve from declared", [declared("a"), resolved("a")]],
    ["resolve from discussed", [declared("a"), commented("a"), resolved("a")]],
    ["comment on committed", [declared("a"), committed("a"), commented("a")]],
    ["commit committed", [declared("a"), committed("a"), committed("a")]],
    [
      "comment on resolved",
      [declared("a"), committed("a"), resolved("a"), commented("a")],
    ],
    [
      "commit resolved",
      [declared("a"), committed("a"), resolved("a"), committed("a")],
    ],
    [
      "resolve resolved",
      [declared("a"), committed("a"), resolved("a"), resolved("a")],
    ],
    ["declare twice", [declared("a"), declared("a", "Other")]],
    ["comment on unknown", [commented("zz")]],
    ["commit unknown", [committed("zz")]],
    ["resolve unknown", [resolved("zz")]],
  ];
  for (const [name, specs] of disallowed) {
    it(`ignores: ${name}`, () => {
      const baseline = fold(specs.slice(0, -1));
      const p = fold(specs);
      expect(p.diagnostics.ignoredTransitions).toBe(1);
      expect(p.actions).toEqual(baseline.actions);
      expect(p.transcript).toHaveLength(specs.length);
    });
  }

  it("keeps two committed actions in log order", () => {
    const p = fold([
      declared("a"),
      declared("b"),
      committed("b"),
      committed("a"),
    ]);
    expect(p.actions.map((a) => a.actionId)).toEqual(["a", "b"]);
    expect(p.actions.every((a) => a.status === "committed")).toBe(true);
    expect(p.actions.map((a) => a.committed?.seq)).toEqual([4, 3]);
  });
});
