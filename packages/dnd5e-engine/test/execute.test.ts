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
  makeCombatant,
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
  it("has 21 commands, 18 events and 26 refusal codes", () => {
    expect(EngineCommandSchema.options).toHaveLength(21);
    expect(EngineEventSchema.options).toHaveLength(18);
    expect(RefusalCodeSchema.options).toHaveLength(26);
  });
});
