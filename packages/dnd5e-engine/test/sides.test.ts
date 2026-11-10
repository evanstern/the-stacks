import { describe, expect, it } from "vitest";
import {
  areHostile,
  closeCombatFoes,
  type EngineState,
  encounterOver,
  hostilesStanding,
  meleeFoes,
} from "../src/index.js";
import { makeCombatant, run, settle, stateWith } from "./helpers.js";

const c = (id: string, side?: "party" | "hostile" | "neutral", o = {}) =>
  makeCombatant({ id, name: id, ...(side ? { side } : {}), ...o });
const cond = (condition: string) => ({
  instanceId: `c-${condition}`,
  condition,
  level: null,
  source: "test",
  expiresAt: null,
});
const zone = (id: string) => ({
  id,
  name: id,
  kind: "room",
  tags: [],
  hidden: false,
});

/** Roll everyone in, then apply each combatant's own fields (dead rolls are refused). */
function fight(...cs: ReturnType<typeof c>[]): EngineState {
  const state = stateWith(
    ...cs.map((x) => ({
      ...x,
      lifeState: "conscious" as const,
      hp: { current: 7, max: 7, temp: 0 },
    })),
  );
  const rolled = settle(
    state,
    run(
      state,
      {
        type: "initiative.roll",
        participants: cs.map((x) => ({ combatantId: x.id, mode: "normal" })),
        reason: "combat",
      },
      cs.map(() => 10),
    ).result,
  );
  return {
    ...rolled,
    combatants: Object.fromEntries(cs.map((x) => [x.id, x])),
  };
}

function placed(cs: [ReturnType<typeof c>, string][]): EngineState {
  let state = stateWith(...cs.map(([x]) => x));
  state = settle(
    state,
    run(state, {
      type: "space.define",
      space: {
        zones: ["a", "b"].map(zone),
        edges: [{ from: "a", to: "b", feet: 20, kind: "open" }],
      },
      reason: "s",
    }).result,
  );
  for (const [x, z] of cs) {
    state = settle(
      state,
      run(state, {
        type: "combatant.place",
        combatantId: x.id,
        zoneId: z,
        reason: "p",
      }).result,
    );
  }
  return state;
}

describe("areHostile", () => {
  it("is true only for party vs hostile, either way", () => {
    expect(areHostile(c("a", "party"), c("b", "hostile"))).toBe(true);
    expect(areHostile(c("a", "hostile"), c("b", "party"))).toBe(true);
    expect(areHostile(c("a", "party"), c("b", "party"))).toBe(false);
    expect(areHostile(c("a", "hostile"), c("b", "hostile"))).toBe(false);
    expect(areHostile(c("a", "party"), c("b", "neutral"))).toBe(false);
    expect(areHostile(c("a", "party"), c("b"))).toBe(false);
    expect(areHostile(c("a"), c("b"))).toBe(false);
  });
});

describe("hostilesStanding and encounterOver", () => {
  it("lists conscious hostiles in order; none with no encounter", () => {
    expect(hostilesStanding(stateWith(c("g", "hostile")))).toEqual([]);
    const s = fight(c("p", "party"), c("g", "hostile"), c("h", "hostile"));
    expect(hostilesStanding(s).sort()).toEqual(["g", "h"]);
    expect(encounterOver(s)).toBe(false);
  });
  it("skips unconscious, dead and sideless; ends when none stand", () => {
    const s = fight(
      c("p", "party"),
      c("g", "hostile", {
        lifeState: "dead",
        hp: { current: 0, max: 7, temp: 0 },
      }),
      c("h", "hostile", {
        lifeState: "unconscious",
        hp: { current: 0, max: 7, temp: 0 },
      }),
      c("n", "neutral"),
    );
    expect(hostilesStanding(s)).toEqual([]);
    expect(encounterOver(s)).toBe(true);
  });
  it("is false with no sided combatant and with no encounter", () => {
    expect(encounterOver(fight(c("a"), c("b")))).toBe(false);
    expect(encounterOver(stateWith(c("p", "party")))).toBe(false);
  });
  it("a downed party does not end it while a hostile stands", () => {
    const s = fight(
      c("p", "party", {
        lifeState: "unconscious",
        hp: { current: 0, max: 12, temp: 0 },
      }),
      c("g", "hostile"),
    );
    expect(encounterOver(s)).toBe(false);
  });
});

/** Seed an active encounter holding the given melee pairs (spec 101). */
function withPairs(state: EngineState, ...pairs: [string, string][]) {
  return {
    ...state,
    encounter: {
      round: 1,
      turnIndex: 0,
      order: Object.keys(state.combatants).map((combatantId) => ({
        combatantId,
        total: 10,
        bonus: 0,
      })),
      melee: pairs,
    },
  } as EngineState;
}

describe("meleeFoes", () => {
  const s = withPairs(
    placed([
      [c("k", "party"), "a"],
      [c("g", "hostile"), "a"],
      [c("h", "hostile"), "a"],
    ]),
    ["g", "k"],
    ["h", "k"],
  );
  it("lists every partner, either side of the pair", () => {
    expect(meleeFoes(s, "k")).toEqual(["g", "h"]);
    expect(meleeFoes(s, "g")).toEqual(["k"]);
    expect(meleeFoes(s, "nobody")).toEqual([]);
  });
  it("is empty with no pairs or no encounter", () => {
    expect(meleeFoes(withPairs(s), "k")).toEqual([]);
    expect(meleeFoes({ ...s, encounter: null }, "k")).toEqual([]);
  });
});

describe("closeCombatFoes", () => {
  const base = (over = {}) =>
    withPairs(
      placed([
        [c("k", "party", over), "a"],
        [c("g", "hostile"), "a"],
      ]),
      ["g", "k"],
    );
  it("lists an opposed conscious combatant paired with the attacker", () => {
    expect(closeCombatFoes(base(), "k")).toEqual(["g"]);
  });
  it("is empty for a same-zone foe without a pair (spec 101)", () => {
    const s = placed([
      [c("k", "party"), "a"],
      [c("g", "hostile"), "a"],
    ]);
    expect(closeCombatFoes(withPairs(s), "k")).toEqual([]);
  });
  it("is empty for a paired neutral, unable or blinded foe", () => {
    const neutral = placed([
      [c("k", "party"), "a"],
      [c("g", "neutral"), "a"],
    ]);
    expect(closeCombatFoes(withPairs(neutral, ["g", "k"]), "k")).toEqual([]);
    for (const k of ["incapacitated", "blinded", "paralyzed"]) {
      const s = placed([
        [c("k", "party"), "a"],
        [c("g", "hostile", { conditions: [cond(k)] }), "a"],
      ]);
      expect(closeCombatFoes(withPairs(s, ["g", "k"]), "k")).toEqual([]);
    }
    const down = placed([
      [c("k", "party"), "a"],
      [
        c("g", "hostile", {
          lifeState: "unconscious",
          hp: { current: 0, max: 7, temp: 0 },
        }),
        "a",
      ],
    ]);
    expect(closeCombatFoes(withPairs(down, ["g", "k"]), "k")).toEqual([]);
  });
  it("is empty for an invisible, sideless or unplaced attacker", () => {
    expect(
      closeCombatFoes(base({ conditions: [cond("invisible")] }), "k"),
    ).toEqual([]);
    const sideless = placed([
      [c("k"), "a"],
      [c("g", "hostile"), "a"],
    ]);
    expect(closeCombatFoes(withPairs(sideless, ["g", "k"]), "k")).toEqual([]);
    const s = stateWith(c("k", "party"), c("g", "hostile"));
    expect(closeCombatFoes(withPairs(s, ["g", "k"]), "k")).toEqual([]);
    expect(closeCombatFoes(base(), "nobody")).toEqual([]);
  });
  it("needs an active encounter", () => {
    expect(closeCombatFoes({ ...base(), encounter: null }, "k")).toEqual([]);
  });
});
