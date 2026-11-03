import { describe, expect, it } from "vitest";
import {
  arrivingNpcs,
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
) =>
  checkPlan({
    snapshot,
    readings,
    rulings: [],
    joining: [],
    arriving: [],
    resumed: [],
    ...extra,
  });

const pellAlias = snapshot.actors
  .find((a) => a.id === "pell")
  ?.aliases.find((x) => x !== "pell") as string;

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

  it("passes a damage effect on a seed NPC with no combatant, pulling it (spec 075)", () => {
    const v = plan([
      read("a1", [
        {
          step: "effect",
          reason: "Fire burns Pell",
          effects: [damageOn("pell")],
        },
      ]),
    ]);
    expect(v).toEqual([{ actionId: "a1", ok: true, pull: ["pell"] }]);
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
    const second = plan([read("a1", [checkStep(), attackStep(pellAlias)])]);
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
    const bad = read("a1", [attackStep("ghoul-9")]);
    const v = plan([bad], {
      rulings: [{ actionId: "a1", steps: steps(attackStep("goblin-2")) }],
    });
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
    const v2 = plan([read("a1", [attackStep("goblin-2")])], {
      rulings: [{ actionId: "a1", steps: steps(attackStep("ghoul-9")) }],
    });
    expect(v2[0]?.ok).toBe(false);
  });

  it("gates the NPC group (actionId null)", () => {
    const v = plan([
      read("a1", [attackStep("goblin-2")]),
      read(null, [attackStep("ghoul-9", { attackerId: "snag" })]),
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
    checkPlan({
      snapshot: snap,
      readings,
      rulings: [],
      joining: [],
      arriving: [],
      resumed: [],
    });
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
      arriving: [],
      resumed: [],
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

  it("refuses the M2 seq 221 reason at step 0", () => {
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
      expect.objectContaining({ claim: "count" }),
    );
  });

  it("passes the control reason (the clause removed)", () => {
    expect(run(M2_SEQ221_CONTROL)).toEqual([{ actionId: null, ok: true }]);
  });
});

describe("checkPlan: reason state", () => {
  const PELL_REASON = "Pell steps out of the reeds";
  const pellAway = () => {
    const f = greyhollowFight();
    f.projections.scenePresence.pell = {
      presence: "absent",
      reason: "removed",
      seq: 125,
    };
    return buildSnapshot(f.projections, f.seed);
  };
  const pellStep = (over: Record<string, unknown> = {}) => ({
    step: "effect",
    reason: PELL_REASON,
    effects: [],
    ...over,
  });
  const arrivedEffect = {
    effect: "presence",
    targetId: "pell",
    reason: "arrived",
  };
  const run = (
    readings: InterpretReading[],
    extra: Partial<Parameters<typeof checkPlan>[0]> = {},
  ) =>
    checkPlan({
      snapshot: pellAway(),
      readings,
      rulings: [],
      joining: [],
      arriving: [],
      resumed: [],
      ...extra,
    });

  it("passes an arrived presence effect with the arrival reason", () => {
    const v = run([read("a1", [pellStep({ effects: [arrivedEffect] })])]);
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
  });

  it("refuses the same reason with no presence effect (act)", () => {
    const v = run([read("a1", [pellStep()])]);
    expect(v[0]).toMatchObject({
      actionId: "a1",
      ok: false,
      code: "REASON_CONTRADICTS_STATE",
      failure: { stepIndex: 0, field: "reason", text: PELL_REASON },
    });
    const failure = (v[0] as unknown as { failure: { issues: unknown[] } })
      .failure;
    expect(failure.issues).toContainEqual(
      expect.objectContaining({ claim: "act" }),
    );
  });

  it("exempts an arriving NPC from the act rule", () => {
    const v = run([read("a1", [pellStep()])], { arriving: ["pell"] });
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
  });

  it("skips the reason check for a resumed action id", () => {
    const v = run([read("a1", [pellStep()])], { resumed: ["a1"] });
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
  });

  it("still runs the id check for a resumed action id", () => {
    const f = greyhollowFight();
    f.projections.scenePresence["goblin-3"] = {
      presence: "absent",
      reason: "removed",
      seq: 125,
    };
    const v = checkPlan({
      snapshot: buildSnapshot(f.projections, f.seed),
      readings: [read("a1", [attackStep("goblin-3")])],
      rulings: [],
      joining: [],
      arriving: [],
      resumed: ["a1"],
    });
    expect(v[0]).toMatchObject({
      ok: false,
      code: "UNKNOWN_COMBATANT",
      failure: { field: "targetId", id: "goblin-3", reason: "absent" },
    });
  });

  it("checks a check step's autoFail.reason", () => {
    const v = run([
      read("a1", [checkStep({ autoFail: { reason: PELL_REASON } })]),
    ]);
    expect(v[0]).toMatchObject({
      ok: false,
      code: "REASON_CONTRADICTS_STATE",
      failure: { stepIndex: 0, field: "autoFail.reason", text: PELL_REASON },
    });
  });

  it("checks a condition effect's source (OQ-3)", () => {
    const v = run([
      read("a1", [
        attackStep("goblin-2", {
          onHit: [
            {
              effect: "condition",
              targetId: "goblin-2",
              op: "apply",
              condition: "prone",
              source: PELL_REASON,
            },
          ],
        }),
      ]),
    ]);
    expect(v[0]).toMatchObject({
      ok: false,
      code: "REASON_CONTRADICTS_STATE",
      failure: { field: "onHit[0].source", text: PELL_REASON },
    });
  });

  it("replaces a reading's steps with its ruling's steps", () => {
    const v = run([read("a1", [pellStep()])], {
      rulings: [{ actionId: "a1", steps: steps(attackStep("goblin-2")) }],
    });
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
  });

  it("does not check a clarify reading", () => {
    const v = run([read("a1", [pellStep()], { clarify: "Which one?" })]);
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
  });

  it("lets an id failure win over a reason failure in the same group", () => {
    const v = run([read("a1", [pellStep(), attackStep("nobody")])]);
    expect(v[0]).toMatchObject({ ok: false, code: "UNKNOWN_COMBATANT" });
  });

  it("reports only the first refused text", () => {
    const v = run([
      read("a1", [
        pellStep({ reason: "Tamsin swings her sword" }),
        pellStep(),
        pellStep({ reason: "Pell lunges at Odo" }),
      ]),
    ]);
    expect(v[0]).toMatchObject({
      ok: false,
      failure: { stepIndex: 1, text: PELL_REASON },
    });
  });

  it("never rewrites a passing reading", () => {
    const r = read("a1", [pellStep({ effects: [arrivedEffect] })]);
    const before = structuredClone(r);
    const v = run([r]);
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
    expect(r).toEqual(before);
  });
});

describe("arrivingNpcs", () => {
  const enc = encounterToStart(
    seed,
    {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "x" },
    } as never,
    "player-action",
  );
  const beat = seed.beats.find((b) => b.encounterId === enc?.id);
  const declared = Object.entries(beat?.presence ?? {})
    .filter(([, v]) => v === "present")
    .map(([id]) => id);

  it("lists the NPCs the encounter beat declares present and not logged present", () => {
    expect(declared.length).toBeGreaterThan(0);
    const logged = Object.fromEntries(
      declared.map((id) => [
        id,
        { presence: "absent", reason: "removed", seq: 1 },
      ]),
    ) as never;
    expect(arrivingNpcs(seed, enc, logged).sort()).toEqual(
      [...declared].sort(),
    );
  });

  it("omits an NPC with no logged presence (it defaults to present)", () => {
    expect(arrivingNpcs(seed, enc, {})).toEqual([]);
  });

  it("omits an NPC whose logged presence is already present", () => {
    const first = declared[0] as string;
    const logged = {
      [first]: { presence: "present", reason: "arrived", seq: 1 },
    } as never;
    expect(arrivingNpcs(seed, enc, logged)).not.toContain(first);
  });

  it("lists an NPC logged absent", () => {
    const first = declared[0] as string;
    const logged = {
      [first]: { presence: "absent", reason: "removed", seq: 1 },
    } as never;
    expect(arrivingNpcs(seed, enc, logged)).toContain(first);
  });

  it("returns [] with no encounter", () => {
    expect(arrivingNpcs(seed, undefined, {})).toEqual([]);
  });
});

describe("checkPlan: non-combatant NPC pull (specs 068, 075)", () => {
  const condOn = (targetId: string) => ({
    effect: "condition",
    op: "remove",
    targetId,
    condition: "restrained",
    source: "cut free",
  });
  const healOn = (targetId: string) => ({
    effect: "heal",
    targetId,
    amount: { kind: "roll", expression: "1d4" },
  });
  const presenceOn = (targetId: string) => ({
    effect: "presence",
    targetId,
    reason: "fled",
  });

  it("passes a check combatantId, a condition effect and a heal effect on pell", () => {
    for (const step of [
      checkStep({ combatantId: "pell" }),
      checkStep({ onSuccess: [condOn("pell")] }),
      checkStep({ onFailure: [healOn("pell")] }),
    ]) {
      expect(plan([read("a1", [step])])).toEqual([
        { actionId: "a1", ok: true, pull: ["pell"] },
      ]);
    }
  });

  it("passes attack ids and damage effects on pell (spec 075)", () => {
    for (const step of [
      attackStep("pell"),
      attackStep("goblin-2", { attackerId: "pell" }),
      checkStep({ onSuccess: [damageOn("pell")] }),
    ]) {
      expect(plan([read("a1", [step])])).toEqual([
        { actionId: "a1", ok: true, pull: ["pell"] },
      ]);
    }
  });

  it("refuses pell's alias as an attack targetId", () => {
    expect(plan([read("a1", [attackStep(pellAlias)])])[0]).toMatchObject({
      ok: false,
      failure: { field: "targetId", reason: "not-a-combatant" },
    });
  });

  it("refuses an absent pell as an attack targetId", () => {
    const f = greyhollowFight();
    f.projections.scenePresence.pell = {
      presence: "absent",
      reason: "fled",
      seq: 125,
    };
    const v = checkPlan({
      snapshot: buildSnapshot(f.projections, f.seed),
      readings: [read("a1", [attackStep("pell")])],
      rulings: [],
      joining: [],
      arriving: [],
      resumed: [],
    });
    expect(v[0]).toMatchObject({
      ok: false,
      failure: { field: "targetId", id: "pell", reason: "absent" },
    });
  });

  it("refuses an alias of pell", () => {
    const alias = snapshot.actors
      .find((a) => a.id === "pell")
      ?.aliases.find((x) => x !== "pell");
    expect(alias).toBeDefined();
    const v = plan([
      read("a1", [checkStep({ onSuccess: [condOn(alias as string)] })]),
    ]);
    expect(v[0]).toMatchObject({
      ok: false,
      failure: { reason: "not-a-combatant" },
    });
  });

  it("refuses an absent pell as absent", () => {
    const f = greyhollowFight();
    f.projections.scenePresence.pell = {
      presence: "absent",
      reason: "fled",
      seq: 125,
    };
    const v = checkPlan({
      snapshot: buildSnapshot(f.projections, f.seed),
      readings: [read("a1", [checkStep({ combatantId: "pell" })])],
      rulings: [],
      joining: [],
      arriving: [],
      resumed: [],
    });
    expect(v[0]).toMatchObject({ ok: false, failure: { reason: "absent" } });
  });

  it("pulls a combatant outside the order; skips in-order and joining ids", () => {
    const order = new Set(snapshot.stage.encounter?.order ?? []);
    const out = snapshot.actors.find(
      (a) => a.combatantId && !order.has(a.id) && !order.has(a.combatantId),
    );
    const inside = snapshot.actors.find(
      (a) => a.combatantId && order.has(a.id),
    );
    expect(out).toBeDefined();
    expect(inside).toBeDefined();
    const v = plan([
      read("a1", [
        checkStep({
          combatantId: inside?.id,
          onSuccess: [condOn(out?.id as string)],
        }),
      ]),
    ]);
    expect(v).toEqual([{ actionId: "a1", ok: true, pull: [out?.id] }]);
    const j = plan([read("a1", [checkStep({ combatantId: "goblin-9" })])], {
      joining: ["goblin-9"],
    });
    expect(j).toEqual([{ actionId: "a1", ok: true }]);
  });

  it("does not pull a presence-effect target and dedupes in step order", () => {
    const p = plan([
      read("a1", [checkStep({ onSuccess: [presenceOn("pell")] })]),
    ]);
    expect(p).toEqual([{ actionId: "a1", ok: true }]);
    const d = plan([
      read("a1", [
        checkStep({ combatantId: "pell", onSuccess: [condOn("pell")] }),
        checkStep({ combatantId: "pell" }),
      ]),
    ]);
    expect(d).toEqual([{ actionId: "a1", ok: true, pull: ["pell"] }]);
  });
});
