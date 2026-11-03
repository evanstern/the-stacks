import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import type { AssembleOutput } from "../../src/dm/nodes/assemble.js";
import { audit } from "../../src/dm/nodes/audit.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import type { TurnContext } from "../../src/dm/pipeline/context.js";
import { buildAuditPrompt } from "../../src/dm/prompts/audit.js";
import { buildNarratePrompt } from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { makeCtx, row } from "./helpers.js";
import {
  combatant,
  condition,
  EMPTY_RESOLVE_SNAPSHOT,
  greyhollowDuo,
} from "./snapshot-fixtures.js";

/**
 * TASK-0207 (spec 081) merge condition: a replay of alpha run 1 seq 124 to 126,
 * Pell Marsh's turn. Source: runbook A playtest run 1 finding 15 (PR #109) and the
 * `greyhollow-ford-reed-camp` seed names (Pell Marsh; Goblin with a pot-helm). The
 * session lives on vm-104, so the beat is rebuilt from the finding, not read from its
 * rows. Pell is grappled and conscious. His reading is a `none` step whose reason is
 * run 1's rules note; his words rode in `followUps`. Run 1 shipped "Pell Marsh speaks up."
 */

const REASON = "Pell Marsh needs no roll to call out.";
const SAY =
  "The clapper's tied with a wet slip-knot! Two more hide left of the fire!";
const PROSE =
  "Pell Marsh yanks against the grapple and shouts a warning across the camp about the clapper and the hidden pair.";
function scenario() {
  const { projections: p, seed } = greyhollowDuo();
  const combatants = {
    ...p.engine.combatants,
    pell: combatant("pell", "Pell Marsh", {
      conditions: [condition("g1", "grappled")],
    }),
    goblin: combatant("goblin", "Goblin with a pot-helm"),
  };
  const order = ["pell", "goblin", "kestrel", "tamsin", "odo"];
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
    activeCombatantId: "pell",
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
  event: { after: { combatantId: "goblin" } },
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
    steps?: { reason: string }[];
    say?: string | null;
    followUps?: string[];
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
    npcTurn: { combatantId: "pell", srdMonsterId: null },
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
    npcTurn: { combatantId: "pell", batchIds: [], awaitingDm: false },
    ...EMPTY_RESOLVE_SNAPSHOT,
    lastSeq: 158,
    ...(over.planGate ? { planGate: over.planGate } : {}),
  } as ResolveOutput;
  const steps = over.steps ?? [{ reason: REASON }];
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
            intent: "talk",
            uncertain: false,
            needsAdjudication: false,
            rulesQuestion: null,
            clarify: null,
            steps,
            followUps: over.followUps ?? [],
            ...(over.say === undefined ? { say: SAY } : { say: over.say }),
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
const auditJson = (verdict: "pass" | "fail", kind?: string) => ({
  purpose: "dm.audit",
  respond: {
    type: "json",
    value: {
      verdict,
      issues: kind
        ? [{ kind, detail: "Run 1 refusal: Kestrel is made to act." }]
        : [],
    },
  },
});

async function run(ctx: TurnContext) {
  const n = await narrate(ctx);
  if (!n.ok) throw new Error("narrate failed");
  const a = await audit({
    ...ctx,
    results: { ...ctx.results, narrate: n.output },
  });
  if (!a.ok) throw new Error("audit failed");
  return { narrated: n.output, audited: a.output };
}

const threeRefusals = () => [
  text(PROSE),
  auditJson("fail", "player-agency"),
  text(PROSE),
  auditJson("fail", "invented-mechanics"),
  text(PROSE),
  auditJson("fail", "ledger-mismatch"),
];

function prompts(
  ctx: TurnContext,
  facts: Parameters<typeof buildNarratePrompt>[0]["facts"],
) {
  const np = buildNarratePrompt({
    seed: playerFacingSeed(ctx.seed),
    roster: [],
    assembled: ctx.results.assemble as AssembleOutput,
    snapshot: EMPTY_RESOLVE_SNAPSHOT.snapshot,
    facts,
    prior: null,
  });
  const ap = buildAuditPrompt({
    facts,
    snapshot: EMPTY_RESOLVE_SNAPSHOT.snapshot,
    prose: PROSE,
  });
  return { np, ap };
}

describe("run 1 seq 124-126: Pell Marsh's turn (spec 081)", () => {
  it("three refused audits ship Pell's own words, not 'speaks up'", async () => {
    const { audited } = await run(ctxFor(threeRefusals(), { followUps: [] }));
    expect(audited.shipped?.fallback).toBe(true);
    expect(audited.shipped?.prose).toContain('Pell Marsh calls out, "');
    expect(audited.shipped?.prose).toContain("Two more hide left of the fire");
    expect(audited.shipped?.prose).not.toContain("speaks up");
  });

  it("the narrate and audit prompts hold the says: line under the Monster turn", async () => {
    const ctx = ctxFor([text(PROSE), auditJson("pass")]);
    const { narrated } = await run(ctx);
    const { np, ap } = prompts(ctx, narrated.facts);
    for (const u of [np.user, ap.user]) {
      expect(u).toMatch(
        /Monster turn: Pell Marsh\n( {2}.*\n)* {2}says: The clapper/,
      );
    }
    expect(np.system).toContain("the monster speaks those words in this beat");
  });

  it("run 1's reading as it was (no say, words in followUps) still ships 'speaks up'", async () => {
    const { audited } = await run(
      ctxFor(threeRefusals(), { say: null, followUps: [SAY] }),
    );
    expect(audited.shipped?.prose).toContain("Pell Marsh speaks up.");
    expect(audited.shipped?.prose).not.toContain("calls out");
  });

  it("a refused plan ships the hold sentence", async () => {
    const { audited } = await run(
      ctxFor(threeRefusals(), {
        planGate: [
          {
            actionId: null,
            ok: false,
            code: "UNKNOWN_COMBATANT",
            failure: {} as never,
          },
        ],
      }),
    );
    expect(audited.shipped?.prose).toContain(
      "Pell Marsh holds back, watching.",
    );
  });
});
