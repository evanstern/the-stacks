import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import type { AssembleOutput } from "../../src/dm/nodes/assemble.js";
import { check } from "../../src/dm/nodes/check.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import type { TurnContext } from "../../src/dm/pipeline/context.js";
import { buildNarratePrompt } from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { makeCtx, row } from "./helpers.js";
import {
  combatant,
  EMPTY_RESOLVE_SNAPSHOT,
  greyhollowDuo,
} from "./snapshot-fixtures.js";

/**
 * TASK-0193 (spec 071) merge condition: a replay of alpha run 3 seq 150 to 157,
 * Snag's turn. Source: docs/playtests/2026-11-01-two-browser-alpha-run-3.md
 * finding 15, and the `greyhollow-ford-duo` seed. The session lives on vm-104, so
 * the beat is rebuilt from the log (OQ-1 (a)), not read from its rows. Snag has
 * no mechanical step; the turn advances to Kestrel. Run 3 shipped
 * "Snag makes a move. Kestrel moves next."
 */

const REASON = "Snag offers the party a parley, hands open.";
const PROSE =
  "Snag lowers his spear and calls across the mud, offering a parley with his hands held open.";

function scenario() {
  const { projections: p, seed } = greyhollowDuo();
  const combatants = {
    ...p.engine.combatants,
    snag: combatant("snag", "Snag"),
  };
  const order = ["snag", "kestrel", "tamsin", "odo"];
  p.engine = {
    v: 1,
    combatants,
    encounter: {
      round: 1,
      turnIndex: 0,
      order: order.map((id, i) => ({
        combatantId: id,
        total: 20 - i,
        bonus: 0,
      })),
    },
  };
  p.encounter = {
    round: 1,
    turnIndex: 0,
    activeCombatantId: "snag",
    order: order.map((id, i) => ({
      combatantId: id,
      name: (combatants as Record<string, { name: string }>)[id]?.name ?? id,
      initiative: 20 - i,
      hp: { current: 10, max: 10, temp: 0 },
      lifeState: "conscious" as const,
      conditions: [],
      characterId: null,
    })),
  };
  p.tableMode = { mode: "turn", activeActor: "ai:dm", activeCharacterId: null };
  return { p, seed };
}

const advanced = row(158, "ai:dm", "turn.advanced", {
  event: { after: { combatantId: "kestrel" } },
});

const director = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
} as DirectorNodeOutput;

function ctxFor(
  responses: unknown[],
  over: {
    planGate?: ResolveOutput["planGate"];
  } = {},
) {
  const { p, seed } = scenario();
  const scripted = createScriptedDm(
    loadDmScript({
      v: 1,
      name: "npc-turn",
      dice: [],
      calls: responses as never,
    }),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const assembled = {
    projections: p,
    snapshot: EMPTY_RESOLVE_SNAPSHOT.snapshot,
    throughSeq: 157,
    beat: [],
    resumed: [],
    npcTurn: { combatantId: "snag", srdMonsterId: null },
    presentNpcIds: [],
    activeEncounterId: null,
    srdRecords: [],
    transcriptTail: [],
    priorSteps: {},
    rejections: {},
    presence: null,
  } as AssembleOutput;
  const resolve = {
    submissions: [],
    actionResults: [],
    appendedRows: [advanced],
    nextJob: null,
    chronicle: false,
    npcTurn: { combatantId: "snag", batchIds: [], awaitingDm: false },
    ...EMPTY_RESOLVE_SNAPSHOT,
    lastSeq: 158,
    ...(over.planGate ? { planGate: over.planGate } : {}),
  } as ResolveOutput;
  const ctx = makeCtx({
    seed,
    job: { trigger: "npc-turn" },
    deps: { gateway, loadProjections: async () => p },
    results: {
      assemble: assembled,
      director,
      resolve,
      interpret: {
        readings: [
          {
            actionId: null,
            stages: [
              {
                intent: {
                  kind: "attempt",
                  targets: [],
                  params: {},
                  text: REASON,
                },
                beside: null,
              },
            ],
            clarify: null,
            followUps: [],
          },
        ],
      },
    } as unknown as TurnContext["results"],
  });
  return ctx;
}

const text = (value: string) => ({
  purpose: "dm.narrate",
  respond: { type: "text", value },
});
async function run(ctx: TurnContext) {
  const n = await narrate(ctx);
  if (!n.ok) throw new Error("narrate failed");
  const a = await check({
    ...ctx,
    results: { ...ctx.results, narrate: n.output },
  });
  if (!a.ok) throw new Error("check failed");
  return { narrated: n.output, checked: a.output };
}

describe("run 3 seq 150-157: Snag's turn (spec 071)", () => {
  it("the narrate prompt names Snag, Kestrel and the plan", async () => {
    const ctx = ctxFor([text(PROSE)]);
    const { narrated } = await run(ctx);
    const assembled = ctx.results.assemble as AssembleOutput;
    const np = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: [],
      assembled,
      snapshot: EMPTY_RESOLVE_SNAPSHOT.snapshot,
      facts: narrated.facts,
    });
    expect(np.user).toContain("Turn: Snag acts in this beat.");
    expect(np.user).toMatch(/Next: Kestrel .*has not acted yet\./);
    expect(np.user).toContain(`planned: attempt; ${REASON}`);
    expect(np.system).toContain(
      "Only the actors on the Turn line, the Action lines and the roll lines act in this beat.",
    );
  });

  it("clean prose ships as written with no correction", async () => {
    const { checked } = await run(ctxFor([text(PROSE)]));
    expect(checked.shipped?.prose).toBe(PROSE);
    expect(checked.shipped?.corrections).toEqual([]);
  });
});
