import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import type { BeatItem } from "../../src/dm/nodes/assemble.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import {
  director,
  legalizeDirector,
  runnableEncounterIds,
} from "../../src/dm/nodes/director.js";
import { DirectorOutput } from "../../src/dm/nodes/schemas.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import {
  fixtureEvents,
  freeEventsThrough,
  makeCtx,
  projectDm,
  row,
  testSeed,
} from "./helpers.js";

const seed = testSeed();

function model(over: Partial<DirectorOutput> = {}): DirectorOutput {
  return {
    beat: { decision: "resolve" },
    tableMode: { to: "stay" },
    trackers: [],
    scene: { status: "continue" },
    pacing: { tension: "rising", spotlight: null, beatId: null },
    goalNote: "keep it moving",
    companionPrompts: [],
    ...over,
  };
}

const freeProjections = projectDm(freeEventsThrough("narration")); // ana (player), bram (AI)
const turnProjections = projectDm(
  fixtureEvents("turn-mode-combat").slice(0, 12),
);

function withTracker(events = freeEventsThrough("narration")) {
  return projectDm([
    ...events,
    row(
      events.length + 1,
      "ai:dm",
      "tracker.changed",
      {
        reason: "start",
        trackerId: "dusk",
        before: null,
        after: {
          trackerId: "dusk",
          name: "Dusk",
          segments: 4,
          filled: 1,
          note: null,
        },
      },
      "dm",
    ),
  ]);
}

const input = (over: Partial<Parameters<typeof legalizeDirector>[1]> = {}) => ({
  trigger: "commit",
  forceResolve: false,
  projections: freeProjections,
  seed,
  beat: [] as BeatItem[],
  ...over,
});

describe("legalizeDirector (director.md legality table)", () => {
  it("keeps a legal hold", () => {
    const out = legalizeDirector(
      model({
        beat: { decision: "hold", companions: ["bram"], reason: "ask" },
      }),
      input(),
    );
    expect(out.beat.decision).toBe("hold");
    expect(out.overrides).toEqual([]);
  });

  it.each([
    ["forceResolve is set", { forceResolve: true }, ["bram"]],
    ["table mode is turn", { projections: turnProjections }, ["bram"]],
    ["the companion is a player's character", {}, ["ana"]],
    ["the companion is not in the party", {}, ["nobody"]],
    [
      "the companion already has a committed action",
      {
        beat: [
          {
            actionId: "a",
            committedSeq: 3,
            actor: "ai:companion:bram",
            characterId: "bram",
            scope: "character",
            text: "x",
            status: "committed",
          } as BeatItem,
        ],
      },
      ["bram"],
    ],
  ] as const)("overrides a hold to resolve when %s", (_label, extra, who) => {
    const out = legalizeDirector(
      model({
        beat: { decision: "hold", companions: [...who], reason: "ask" },
      }),
      input(extra as Partial<Parameters<typeof legalizeDirector>[1]>),
    );
    expect(out.beat).toEqual({ decision: "resolve" });
    expect(out.overrides.map((o) => o.decision)).toEqual(["hold"]);
  });

  it("forceResolve overrides a hold (open question 6)", () => {
    const out = legalizeDirector(
      model({
        beat: { decision: "hold", companions: ["bram"], reason: "again" },
      }),
      input({ forceResolve: true }),
    );
    expect(out.beat).toEqual({ decision: "resolve" });
  });

  it("allows a turn into a seed encounter that has not run", () => {
    expect(runnableEncounterIds(freeProjections, seed)).toContain("reed-camp");
    const out = legalizeDirector(
      model({
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "ambush" },
      }),
      input(),
    );
    expect(out.tableMode.to).toBe("turn");
    expect(out.overrides).toEqual([]);
  });

  it.each([
    ["an unknown encounter", freeProjections, "nope"],
    ["table mode is already turn", turnProjections, "reed-camp"],
  ])("overrides a turn to stay for %s", (_label, projections, encounterId) => {
    const out = legalizeDirector(
      model({ tableMode: { to: "turn", encounterId, reason: "x" } }),
      input({ projections }),
    );
    expect(out.tableMode).toEqual({ to: "stay" });
    expect(out.overrides.map((o) => o.decision)).toEqual(["turn"]);
  });

  it("overrides a turn into an encounter that has already run (spec 088)", () => {
    // A logged encounter.started row whose order held snag: the encounter ran.
    const projections = {
      ...freeProjections,
      ledger: [
        ...freeProjections.ledger,
        {
          kind: "change",
          type: "encounter.started",
          after: { order: [{ combatantId: "snag" }] },
        },
      ],
      engine: {
        ...freeProjections.engine,
        combatants: {
          ...freeProjections.engine.combatants,
          snag: freeProjections.engine.combatants.ana,
        },
      },
    } as typeof freeProjections;
    const out = legalizeDirector(
      model({
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "x" },
      }),
      input({ projections: projections as never }),
    );
    expect(out.tableMode).toEqual({ to: "stay" });
  });

  it("allows free only from turn mode", () => {
    const legal = legalizeDirector(
      model({ tableMode: { to: "free", reason: "fight over" } }),
      input({ projections: turnProjections }),
    );
    expect(legal.tableMode.to).toBe("free");
    const illegal = legalizeDirector(
      model({ tableMode: { to: "free", reason: "x" } }),
      input(),
    );
    expect(illegal.tableMode).toEqual({ to: "stay" });
    expect(illegal.overrides.map((o) => o.decision)).toEqual(["free"]);
  });

  it("reports a readable issue for a zero tracker advance", () => {
    const parsed = DirectorOutput.safeParse(
      model({ trackers: [{ trackerId: "dusk", advance: 0, reason: "x" }] }),
    );
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.map((i) => i.message)).toContain(
      "advance must be a non-zero integer from -3 to 3",
    );
  });

  it("drops a tracker advance for a tracker that does not exist", () => {
    const out = legalizeDirector(
      model({
        trackers: [
          { trackerId: "dusk", advance: 1, reason: "time" },
          { trackerId: "ghost", advance: 1, reason: "x" },
        ],
      }),
      input({ projections: withTracker() }),
    );
    expect(out.trackers.map((t) => t.trackerId)).toEqual(["dusk"]);
    expect(out.overrides.map((o) => o.decision)).toEqual(["tracker"]);
  });

  it("treats scene end as continue when no scene is set", () => {
    const end = { status: "end", outcome: "goal-met", reason: "done" } as const;
    const noScene = legalizeDirector(
      model({ scene: end }),
      input({ projections: projectDm([]) }),
    );
    expect(noScene.scene).toEqual({ status: "continue" });
    expect(noScene.overrides.map((o) => o.decision)).toEqual(["scene-end"]);
    expect(freeProjections.scene).not.toBeNull();
    const withScene = legalizeDirector(model({ scene: end }), input());
    expect(withScene.scene.status).toBe("end");
  });

  it("drops companion prompts outside free mode or for non-companions", () => {
    const ok = legalizeDirector(model({ companionPrompts: ["bram"] }), input());
    expect(ok.companionPrompts).toEqual(["bram"]);
    const bad = legalizeDirector(
      model({ companionPrompts: ["bram", "ana"] }),
      input(),
    );
    expect(bad.companionPrompts).toEqual(["bram"]);
    expect(bad.overrides.map((o) => o.decision)).toEqual(["companionPrompts"]);
    const turn = legalizeDirector(
      model({ companionPrompts: ["bram"] }),
      input({ projections: turnProjections }),
    );
    expect(turn.companionPrompts).toEqual([]);
  });

  it("keeps only pacing on scene start", () => {
    const out = legalizeDirector(
      model({
        beat: { decision: "hold", companions: ["bram"], reason: "x" },
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "x" },
        trackers: [{ trackerId: "dusk", advance: 1, reason: "x" }],
        scene: { status: "end", outcome: "failed", reason: "x" },
        companionPrompts: ["bram"],
      }),
      input({ trigger: "scene-start", projections: projectDm([]) }),
    );
    expect(out.beat).toEqual({ decision: "resolve" });
    expect(out.tableMode).toEqual({ to: "stay" });
    expect(out.trackers).toEqual([]);
    expect(out.scene).toEqual({ status: "continue" });
    expect(out.companionPrompts).toEqual([]);
    expect(out.pacing.tension).toBe("rising");
    expect(out.overrides).toHaveLength(5);
  });
});

describe("legalizeDirector arrivals (spec 078)", () => {
  const offstage = {
    ...freeProjections,
    scenePresence: {
      ...freeProjections.scenePresence,
      snag: {
        presence: "absent" as const,
        reason: "removed" as const,
        seq: 12,
      },
      pell: {
        presence: "absent" as const,
        reason: "removed" as const,
        seq: 13,
      },
    },
  };
  const arrivalsOf = (arrivals?: string[], over = {}) =>
    legalizeDirector(model(arrivals ? { arrivals } : {}), {
      ...input({ projections: offstage }),
      ...over,
    });

  it("keeps a legal arrival", () => {
    const out = arrivalsOf(["snag", "pell"]);
    expect(out.arrivals).toEqual(["snag", "pell"]);
    expect(out.overrides).toEqual([]);
  });

  it("drops present, unknown and duplicate ids with one override", () => {
    const out = arrivalsOf(["snag", "snag", "wenna", "ghoul-9"]);
    expect(out.arrivals).toEqual(["snag"]);
    expect(out.overrides.filter((o) => o.decision === "arrivals")).toHaveLength(
      1,
    );
  });

  it("drops a yielded NPC", () => {
    const yielded = {
      ...offstage,
      scenePresence: {
        ...offstage.scenePresence,
        snag: {
          presence: "yielded" as const,
          reason: "conceded" as const,
          seq: 14,
        },
      },
    };
    const out = legalizeDirector(
      model({ arrivals: ["snag"] }),
      input({ projections: yielded }),
    );
    expect(out.arrivals).toEqual([]);
  });

  it("drops all on scene start", () => {
    const out = arrivalsOf(["snag"], { trigger: "scene-start" });
    expect(out.arrivals).toEqual([]);
    expect(out.overrides.map((o) => o.decision)).toContain("arrivals");
  });

  it("reads an omitted field as []", () => {
    expect(arrivalsOf().arrivals).toEqual([]);
  });
});

describe("director node", () => {
  it("makes one dm.director call and applies legality", async () => {
    const script = loadDmScript({
      v: 1,
      name: "director-node",
      dice: [],
      calls: [
        {
          purpose: "dm.director",
          respond: {
            type: "json",
            value: model({
              tableMode: { to: "free", reason: "not needed" },
            }),
          },
        },
      ],
    });
    const scripted = createScriptedDm(script);
    const gateway = createGateway({
      config: scripted.aiConfig,
      sink: memorySink(),
      adapters: { fake: () => scripted.provider },
    });
    const events = freeEventsThrough("action.committed");
    const ctx = makeCtx({
      deps: { gateway, loadProjections: async () => projectDm(events) },
    });
    const assembled = await assemble(ctx);
    if (!assembled.ok) throw new Error("assemble failed");
    const result = await director({
      ...ctx,
      results: { assemble: assembled.output },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calls.map((c) => c.purpose)).toEqual(["dm.director"]);
    expect(result.output.tableMode).toEqual({ to: "stay" });
    expect(result.output.overrides.map((o) => o.decision)).toEqual(["free"]);
    expect(scripted.remaining().calls["dm.director"]).toBe(0);
    expect(scripted.provider.chatCalls[0]?.request.system).toContain(
      "Director",
    );
  });
});

describe("legalizeDirector monster arrivals (spec 088)", () => {
  const goblin = seed.encounters
    .find((e) => e.id === "reed-camp")
    ?.monsters.find((m) => m.combatantId === "goblin-3");
  const arrive = (ids: string[], projections = freeProjections) =>
    legalizeDirector(model({ arrivals: ids }), input({ projections }));

  it("keeps an unseen monster in free mode", () => {
    const out = arrive(["goblin-3"]);
    expect(out.arrivals).toEqual(["goblin-3"]);
    expect(out.overrides).toEqual([]);
  });

  it("drops it in turn mode, and drops an unknown monster id", () => {
    expect(arrive(["goblin-3"], turnProjections).arrivals).toEqual([]);
    const out = arrive(["goblin-9"]);
    expect(out.arrivals).toEqual([]);
    expect(out.overrides.filter((o) => o.decision === "arrivals")).toHaveLength(
      1,
    );
  });

  it("drops a monster that is already a combatant", () => {
    if (!goblin) throw new Error("fixture lacks goblin-3");
    const p = structuredClone(freeProjections);
    p.engine.combatants["goblin-3"] = {
      ...Object.values(p.engine.combatants)[0],
      id: "goblin-3",
    } as never;
    expect(arrive(["goblin-3"], p).arrivals).toEqual([]);
  });

  it("keeps reed-camp runnable with a monster added, not after it started", () => {
    const p = structuredClone(freeProjections);
    p.engine.combatants["goblin-3"] = {
      ...Object.values(p.engine.combatants)[0],
      id: "goblin-3",
    } as never;
    expect(runnableEncounterIds(p, seed)).toContain("reed-camp");
    p.ledger.push({
      kind: "change",
      seq: 99,
      actor: "ai:dm",
      visibility: "public",
      reason: "x",
      type: "encounter.started",
      subject: null,
      before: null,
      after: { order: [{ combatantId: "goblin-3" }] },
      batchId: null,
      index: null,
      actionId: null,
    } as never);
    expect(runnableEncounterIds(p, seed)).not.toContain("reed-camp");
  });
});
