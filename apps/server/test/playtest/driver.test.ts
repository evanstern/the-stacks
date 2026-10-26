import type { SessionProjections } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { type DriverState, nextMove } from "../../src/playtest/driver.js";
import { loadScenario } from "../../src/playtest/scenario.js";

const scenario = loadScenario(
  new URL("../../playtests/scenarios/greyhollow-ford.json", import.meta.url)
    .pathname,
);

const fresh = (over: Partial<DriverState> = {}): DriverState => ({
  freeIndex: 0,
  moves: 0,
  combatMoves: 0,
  started: true,
  ...over,
});

function proj(over: Record<string, unknown> = {}): SessionProjections {
  return {
    scene: { sceneId: "greyhollow-ford" },
    tableMode: { mode: "free" },
    actions: [],
    ...over,
  } as unknown as SessionProjections;
}

const turnMode = (who: string | null) => ({
  mode: "turn",
  activeActor: "x",
  activeCharacterId: who,
});

describe("nextMove", () => {
  it("serves the free moves in order, then the fallback", () => {
    const ids: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      const m = nextMove(proj(), scenario, fresh({ freeIndex: i, moves: i }));
      if (m === "wait" || m === "done") throw new Error("unexpected");
      ids.push(m.actionId);
    }
    expect(ids).toEqual(["act-search", "act-persuade", "act-advance", "pt-4"]);
  });

  it("plays the combat move only when the seat is active; the first uses firstActionId", () => {
    const p = (who: string | null) => proj({ tableMode: turnMode(who) });
    expect(nextMove(p("odo"), scenario, fresh())).toBe("wait");
    expect(nextMove(p("tamsin"), scenario, fresh({ moves: 3 }))).toMatchObject({
      actionId: "act-strike",
      text: scenario.moves.combat.text,
    });
    expect(
      nextMove(p("tamsin"), scenario, fresh({ moves: 4, combatMoves: 1 })),
    ).toMatchObject({ actionId: "pt-5" });
  });

  it("waits while a human action is unresolved", () => {
    const actions = [{ characterId: "tamsin", status: "committed" }];
    expect(nextMove(proj({ actions }), scenario, fresh())).toBe("wait");
    const done = [{ characterId: "tamsin", status: "resolved" }];
    expect(nextMove(proj({ actions: done }), scenario, fresh())).not.toBe(
      "wait",
    );
  });

  it("is done when the scene ended or the move cap is reached", () => {
    expect(nextMove(proj({ scene: null }), scenario, fresh())).toBe("done");
    expect(
      nextMove(proj(), scenario, fresh({ moves: scenario.limits.maxMoves })),
    ).toBe("done");
  });
});
