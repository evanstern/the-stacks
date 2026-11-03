import { describe, expect, it } from "vitest";
import { replay } from "../../src/index.js";
import {
  expectOk,
  expectRefusedBeforeDraw,
  makeCombatant,
  run,
  settle,
  stateWith,
} from "../helpers.js";

const pc = (id: string) => makeCombatant({ id, name: id });
const roll = (ids: string[]) => ({
  type: "initiative.roll",
  participants: ids.map((combatantId) => ({ combatantId, mode: "normal" })),
  reason: "combat begins",
});
const advance = { type: "turn.advance", reason: "next turn" };
const react = (attackerId: string | null = "g", over = {}) => ({
  type: "attack.roll",
  attackerId,
  targetId: "a",
  expression: "1d20+4",
  reaction: true,
  reason: "opportunity attack",
  ...over,
});

/** Order: a (15), g (5). a is active. */
function started() {
  const state = stateWith(pc("a"), pc("g"), pc("h"));
  return settle(state, run(state, roll(["a", "g"]), [15, 5]).result);
}

describe("attack.roll reaction", () => {
  it("resolves with reaction: true and spends the Reaction", () => {
    const state = started();
    const out = run(state, react(), [12]);
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
      "encounter.changed",
    ]);
    expect(events[1]).toMatchObject({ reaction: true, attackerId: "g" });
    expect(events[2]).toMatchObject({ combatantId: "g" });
    const next = settle(state, out.result);
    expect(next.encounter?.reactionsSpent).toEqual(["g"]);
    expect(replay(events, state)).toEqual(next);
  });

  it("a plain attack carries no reaction flag and spends nothing", () => {
    const state = started();
    const out = run(state, react("g", { reaction: false }), [12]);
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
    ]);
    expect(events[1]).not.toHaveProperty("reaction");
  });

  it("refuses a second reaction before any draw", () => {
    const state = started();
    const spent = settle(state, run(state, react(), [12]).result);
    expectRefusedBeforeDraw(run(spent, react(), [12]), "REACTION_SPENT");
  });

  it("refuses a null attacker, no encounter and not-in-order before any draw", () => {
    expectRefusedBeforeDraw(
      run(started(), react(null), [12]),
      "INVALID_COMMAND",
    );
    expectRefusedBeforeDraw(
      run(stateWith(pc("a"), pc("g")), react(), [12]),
      "NO_ACTIVE_ENCOUNTER",
    );
    expectRefusedBeforeDraw(
      run(started(), react("h"), [12]),
      "UNKNOWN_COMBATANT",
    );
  });

  it("turn.advance to the reactor resets the Reaction", () => {
    const state = started();
    const spent = settle(state, run(state, react(), [12]).result);
    const out = run(spent, advance);
    const events = expectOk(out.result);
    expect(events.map((e) => e.type)).toEqual([
      "turn.advanced",
      "encounter.changed",
    ]);
    const next = settle(spent, out.result);
    expect(next.encounter?.reactionsSpent).toEqual([]);
    expectOk(run(next, react(), [12]).result);
  });

  it("advancing to someone else keeps the spend", () => {
    const state = started();
    const spent = settle(state, run(state, react(), [12]).result);
    const events = expectOk(run(spent, advance).result);
    expect(events).toHaveLength(2); // g becomes active here
    const back = settle(spent, run(spent, advance).result);
    const again = expectOk(run(back, advance).result); // a active; g still clear
    expect(again.map((e) => e.type)).toEqual(["turn.advanced"]);
  });

  it("initiative.leave drops the leaver and resets an incoming reactor", () => {
    const state = started();
    const spent = settle(state, run(state, react(), [12]).result);
    // a (active) leaves: g becomes active, so its Reaction resets.
    const left = settle(
      spent,
      run(spent, { type: "initiative.leave", combatantId: "a", reason: "gone" })
        .result,
    );
    expect(left.encounter?.reactionsSpent).toEqual([]);
    // g (not active) leaves while spent: dropped from the list.
    const s2 = settle(state, run(state, react(), [12]).result);
    const gone = settle(
      s2,
      run(s2, { type: "initiative.leave", combatantId: "g", reason: "gone" })
        .result,
    );
    expect(gone.encounter?.reactionsSpent).toEqual([]);
  });

  it("encounter.end clears the list", () => {
    const state = started();
    const spent = settle(state, run(state, react(), [12]).result);
    const ended = settle(
      spent,
      run(spent, { type: "encounter.end", reason: "done" }).result,
    );
    expect(ended.encounter).toBeNull();
  });
});
