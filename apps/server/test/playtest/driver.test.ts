import type { SessionProjections } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import {
  type DriverState,
  initialDriverState,
  nextMove,
  turnChangedState,
} from "../../src/playtest/driver.js";
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
  fallbackIndex: 0,
  lastFallbackText: null,
  stallStreak: 0,
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
    for (let i = 0; i < 7; i++) {
      const m = nextMove(proj(), scenario, fresh({ freeIndex: i, moves: i }));
      if (m === "wait" || m === "done") throw new Error("unexpected");
      ids.push(m.actionId);
    }
    expect(ids).toEqual([
      "act-search",
      "confirm-search",
      "deed-search",
      "deed-move",
      "act-persuade",
      "act-advance",
      "pt-7",
    ]);
  });

  it("passes `confirm` and `intent` through from the scenario move", () => {
    const move = (i: number) => {
      const m = nextMove(proj(), scenario, fresh({ freeIndex: i, moves: i }));
      if (m === "wait" || m === "done") throw new Error("unexpected");
      return m;
    };
    expect(move(1)).toMatchObject({
      actionId: "confirm-search",
      confirm: true,
    });
    expect(move(1).intent).toBeUndefined();
    // OQ-4 ruling (a), 2026-11-14.
    expect(move(2)).toMatchObject({ actionId: "deed-search", intent: true });
    expect(move(3)).toMatchObject({ actionId: "deed-move", intent: true });
    expect(move(0).confirm).toBeUndefined();
    expect(move(0).intent).toBeUndefined();
  });

  it("plays the combat move only when the seat is active; the first uses firstActionId", () => {
    const p = (who: string | null) => proj({ tableMode: turnMode(who) });
    expect(nextMove(p("odo"), scenario, fresh())).toBe("wait");
    expect(nextMove(p("tamsin"), scenario, fresh({ moves: 6 }))).toMatchObject({
      actionId: "act-strike",
      text: scenario.moves.combat.text,
    });
    expect(
      nextMove(p("tamsin"), scenario, fresh({ moves: 6, combatMoves: 1 })),
    ).toMatchObject({ actionId: "pt-7" });
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

describe("fallback cycling and the stall stop", () => {
  const list = scenario.moves.fallback;

  it("cycles the fallback list without an immediate repeat", () => {
    const state = fresh({ freeIndex: 6, moves: 6 });
    const texts: string[] = [];
    for (let i = 0; i < list.length * 2; i++) {
      const m = nextMove(proj(), scenario, state);
      if (m === "wait" || m === "done") throw new Error("unexpected");
      expect(m.fallback).toBe(true);
      texts.push(m.text);
      state.fallbackIndex = (m.fallbackIndex ?? 0) + 1;
      state.lastFallbackText = m.text;
      state.moves += 1;
    }
    expect(texts.slice(0, list.length)).toEqual(list.map((f) => f.text));
    for (let i = 1; i < texts.length; i++)
      expect(texts[i]).not.toBe(texts[i - 1]);
  });

  it("skips a fallback that equals the last one sent", () => {
    const m = nextMove(
      proj(),
      scenario,
      fresh({ freeIndex: 6, fallbackIndex: 0, lastFallbackText: list[0].text }),
    );
    expect(m).toMatchObject({ text: list[1].text });
  });

  it("stops after three no-change fallback moves, not before", () => {
    const base = { freeIndex: 3, moves: 6 };
    expect(
      nextMove(proj(), scenario, fresh({ ...base, stallStreak: 2 })),
    ).not.toBe("done");
    expect(nextMove(proj(), scenario, fresh({ ...base, stallStreak: 3 }))).toBe(
      "done",
    );
    expect(initialDriverState().stallStreak).toBe(0);
  });

  const change = (seq: number, type: string, before: unknown, after: unknown) =>
    ({ kind: "change", seq, type, before, after }) as never;

  it("counts a ledger change as a state change, a fallback move that changed nothing as none", () => {
    const roll = { kind: "roll", seq: 5 } as never;
    expect(turnChangedState([roll], 4)).toBe(false);
    expect(turnChangedState([change(5, "hp.changed", 3, 1)], 4)).toBe(true);
    expect(turnChangedState([change(3, "hp.changed", 3, 1)], 4)).toBe(false);
    expect(turnChangedState([change(5, "scene.changed", null, {})], 4)).toBe(
      true,
    );
  });

  it("counts a table-mode row only when the mode changed", () => {
    const free = { mode: "free" };
    const t = (c: string) => ({ mode: "turn", activeCharacterId: c });
    expect(
      turnChangedState([change(5, "table-mode.changed", t("a"), t("b"))], 4),
    ).toBe(false);
    expect(
      turnChangedState([change(5, "table-mode.changed", free, t("a"))], 4),
    ).toBe(true);
  });
});

describe("nextMove for a downed seat (TASK-0112)", () => {
  const member = (hp: number, lifeState: string) => ({
    characterId: "tamsin",
    combatant: { hp: { current: hp, max: 13, temp: 0 }, lifeState },
  });
  const party = (m: unknown) => ({ party: [m] });

  it("is done in free mode with 0 HP", () => {
    expect(
      nextMove(proj(party(member(0, "unconscious"))), scenario, fresh()),
    ).toBe("done");
  });

  it("waits in turn mode when another combatant is active", () => {
    expect(
      nextMove(
        proj({
          ...party(member(0, "unconscious")),
          tableMode: turnMode("odo"),
        }),
        scenario,
        fresh(),
      ),
    ).toBe("wait");
  });

  it("waits in turn mode even when its own turn is shown active", () => {
    expect(
      nextMove(
        proj({
          ...party(member(0, "unconscious")),
          tableMode: turnMode("tamsin"),
        }),
        scenario,
        fresh(),
      ),
    ).toBe("wait");
  });

  it("declares again once the character is conscious", () => {
    expect(
      nextMove(proj(party(member(1, "conscious"))), scenario, fresh()),
    ).toMatchObject({ actionId: "act-search" });
  });

  it("declares for a seat whose party member has no combatant", () => {
    expect(
      nextMove(
        proj({ party: [{ characterId: "tamsin", combatant: null }] }),
        scenario,
        fresh(),
      ),
    ).toMatchObject({ actionId: "act-search" });
  });
});
