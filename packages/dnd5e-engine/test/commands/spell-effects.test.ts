import { describe, expect, it } from "vitest";
import type { Combatant, EngineState } from "../../src/index.js";
import { replay } from "../../src/index.js";
import { expectOk, makeCombatant, run, settle, stateWith } from "../helpers.js";

const stats = {
  abilityMods: { wis: 3, dex: 1, con: 0, str: 2 },
  proficiencyBonus: 2,
  saves: {},
  skills: { stealth: 3 },
  attacks: [{ name: "Club", range: "melee" as const, toHit: 4, damage: [] }],
  spellcastingAbility: "wis" as const,
};
const slots = {
  standard: { "1": { max: 3, expended: 0 }, "2": { max: 2, expended: 0 } },
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
const ana = (over: Partial<Combatant> = {}) =>
  makeCombatant({ id: "pc-ana", name: "Ana", stats, ...over });
const bo = (id: string) => makeCombatant({ id, name: id, stats });
const foe = () =>
  makeCombatant({ id: "m-goblin", name: "Goblin", ac: 12, stats });

const bless = (over: Record<string, unknown> = {}) => ({
  type: "spell.cast",
  casterId: "pc-odo",
  spellId: "bless",
  targetId: "pc-ana",
  slotLevel: 1,
  casterLevel: 1,
  reason: "blesses",
  ...over,
});
const guidance = (over: Record<string, unknown> = {}) => ({
  ...bless({ spellId: "guidance", slotLevel: null, skill: "stealth" }),
  ...over,
});
const world = () =>
  stateWith(odo(), ana(), bo("pc-bo"), bo("pc-cy"), bo("pc-di"), foe());
const cast = (state: EngineState, cmd: unknown) =>
  settle(state, run(state, cmd).result);
const dmg = (amount: number) => ({
  type: "damage.apply",
  targetId: "pc-odo",
  components: [
    { amount: { kind: "fixed", value: amount }, damageType: "slashing" },
  ],
  critical: false,
  reason: "hit",
});
const concentrating = () => cast(world(), bless());
const types = (events: { type: string }[]) => events.map((e) => e.type);

describe("spell.cast roll-bonus spells", () => {
  it("bless grants concentration and a 1d4 bonus", () => {
    const state = concentrating();
    expect(state.combatants["pc-odo"]?.concentration).toMatchObject({
      spellId: "bless",
      targetIds: ["pc-ana"],
      expiresAt: null,
    });
    expect(state.combatants["pc-ana"]?.rollBonuses).toEqual([
      {
        spellId: "bless",
        casterId: "pc-odo",
        die: "1d4",
        applies: ["attack", "saving-throw"],
        skill: null,
      },
    ]);
    expect(state.combatants["pc-odo"]?.spellSlots.standard["1"]?.expended).toBe(
      1,
    );
  });

  it("adds the die to attack rolls and saves", () => {
    const state = concentrating();
    const atk = run(
      state,
      {
        type: "attack.roll",
        attackerId: "pc-ana",
        targetId: "m-goblin",
        attack: "Club",
        mode: "normal",
        targetAc: null,
        reason: "swings",
      },
      [10, 3],
    );
    const events = expectOk(atk.result);
    expect(events[0]).toMatchObject({
      type: "dice.rolled",
      expression: "1d20+4+1d4",
      total: 17,
      natural: 10,
    });
    const save = run(
      state,
      {
        type: "check.roll",
        combatantId: "pc-ana",
        kind: "saving-throw",
        ability: "dex",
        mode: "advantage",
        dc: 12,
        reason: "dodges",
      },
      [4, 9, 2],
    );
    expect(expectOk(save.result)[0]).toMatchObject({
      expression: "1d20+1+1d4",
      total: 12,
      natural: 9,
    });
  });

  it("does not add the die to ability checks", () => {
    const out = run(
      concentrating(),
      {
        type: "check.roll",
        combatantId: "pc-ana",
        kind: "ability-check",
        ability: "dex",
        skill: "stealth",
        mode: "normal",
        dc: 10,
        reason: "sneaks",
      },
      [10],
    );
    expect(expectOk(out.result)[0]).toMatchObject({ expression: "1d20+3" });
  });

  it("upcasting adds targets; over the limit is refused", () => {
    const four = ["pc-bo", "pc-cy", "pc-di"];
    const s = world();
    expect(
      run(s, bless({ moreTargetIds: ["pc-bo", "pc-cy", "pc-di"] })).result.ok,
    ).toBe(false);
    expect(run(s, bless({ moreTargetIds: ["pc-bo", "pc-cy"] })).result.ok).toBe(
      true,
    );
    const up = cast(s, bless({ slotLevel: 2, moreTargetIds: four }));
    expect(up.combatants["pc-odo"]?.concentration?.targetIds).toHaveLength(4);
    expect(run(s, bless({ moreTargetIds: ["pc-ana"] })).result.ok).toBe(false);
  });

  it("guidance applies only to its skill and needs a skill", () => {
    const state = cast(world(), guidance());
    const hit = run(
      state,
      {
        type: "check.roll",
        combatantId: "pc-ana",
        kind: "ability-check",
        ability: "dex",
        skill: "stealth",
        mode: "normal",
        dc: 10,
        reason: "sneaks",
      },
      [10, 2],
    );
    expect(expectOk(hit.result)[0]).toMatchObject({
      expression: "1d20+3+1d4",
      total: 15,
    });
    const miss = run(
      state,
      {
        type: "check.roll",
        combatantId: "pc-ana",
        kind: "ability-check",
        ability: "str",
        skill: "athletics",
        mode: "normal",
        dc: 10,
        reason: "lifts",
      },
      [10],
    );
    expect(expectOk(miss.result)[0]).toMatchObject({ expression: "1d20+2" });
    expect(run(world(), guidance({ skill: undefined })).result.ok).toBe(false);
  });

  it("a new concentration cast replaces the old one", () => {
    const state = concentrating();
    const out = run(state, guidance());
    const events = expectOk(out.result);
    expect(types(events)).toEqual([
      "concentration.changed",
      "roll-bonus.ended",
      "concentration.changed",
      "roll-bonus.granted",
    ]);
    expect(events[0]).toMatchObject({ cause: "replaced" });
    const next = settle(state, out.result);
    expect(next.combatants["pc-odo"]?.concentration?.spellId).toBe("guidance");
    expect(next.combatants["pc-ana"]?.rollBonuses).toHaveLength(1);
  });

  it("the same spell does not stack", () => {
    const s = cast(concentrating(), bless({ slotLevel: 2 }));
    expect(s.combatants["pc-ana"]?.rollBonuses).toHaveLength(1);
    const other = cast(
      stateWith(
        odo(),
        ana({
          rollBonuses: [
            {
              spellId: "bless",
              casterId: "pc-cy",
              die: "1d4",
              applies: ["attack"],
              skill: null,
            },
          ],
        }),
        bo("pc-cy"),
      ),
      bless(),
    );
    const atk = run(
      other,
      {
        type: "attack.roll",
        attackerId: "pc-ana",
        targetId: "pc-cy",
        attack: "Club",
        mode: "normal",
        targetAc: null,
        reason: "swings",
      },
      [10, 3],
    );
    expect(expectOk(atk.result)[0]).toMatchObject({ expression: "1d20+4+1d4" });
  });
});

describe("concentration breaks", () => {
  it("a passed Con save keeps it (DC 10 floor)", () => {
    const state = concentrating();
    const out = run(state, dmg(4), [10]);
    const events = expectOk(out.result);
    expect(events.find((e) => e.type === "check.resolved")).toMatchObject({
      dc: 10,
      outcome: "success",
    });
    expect(
      settle(state, out.result).combatants["pc-odo"]?.concentration,
    ).toBeDefined();
  });

  it("a failed Con save ends it and the bonuses", () => {
    const state = concentrating();
    const out = run(state, dmg(4), [9]);
    const events = expectOk(out.result);
    expect(types(events)).toContain("roll-bonus.ended");
    const next = settle(state, out.result);
    expect(next.combatants["pc-odo"]?.concentration).toBeUndefined();
    expect(next.combatants["pc-ana"]?.rollBonuses).toBeUndefined();
  });

  it("DC is half the damage when higher, capped at 30", () => {
    const big = stateWith(
      odo({ hp: { current: 200, max: 200, temp: 0 } }),
      ana(),
    );
    const s = cast(big, bless());
    const dc = (n: number, face = 20) =>
      expectOk(run(s, dmg(n), [face]).result).find(
        (e) => e.type === "check.resolved",
      );
    expect(dc(24)).toMatchObject({ dc: 12 });
    expect(dc(100)).toMatchObject({ dc: 30 });
    expect(dc(5)).toMatchObject({ dc: 10 });
  });

  it("dropping to 0 HP ends it with no save", () => {
    const state = concentrating();
    const out = run(state, dmg(12));
    const events = expectOk(out.result);
    expect(types(events)).not.toContain("check.resolved");
    expect(
      events.find((e) => e.type === "concentration.changed"),
    ).toMatchObject({ cause: "incapacitated" });
    expect(
      settle(state, out.result).combatants["pc-odo"]?.concentration,
    ).toBeUndefined();
  });

  it("dying ends it as died", () => {
    const out = run(concentrating(), dmg(40));
    expect(
      expectOk(out.result).find((e) => e.type === "concentration.changed"),
    ).toMatchObject({ cause: "died" });
  });

  it("gaining an incapacitating condition ends it", () => {
    const state = concentrating();
    const out = run(state, {
      type: "condition.apply",
      targetId: "pc-odo",
      condition: "stunned",
      source: "test",
      expiresAt: null,
      reason: "stunned",
    });
    expectOk(out.result);
    expect(
      settle(state, out.result).combatants["pc-odo"]?.concentration,
    ).toBeUndefined();
    const other = run(state, {
      type: "condition.apply",
      targetId: "pc-odo",
      condition: "poisoned",
      source: "test",
      expiresAt: null,
      reason: "poisoned",
    });
    expect(
      settle(state, other.result).combatants["pc-odo"]?.concentration,
    ).toBeDefined();
  });

  it("expires after 10 rounds at the caster's turn start", () => {
    const base = world();
    const state: EngineState = {
      ...base,
      encounter: {
        round: 1,
        turnIndex: 0,
        order: [
          { combatantId: "pc-odo", total: 10, bonus: 0 },
          { combatantId: "m-goblin", total: 5, bonus: 0 },
        ],
      } as never,
    };
    let s = cast(state, bless());
    expect(s.combatants["pc-odo"]?.concentration?.expiresAt).toEqual({
      round: 11,
      combatantId: "pc-odo",
      boundary: "turn-start",
    });
    s = {
      ...s,
      encounter: {
        ...(s.encounter as never as object),
        round: 10,
        turnIndex: 1,
      } as never,
    };
    const out = run(s, { type: "turn.advance", reason: "next" });
    const events = expectOk(out.result);
    expect(
      events.find((e) => e.type === "concentration.changed"),
    ).toMatchObject({ cause: "expired" });
    expect(replay(events, s).combatants["pc-ana"]?.rollBonuses).toBeUndefined();
  });
});
