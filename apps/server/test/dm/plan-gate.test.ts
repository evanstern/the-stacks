import { describe, expect, it } from "vitest";
import {
  checkPlan,
  encounterToStart,
  joiningCombatants,
} from "../../src/dm/gates/plan-gate.js";
import type { InterpretReading, Step } from "../../src/dm/nodes/schemas.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import {
  M2_SEQ221_CONTROL,
  M2_SEQ221_REASON,
  M2_SEQ221_S0,
  m2Seq221Reading,
} from "./plan-reason-fixtures.js";
import { greyhollowFight } from "./snapshot-fixtures.js";
import { attackStep, checkStep, reading } from "./world.js";

const { projections, seed } = greyhollowFight();
const snapshot = buildSnapshot(projections, seed);

const steps = (...s: unknown[]) => s as Step[];
const read = (actionId: string | null, s: unknown[], over = {}) =>
  reading(actionId, s, over) as unknown as InterpretReading;

const plan = (
  readings: InterpretReading[],
  extra: Partial<Parameters<typeof checkPlan>[0]> = {},
) => checkPlan({ snapshot, readings, rulings: [], joining: [], ...extra });

const damageOn = (targetId: string) => ({
  effect: "damage",
  targetId,
  components: [
    { amount: { kind: "roll", expression: "1d4" }, damageType: "fire" },
  ],
  defenses: null,
});

describe("checkPlan", () => {
  it("accepts a plan whose ids are all S0 combatants", () => {
    const v = plan([read("a1", [attackStep("goblin-2")])]);
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
  });

  it("refuses an effect on a seed NPC with no combatant as not-a-combatant", () => {
    const v = plan([
      read("a1", [
        {
          step: "effect",
          reason: "Fire burns Pell",
          effects: [damageOn("pell")],
        },
      ]),
    ]);
    expect(v).toEqual([
      {
        actionId: "a1",
        ok: false,
        code: "UNKNOWN_COMBATANT",
        failure: {
          stepIndex: 0,
          field: "effects[0].targetId",
          id: "pell",
          reason: "not-a-combatant",
        },
      },
    ]);
  });

  it("refuses an unknown id as not-in-snapshot", () => {
    const v = plan([read("a1", [attackStep("ghoul-9")])]);
    expect(v[0]).toMatchObject({
      ok: false,
      failure: {
        field: "targetId",
        id: "ghoul-9",
        reason: "not-in-snapshot",
      },
    });
  });

  it("does not map an alias to its combatant", () => {
    const goblinAlias = snapshot.actors
      .find((a) => a.id === "goblin-2")
      ?.aliases.find((x) => x !== "goblin-2");
    expect(goblinAlias).toBeDefined();
    const v = plan([read("a1", [attackStep(goblinAlias as string)])]);
    expect(v[0]?.ok).toBe(false);
  });

  it("walks nested onHit, onSuccess and onFailure targets in step order", () => {
    const hit = plan([
      read("a1", [
        attackStep("goblin-2", {
          onHit: [damageOn("goblin-3"), damageOn("x")],
        }),
      ]),
    ]);
    expect(hit[0]).toMatchObject({
      failure: { stepIndex: 0, field: "onHit[1].targetId", id: "x" },
    });
    const ok = plan([
      read("a1", [
        checkStep({
          onSuccess: [damageOn("goblin-3")],
          onFailure: [damageOn("zzz")],
        }),
      ]),
    ]);
    expect(ok[0]).toMatchObject({
      failure: { field: "onFailure[0].targetId", id: "zzz" },
    });
    const second = plan([read("a1", [checkStep(), attackStep("pell")])]);
    expect(second[0]).toMatchObject({
      failure: { stepIndex: 1, reason: "not-a-combatant" },
    });
  });

  it("reports the first failure of the group only", () => {
    const v = plan([
      read("a1", [attackStep("zzz", { onHit: [damageOn("pell")] })]),
    ]);
    expect(v[0]).toMatchObject({ failure: { id: "zzz" } });
  });

  it("lets a ruling replace the reading's steps", () => {
    const bad = read("a1", [attackStep("pell")]);
    const v = plan([bad], {
      rulings: [{ actionId: "a1", steps: steps(attackStep("goblin-2")) }],
    });
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
    const v2 = plan([read("a1", [attackStep("goblin-2")])], {
      rulings: [{ actionId: "a1", steps: steps(attackStep("pell")) }],
    });
    expect(v2[0]?.ok).toBe(false);
  });

  it("gates the NPC group (actionId null)", () => {
    const v = plan([
      read("a1", [attackStep("goblin-2")]),
      read(null, [attackStep("pell", { attackerId: "snag" })]),
    ]);
    expect(v.map((x) => [x.actionId, x.ok])).toEqual([
      ["a1", true],
      [null, false],
    ]);
  });

  it("accepts the ids an encounter start adds", () => {
    const readings = [read("a1", [attackStep("goblin-9")])];
    expect(plan(readings)[0]?.ok).toBe(false);
    expect(plan(readings, { joining: ["goblin-9"] })[0]?.ok).toBe(true);
  });

  it("skips null actor ids and clarify readings", () => {
    const v = plan([
      read("a1", [checkStep({ combatantId: null })]),
      read("a2", [attackStep("pell")], { clarify: "Which one?" }),
    ]);
    expect(v.every((x) => x.ok)).toBe(true);
  });
});

describe("checkPlan: absent actors", () => {
  const away = (id: string, presence: "absent" | "yielded" = "absent") => {
    const f = greyhollowFight();
    f.projections.scenePresence[id] = {
      presence,
      reason: presence === "absent" ? "fled" : "conceded",
      seq: 125,
    };
    return buildSnapshot(f.projections, f.seed);
  };
  const run = (
    snap: typeof snapshot,
    readings: InterpretReading[],
  ): ReturnType<typeof checkPlan> =>
    checkPlan({ snapshot: snap, readings, rulings: [], joining: [] });
  const presenceOn = (targetId: string, reason: string) => ({
    effect: "presence",
    targetId,
    reason,
  });

  it("refuses an absent targetId", () => {
    const v = run(away("goblin-2"), [read("a1", [attackStep("goblin-2")])]);
    expect(v[0]).toEqual({
      actionId: "a1",
      ok: false,
      code: "UNKNOWN_COMBATANT",
      failure: {
        stepIndex: 0,
        field: "targetId",
        id: "goblin-2",
        reason: "absent",
      },
    });
  });

  it("refuses an absent attackerId", () => {
    const v = run(away("tamsin"), [read("a1", [attackStep("goblin-2")])]);
    expect(v[0]).toMatchObject({
      ok: false,
      failure: { field: "attackerId", id: "tamsin", reason: "absent" },
    });
  });

  it("refuses an absent check combatantId", () => {
    const v = run(away("tamsin"), [read("a1", [checkStep()])]);
    expect(v[0]).toMatchObject({
      ok: false,
      failure: { field: "combatantId", id: "tamsin", reason: "absent" },
    });
  });

  it("refuses an absent onHit effect target", () => {
    const v = run(away("goblin-3"), [
      read("a1", [attackStep("goblin-2", { onHit: [damageOn("goblin-3")] })]),
    ]);
    expect(v[0]).toMatchObject({
      ok: false,
      failure: { field: "onHit[0].targetId", id: "goblin-3", reason: "absent" },
    });
  });

  it("lets an arrived presence effect name an absent actor", () => {
    const v = run(away("goblin-3"), [
      read("a1", [
        {
          step: "effect",
          reason: "Goblin returns",
          effects: [presenceOn("goblin-3", "arrived")],
        },
      ]),
    ]);
    expect(v[0]).toEqual({ actionId: "a1", ok: true });
  });

  it("refuses a non-arrived presence effect on an absent actor", () => {
    const v = run(away("goblin-3"), [
      read("a1", [checkStep({ onSuccess: [presenceOn("goblin-3", "fled")] })]),
    ]);
    expect(v[0]).toMatchObject({
      ok: false,
      failure: {
        field: "onSuccess[0].targetId",
        id: "goblin-3",
        reason: "absent",
      },
    });
  });

  it("passes a yielded target", () => {
    const v = run(away("goblin-2", "yielded"), [
      read("a1", [attackStep("goblin-2")]),
    ]);
    expect(v[0]).toEqual({ actionId: "a1", ok: true });
  });

  it("passes a presence effect on a seed NPC with no combatant", () => {
    const v = run(snapshot, [
      read("a1", [checkStep({ onSuccess: [presenceOn("pell", "fled")] })]),
    ]);
    expect(v[0]).toEqual({ actionId: "a1", ok: true });
  });

  it("still reports an unknown id as not-in-snapshot", () => {
    const v = run(away("goblin-2"), [read("a1", [attackStep("ghoul-9")])]);
    expect(v[0]).toMatchObject({
      failure: { id: "ghoul-9", reason: "not-in-snapshot" },
    });
    const p = run(snapshot, [
      read("a1", [checkStep({ onSuccess: [presenceOn("ghoul-9", "fled")] })]),
    ]);
    expect(p[0]).toMatchObject({ failure: { reason: "not-in-snapshot" } });
  });
});

describe("joiningCombatants", () => {
  it("lists the encounter's monsters missing from the engine", () => {
    const enc = encounterToStart(
      seed,
      {
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "x" },
      } as never,
      "player-action",
    );
    expect(enc?.id).toBe("reed-camp");
    const ids = enc?.monsters.map((m) => m.combatantId) ?? [];
    expect(joiningCombatants(enc, {})).toEqual(ids);
    expect(joiningCombatants(enc, { [ids[0] as string]: {} })).toEqual(
      ids.slice(1),
    );
    expect(joiningCombatants(undefined, {})).toEqual([]);
  });

  it("starts no encounter on a scene start or a free decision", () => {
    const turn = {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "x" },
    } as never;
    expect(encounterToStart(seed, turn, "scene-start")).toBeUndefined();
    expect(
      encounterToStart(
        seed,
        { tableMode: { to: "free", reason: "x" } } as never,
        "player-action",
      ),
    ).toBeUndefined();
  });
});

describe("checkPlan: roll reasons", () => {
  const run = (reason: string) =>
    checkPlan({
      snapshot: M2_SEQ221_S0,
      readings: [m2Seq221Reading(reason)],
      rulings: [],
      joining: [],
    });

  it("M2 seq 221 state: goblin-3 dead, goblin-2 and snag up, no party actor down", () => {
    const actor = (id: string) =>
      M2_SEQ221_S0.actors.find((a) => a.id === id || a.combatantId === id);
    const stateOf = (id: string) => actor(id)?.lifeState ?? null;
    expect(stateOf("goblin-3")).toBe("dead");
    for (const id of ["goblin-2", "snag"]) {
      expect(actor(id)).toBeDefined();
      expect(["dead", "unconscious", "stable"]).not.toContain(stateOf(id));
    }
    const down = M2_SEQ221_S0.actors.filter(
      (a) =>
        a.kind === "party" &&
        a.lifeState !== null &&
        a.lifeState !== "conscious",
    );
    expect(down).toEqual([]);
  });

  it.fails("refuses the M2 seq 221 reason at step 0", () => {
    const v = run(M2_SEQ221_REASON);
    expect(v[0]).toMatchObject({
      actionId: null,
      ok: false,
      failure: { stepIndex: 0, field: "reason" },
    });
    const failure = (v[0] as unknown as { failure: { issues: unknown[] } })
      .failure;
    expect(JSON.stringify(failure.issues)).toContain("two kin have fallen");
    expect(failure.issues).toContainEqual(
      expect.objectContaining({ kind: "count" }),
    );
  });

  it("passes the control reason (the clause removed)", () => {
    expect(run(M2_SEQ221_CONTROL)).toEqual([{ actionId: null, ok: true }]);
  });
});
