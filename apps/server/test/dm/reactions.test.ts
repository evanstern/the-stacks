import { type EngineState, emptyState } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { reactors } from "../../src/dm/reactions.js";

describe("reactors", () => {
  const combatant = (id: string, over = {}) =>
    ({
      id,
      name: id,
      lifeState: "conscious",
      conditions: [],
      ...over,
    }) as never;
  const engine = (spent: string[] = [], over: Record<string, unknown> = {}) =>
    ({
      ...emptyState(),
      combatants: {
        kestrel: combatant("kestrel"),
        "goblin-2": combatant("goblin-2"),
        "goblin-3": combatant("goblin-3", over),
        pell: combatant("pell"),
      },
      encounter: {
        round: 1,
        turnIndex: 0,
        order: ["kestrel", "goblin-2", "goblin-3", "pell"].map(
          (combatantId) => ({
            combatantId,
            total: 10,
            bonus: 0,
          }),
        ),
        reactionsSpent: spent,
      },
    }) as EngineState;
  const base = {
    moverId: "kestrel",
    leavesReachOf: ["goblin-2", "goblin-3", "pell", "kestrel"],
    partyCombatantIds: new Set(["kestrel"]),
    encounterMonsters: new Map([
      ["goblin-2", "goblin-warrior"],
      ["goblin-3", "goblin-minion"],
    ]),
  };

  it("keeps unspent able encounter monsters only", () => {
    expect(reactors({ ...base, engine: engine() })).toEqual([
      "goblin-2",
      "goblin-3",
    ]);
  });

  it("drops a spent, an unable and a captive NPC combatant", () => {
    expect(reactors({ ...base, engine: engine(["goblin-2"]) })).toEqual([
      "goblin-3",
    ]);
    expect(
      reactors({ ...base, engine: engine([], { lifeState: "unconscious" }) }),
    ).toEqual(["goblin-2"]);
    expect(
      reactors({
        ...base,
        engine: engine([], { conditions: [{ condition: "stunned" }] }),
      }),
    ).toEqual(["goblin-2"]);
    // pell has a combatant but is not an encounter monster: never listed above.
  });

  it("returns nothing with no encounter or a non-party mover", () => {
    expect(
      reactors({ ...base, engine: { ...engine(), encounter: null } }),
    ).toEqual([]);
    expect(
      reactors({ ...base, engine: engine(), moverId: "goblin-2" }),
    ).toEqual([]);
  });
});
