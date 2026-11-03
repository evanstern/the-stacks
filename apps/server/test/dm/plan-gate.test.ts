import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SYSTEM_WORDS } from "../../src/dm/fallback.js";
import { cutPlans } from "../../src/dm/first-stage.js";
import {
  arrivingNpcs,
  askUndeclared,
  checkPlan,
  encounterToStart,
  joiningCombatants,
  MANNER_SKILLS,
  otherPlayerQuestion,
} from "../../src/dm/gates/plan-gate.js";
import type { Ruling } from "../../src/dm/nodes/adjudicate.js";
import type { BeatItem } from "../../src/dm/nodes/assemble.js";
import {
  InterpretOutput,
  type InterpretReading,
  type Step,
} from "../../src/dm/nodes/schemas.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import {
  M2_SEQ221_CONTROL,
  M2_SEQ221_REASON,
  M2_SEQ221_S0,
  m2Seq221Reading,
} from "./plan-reason-fixtures.js";
import {
  greyhollowDuo,
  greyhollowFight,
  PLAYER_USER,
} from "./snapshot-fixtures.js";
import { attackStep, checkStep, reading } from "./world.js";

const HERE = dirname(fileURLToPath(import.meta.url));
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
    combatants: {},
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

describe("checkPlan: STAT_UNDEFINED (spec 082 D8)", () => {
  const base = projections.engine.combatants;
  const stats = {
    abilityMods: { str: 3 },
    proficiencyBonus: 2,
    saves: {},
    skills: {},
    attacks: [
      {
        name: "Longsword",
        range: "melee" as const,
        toHit: 5,
        damage: [],
      },
    ],
    spellcastingAbility: null,
  };
  const withStats = {
    ...base,
    tamsin: { ...base.tamsin, stats },
  } as typeof base;

  it("passes a derivable attack and check", () => {
    const v = plan(
      [read("a1", [attackStep("goblin-2"), checkStep({ ability: "str" })])],
      { combatants: withStats },
    );
    expect(v).toEqual([{ actionId: "a1", ok: true }]);
  });
  it("refuses an unknown attack name", () => {
    const v = plan(
      [read("a1", [attackStep("goblin-2", { attack: "Warhammer" })])],
      {
        combatants: withStats,
      },
    );
    expect(v[0]).toMatchObject({
      ok: false,
      code: "STAT_UNDEFINED",
      failure: { field: "attack", reason: "stat-undefined" },
    });
  });
  it("refuses a combatant with no stats", () => {
    const v = plan([read("a1", [attackStep("goblin-2")])], {
      combatants: base,
    });
    expect(v[0]).toMatchObject({ ok: false, code: "STAT_UNDEFINED" });
  });
  it("refuses a missing ability modifier", () => {
    const v = plan([read("a1", [checkStep({ ability: "wis", skill: null })])], {
      combatants: withStats,
    });
    expect(v[0]).toMatchObject({ ok: false, code: "STAT_UNDEFINED" });
  });
  it("skips a joining combatant", () => {
    const v = plan([read("a1", [attackStep("goblin-2")])], {
      combatants: base,
      joining: ["tamsin"],
    });
    expect(v[0]).toMatchObject({ ok: true });
  });
  it("refuses a circumstance reason that contradicts state", () => {
    const v = plan(
      [
        read("a1", [
          attackStep("goblin-2", {
            circumstance: {
              mode: "advantage",
              reason: M2_SEQ221_REASON,
            },
          }),
        ]),
      ],
      { combatants: withStats },
    );
    expect(v[0]).toMatchObject({
      ok: false,
      code: "REASON_CONTRADICTS_STATE",
      failure: { field: "circumstance.reason" },
    });
  });
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
      combatants: {},
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

  it("passes an attack on an absent NPC that is arriving, pulling it (spec 078)", () => {
    const f = greyhollowFight();
    f.projections.scenePresence.pell = {
      presence: "absent",
      reason: "removed",
      seq: 12,
    };
    const v = checkPlan({
      combatants: {},
      snapshot: buildSnapshot(f.projections, f.seed),
      readings: [read("a1", [attackStep("pell")])] as InterpretReading[],
      rulings: [],
      joining: [],
      arriving: ["pell"],
      resumed: [],
    });
    expect(v).toEqual([{ actionId: "a1", ok: true, pull: ["pell"] }]);
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
      combatants: {},
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
      combatants: {},
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

  it("refuses a stakes text that contradicts state (spec 070)", () => {
    const v = run([
      read("a1", [
        checkStep({
          reason: "Ana studies the reeds",
          stakes: {
            success: "The attempt works as intended.",
            cost: "It works, at a small price.",
            failure: PELL_REASON,
            severe: "It goes badly wrong.",
          },
        }),
      ]),
    ]);
    expect(v[0]).toMatchObject({
      ok: false,
      code: "REASON_CONTRADICTS_STATE",
      failure: { stepIndex: 0, field: "stakes.failure", text: PELL_REASON },
    });
  });

  it("refuses an absent id in onSevere (spec 070)", () => {
    const v = run([
      read("a1", [
        checkStep({
          reason: "Ana studies the reeds",
          onSevere: [damageOn("pell")],
        }),
      ]),
    ]);
    expect(v[0]).toMatchObject({
      ok: false,
      code: "UNKNOWN_COMBATANT",
      failure: { field: "onSevere[0].targetId", id: "pell" },
    });
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
      combatants: {},
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
      combatants: {},
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
      combatants: {},
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

describe("askUndeclared (spec 077)", () => {
  const duo = greyhollowDuo();
  const s0 = buildSnapshot(duo.projections, duo.seed);
  const item = (text: string, over: Partial<BeatItem> = {}): BeatItem => ({
    actionId: "a1",
    committedSeq: 11,
    actor: PLAYER_USER,
    characterId: "tamsin",
    scope: "character",
    text,
    status: "committed",
    ...over,
  });
  const ask = (
    b: BeatItem,
    steps: unknown[],
    extra: {
      snapshot?: typeof s0;
      rulings?: Ruling[];
      resumed?: string[];
      readings?: InterpretReading[];
    } = {},
  ) => {
    const readings = extra.readings ?? [
      read("a1", steps),
      read(null, [checkStep({ combatantId: "kestrel", skill: "stealth" })]),
    ];
    const out = askUndeclared({
      snapshot: extra.snapshot ?? s0,
      beat: [b],
      readings,
      rulings: extra.rulings ?? [],
      resumed: extra.resumed ?? [],
    });
    return out;
  };
  const stealth = (who: string) =>
    checkStep({ combatantId: who, skill: "stealth", ability: "dex" });
  const REED =
    "We move toward the reed camp until we see Goblins or they see us.";
  const SNEAK = "We sneak toward the reed camp.";

  it("asks the manner question first for run 1 seq 24 (Kestrel's Stealth)", () => {
    const r = ask(item(REED), [stealth("kestrel")]);
    expect(r.readings[0]).toMatchObject({
      steps: [],
      clarify: MANNER_SKILLS[0].question,
    });
    expect(r.asked).toEqual([
      { actionId: "a1", stepIndex: 0, rule: "manner", detail: "stealth" },
    ]);
  });

  it("asks the manner question for the declarer's own Stealth", () => {
    const r = ask(item(REED), [stealth("tamsin")]);
    expect(r.readings[0]?.clarify).toBe(MANNER_SKILLS[0].question);
  });

  it("asks before rolling for another human's PC", () => {
    const r = ask(item(SNEAK), [stealth("kestrel")]);
    expect(r.readings[0]?.clarify).toBe(otherPlayerQuestion("Kestrel"));
    expect(r.asked[0]?.rule).toBe("other-player");
  });

  it("passes a stated manner for the declarer and a companion", () => {
    const r = ask(item(SNEAK), [stealth("tamsin"), stealth("odo")]);
    expect(r.readings[0]?.clarify).toBeNull();
    expect(r.asked).toEqual([]);
    expect(r.readings[0]?.clarify).toBeNull();
  });

  it("run 1 seq 114: Athletics passes, Stealth asks", () => {
    const text = "I move towards Pell";
    const ok = ask(item(text), [checkStep({ skill: "athletics" })]);
    expect(ok.asked).toEqual([]);
    const bad = ask(item(text), [stealth("tamsin")]);
    expect(bad.readings[0]?.clarify).toBe(MANNER_SKILLS[0].question);
  });

  it("skips the rule for a party-scope action", () => {
    const r = ask(item(SNEAK, { scope: "party" }), [stealth("kestrel")]);
    expect(r.asked).toEqual([]);
  });

  it("passes a saving throw for another PC", () => {
    const r = ask(item(REED), [
      checkStep({ combatantId: "kestrel", kind: "saving-throw", skill: null }),
    ]);
    expect(r.asked).toEqual([]);
  });

  it("passes heal and damage effects on another PC", () => {
    const r = ask(item(REED), [
      {
        step: "effect",
        reason: "Tamsin helps",
        effects: [
          {
            effect: "heal",
            targetId: "kestrel",
            amount: { kind: "fixed", value: 2 },
          },
          damageOn("kestrel"),
        ],
      },
    ]);
    expect(r.asked).toEqual([]);
  });

  it("asks when an attack rolls for another PC", () => {
    const r = ask(item("I strike the goblin"), [
      attackStep("goblin-1", { attackerId: "kestrel" }),
    ]);
    expect(r.readings[0]?.clarify).toBe(otherPlayerQuestion("Kestrel"));
  });

  it("skips the manner rule for a companion's action", () => {
    const r = ask(
      item(REED, { actor: "ai:companion:odo", characterId: "odo" }),
      [stealth("odo")],
    );
    expect(r.asked).toEqual([]);
  });

  it("asks on a ruling's steps and removes the ruling", () => {
    const ruling = {
      actionId: "a1",
      ruling: "x",
      improvised: true,
      citations: [],
      dropped: 0,
      steps: [stealth("tamsin")],
      followUps: [],
    } as unknown as Ruling;
    const r = ask(item(REED), [], { rulings: [ruling] });
    expect(r.rulings).toEqual([]);
    expect(r.readings[0]?.clarify).toBe(MANNER_SKILLS[0].question);
  });

  it("leaves resumed, clarify and NPC readings alone", () => {
    const resumed = ask(item(REED), [stealth("tamsin")], { resumed: ["a1"] });
    expect(resumed.asked).toEqual([]);
    const cl = [read("a1", [stealth("tamsin")], { clarify: "Which?" })];
    const c = ask(item(REED), [], { readings: cl });
    expect(c.readings[0]).toBe(cl[0]);
    expect(c.asked).toEqual([]);
    expect(c.readings).toHaveLength(1);
  });

  it("passes a second PC held by the same user", () => {
    const twin = {
      ...s0,
      actors: s0.actors.map((a) =>
        a.id === "kestrel"
          ? {
              ...a,
              controller: { kind: "player" as const, userId: PLAYER_USER },
            }
          : a,
      ),
    } as typeof s0;
    const r = ask(item(SNEAK), [stealth("kestrel")], { snapshot: twin });
    expect(r.asked).toEqual([]);
  });

  it("covers Deception and Intimidation cues", () => {
    const dec = checkStep({ skill: "deception", ability: "cha" });
    const int = checkStep({ skill: "intimidation", ability: "cha" });
    expect(ask(item("I bluff the guard"), [dec]).asked).toEqual([]);
    expect(ask(item("I talk to the guard"), [dec]).readings[0]?.clarify).toBe(
      MANNER_SKILLS[1].question,
    );
    expect(ask(item("I threaten the guard"), [int]).asked).toEqual([]);
    expect(ask(item("I talk to the guard"), [int]).readings[0]?.clarify).toBe(
      MANNER_SKILLS[2].question,
    );
  });

  it("keeps every question speakable", () => {
    const qs = [
      ...MANNER_SKILLS.map((m) => m.question),
      otherPlayerQuestion("Kestrel"),
    ];
    for (const q of qs) {
      expect(q).not.toMatch(/\d/);
      expect(q).not.toMatch(SYSTEM_WORDS);
      expect(q.match(/\?/g)).toHaveLength(1);
      expect(q.length).toBeLessThanOrEqual(200);
    }
  });
});

describe("checkPlan actor rule (spec 079 D5)", () => {
  const actors = new Map<string, string | null>([
    ["a1", "kestrel"],
    ["party", null],
  ]);
  const withActors = (readings: InterpretReading[]) =>
    plan(readings, { actors });
  const move = (combatantId: string) => ({
    step: "move",
    reason: "Kestrel runs for Pell",
    combatantId,
    leavesReachOf: ["goblin-2"],
  });

  it("refuses a foreign attacker inside a character action", () => {
    const v = withActors([
      read("a1", [attackStep("kestrel", { attackerId: "goblin-2" })]),
    ]);
    expect(v[0]).toEqual({
      actionId: "a1",
      ok: false,
      code: "STEP_ACTOR_MISMATCH",
      failure: {
        stepIndex: 0,
        field: "attackerId",
        id: "goblin-2",
        reason: "not-the-actor",
      },
    });
  });

  it("refuses a foreign mover, and passes the actor's own move", () => {
    expect(withActors([read("a1", [move("tamsin")])])[0]).toMatchObject({
      ok: false,
      code: "STEP_ACTOR_MISMATCH",
      failure: { field: "combatantId", id: "tamsin" },
    });
    expect(withActors([read("a1", [move("kestrel")])])[0]).toEqual({
      actionId: "a1",
      ok: true,
    });
  });

  it("a party-scope action may name any party member, not a monster", () => {
    expect(withActors([read("party", [move("tamsin")])])[0]).toMatchObject({
      ok: true,
    });
    expect(
      withActors([
        read("party", [attackStep("kestrel", { attackerId: "goblin-2" })]),
      ])[0],
    ).toMatchObject({ ok: false, code: "STEP_ACTOR_MISMATCH" });
  });

  it("does not check the monster turn", () => {
    const v = withActors([
      read(null, [attackStep("kestrel", { attackerId: "goblin-2" })]),
    ]);
    expect(v[0]).toMatchObject({ ok: true });
  });

  it("run 1's plan-approach plan (Kestrel attacks Snag in Tamsin's action) passes after the free-mode cut (R4)", () => {
    const script = JSON.parse(
      readFileSync(join(HERE, "scripts", "plan-approach.json"), "utf8"),
    );
    const call = script.calls.find(
      (c: { purpose: string }) => c.purpose === "dm.interpret",
    );
    const parsed = InterpretOutput.parse(call.respond.value);
    const cut = cutPlans({
      mode: "free",
      readings: parsed.readings,
      rulings: [],
    });
    // The scripted action belongs to Tamsin; Kestrel's attack is cut as a later stage.
    const v = plan(cut.readings, {
      actors: new Map([[parsed.readings[0]?.actionId as string, "tamsin"]]),
    });
    expect(v[0]).toMatchObject({ ok: true });
  });
});
