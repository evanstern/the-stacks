import { describe, expect, it } from "vitest";
import type { Combatant, EngineState } from "../../src/index.js";
import { replay } from "../../src/index.js";
import {
  expectOk,
  expectRefusal,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const stats = {
  abilityMods: { wis: 3, dex: 1, con: 0, str: 2 },
  proficiencyBonus: 2,
  saves: {},
  skills: {},
  attacks: [],
  spellcastingAbility: "wis" as const,
};
const slots = {
  standard: { "2": { max: 2, expended: 0 }, "3": { max: 1, expended: 0 } },
  pact: null,
};
const odo = (over: Partial<Combatant> = {}) =>
  makeCombatant({
    id: "pc-odo",
    name: "Odo",
    stats,
    spellSlots: slots as never,
    ...over,
  });
const foe = (id: string) => makeCombatant({ id, name: id, stats });
const hold = (over: Record<string, unknown> = {}) => ({
  type: "spell.cast",
  casterId: "pc-odo",
  spellId: "hold-person",
  targetId: "m-a",
  slotLevel: 2,
  casterLevel: 3,
  reason: "holds",
  ...over,
});
const world = () => stateWith(odo(), foe("m-a"), foe("m-b"), foe("m-c"));
const inFight = (s: EngineState, turnIndex = 0): EngineState => ({
  ...s,
  encounter: {
    round: 1,
    turnIndex,
    order: [
      { combatantId: "pc-odo", total: 10, bonus: 0 },
      { combatantId: "m-a", total: 8, bonus: 0 },
      { combatantId: "m-b", total: 5, bonus: 0 },
    ],
  } as never,
});
// DC is 8 + 2 + 3 = 13; the target adds +3, so a face of 10 or more saves.
const FAIL = 5;
const PASS = 15;
const castWith = (s: EngineState, faces: number[], over = {}) =>
  settle(s, run(s, hold(over), faces).result);
const advance = (s: EngineState, faces: number[]) =>
  run(s, { type: "turn.advance", reason: "next" }, faces);
const cond = (s: EngineState, id: string) => s.combatants[id]?.conditions ?? [];

describe("Hold Person (spec 125)", () => {
  it("a failed save applies paralyzed with repeatSave and starts concentration", () => {
    const s = castWith(world(), [FAIL]);
    expect(cond(s, "m-a")).toEqual([
      expect.objectContaining({
        condition: "paralyzed",
        source: "hold-person",
        expiresAt: null,
        repeatSave: { ability: "wis", dc: 13, casterId: "pc-odo" },
      }),
    ]);
    expect(s.combatants["pc-odo"]?.concentration).toMatchObject({
      spellId: "hold-person",
      targetIds: ["m-a"],
      expiresAt: null,
    });
  });

  it("a successful save applies nothing but concentration still starts", () => {
    const s = castWith(world(), [PASS]);
    expect(cond(s, "m-a")).toEqual([]);
    expect(s.combatants["pc-odo"]?.concentration?.spellId).toBe("hold-person");
  });

  it("concentration has a 10-round expiry in an encounter", () => {
    const s = castWith(inFight(world()), [FAIL]);
    expect(s.combatants["pc-odo"]?.concentration?.expiresAt).toEqual({
      round: 11,
      combatantId: "pc-odo",
      boundary: "turn-start",
    });
  });

  it("upcasting adds targets; over the cap and duplicates are refused", () => {
    const two = hold({ slotLevel: 3, moreTargetIds: ["m-b"] });
    const s = world();
    const out = run(s, two, [FAIL, PASS]);
    const next = settle(s, out.result);
    expect(cond(next, "m-a")).toHaveLength(1);
    expect(cond(next, "m-b")).toHaveLength(0);
    expectRefusal(
      run(s, hold({ moreTargetIds: ["m-b"] }), [FAIL, FAIL]).result,
      "INVALID_COMMAND",
    );
    expectRefusal(
      run(s, hold({ slotLevel: 3, moreTargetIds: ["m-a"] })).result,
      "INVALID_COMMAND",
    );
  });

  it("end of turn: a failed repeat save keeps the condition", () => {
    const s = castWith(inFight(world(), 1), [FAIL]);
    const out = advance(s, [FAIL]);
    const next = settle(s, out.result);
    expect(cond(next, "m-a")).toHaveLength(1);
    expect(next.combatants["pc-odo"]?.concentration).toBeDefined();
  });

  it("end of turn: a successful save removes it, ends the spell and concentration", () => {
    const s = castWith(inFight(world(), 1), [FAIL]);
    const events = expectOk(advance(s, [PASS]).result);
    expect(events.find((e) => e.type === "condition.removed")).toMatchObject({
      cause: "save",
    });
    expect(
      events.find((e) => e.type === "concentration.changed"),
    ).toMatchObject({ cause: "expired" });
    const next = replay(events, s);
    expect(cond(next, "m-a")).toEqual([]);
    expect(next.combatants["pc-odo"]?.concentration).toBeUndefined();
  });

  it("concentration persists while another target is still held", () => {
    const s = castWith(inFight(world(), 1), [FAIL, FAIL], {
      slotLevel: 3,
      moreTargetIds: ["m-b"],
    });
    const next = settle(s, advance(s, [PASS]).result);
    expect(cond(next, "m-a")).toEqual([]);
    expect(cond(next, "m-b")).toHaveLength(1);
    expect(next.combatants["pc-odo"]?.concentration).toBeDefined();
  });

  it("concentration broken by damage removes the condition", () => {
    const s = castWith(world(), [FAIL]);
    const out = run(
      s,
      {
        type: "damage.apply",
        targetId: "pc-odo",
        components: [
          { amount: { kind: "fixed", value: 4 }, damageType: "slashing" },
        ],
        critical: false,
        reason: "hit",
      },
      [2],
    );
    const next = settle(s, out.result);
    expect(next.combatants["pc-odo"]?.concentration).toBeUndefined();
    expect(cond(next, "m-a")).toEqual([]);
    expect(
      expectOk(out.result).find((e) => e.type === "condition.removed"),
    ).toMatchObject({ cause: "concentration" });
  });

  it("replacing concentration removes the condition", () => {
    const s = castWith(world(), [FAIL]);
    const next = castWith(s, [], {
      spellId: "bless",
      slotLevel: 2,
      targetId: "m-b",
    });
    expect(cond(next, "m-a")).toEqual([]);
    expect(next.combatants["pc-odo"]?.concentration?.spellId).toBe("bless");
  });

  it("replay is deterministic and works outside an encounter", () => {
    const s = world();
    const events = expectOk(run(s, hold(), [FAIL]).result);
    expect(replay(events, s)).toEqual(replay(events, s));
    expect(events.map((e) => e.type)).toContain("condition.applied");
  });
});
