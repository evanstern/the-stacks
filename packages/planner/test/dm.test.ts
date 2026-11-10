import { describe, expect, it } from "vitest";
import { type PlanResult, plan } from "../src/index.js";
import {
  actors,
  baseState,
  inEncounter,
  intent,
  placeAt,
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
const refusal = (r: PlanResult) => {
  expect(r.kind).toBe("refusal");
  return r.kind === "refusal" ? r.refusal : (undefined as never);
};
const as = (actor: unknown, kind: string, over: Record<string, unknown> = {}) =>
  intent(kind, { actor, ...over });

describe("apply_damage, apply_heal, apply_condition", () => {
  it("apply_damage plans one damage.apply per target from the dm seat", () => {
    const r = cmds(
      run(
        as(actors.dm, "apply_damage", {
          targets: [tgt("goblin-2"), tgt("snag")],
          params: {
            amount: { kind: "roll", expression: "1d6" },
            damageType: "fire",
            critical: true,
          },
        }),
      ),
    );
    expect(r.commands.map((c) => c.command)).toEqual([
      {
        type: "damage.apply",
        targetId: "goblin-2",
        components: [
          { amount: { kind: "roll", expression: "1d6" }, damageType: "fire" },
        ],
        critical: true,
        defenses: null,
        reason: expect.any(String),
      },
      expect.objectContaining({ targetId: "snag" }),
    ]);
  });

  it("the ai:dm may damage a hostile but not a party actor", () => {
    const dmg = (id: string) =>
      as(actors.aiDm, "apply_damage", {
        targets: [tgt(id)],
        params: {
          amount: { kind: "roll", expression: "1d6" },
          damageType: "fire",
        },
      });
    expect(run(dmg("goblin-2")).kind).toBe("commands");
    const f = refusal(run(dmg("thorin")));
    expect([f.source, f.code]).toEqual(["planner", "DM_SEAT_REQUIRED"]);
  });

  it("apply_heal plans healing.apply, or temp-hp.grant with temp", () => {
    const heal = (temp: boolean) =>
      as(actors.dm, "apply_heal", {
        targets: [tgt("thorin")],
        params: { amount: { kind: "roll", expression: "1d4" }, temp },
      });
    expect(cmds(run(heal(false))).commands[0]?.command).toMatchObject({
      type: "healing.apply",
      targetId: "thorin",
    });
    expect(cmds(run(heal(true))).commands[0]?.command).toMatchObject({
      type: "temp-hp.grant",
    });
  });

  it("apply_condition add and remove", () => {
    const cond = (op: string, actor: unknown = actors.dm) =>
      as(actor, "apply_condition", {
        targets: [tgt("goblin-2")],
        params: { op, condition: "frightened" },
      });
    expect(cmds(run(cond("add"))).commands[0]?.command).toMatchObject({
      type: "condition.apply",
      targetId: "goblin-2",
      condition: "frightened",
      expiresAt: null,
    });
    expect(cmds(run(cond("remove"))).commands[0]?.command).toMatchObject({
      type: "condition.remove",
    });
  });

  it("apply_condition with until carries the expiry", () => {
    const r = cmds(
      run(
        as(actors.dm, "apply_condition", {
          targets: [tgt("goblin-2")],
          params: {
            op: "add",
            condition: "poisoned",
            until: { round: 3, actor: "thorin", boundary: "turn-end" },
          },
        }),
      ),
    );
    expect(r.commands[0]?.command).toMatchObject({
      expiresAt: { round: 3, combatantId: "thorin", boundary: "turn-end" },
    });
  });

  it("exhaustion plans exhaustion.adjust by one", () => {
    const ex = (op: string) =>
      as(actors.dm, "apply_condition", {
        targets: [tgt("goblin-2")],
        params: { op, condition: "exhaustion" },
      });
    expect(cmds(run(ex("add"))).commands[0]?.command).toMatchObject({
      type: "exhaustion.adjust",
      delta: 1,
    });
    expect(cmds(run(ex("remove"))).commands[0]?.command).toMatchObject({
      delta: -1,
    });
  });

  it("the ai:dm may remove a condition from a party actor but not add one", () => {
    const cond = (op: string) =>
      as(actors.aiDm, "apply_condition", {
        targets: [tgt("kestrel")],
        params: { op, condition: "frightened" },
      });
    expect(refusal(run(cond("add"))).code).toBe("DM_SEAT_REQUIRED");
    expect(run(cond("remove")).kind).toBe("commands");
  });

  it("the dm seat is never refused on a party actor", () => {
    const r = run(
      as(actors.dm, "apply_condition", {
        targets: [tgt("kestrel")],
        params: { op: "add", condition: "frightened" },
      }),
    );
    expect(r.kind).toBe("commands");
  });

  it("an unseen or absent target is refused", () => {
    const s = setActor(baseState(), "goblin-2", { seen: false });
    const f = refusal(
      run(
        as(actors.dm, "apply_damage", {
          targets: [tgt("goblin-2")],
          params: {
            amount: { kind: "roll", expression: "1d4" },
            damageType: "fire",
          },
        }),
        s,
      ),
    );
    expect(f.code).toBe("TARGET_UNSEEN");
  });
});

describe("start_combat and end_combat", () => {
  it("start_combat with targets rolls initiative for them", () => {
    const r = cmds(
      run(
        as(actors.dm, "start_combat", {
          targets: [tgt("thorin"), tgt("goblin-2")],
        }),
      ),
    );
    expect(r.commands[0]?.command).toEqual({
      type: "initiative.roll",
      participants: [
        { combatantId: "thorin", mode: "normal" },
        { combatantId: "goblin-2", mode: "normal" },
      ],
      reason: expect.any(String),
    });
  });

  it("start_combat with no targets rolls for every present party and hostile combatant", () => {
    const s = setActor(baseState(), "snag", { presence: "absent" });
    const r = cmds(run(as(actors.dm, "start_combat"), s));
    const cmd = r.commands[0]?.command as {
      participants: { combatantId: string }[];
    };
    expect(cmd.participants.map((p) => p.combatantId)).toEqual([
      "goblin-2",
      "kestrel",
      "mira",
      "thorin",
    ]);
  });

  it("end_combat plans encounter.end from the dm seat", () => {
    expect(
      cmds(run(as(actors.dm, "end_combat"), baseState())).commands[0]?.command,
    ).toMatchObject({ type: "encounter.end" });
  });

  it("the ai:dm cannot end combat while hostiles stand, and can once they yield", () => {
    const s = baseState();
    expect(refusal(run(as(actors.aiDm, "end_combat"), s)).code).toBe(
      "DM_SEAT_REQUIRED",
    );
    setActor(s, "goblin-2", { presence: "yielded" });
    setActor(s, "snag", { presence: "yielded" });
    expect(run(as(actors.aiDm, "end_combat"), s).kind).toBe("commands");
    const dead = withCombatant(
      withCombatant(baseState(), "goblin-2", {
        lifeState: "dead",
        hp: { current: 0, max: 7, temp: 0 },
      }),
      "snag",
      { lifeState: "dead", hp: { current: 0, max: 7, temp: 0 } },
    );
    expect(run(as(actors.aiDm, "end_combat"), dead).kind).toBe("commands");
  });
});

describe("add_combatant and move_token", () => {
  it("adds count combatants with the first free ids, placed, and joined in an encounter", () => {
    const s = inEncounter(baseState(), ["thorin", "goblin-2"]);
    placeAt(s, "goblin-2", "a");
    s.engine.combatants["orc-1-1"] = structuredClone(
      s.engine.combatants["goblin-2"],
    ) as never;
    const r = cmds(
      run(
        as(actors.dm, "add_combatant", {
          targets: [zone("b")],
          params: { from: "orc-1", count: 2 },
        }),
        s,
      ),
    );
    expect(r.commands.map((c) => c.command.type)).toEqual([
      "combatant.add",
      "combatant.place",
      "initiative.join",
      "combatant.add",
      "combatant.place",
      "initiative.join",
    ]);
    const ids = r.commands
      .filter((c) => c.command.type === "combatant.add")
      .map((c) => (c.command as { combatant: { id: string } }).combatant.id);
    expect(ids).toEqual(["orc-1-2", "orc-1-3"]);
  });

  it("add_combatant with no zone and no encounter plans combatant.add only", () => {
    const r = cmds(
      run(as(actors.dm, "add_combatant", { params: { from: "orc-1" } })),
    );
    expect(r.commands.map((c) => c.command.type)).toEqual(["combatant.add"]);
  });

  it("refuses an unknown from", () => {
    expect(
      refusal(
        run(as(actors.dm, "add_combatant", { params: { from: "dragon" } })),
      ).code,
    ).toBe("TARGET_NOT_PRESENT");
  });

  it("move_token to a zone plans combatant.place; squares are unserved", () => {
    const r = cmds(
      run(
        as(actors.dm, "move_token", { targets: [tgt("goblin-2"), zone("c")] }),
      ),
    );
    expect(r.commands[0]?.command).toEqual({
      type: "combatant.place",
      combatantId: "goblin-2",
      zoneId: "c",
      reason: expect.any(String),
    });
    expect(
      refusal(
        run(
          as(actors.dm, "move_token", {
            targets: [tgt("goblin-2"), { kind: "square", x: 1, y: 1 }],
          }),
        ),
      ).code,
    ).toBe("KIND_UNSERVED");
  });

  it("the ai:dm may not move a party token", () => {
    const f = refusal(
      run(
        as(actors.aiDm, "move_token", { targets: [tgt("kestrel"), zone("c")] }),
      ),
    );
    expect(f.code).toBe("DM_SEAT_REQUIRED");
  });
});
