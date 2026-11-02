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
    steps?: { reason: string }[];
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
const auditJson = (verdict: "pass" | "fail", kind?: string) => ({
  purpose: "dm.audit",
  respond: {
    type: "json",
    value: {
      verdict,
      issues: kind ? [{ kind, detail: "Run 3 refusal." }] : [],
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

describe("run 3 seq 150-157: Snag's turn (spec 071)", () => {
  it("the narrate and audit prompts name Snag, Kestrel and the plan", async () => {
    const ctx = ctxFor([text(PROSE), auditJson("pass")]);
    const { narrated } = await run(ctx);
    const assembled = ctx.results.assemble as AssembleOutput;
    const np = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: [],
      assembled,
      snapshot: EMPTY_RESOLVE_SNAPSHOT.snapshot,
      facts: narrated.facts,
      prior: null,
    });
    expect(np.user).toContain("Turn: Snag acts in this beat.");
    expect(np.user).toMatch(/Next: Kestrel .*has not acted yet\./);
    expect(np.user).toContain(`planned: talk; ${REASON}`);
    expect(np.system).toContain(
      "Only the actor named on the Turn line acts in this beat.",
    );
    const ap = buildAuditPrompt({
      facts: narrated.facts,
      snapshot: EMPTY_RESOLVE_SNAPSHOT.snapshot,
      prose: PROSE,
    });
    expect(ap.user).toContain("Turn: Snag acts in this beat.");
    expect(ap.user).toMatch(/Next: Kestrel /);
    expect(ap.system).toContain(
      "6. The actor on the Turn line acts in this beat",
    );
  });

  it("passing prose ships as written", async () => {
    const { audited } = await run(ctxFor([text(PROSE), auditJson("pass")]));
    expect(audited.shipped?.fallback).toBe(false);
    expect(audited.shipped?.prose).toBe(PROSE);
  });

  it("three refused audits ship Snag's planned reason, never 'makes a move'", async () => {
    const { audited } = await run(
      ctxFor([
        text(PROSE),
        auditJson("fail", "invented-mechanics"),
        text(PROSE),
        auditJson("fail", "ledger-mismatch"),
        text(PROSE),
        auditJson("fail", "ledger-mismatch"),
      ]),
    );
    expect(audited.shipped?.fallback).toBe(true);
    expect(audited.shipped?.prose).toContain(REASON.replace(/\.$/, ""));
    expect(audited.shipped?.text).not.toContain("makes a move");
  });

  it("a refused plan ships the hold sentence", async () => {
    const { audited } = await run(
      ctxFor(
        [
          text(PROSE),
          auditJson("fail", "invented-mechanics"),
          text(PROSE),
          auditJson("fail", "ledger-mismatch"),
          text(PROSE),
          auditJson("fail", "ledger-mismatch"),
        ],
        {
          planGate: [
            {
              actionId: null,
              ok: false,
              code: "UNKNOWN_COMBATANT",
              failure: {} as never,
            },
          ],
        },
      ),
    );
    expect(audited.shipped?.fallback).toBe(true);
    expect(audited.shipped?.prose).toContain("Snag holds back, watching.");
  });
});
