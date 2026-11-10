import { describe, expect, it } from "vitest";
import { type PlanResult, plan } from "../src/index.js";
import {
  baseState,
  inEncounter,
  intent,
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
const go = (to: string, over: Record<string, unknown> = {}) =>
  intent("move", { targets: [zone(to)], ...over });

/** Thorin and goblin-2 share zone a; Thorin is active. */
const setMovement = (
  s: ReturnType<typeof baseState>,
  m: { usedFt: number; disengaged: boolean },
) => {
  const enc = s.engine.encounter;
  if (enc) {
    enc.movement = { combatantId: "thorin", round: 1, dashes: 0, ...m };
  }
};
const fight = () => inEncounter(baseState(), ["thorin", "goblin-2", "kestrel"]);

describe("move", () => {
  it("a free-mode move with no encounter plans the move alone", () => {
    const r = cmds(run(go("b")));
    expect(r.commands).toEqual([
      {
        command: {
          type: "move",
          combatantId: "thorin",
          toZoneId: "b",
          reason: expect.any(String),
        },
      },
    ]);
  });

  it("leaving a hostile's zone plans its reaction attack and guarded damage first", () => {
    const r = cmds(run(go("b"), fight()));
    expect(r.commands.map((c) => c.command.type)).toEqual([
      "attack.roll",
      "damage.apply",
      "damage.apply",
      "move",
    ]);
    expect(r.commands[0]?.command).toMatchObject({
      attackerId: "goblin-2",
      targetId: "thorin",
      attack: "Scimitar",
      reaction: true,
    });
    expect(r.commands[1]).toMatchObject({
      command: { targetId: "thorin", critical: false },
      when: { step: 0, outcomes: ["hit"] },
    });
    expect(r.commands[2]).toMatchObject({
      command: { critical: true },
      when: { step: 0, outcomes: ["critical-hit"] },
    });
    expect(r.facts).toContainEqual({
      kind: "reaction",
      reactorId: "goblin-2",
      trigger: "leaves-zone",
    });
  });

  it("a disengaged mover provokes nothing", () => {
    const s = fight();
    setMovement(s, { usedFt: 0, disengaged: true });
    expect(cmds(run(go("b"), s)).commands).toHaveLength(1);
  });

  it("a party ally in the zone does not react", () => {
    const s = inEncounter(baseState(), ["thorin", "kestrel"]);
    expect(cmds(run(go("b"), s)).commands).toHaveLength(1);
  });

  it("a hostile mover is not reacted against by the party", () => {
    const s = inEncounter(baseState(), ["goblin-2", "thorin"]);
    const r = cmds(run(go("b", { actor: { kind: "npc", id: "goblin-2" } }), s));
    expect(r.commands).toHaveLength(1);
  });

  it("passes engine refusals through before reactions", () => {
    const blocked = baseState();
    blocked.engine.space = {
      zones: blocked.engine.space?.zones ?? [],
      edges: [{ from: "a", to: "b", kind: "blocked", feet: 30 }],
    };
    const f = refusal(run(go("b"), blocked));
    expect([f.source, f.code]).toEqual(["engine", "MOVE_BLOCKED"]);
    const over = withCombatant(fight(), "thorin", { speed: 20 });
    expect(refusal(run(go("b"), over)).code).toBe("MOVE_OVER_SPEED");
  });

  it("refuses NO_MOVEMENT_LEFT at 0 feet", () => {
    const s = fight();
    setMovement(s, { usedFt: 30, disengaged: false });
    const f = refusal(run(go("b"), s));
    expect([f.source, f.code]).toEqual(["planner", "NO_MOVEMENT_LEFT"]);
  });

  it("refuses an unplaced mover (engine NOT_PLACED)", () => {
    const s = baseState();
    delete (s.engine.combatants.thorin as { placement?: unknown }).placement;
    expect(refusal(run(go("b"), s)).code).toBe("NOT_PLACED");
  });

  it("refuses squares KIND_UNSERVED", () => {
    const f = refusal(
      run(
        intent("move", {
          targets: [
            { kind: "square", x: 1, y: 1 },
            { kind: "square", x: 1, y: 2 },
          ],
        }),
      ),
    );
    expect([f.source, f.code]).toEqual(["planner", "KIND_UNSERVED"]);
  });

  it("an unable mover is refused ACTOR_UNABLE", () => {
    const s = withCombatant(baseState(), "thorin", {
      conditions: [
        {
          instanceId: "c1",
          condition: "stunned",
          level: null,
          source: "x",
          expiresAt: null,
        },
      ],
    });
    expect(refusal(run(go("b"), s)).code).toBe("ACTOR_UNABLE");
  });
});

describe("turn actions", () => {
  it("dash and disengage plan movement.action", () => {
    for (const action of ["dash", "disengage"] as const) {
      const r = cmds(run(intent(action)));
      expect(r.commands[0]?.command).toEqual({
        type: "movement.action",
        combatantId: "thorin",
        action,
        reason: expect.any(String),
      });
    }
  });

  it("stand refuses KIND_UNSERVED naming TASK-0274 until the engine stand command lands", () => {
    expect(refusal(run(intent("stand")))).toMatchObject({
      source: "planner",
      code: "KIND_UNSERVED",
      details: { kind: "stand", owner: "TASK-0274" },
    });
  });

  it("drop_prone applies prone", () => {
    expect(cmds(run(intent("drop_prone"))).commands[0]?.command).toMatchObject({
      type: "condition.apply",
      targetId: "thorin",
      condition: "prone",
      expiresAt: null,
    });
  });

  it("end_turn plans turn.advance", () => {
    expect(cmds(run(intent("end_turn"))).commands[0]?.command).toMatchObject({
      type: "turn.advance",
    });
  });
});

describe("resources", () => {
  it("rest_short plans rest.short with its spend", () => {
    const r = cmds(
      run(
        intent("rest_short", {
          params: { spend: [{ die: 8, count: 2 }] },
        }),
      ),
    );
    expect(r.commands[0]?.command).toEqual({
      type: "rest.short",
      participants: [{ combatantId: "thorin", spend: [{ die: 8, count: 2 }] }],
      reason: expect.any(String),
    });
  });

  it("rest_long plans rest.long for the actor", () => {
    expect(cmds(run(intent("rest_long"))).commands[0]?.command).toEqual({
      type: "rest.long",
      participants: ["thorin"],
      reason: expect.any(String),
    });
  });

  it("roll_free plans roll", () => {
    expect(
      cmds(
        run(
          intent("roll_free", {
            params: { expression: "2d6+1" },
            channel: { kind: "scene" },
          }),
        ),
      ).commands[0]?.command,
    ).toMatchObject({ type: "roll", expression: "2d6+1", mode: "normal" });
  });
});
