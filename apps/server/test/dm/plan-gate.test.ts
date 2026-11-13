import { describe, expect, it } from "vitest";
import {
  arrivingMonsters,
  arrivingNpcs,
  askUndeclared,
  checkPlan,
  eligibleMonsters,
  encounterPhase,
  encounterRan,
  encounterToStart,
  joinableMonsters,
  joiningCombatants,
  MANNER_SKILLS,
  startableEncounterIds,
} from "../../src/dm/gates/plan-gate.js";
import type { BeatItem } from "../../src/dm/nodes/assemble.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import {
  greyhollowDuo,
  greyhollowFight,
  PLAYER_USER,
} from "./snapshot-fixtures.js";
import { stage, stages } from "./world.js";

const { projections, seed } = greyhollowFight();
const snapshot = buildSnapshot(projections, seed);

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

describe("encounter phases and resume (spec 099)", () => {
  const reed = () => {
    const e = seed.encounters.find((x) => x.id === "reed-camp");
    if (!e) throw new Error("fixture lacks reed-camp");
    return e;
  };
  const ids = () => reed().monsters.map((m) => m.combatantId);
  const proj = (over: {
    order?: string[];
    started?: boolean;
    combatants?: Record<string, Record<string, unknown>>;
    presence?: Record<string, string>;
  }) =>
    ({
      encounter: over.order
        ? { order: over.order.map((combatantId) => ({ combatantId })) }
        : null,
      ledger: over.started
        ? [
            {
              kind: "change",
              type: "encounter.started",
              after: { order: [{ combatantId: ids()[0] }] },
            },
          ]
        : [],
      scenePresence: Object.fromEntries(
        Object.entries(over.presence ?? {}).map(([k, v]) => [
          k,
          { presence: v },
        ]),
      ),
      engine: { combatants: over.combatants ?? {} },
    }) as never;
  const fighter = (o = {}) => ({
    lifeState: "conscious",
    side: "hostile",
    ...o,
  });

  it("derives pending, active and ended", () => {
    expect(encounterPhase(proj({}), reed())).toBe("pending");
    expect(encounterPhase(proj({ order: [ids()[0] as string] }), reed())).toBe(
      "active",
    );
    expect(encounterPhase(proj({ started: true }), reed())).toBe("ended");
  });

  it("filters eligible monsters: dead, absent, yielded and missing are out; sideless is in", () => {
    const [a, b, c, d] = ids() as string[];
    const p = proj({
      started: true,
      combatants: {
        [a as string]: fighter(),
        [b as string]: fighter({ lifeState: "dead" }),
        [c as string]: fighter({ side: "neutral" }),
        [d as string]: fighter({ side: undefined }),
      },
      presence: { [d as string]: "absent" },
    });
    expect(eligibleMonsters(p, reed())).toEqual([a]);
    const sideless = proj({
      started: true,
      combatants: { [a as string]: fighter({ side: undefined }) },
    });
    expect(eligibleMonsters(sideless, reed())).toEqual([a]);
  });

  it("lists pending encounters and ended ones with an eligible monster as startable", () => {
    expect(startableEncounterIds(proj({}), seed)).toContain("reed-camp");
    const none = proj({ started: true });
    expect(startableEncounterIds(none, seed)).not.toContain("reed-camp");
    const some = proj({
      started: true,
      combatants: { [ids()[0] as string]: fighter() },
    });
    expect(startableEncounterIds(some, seed)).toContain("reed-camp");
    const active = proj({ order: [ids()[0] as string] });
    expect(startableEncounterIds(active, seed)).not.toContain("reed-camp");
  });

  it("a resume has no joiners and no arriving NPCs", () => {
    const ended = proj({ started: true });
    expect(joiningCombatants(reed(), {}, ended)).toEqual([]);
    expect(joiningCombatants(reed(), {}, proj({}))).toEqual(ids());
    expect(arrivingNpcs(seed, reed(), {}, ended)).toEqual([]);
  });

  it("joinable monsters are those of the active encounter not yet combatants", () => {
    const [a] = ids() as string[];
    const active = proj({
      order: [a as string],
      combatants: { [a as string]: fighter() },
    });
    const joinable = joinableMonsters(active, seed).map((m) => m.id);
    expect(joinable).not.toContain(a);
    expect(joinable.length).toBe(ids().length - 1);
    expect(joinableMonsters(proj({}), seed)).toEqual([]);
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

describe("monster arrivals (spec 088)", () => {
  const duo = greyhollowDuo();
  const reedCamp = duo.seed.encounters.find((e) => e.id === "reed-camp");
  it("lists arrivals then joiners once", () => {
    const out = arrivingMonsters(
      duo.seed,
      duo.projections,
      {
        arrivals: ["goblin-3", "snag"],
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "x" },
      },
      "commit",
    );
    const ids = out.map((m) => m.id);
    expect(ids[0]).toBe("goblin-3");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("goblin-4");
    expect(out[0]?.name).toBe("Goblin lookout");
  });

  it("leaves a seed NPC that is also a monster to the 078 path", () => {
    const out = arrivingMonsters(
      duo.seed,
      duo.projections,
      { arrivals: ["snag"], tableMode: { to: "stay" } },
      "commit",
    );
    expect(out).toEqual([]);
  });

  it("encounterRan: active order and a logged start", () => {
    if (!reedCamp) throw new Error("no reed-camp");
    expect(encounterRan(duo.projections, reedCamp)).toBe(false);
    const p = structuredClone(duo.projections);
    p.ledger.push({
      kind: "change",
      type: "encounter.started",
      after: { order: [{ combatantId: "snag" }] },
    } as never);
    expect(encounterRan(p, reedCamp)).toBe(true);
    const q = structuredClone(duo.projections);
    q.encounter = { round: 1, order: [{ combatantId: "goblin-3" }] } as never;
    expect(encounterRan(q, reedCamp)).toBe(true);
  });
});

describe("askUndeclared (spec 077)", () => {
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
  const check = (skill: string) => stage({ kind: "check", params: { skill } });
  const ask = (
    b: BeatItem,
    stageList: unknown[],
    extra: { resumed?: string[]; readings?: unknown[] } = {},
  ) =>
    askUndeclared({
      beat: [b],
      readings: (extra.readings ?? [
        stages("a1", stageList),
        stages(null, [check("stealth")]),
      ]) as never,
      resumed: extra.resumed ?? [],
    });
  const REED =
    "We move toward the reed camp until we see Goblins or they see us.";
  const SNEAK = "We sneak toward the reed camp.";

  it("asks the manner question for a Stealth check the text does not state", () => {
    const r = ask(item(REED), [check("stealth")]);
    expect(r.readings[0]).toMatchObject({
      stages: [],
      clarify: MANNER_SKILLS[0].question,
    });
    expect(r.asked).toEqual([
      { actionId: "a1", stepIndex: 0, rule: "manner", detail: "stealth" },
    ]);
  });

  it("passes a stated manner", () => {
    const r = ask(item(SNEAK), [check("stealth")]);
    expect(r.readings[0]?.clarify).toBeNull();
    expect(r.asked).toEqual([]);
  });

  it("run 1 seq 114: Athletics passes, Stealth asks", () => {
    const text = "I move towards Pell";
    expect(ask(item(text), [check("athletics")]).asked).toEqual([]);
    const bad = ask(item(text), [check("stealth")]);
    expect(bad.readings[0]?.clarify).toBe(MANNER_SKILLS[0].question);
  });

  it("skips the manner rule for a companion's action", () => {
    const r = ask(
      item(REED, { actor: "ai:companion:odo", characterId: "odo" }),
      [check("stealth")],
    );
    expect(r.asked).toEqual([]);
  });

  it("leaves resumed, clarify and NPC readings alone", () => {
    const resumed = ask(item(REED), [check("stealth")], { resumed: ["a1"] });
    expect(resumed.asked).toEqual([]);
    const cl = [stages("a1", [check("stealth")], { clarify: "Which?" })];
    const c = ask(item(REED), [], { readings: cl });
    expect(c.readings[0]).toBe(cl[0]);
    expect(c.asked).toEqual([]);
    expect(c.readings).toHaveLength(1);
  });

  it("covers Deception and Intimidation cues", () => {
    expect(ask(item("I bluff the guard"), [check("deception")]).asked).toEqual(
      [],
    );
    expect(
      ask(item("I talk to the guard"), [check("deception")]).readings[0]
        ?.clarify,
    ).toBe(MANNER_SKILLS[1].question);
    expect(
      ask(item("I threaten the guard"), [check("intimidation")]).asked,
    ).toEqual([]);
    expect(
      ask(item("I talk to the guard"), [check("intimidation")]).readings[0]
        ?.clarify,
    ).toBe(MANNER_SKILLS[2].question);
  });

  it("keeps every question speakable", () => {
    for (const q of MANNER_SKILLS.map((m) => m.question)) {
      expect(q).not.toMatch(/\d/);
      expect(q.match(/\?/g)).toHaveLength(1);
      expect(q.length).toBeLessThanOrEqual(200);
    }
  });
});

describe("checkPlan turn hold (TASK-0244)", () => {
  const party = new Map<string, string | null>([["p1", null]]);
  const read = (clarify: string | null = null) =>
    stages("p1", [stage({ kind: "check" })], { clarify }) as never;
  const plan = (
    s: typeof snapshot,
    over: Partial<Parameters<typeof checkPlan>[0]> = {},
  ) =>
    checkPlan({
      snapshot: s,
      readings: [read()],
      actors: party,
      declarers: new Map([["p1", "odo"]]),
      ...over,
    });
  const codeOf = (v: ReturnType<typeof checkPlan>) =>
    (v[0] as { code?: string }).code;
  const withActive = (
    active: string,
    patch: (s: typeof snapshot) => void = () => {},
  ) => {
    const s = structuredClone(snapshot);
    if (s.stage.encounter) s.stage.encounter.activeCombatantId = active;
    patch(s);
    return s;
  };

  it("holds a party action whose declarer is an off-turn companion", () => {
    expect(plan(snapshot)[0]).toEqual({
      actionId: "p1",
      ok: false,
      code: "TURN_HELD",
      heldFor: "odo",
    });
  });
  it("holds when the companion is active but has its own group", () => {
    const v = checkPlan({
      snapshot: withActive("odo"),
      readings: [read(), stages("a1", [stage({ kind: "attack" })]) as never],
      actors: new Map<string, string | null>([
        ["p1", null],
        ["a1", "odo"],
      ]),
      declarers: new Map([["p1", "odo"]]),
    });
    expect(v.find((x) => x.actionId === "p1")).toMatchObject({
      code: "TURN_HELD",
    });
  });
  it("does not hold the active companion with no own group", () => {
    expect(codeOf(plan(withActive("odo")))).not.toBe("TURN_HELD");
  });
  it("does not hold in free mode", () => {
    const s = withActive("snag", (x) => {
      x.stage.tableMode = { mode: "free" };
    });
    expect(codeOf(plan(s))).not.toBe("TURN_HELD");
  });
  it("does not hold a downed companion", () => {
    const s = withActive("snag", (x) => {
      const a = x.actors.find((y) => y.combatantId === "odo");
      if (a) a.lifeState = "unconscious";
    });
    expect(codeOf(plan(s))).not.toBe("TURN_HELD");
  });
  it("leaves a human declarer and a clarify reading unchanged", () => {
    const human = plan(snapshot, { declarers: new Map([["p1", "tamsin"]]) });
    expect(codeOf(human)).not.toBe("TURN_HELD");
    expect(plan(snapshot, { readings: [read("Which?")] })).toEqual([
      { actionId: "p1", ok: true },
    ]);
  });
});
