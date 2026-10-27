import { describe, expect, it } from "vitest";
import {
  EngineCommandSchema,
  EngineEventSchema,
  emptyState,
  execute,
  RefusalCodeSchema,
  scriptedRng,
  seededRng,
} from "../src/index.js";
import {
  countingRng,
  deepFreeze,
  expectOk,
  expectRefusal,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  stateWith,
} from "./helpers.js";

const rollCmd = {
  type: "roll",
  expression: "1d20",
  mode: "normal",
  reason: "t",
};

describe("execute", () => {
  it("refuses INVALID_STATE for hp above max", () => {
    const c = makeCombatant({ hp: { current: 20, max: 12, temp: 0 } });
    expectRefusal(
      execute(stateWith(c), rollCmd, scriptedRng([])),
      "INVALID_STATE",
    );
  });

  it("refuses INVALID_STATE for lifeState inconsistent with hp", () => {
    const dead = makeCombatant({
      lifeState: "conscious",
      hp: { current: 0, max: 12, temp: 0 },
    });
    expectRefusal(
      execute(stateWith(dead), rollCmd, scriptedRng([])),
      "INVALID_STATE",
    );
    const up = makeCombatant({ lifeState: "unconscious" });
    expectRefusal(
      execute(stateWith(up), rollCmd, scriptedRng([])),
      "INVALID_STATE",
    );
  });

  it("refuses INVALID_STATE when an encounter names a missing combatant", () => {
    const state = {
      ...emptyState(),
      encounter: {
        round: 1,
        turnIndex: 0,
        order: [{ combatantId: "ghost", total: 10, bonus: 0 }],
      },
    };
    expectRefusal(execute(state, rollCmd, scriptedRng([])), "INVALID_STATE");
  });

  it("refuses INVALID_COMMAND for unknown type, missing reason, negative amount", () => {
    const rng = scriptedRng([]);
    expectRefusal(
      execute(emptyState(), { type: "nope", reason: "t" }, rng),
      "INVALID_COMMAND",
    );
    expectRefusal(
      execute(emptyState(), { type: "roll", expression: "1d20" }, rng),
      "INVALID_COMMAND",
    );
    expectRefusal(
      execute(
        stateWith(makeCombatant()),
        {
          type: "healing.apply",
          targetId: "pc-ana",
          amount: { kind: "fixed", value: -1 },
          reason: "t",
        },
        rng,
      ),
      "INVALID_COMMAND",
    );
    expectRefusal(execute(emptyState(), "roll", rng), "INVALID_COMMAND");
  });

  it("rejects exhaustion on condition.apply and condition.remove", () => {
    const rng = scriptedRng([]);
    const s = stateWith(makeCombatant());
    expectRefusal(
      execute(
        s,
        {
          type: "condition.apply",
          targetId: "pc-ana",
          condition: "exhaustion",
          source: "x",
          reason: "t",
        },
        rng,
      ),
      "INVALID_COMMAND",
    );
    expectRefusal(
      execute(
        s,
        {
          type: "condition.remove",
          targetId: "pc-ana",
          condition: "exhaustion",
          reason: "t",
        },
        rng,
      ),
      "INVALID_COMMAND",
    );
  });

  it("reports INVALID_STATE before INVALID_COMMAND", () => {
    const c = makeCombatant({ hp: { current: 20, max: 12, temp: 0 } });
    expectRefusal(
      execute(stateWith(c), { type: "nope" }, scriptedRng([])),
      "INVALID_STATE",
    );
  });

  it("does not mutate deep-frozen inputs", () => {
    const state = deepFreeze(stateWith(makeCombatant()));
    const cmd = deepFreeze({ ...rollCmd });
    expect(() =>
      expectOk(execute(state, cmd, scriptedRng([10]))),
    ).not.toThrow();
  });

  it("is deterministic with seededRng(42)", () => {
    const state = stateWith(makeCombatant());
    const a = execute(state, rollCmd, seededRng(42));
    const b = execute(state, rollCmd, seededRng(42));
    expect(a).toEqual(b);
  });

  it("draws nothing on refusal", () => {
    const rng = countingRng(scriptedRng([]));
    expectRefusal(
      execute(emptyState(), { type: "nope" }, rng),
      "INVALID_COMMAND",
    );
    expect(rng.draws()).toBe(0);
  });
});

describe("contract surface", () => {
  it("has 21 commands, 18 events and 27 refusal codes", () => {
    expect(EngineCommandSchema.options).toHaveLength(21);
    expect(EngineEventSchema.options).toHaveLength(18);
    expect(RefusalCodeSchema.options).toHaveLength(27);
  });
});

describe("refuse before draw", () => {
  const ana = makeCombatant();
  const bob = makeCombatant({ id: "pc-bob", name: "Bob" });
  const fallen = makeCombatant({
    id: "pc-dead",
    name: "Dead",
    lifeState: "dead",
    hp: { current: 0, max: 12, temp: 0 },
  });
  const noAc = makeCombatant({ id: "pc-noac", name: "NoAc", ac: null });
  const base = stateWith(ana, bob, fallen, noAc);
  const inEncounter = {
    ...stateWith(ana, bob),
    encounter: {
      round: 1,
      turnIndex: 0,
      order: [
        { combatantId: "pc-ana", total: 12, bonus: 0 },
        { combatantId: "pc-bob", total: 10, bonus: 0 },
      ],
    },
  };
  const damage = (targetId: string, expression = "1d6") => ({
    type: "damage.apply",
    targetId,
    critical: false,
    components: [
      { amount: { kind: "roll", expression }, damageType: "slashing" },
    ],
    reason: "t",
  });
  const attack = (over: Record<string, unknown> = {}) => ({
    type: "attack.roll",
    attackerId: null,
    targetId: "pc-ana",
    expression: "1d20+4",
    targetAc: null,
    reason: "t",
    ...over,
  });
  const init = (...ids: string[]) => ({
    type: "initiative.roll",
    participants: ids.map((combatantId) => ({ combatantId, mode: "normal" })),
    reason: "t",
  });

  const cases: [
    string,
    Parameters<typeof expectRefusedBeforeDraw>[1],
    typeof base,
    unknown,
  ][] = [
    [
      "INVALID_STATE",
      "INVALID_STATE",
      stateWith({ ...ana, hp: { current: 99, max: 12, temp: 0 } }),
      rollCmd,
    ],
    ["INVALID_COMMAND", "INVALID_COMMAND", base, { type: "nope" }],
    [
      "INVALID_DICE_EXPRESSION",
      "INVALID_DICE_EXPRESSION",
      base,
      { ...rollCmd, expression: "3d" },
    ],
    [
      "DICE_LIMIT_EXCEEDED",
      "DICE_LIMIT_EXCEEDED",
      base,
      { ...rollCmd, expression: "101d6" },
    ],
    [
      "ADVANTAGE_NOT_APPLICABLE",
      "ADVANTAGE_NOT_APPLICABLE",
      base,
      { ...rollCmd, expression: "1d6", mode: "advantage" },
    ],
    [
      "D20_TERM_REQUIRED",
      "D20_TERM_REQUIRED",
      base,
      attack({ expression: "1d6+3" }),
    ],
    [
      "TARGET_AC_UNKNOWN",
      "TARGET_AC_UNKNOWN",
      base,
      attack({ targetId: "pc-noac" }),
    ],
    ["UNKNOWN_COMBATANT", "UNKNOWN_COMBATANT", base, damage("ghost")],
    ["TARGET_DEAD", "TARGET_DEAD", base, damage("pc-dead")],
    [
      "NOT_DYING",
      "NOT_DYING",
      base,
      {
        type: "death-save.roll",
        targetId: "pc-ana",
        mode: "normal",
        reason: "t",
      },
    ],
    ["ENCOUNTER_ACTIVE", "ENCOUNTER_ACTIVE", inEncounter, init("pc-ana")],
    [
      "NO_ACTIVE_ENCOUNTER",
      "NO_ACTIVE_ENCOUNTER",
      base,
      {
        type: "initiative.join",
        combatantId: "pc-ana",
        mode: "normal",
        reason: "t",
      },
    ],
    [
      "ALREADY_IN_ENCOUNTER",
      "ALREADY_IN_ENCOUNTER",
      inEncounter,
      {
        type: "initiative.join",
        combatantId: "pc-ana",
        mode: "normal",
        reason: "t",
      },
    ],
    [
      "DUPLICATE_PARTICIPANT",
      "DUPLICATE_PARTICIPANT",
      base,
      init("pc-ana", "pc-ana"),
    ],
    [
      "INSUFFICIENT_HIT_DICE",
      "INSUFFICIENT_HIT_DICE",
      base,
      {
        type: "rest.short",
        participants: [
          { combatantId: "pc-ana", spend: [{ die: 10, count: 1 }] },
        ],
        reason: "t",
      },
    ],
  ];

  for (const [name, code, state, command] of cases) {
    it(`draws nothing before refusing ${name}`, () => {
      expectRefusedBeforeDraw(run(state, command, [10, 10, 10]), code);
    });
  }
});
