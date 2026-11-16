import { INTENT_KINDS } from "@the-stacks/intent";
import { describe, expect, it } from "vitest";
import { actionCostOf, type PlanResult, plan } from "../src/index.js";
import {
  actors,
  baseState,
  inEncounter,
  intent,
  placeAt,
  tgt,
  view,
  withCombatant,
} from "./fixtures.js";

const run = (i: ReturnType<typeof intent>, s = baseState()) =>
  plan(s, view(s), i);
const types = (r: PlanResult) =>
  r.kind === "commands" ? r.commands.map((c) => c.command.type) : [r.kind];
const code = (r: PlanResult) =>
  r.kind === "refusal" ? r.refusal.code : r.kind;
const hit = (extra: Record<string, unknown> = {}) =>
  intent("attack", {
    targets: [tgt("goblin-2")],
    params: { weapon: "Longsword" },
    ...extra,
  });
const cast = (spell: string) =>
  intent("cast", {
    actor: actors.companion,
    targets: [tgt("goblin-2")],
    params: { spell },
  });
// Thorin (or `who`) is active; `slot` marks what he already used this turn.
const turn = (
  who = "thorin",
  slot?: "actionUsed" | "bonusActionUsed",
  far = false,
) => {
  let s = inEncounter(baseState(), [who, "goblin-2"]);
  if (far) s = placeAt(s, "goblin-2", "b");
  if (slot)
    s.engine.encounter = {
      ...(s.engine.encounter as NonNullable<typeof s.engine.encounter>),
      economy: {
        combatantId: who,
        round: 1,
        actionUsed: slot === "actionUsed",
        bonusActionUsed: slot === "bonusActionUsed",
      },
    };
  return s;
};

describe("planner economy (spec 117)", () => {
  it("an active actor's attack ends with an action spend; guards keep their steps", () => {
    const r = run(hit(), turn());
    expect(types(r)).toEqual([
      "attack.roll",
      "damage.apply",
      "damage.apply",
      "action.spend",
    ]);
    if (r.kind !== "commands") return;
    expect(r.commands[1]?.when?.step).toBe(0);
    expect(r.commands[3]).toMatchObject({
      command: { type: "action.spend", combatantId: "thorin", cost: "action" },
    });
    expect(r.commands[3]?.when).toBeUndefined();
  });

  it("healing-word ends with a bonus-action spend", () => {
    const r = run(cast("healing-word"), turn("mira"));
    expect(types(r).at(-1)).toBe("action.spend");
    if (r.kind === "commands")
      expect(r.commands.at(-1)?.command).toMatchObject({
        cost: "bonus-action",
        combatantId: "mira",
      });
  });

  it("move, stand, end_turn and save plan no spend", () => {
    for (const i of [
      intent("stand"),
      intent("end_turn"),
      intent("save", { params: { ability: "dex", difficulty: "hard" } }),
    ])
      expect(types(run(i, turn())), i.kind).not.toContain("action.spend");
  });

  it("free mode and an off-turn actor plan no spend", () => {
    expect(types(run(hit(), baseState()))).not.toContain("action.spend");
    const off = turn("goblin-2");
    expect(types(run(hit(), off))).not.toContain("action.spend");
  });

  it("an attack with a pull-in still ends with the spend", () => {
    const s = inEncounter(baseState(), ["thorin", "goblin-2"]);
    const r = run(hit({ targets: [tgt("orc-1")] }), s);
    expect(types(r).at(-1)).toBe("action.spend");
    expect(types(r)[0]).toBe("combatant.add");
  });

  it("a used Action refuses NO_ACTION_LEFT before the handler", () => {
    expect(code(run(hit(), turn("thorin", "actionUsed")))).toBe(
      "NO_ACTION_LEFT",
    );
    // out of reach would otherwise be OUT_OF_REACH
    expect(code(run(hit(), turn("thorin", "actionUsed", true)))).toBe(
      "NO_ACTION_LEFT",
    );
  });

  it("a used Bonus Action refuses; an Action cast still plans", () => {
    const s = turn("mira", "bonusActionUsed");
    expect(code(run(cast("healing-word"), s))).toBe("NO_BONUS_ACTION_LEFT");
    expect(types(run(cast("fire-bolt"), s)).at(-1)).toBe("action.spend");
  });

  it("a check with no DC under a used Action refuses rather than asks", () => {
    const r = run(
      intent("check", { params: { skill: "athletics" } }),
      turn("thorin", "actionUsed"),
    );
    expect(code(r)).toBe("NO_ACTION_LEFT");
  });

  it("a ruling accept replans with a spend", () => {
    const s0 = turn();
    const asked = run(
      intent("check", { id: "i-climb", params: { skill: "athletics" } }),
      s0,
    );
    // the ask itself plans no commands, so it spends nothing
    expect(asked.kind).toBe("needs_ruling");
    if (asked.kind !== "needs_ruling") return;
    const s = {
      ...s0,
      openRequests: { [asked.request.requestId]: asked.request },
    };
    const r = run(
      intent("ruling", {
        actor: actors.aiDm,
        params: {
          requestId: asked.request.requestId,
          decision: "accept",
          difficulty: "hard",
        },
      }),
      s,
    );
    expect(types(r)).toEqual(["check.roll", "action.spend"]);
  });

  it("a dead-or-unable actor is refused by the handler, not the economy", () => {
    const s = withCombatant(turn(), "thorin", {
      lifeState: "unconscious",
      hp: { current: 0, max: 12, temp: 0 },
    });
    expect(code(run(hit(), s))).toBe("ACTOR_UNABLE");
  });

  it("actionCostOf follows the cost table for every kind", () => {
    const action = new Set([
      "attack",
      "check",
      "contest",
      "dash",
      "disengage",
      "dodge",
      "grapple",
      "help",
      "hide",
      "search",
      "shove",
    ]);
    for (const k of INTENT_KINDS) {
      if (k === "cast") continue;
      const i = { kind: k, params: {} } as never;
      expect(actionCostOf(i), k).toBe(action.has(k) ? "action" : null);
    }
    expect(
      actionCostOf({
        kind: "cast",
        params: { spell: "healing-word" },
      } as never),
    ).toBe("bonus-action");
    expect(
      actionCostOf({ kind: "cast", params: { spell: "fire-bolt" } } as never),
    ).toBe("action");
    expect(
      actionCostOf({ kind: "cast", params: { spell: "nope" } } as never),
    ).toBe("action");
  });
});
