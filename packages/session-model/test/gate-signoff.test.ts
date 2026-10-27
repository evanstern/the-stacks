import { describe, expect, it } from "vitest";
import { signoffState } from "../src/index.js";
import { dmFold } from "./gate-helpers.js";
import { PLAYER_A, PLAYER_B, type RowSpec } from "./helpers.js";

const BRAM = "ai:companion:bram";
const PLAYER_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const stance = (
  actor: string,
  s: "approve" | "object" | "comment",
  actionId = "act-party",
): RowSpec => ({
  type: "action.commented",
  payload: { actionId, stance: s, text: "t" },
  opts: { actor },
});

const third: RowSpec = {
  type: "party.member.changed",
  payload: {
    reason: "j",
    characterId: "dara",
    before: null,
    after: {
      characterId: "dara",
      name: "Dara",
      controller: { kind: "player", userId: PLAYER_C },
      combatantId: null,
    },
  },
};

describe("signoffState", () => {
  it("two humans: the declarer approves by default, the other waits", () => {
    const p = dmFold({ twoHumans: true });
    const s = signoffState(p, "act-party", [PLAYER_A, PLAYER_B]);
    expect(s?.rows).toEqual([
      { userId: PLAYER_A, present: true, stance: "approve" },
      { userId: PLAYER_B, present: true, stance: "waiting" },
    ]);
    expect(s?.waiting).toEqual([PLAYER_B]);
    expect(s?.met).toBe(false);
  });

  it("all approve: met", () => {
    const p = dmFold({ twoHumans: true, extra: [stance(PLAYER_B, "approve")] });
    const s = signoffState(p, "act-party", [PLAYER_A, PLAYER_B]);
    expect(s?.met).toBe(true);
    expect(s?.waiting).toEqual([]);
    expect(s?.quorum).toEqual([PLAYER_A, PLAYER_B].sort());
  });

  it("three humans: one waiting is not met", () => {
    const p = dmFold({
      twoHumans: true,
      extra: [third, stance(PLAYER_B, "approve")],
    });
    const s = signoffState(p, "act-party", [PLAYER_A, PLAYER_B, PLAYER_C]);
    expect(s?.met).toBe(false);
    expect(s?.waiting).toEqual([PLAYER_C]);
  });

  it("an absent human is excluded from the quorum", () => {
    const p = dmFold({ twoHumans: true, extra: [third] });
    const s = signoffState(p, "act-party", [PLAYER_A, PLAYER_C]);
    expect(s?.quorum).toEqual([PLAYER_A, PLAYER_C].sort());
    expect(s?.rows.find((r) => r.userId === PLAYER_B)?.present).toBe(false);
    expect(s?.waiting).toEqual([PLAYER_C]);
    const q = dmFold({
      twoHumans: true,
      extra: [third, stance(PLAYER_C, "approve")],
    });
    expect(signoffState(q, "act-party", [PLAYER_A, PLAYER_C])?.met).toBe(true);
  });

  it("the acting human counts as present and approving", () => {
    const p = dmFold({
      twoHumans: true,
      extra: [stance(PLAYER_B, "object"), stance(PLAYER_B, "approve")],
    });
    const s = signoffState(p, "act-party", [PLAYER_A], PLAYER_B);
    expect(s?.quorum).toEqual([PLAYER_A, PLAYER_B].sort());
    expect(s?.met).toBe(true);
    const q = dmFold({ twoHumans: true });
    expect(signoffState(q, "act-party", [PLAYER_A], PLAYER_B)?.met).toBe(true);
  });

  it("a comment stance changes nothing", () => {
    const p = dmFold({ twoHumans: true, extra: [stance(PLAYER_B, "comment")] });
    const s = signoffState(p, "act-party", [PLAYER_A, PLAYER_B]);
    expect(s?.waiting).toEqual([PLAYER_B]);
    expect(s?.met).toBe(false);
  });

  it("the latest stance wins", () => {
    const objectThenApprove = dmFold({
      twoHumans: true,
      extra: [stance(PLAYER_B, "object"), stance(PLAYER_B, "approve")],
    });
    expect(
      signoffState(objectThenApprove, "act-party", [PLAYER_A, PLAYER_B])?.met,
    ).toBe(true);
    const approveThenObject = dmFold({
      twoHumans: true,
      extra: [stance(PLAYER_B, "approve"), stance(PLAYER_B, "object")],
    });
    const s = signoffState(approveThenObject, "act-party", [
      PLAYER_A,
      PLAYER_B,
    ]);
    expect(s?.met).toBe(false);
    expect(s?.objecting).toEqual([PLAYER_B]);
  });

  it("a companion's comment is ignored and the companion has no row", () => {
    const p = dmFold({
      twoHumans: true,
      extra: [stance(BRAM, "approve"), stance(PLAYER_B, "object")],
    });
    const s = signoffState(p, "act-party", [PLAYER_A, PLAYER_B]);
    expect(s?.rows.map((r) => r.userId)).toEqual([PLAYER_A, PLAYER_B].sort());
    expect(s?.met).toBe(false);
    const q = dmFold({ twoHumans: true, extra: [stance(BRAM, "approve")] });
    expect(signoffState(q, "act-party", [PLAYER_A, PLAYER_B])?.met).toBe(false);
  });

  it("returns null for a character-scope or unknown action", () => {
    const p = dmFold({ twoHumans: true });
    expect(signoffState(p, "act-ana", [PLAYER_A])).toBeNull();
    expect(signoffState(p, "nope", [PLAYER_A])).toBeNull();
  });

  it("an empty quorum is not met", () => {
    const p = dmFold({ twoHumans: true });
    expect(signoffState(p, "act-party", [])?.met).toBe(false);
  });
});
