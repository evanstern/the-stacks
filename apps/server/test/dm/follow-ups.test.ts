import type { SessionProjections } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { openFollowUps } from "../../src/dm/follow-ups.js";
import type { PriorTurn } from "../../src/dm/resume.js";

type Act = {
  actionId: string;
  declaredSeq: number;
  characterId: string;
  status: string;
};

const proj = (actions: Act[]): SessionProjections =>
  ({
    party: [{ characterId: "kestrel" }, { characterId: "odo" }],
    actions,
  }) as unknown as SessionProjections;

const turn = (
  jobId: string,
  reading: { actionId: string; followUps: string[] } | null,
): PriorTurn =>
  ({
    jobId,
    checkpoint: {
      interpret: reading ? { readings: [reading] } : null,
    },
  }) as unknown as PriorTurn;

const kestrel = (over: Partial<Act> = {}): Act => ({
  actionId: "a1",
  declaredSeq: 10,
  characterId: "kestrel",
  status: "resolved",
  ...over,
});

describe("openFollowUps (spec 079 D8)", () => {
  it("carries a member's followUps from an earlier turn", () => {
    const out = openFollowUps(
      proj([kestrel()]),
      [turn("j1", { actionId: "a1", followUps: ["cut Pell's bonds"] })],
      ["a2"],
    );
    expect(out).toEqual([{ characterId: "kestrel", text: "cut Pell's bonds" }]);
  });

  it("drops them once the member declares again (the new action is in this beat)", () => {
    const p = proj([kestrel(), kestrel({ actionId: "a2", declaredSeq: 20 })]);
    const prior = [turn("j1", { actionId: "a1", followUps: ["cut bonds"] })];
    expect(openFollowUps(p, prior, ["a2"])).toEqual([]);
  });

  it("carries nothing when the latest action is unresolved", () => {
    const out = openFollowUps(
      proj([kestrel({ status: "committed" })]),
      [turn("j1", { actionId: "a1", followUps: ["x"] })],
      [],
    );
    expect(out).toEqual([]);
  });

  it("uses the newest checkpoint holding the action, and caps at six", () => {
    const many = Array.from({ length: 9 }, (_, i) => `step ${i}`);
    const out = openFollowUps(
      proj([kestrel()]),
      [
        turn("j2", { actionId: "a1", followUps: many }),
        turn("j1", { actionId: "a1", followUps: ["old"] }),
      ],
      [],
    );
    expect(out).toHaveLength(6);
    expect(out[0]?.text).toBe("step 0");
  });
});
