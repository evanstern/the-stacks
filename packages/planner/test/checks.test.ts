import { describe, expect, it } from "vitest";
import { type PlanResult, plan } from "../src/index.js";
import {
  actors,
  baseState,
  intent,
  setActor,
  tgt,
  view,
  withCombatant,
  zone,
} from "./fixtures.js";

const run = (i: ReturnType<typeof intent>, s = baseState()) =>
  plan(s, view(s), i);
const cmds = (r: PlanResult) => {
  expect(r.kind).toBe("commands");
  return r.kind === "commands" ? r : (undefined as never);
};
const HOUSE = { outcomeBands: false, naturals: false };

describe("check and save", () => {
  it("plans one check.roll with the tier from an npc actor", () => {
    const r = cmds(
      run(
        intent("check", {
          actor: actors.npc,
          params: { skill: "stealth", difficulty: "hard" },
        }),
      ),
    );
    expect(r.commands).toEqual([
      {
        command: {
          type: "check.roll",
          combatantId: "goblin-2",
          kind: "ability-check",
          ability: "dex",
          skill: "stealth",
          mode: "normal",
          difficulty: "hard",
          autoFail: null,
          houseRules: HOUSE,
          reason: expect.stringContaining("/as @goblin-2"),
        },
      },
    ]);
    expect(r.facts).toEqual([
      { kind: "dc", source: "difficulty", difficulty: "hard" },
    ]);
  });

  it("an npc dc plans a dc source", () => {
    const r = cmds(
      run(
        intent("save", {
          actor: actors.npc,
          params: { ability: "dex", dc: 13 },
        }),
      ),
    );
    expect(r.commands[0]?.command).toMatchObject({
      kind: "saving-throw",
      ability: "dex",
      dc: 13,
    });
  });

  it("carries the mode, the table rules and the SRD default ability", () => {
    const s = baseState({ tableRules: { outcomeBands: true, naturals: true } });
    const r = cmds(
      run(
        intent("check", {
          actor: actors.npc,
          params: { skill: "athletics", mode: "advantage", dc: 12 },
        }),
        s,
      ),
    );
    expect(r.commands[0]?.command).toMatchObject({
      ability: "str",
      skill: "athletics",
      mode: "advantage",
      houseRules: { outcomeBands: true, naturals: true },
    });
  });

  it("asks for a difficulty when no DC exists", () => {
    const i = intent("check", { params: { skill: "athletics" } });
    const r = run(i);
    expect(r.kind).toBe("needs_ruling");
    if (r.kind !== "needs_ruling") return;
    expect(r.request).toMatchObject({
      requestId: i.id,
      ask: "difficulty",
      roll: {
        kind: "ability-check",
        combatantId: "thorin",
        ability: "str",
        skill: "athletics",
        mode: "normal",
      },
      opposition: null,
      stakes: "self",
    });
  });

  it("ignores a player-written dc and difficulty (fact ignored) and asks", () => {
    for (const [field, params] of [
      ["dc", { skill: "athletics", dc: 5 }],
      ["difficulty", { skill: "athletics", difficulty: "very-easy" }],
    ] as const) {
      const r = run(intent("check", { params }));
      expect(r.kind).toBe("needs_ruling");
      expect(r.facts).toContainEqual({
        kind: "ignored",
        field,
        why: "player-seat",
      });
    }
    const c = run(
      intent("check", {
        actor: actors.companion,
        params: { skill: "perception", dc: 5 },
      }),
    );
    expect(c.kind).toBe("needs_ruling");
    expect(c.facts[0]).toMatchObject({ kind: "ignored", field: "dc" });
  });

  it("an npc check with neither field asks too", () => {
    const r = run(
      intent("check", { actor: actors.npc, params: { ability: "str" } }),
    );
    expect(r.kind).toBe("needs_ruling");
  });

  it("a check on an actor target is stakes other and pulls in a new npc", () => {
    const r = run(
      intent("check", {
        targets: [tgt("orc-1")],
        params: { ability: "str" },
      }),
    );
    expect(r.kind).toBe("needs_ruling");
    if (r.kind === "needs_ruling") expect(r.request.stakes).toBe("other");
    expect(r.facts).toContainEqual({ kind: "pull-in", actorId: "orc-1" });
  });

  it("refuses STAT_UNDEFINED (engine) when the modifier cannot be derived", () => {
    const s = withCombatant(baseState(), "thorin", { stats: undefined });
    const r = run(intent("check", { params: { ability: "str" } }), s);
    expect(r.kind).toBe("refusal");
    if (r.kind === "refusal") {
      expect([r.refusal.source, r.refusal.code]).toEqual([
        "engine",
        "STAT_UNDEFINED",
      ]);
    }
  });
});

describe("contest", () => {
  it("plans an influence roll against the opponent", () => {
    const r = cmds(
      run(
        intent("contest", {
          actor: actors.kestrel,
          targets: [tgt("goblin-2")],
          params: { skill: "intimidation" },
        }),
      ),
    );
    expect(r.commands[0]?.command).toMatchObject({
      type: "check.roll",
      combatantId: "kestrel",
      skill: "intimidation",
      opposition: { opponentId: "goblin-2", rule: "influence" },
    });
    expect(r.facts).toContainEqual({
      kind: "dc",
      source: "opposition",
      opposition: { opponentId: "goblin-2", rule: "influence" },
    });
  });

  it("plans an unarmed-strike roll for a Strength (Athletics) contest", () => {
    const r = cmds(
      run(
        intent("contest", {
          targets: [tgt("goblin-2")],
          params: { skill: "athletics" },
        }),
      ),
    );
    expect(r.commands[0]?.command).toMatchObject({
      opposition: { opponentId: "goblin-2", rule: "unarmed-strike" },
    });
  });

  it("asks for a difficulty with no rules when no engine rule covers the check", () => {
    const i = intent("contest", {
      targets: [tgt("goblin-2")],
      params: { skill: "stealth" },
    });
    const r = run(i);
    expect(r.kind).toBe("needs_ruling");
    if (r.kind !== "needs_ruling") return;
    expect(r.request.opposition).toEqual({
      opponentId: "goblin-2",
      rules: [],
    });
    expect(r.request.stakes).toBe("other");
  });

  it("an unseen opponent is refused TARGET_UNSEEN", () => {
    const s = baseState();
    setActor(s, "goblin-2", { seen: false });
    const r = run(
      intent("contest", {
        targets: [tgt("goblin-2")],
        params: { skill: "athletics" },
      }),
      s,
    );
    expect(r.kind === "refusal" && r.refusal.code).toBe("TARGET_UNSEEN");
  });
});

describe("search and hide", () => {
  it("search asks for a difficulty with the Perception roll and the rule", () => {
    const r = run(intent("search", { targets: [zone("b")] }));
    expect(r.kind).toBe("needs_ruling");
    if (r.kind !== "needs_ruling") return;
    expect(r.request).toMatchObject({
      ask: "difficulty",
      roll: { ability: "wis", skill: "perception" },
      rule: "rules-glossary.search-action",
    });
  });

  it("search with investigation rolls Intelligence", () => {
    const r = run(intent("search", { params: { skill: "investigation" } }));
    expect(r.kind === "needs_ruling" && r.request.roll).toMatchObject({
      ability: "int",
      skill: "investigation",
    });
  });

  it("hide rolls Stealth at medium with a rule fact and an unserved fact", () => {
    const r = cmds(run(intent("hide", { actor: actors.kestrel })));
    expect(r.commands[0]?.command).toMatchObject({
      type: "check.roll",
      combatantId: "kestrel",
      ability: "dex",
      skill: "stealth",
      difficulty: "medium",
    });
    expect(r.facts).toContainEqual({
      kind: "unserved",
      part: "hidden-state",
      owner: "TASK-0271",
    });
    expect(r.facts.some((f) => f.kind === "rule")).toBe(true);
  });
});
