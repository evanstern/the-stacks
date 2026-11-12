import { describe, expect, it } from "vitest";
import {
  CLARIFY_HELD,
  clarifyHolds,
  cutPlans,
  firstStage,
  holdDirector,
} from "../../src/dm/first-stage.js";
import type { Ruling } from "../../src/dm/nodes/adjudicate.js";
import type { BeatItem } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type {
  LegacyInterpretReading as InterpretReading,
  Step,
} from "../../src/dm/nodes/schemas.js";

function check(
  reason: string,
  skill: "stealth" | "persuasion" | null = "stealth",
  ability: "dex" | "cha" = "dex",
): Step {
  return {
    step: "check",
    reason,
    combatantId: null,
    kind: "ability-check",
    ability,
    skill,
    difficulty: "medium",
    circumstance: null,
    autoFail: null,
    onSuccess: [],
    onFailure: [],
    stakes: {
      success: "The attempt works as intended.",
      cost: "It works, at a small price.",
      failure: "The attempt comes to nothing.",
      severe: "It goes badly wrong.",
    },
    onCost: [],
    onSevere: [],
    newRisk: null,
  } as unknown as Step;
}
const attack = (reason: string): Step =>
  ({
    step: "attack",
    reason,
    attackerId: "tamsin",
    targetId: "snag",
    attack: "Longsword",
    circumstance: null,
    onHit: [
      { effect: "heal", targetId: "snag", amount: { kind: "flat", value: 1 } },
    ],
  }) as unknown as Step;

function reading(
  actionId: string | null,
  steps: Step[],
  followUps: string[] = [],
): InterpretReading {
  return {
    actionId,
    intent: "other",
    uncertain: false,
    needsAdjudication: false,
    rulesQuestion: null,
    clarify: null,
    steps,
    followUps,
  };
}
function ruling(actionId: string | null, steps: Step[]): Ruling {
  return {
    actionId,
    ruling: "r",
    improvised: true,
    citations: [],
    dropped: 0,
    steps,
    followUps: [],
  };
}

const plan = [
  check("kestrel sneaks"),
  check("odo sneaks"),
  check("tamsin hails the camp", "persuasion", "cha"),
  attack("kestrel attacks snag"),
];

describe("firstStage", () => {
  it("keeps a same-skill check run whole and cuts the rest", () => {
    const { kept, cut } = firstStage(plan);
    expect(kept).toHaveLength(2);
    expect(cut.map((s) => s.reason)).toEqual([
      "tamsin hails the camp",
      "kestrel attacks snag",
    ]);
  });
  it("cuts a different-skill second check", () => {
    const { kept, cut } = firstStage([
      check("a"),
      check("b", "persuasion", "cha"),
    ]);
    expect(kept).toHaveLength(1);
    expect(cut).toHaveLength(1);
  });
  it("cuts nothing without a check", () => {
    const steps = [attack("x"), attack("y")];
    expect(firstStage(steps)).toEqual({ kept: steps, cut: [] });
  });
});

describe("cutPlans", () => {
  it("cuts in free mode and writes reasons as follow-ups", () => {
    const out = cutPlans({
      mode: "free",
      readings: [reading("act-1", plan)],
      rulings: [ruling("act-1", plan)],
    });
    expect((out.readings[0] as InterpretReading).steps).toHaveLength(2);
    expect(out.readings[0]?.followUps).toEqual([
      "tamsin hails the camp",
      "kestrel attacks snag",
    ]);
    expect(out.rulings[0]?.steps).toHaveLength(2);
    expect(out.rulings[0]?.followUps).toHaveLength(2);
  });
  it("cuts nothing in turn mode", () => {
    const input = {
      mode: "turn" as const,
      readings: [reading("a", plan)],
      rulings: [],
    };
    expect(cutPlans(input)).toEqual({ readings: input.readings, rulings: [] });
  });
  it("never cuts the NPC reading", () => {
    const out = cutPlans({
      mode: "free",
      readings: [reading(null, plan)],
      rulings: [ruling(null, plan)],
    });
    expect((out.readings[0] as InterpretReading).steps).toHaveLength(4);
    expect(out.rulings[0]?.steps).toHaveLength(4);
  });
  it("keeps model follow-ups, merges, dedupes and caps at six", () => {
    const out = cutPlans({
      mode: "free",
      readings: [
        reading("a", plan, ["kestrel attacks snag", "model one"]),
        reading(
          "b",
          [
            check("x"),
            ...Array.from({ length: 5 }, (_, i) => attack(`later ${i}`)),
            attack("l6"),
          ],
          ["m1", "m2"],
        ),
      ],
      rulings: [],
    });
    expect(out.readings[0]?.followUps).toEqual([
      "kestrel attacks snag",
      "model one",
      "tamsin hails the camp",
    ]);
    expect(out.readings[1]?.followUps).toHaveLength(6);
  });
  it("leaves model follow-ups when nothing is cut", () => {
    const r = reading("a", [attack("x")], ["later"]);
    expect(
      cutPlans({ mode: "free", readings: [r], rulings: [] }).readings[0]
        ?.followUps,
    ).toEqual(["later"]);
  });
});

function director(over: Partial<DirectorNodeOutput> = {}): DirectorNodeOutput {
  return {
    beat: { decision: "resolve" },
    tableMode: { to: "turn", encounterId: "reed-camp", reason: "r" },
    trackers: [{ trackerId: "alarm", advance: 1, reason: "r" }],
    scene: { status: "end", outcome: "goal-met", reason: "r" },
    pacing: { tension: "rising", spotlight: null, beatId: null },
    goalNote: "g",
    companionPrompts: [],
    overrides: [],
    ...over,
  };
}

describe("holdDirector", () => {
  it("holds turn, trackers and scene end with three overrides", () => {
    const out = holdDirector(director(), true);
    expect(out.tableMode).toEqual({ to: "stay" });
    expect(out.trackers).toEqual([]);
    expect(out.scene).toEqual({ status: "continue" });
    expect(out.overrides.map((o) => o.decision)).toEqual([
      "turn",
      "tracker",
      "scene-end",
    ]);
  });
  it("keeps free", () => {
    const d = director({ tableMode: { to: "free", reason: "r" } });
    expect(holdDirector(d, true).tableMode).toEqual(d.tableMode);
  });
  it("returns the input when the beat is not cut", () => {
    const d = director();
    expect(holdDirector(d, false)).toBe(d);
  });
  it("adds no override when holding an already-held output", () => {
    const once = holdDirector(director(), true);
    expect(holdDirector(once, true).overrides).toHaveLength(3);
  });
});

describe("clarifyHolds", () => {
  const item = (actionId: string, over: Partial<BeatItem> = {}): BeatItem => ({
    actionId,
    committedSeq: 1,
    actor: "user:tamsin",
    characterId: "tamsin",
    scope: "character",
    text: "t",
    status: "committed",
    ...over,
  });
  const asks = (id: string) => ({ ...reading(id, []), clarify: "Which?" });
  it("selects a human's clarify only", () => {
    const beat = [
      item("a"),
      item("b", { actor: "ai:companion:odo" }),
      item("c"),
      item("d", { status: "resolved" }),
      item("e"),
    ];
    const readings: InterpretReading[] = ["a", "b", "c", "d"].map(asks);
    readings.push(reading("e", []));
    const held = clarifyHolds(beat, readings, [ruling("c", [])]);
    expect([...held]).toEqual(["a"]);
  });
  it("records the clarify reason and never holds free", () => {
    const out = holdDirector(director(), true, CLARIFY_HELD);
    expect(out.overrides.every((o) => o.reason === CLARIFY_HELD)).toBe(true);
    const d = director({ tableMode: { to: "free", reason: "r" } });
    expect(holdDirector(d, true, CLARIFY_HELD).tableMode).toEqual(d.tableMode);
  });
});
