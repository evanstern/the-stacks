import { INTENT_KINDS } from "@the-stacks/intent";
import { VALID } from "@the-stacks/intent/fixtures";
import { describe, expect, it } from "vitest";
import {
  hostilesStanding,
  PLAN_KINDS,
  type PlanState,
  plan,
} from "../src/index.js";
import {
  type Ctx,
  type Res,
  reasonOf,
  resolveActor,
  resolveTarget,
} from "../src/refs.js";
import {
  baseState,
  inEncounter,
  intent,
  setActor,
  tgt,
  view,
  withCombatant,
  zone,
} from "./fixtures.js";

const refusalOf = (r: ReturnType<typeof plan>) => {
  expect(r.kind).toBe("refusal");
  return r.kind === "refusal" ? r.refusal : (undefined as never);
};

describe("PLAN_KINDS", () => {
  it("classifies every Intent kind", () => {
    for (const k of INTENT_KINDS) expect(PLAN_KINDS[k], k).toBeDefined();
    expect(Object.keys(PLAN_KINDS)).toHaveLength(INTENT_KINDS.length);
    const count = (c: string) =>
      Object.values(PLAN_KINDS).filter((r) => r.class === c).length;
    expect(count("served")).toBe(28);
    expect(count("ruling")).toBe(2);
    expect(count("unserved")).toBe(12);
    expect(count("not-planned")).toBe(15);
  });

  it("refuses every unserved and not-planned kind KIND_UNSERVED with its owner", () => {
    const state = baseState();
    for (const k of INTENT_KINDS) {
      const row = PLAN_KINDS[k];
      if (row.class !== "unserved" && row.class !== "not-planned") continue;
      const i = VALID[k][0];
      expect(i, k).toBeDefined();
      const r = plan(state, view(state), i as NonNullable<typeof i>);
      const f = refusalOf(r);
      expect(f.source, k).toBe("planner");
      expect(f.code, k).toBe("KIND_UNSERVED");
      expect(f.details?.owner, k).toBe(row.owner);
    }
    expect(PLAN_KINDS.dodge.owner).toBe("TASK-0304");
  });
});

describe("references", () => {
  const ctxOf = (s: PlanState, over: Record<string, unknown> = {}): Ctx => {
    const i = intent("attack", {
      targets: [tgt("goblin-2")],
      params: { weapon: "Longsword" },
      ...over,
    });
    return {
      state: s,
      space: view(s),
      intent: i,
      reason: reasonOf(i),
      askId: i.id,
    };
  };
  const fail = <T>(r: Res<T>) => {
    expect(r.ok).toBe(false);
    return r.ok ? (undefined as never) : refusalOf(r.result);
  };

  it("refuses an unknown actor UNKNOWN_COMBATANT (engine)", () => {
    const c = ctxOf(baseState(), { actor: { kind: "pc", id: "nobody" } });
    const f = fail(resolveActor(c));
    expect([f.source, f.code]).toEqual(["engine", "UNKNOWN_COMBATANT"]);
  });

  it("refuses an absent actor UNKNOWN_COMBATANT (engine)", () => {
    const s = setActor(baseState(), "thorin", { presence: "absent" });
    const f = fail(resolveActor(ctxOf(s)));
    expect([f.source, f.code]).toEqual(["engine", "UNKNOWN_COMBATANT"]);
  });

  it("refuses an unable actor ACTOR_UNABLE (engine)", () => {
    const s = withCombatant(baseState(), "thorin", {
      lifeState: "unconscious",
      hp: { current: 0, max: 12, temp: 0 },
    });
    const f = fail(resolveActor(ctxOf(s)));
    expect([f.source, f.code]).toEqual(["engine", "ACTOR_UNABLE"]);
  });

  it("refuses an unknown, absent or unseen target", () => {
    const s = baseState();
    const unknown = fail(resolveTarget(ctxOf(s), tgt("ghost")));
    expect([unknown.source, unknown.code]).toEqual([
      "planner",
      "TARGET_NOT_PRESENT",
    ]);
    setActor(s, "goblin-2", { presence: "absent" });
    expect(fail(resolveTarget(ctxOf(s), tgt("goblin-2"))).code).toBe(
      "TARGET_NOT_PRESENT",
    );
    setActor(s, "goblin-2", { presence: "present", seen: false });
    expect(fail(resolveTarget(ctxOf(s), tgt("goblin-2"))).code).toBe(
      "TARGET_UNSEEN",
    );
  });

  it("refuses a non-actor target TARGET_NOT_PRESENT", () => {
    const s = baseState();
    expect(fail(resolveTarget(ctxOf(s), zone("a"))).code).toBe(
      "TARGET_NOT_PRESENT",
    );
  });

  it("pulls an NPC with an init into the engine, and into an encounter", () => {
    const quiet = baseState();
    const r = resolveTarget(ctxOf(quiet), tgt("orc-1"));
    expect(r.ok && r.value.pull.map((p) => p.command.type)).toEqual([
      "combatant.add",
    ]);
    expect(r.ok && r.value.facts).toEqual([
      { kind: "pull-in", actorId: "orc-1" },
    ]);
    const fight = inEncounter(baseState(), ["thorin", "goblin-2"]);
    const r2 = resolveTarget(ctxOf(fight), tgt("orc-1"));
    expect(r2.ok && r2.value.pull.map((p) => p.command.type)).toEqual([
      "combatant.add",
      "initiative.join",
    ]);
  });

  it("an NPC with no combatant and no init is not present", () => {
    const s = baseState();
    s.inits = {};
    expect(fail(resolveTarget(ctxOf(s), tgt("orc-1"))).code).toBe(
      "TARGET_NOT_PRESENT",
    );
  });

  it("hostilesStanding reads presence and life state", () => {
    const s = baseState();
    expect(hostilesStanding(s)).toBe(true);
    const down = withCombatant(
      withCombatant(s, "goblin-2", { lifeState: "dead" }),
      "snag",
      { lifeState: "dead" },
    );
    expect(hostilesStanding(down)).toBe(false);
    setActor(s, "snag", { presence: "yielded" });
    setActor(s, "goblin-2", { presence: "yielded" });
    expect(hostilesStanding(s)).toBe(false);
  });
});
