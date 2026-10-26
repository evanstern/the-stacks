import { describe, expect, it } from "vitest";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const caster = (over = {}) =>
  makeCombatant({
    spellSlots: {
      standard: {
        "1": { max: 2, expended: 0 },
        "2": { max: 1, expended: 0 },
      },
      pact: { level: 3, slot: { max: 2, expended: 0 } },
    },
    ...over,
  });

const expend = (pool: string, level: number) => ({
  type: "spell-slot.expend",
  targetId: "pc-ana",
  pool,
  level,
  reason: "casts a spell",
});
const restore = (pool: string, level: number, count?: number) => ({
  type: "spell-slot.restore",
  targetId: "pc-ana",
  pool,
  level,
  ...(count ? { count } : {}),
  reason: "arcane recovery",
});

describe("spell-slot.expend", () => {
  it("expends a standard slot", () => {
    const state = stateWith(caster());
    const out = run(state, expend("standard", 1));
    expect(expectOk(out.result)[0]).toMatchObject({
      type: "spell-slots.changed",
      before: { pool: "standard", level: 1, expended: 0 },
      after: { pool: "standard", level: 1, expended: 1 },
    });
    const next = settle(state, out.result);
    expect(next.combatants["pc-ana"]?.spellSlots.standard["1"]?.expended).toBe(
      1,
    );
    expect(out.counter.draws()).toBe(0);
  });

  it("expends a pact slot", () => {
    const state = stateWith(caster());
    const out = run(state, expend("pact", 3));
    expect(expectOk(out.result)[0]).toMatchObject({
      after: { pool: "pact", level: 3, expended: 1 },
    });
    expect(
      settle(state, out.result).combatants["pc-ana"]?.spellSlots.pact?.slot
        .expended,
    ).toBe(1);
  });

  it("refuses an unavailable level, a pact mismatch and no pact pool", () => {
    const state = stateWith(caster());
    expectRefusedBeforeDraw(
      run(state, expend("standard", 5)),
      "SLOT_LEVEL_UNAVAILABLE",
    );
    expectRefusedBeforeDraw(
      run(state, expend("pact", 2)),
      "SLOT_LEVEL_UNAVAILABLE",
    );
    expectRefusedBeforeDraw(
      run(stateWith(makeCombatant()), expend("pact", 1)),
      "SLOT_LEVEL_UNAVAILABLE",
    );
  });

  it("refuses when every slot is expended", () => {
    const state = stateWith(
      caster({
        spellSlots: {
          standard: { "1": { max: 2, expended: 2 } },
          pact: null,
        },
      }),
    );
    expectRefusedBeforeDraw(
      run(state, expend("standard", 1)),
      "NO_SLOT_AVAILABLE",
    );
  });

  it("refuses unknown and dead targets", () => {
    expectRefusedBeforeDraw(
      run(stateWith(), expend("standard", 1)),
      "UNKNOWN_COMBATANT",
    );
    const dead = caster({
      lifeState: "dead",
      hp: { current: 0, max: 12, temp: 0 },
    });
    expectRefusedBeforeDraw(
      run(stateWith(dead), expend("standard", 1)),
      "TARGET_DEAD",
    );
  });
});

describe("spell-slot.restore", () => {
  const spent = () =>
    caster({
      spellSlots: {
        standard: { "1": { max: 3, expended: 3 } },
        pact: { level: 3, slot: { max: 2, expended: 1 } },
      },
    });

  it("restores one by default", () => {
    const state = stateWith(spent());
    const out = run(state, restore("standard", 1));
    expect(expectOk(out.result)[0]).toMatchObject({
      before: { expended: 3 },
      after: { expended: 2 },
    });
  });

  it("restores several", () => {
    const state = stateWith(spent());
    const out = run(state, restore("standard", 1, 3));
    expect(
      settle(state, out.result).combatants["pc-ana"]?.spellSlots.standard["1"]
        ?.expended,
    ).toBe(0);
  });

  it("restores a pact slot", () => {
    const state = stateWith(spent());
    const out = run(state, restore("pact", 3));
    expect(expectOk(out.result)[0]).toMatchObject({
      after: { pool: "pact", expended: 0 },
    });
  });

  it("refuses restoring more than are expended", () => {
    const state = stateWith(spent());
    expectRefusedBeforeDraw(
      run(state, restore("pact", 3, 2)),
      "SLOT_NOT_EXPENDED",
    );
    expectRefusedBeforeDraw(
      run(stateWith(caster()), restore("standard", 1)),
      "SLOT_NOT_EXPENDED",
    );
  });

  it("refuses an unavailable level and a dead target", () => {
    expectRefusedBeforeDraw(
      run(stateWith(spent()), restore("standard", 4)),
      "SLOT_LEVEL_UNAVAILABLE",
    );
    const dead = spent();
    dead.lifeState = "dead";
    dead.hp = { current: 0, max: 12, temp: 0 };
    expectRefusedBeforeDraw(
      run(stateWith(dead), restore("standard", 1)),
      "TARGET_DEAD",
    );
    expectRefusedBeforeDraw(
      run(stateWith(), restore("standard", 1)),
      "UNKNOWN_COMBATANT",
    );
  });
});
