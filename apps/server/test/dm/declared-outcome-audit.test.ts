import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LedgerRow } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import {
  collectFacts,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { audit } from "../../src/dm/nodes/audit.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type { NarrateOutput } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { buildAuditPrompt } from "../../src/dm/prompts/audit.js";
import { rosterOf } from "../../src/dm/prompts/common.js";
import { buildNarratePrompt } from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { clueFor } from "../../src/dm/stakes.js";
import { freeEventsThrough, makeCtx, projectDm, testSeed } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/**
 * Card AC #2-#5 and the runbook merge condition "names the creature on
 * success", replayed over a RECONSTRUCTED fixture of the lost 2026-10-28
 * claw-marks turn (spec 080 OQ-3 a; see the fixture header). The fake gateway
 * scripts the model.
 */

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(
    join(here, "fixtures/claw-marks-20261028-reconstructed.json"),
    "utf8",
  ),
) as {
  reconstructed: boolean;
  rows: { seq: number; type: string; payload: Record<string, unknown> }[];
};
const rowAt = (seq: number) => {
  const r = fixture.rows.find((x) => x.seq === seq);
  if (!r) throw new Error(`seq ${seq} missing`);
  return r;
};
const MARKS_ONLY = String(rowAt(4).payload.text);
const SUCCESS = "Tamsin reads the prints: goblin feet, small and splayed.";
const stakes = {
  success: SUCCESS,
  cost: "It works, at a small price.",
  failure: "The mud gives her nothing.",
  severe: null,
};
const SEED = testSeed();
const CLUE = clueFor(SEED, "ferry-house#1");

const ledger = (): LedgerRow[] => {
  const mk = (seq: number) => {
    const { payload } = rowAt(seq);
    const event = payload.event as Record<string, unknown>;
    return {
      seq,
      actor: "ai:dm",
      visibility: "public",
      reason: event.reason,
      batchId: payload.batchId,
      index: payload.index,
      actionId: payload.actionId,
      event,
    };
  };
  const r = mk(2);
  const c = mk(3);
  return [
    { kind: "roll", ...r, roll: r.event },
    {
      kind: "outcome",
      ...c,
      outcome: { ...c.event, band: "success", margin: 11 },
    },
  ] as unknown as LedgerRow[];
};

function buildFacts(): NarrationFacts {
  const rows = ledger();
  const batchId = rows[0]?.batchId as string;
  const c = collectFacts(
    rows,
    (id) => (id === "tamsin" ? "Tamsin" : (id ?? "The scene")),
    new Map(),
    new Map([[batchId, stakes]]),
    new Map([[batchId, CLUE as string]]),
  );
  return {
    trigger: "commit",
    actions: [
      {
        actionId: "a1",
        characterName: "Tamsin",
        text: "looks for what may have made these claw marks",
        outcome: "applied",
        refusalCode: null,
        ...c,
        followUps: [],
      },
    ],
    npcTurn: null,
    director: {
      pacing: { tension: "low", spotlight: null, beatId: null },
      goalNote: "",
      sceneEnded: false,
    },
    modeChange: null,
    presentNpcs: [],
    rulings: [],
    clarify: [],
    party: [],
    events: [],
    setting: { locationName: "The Ford", openingFraming: "The ford waits." },
  } as unknown as NarrationFacts;
}

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};
const resolved: ResolveOutput = {
  submissions: [],
  actionResults: [],
  appendedRows: [],
  nextJob: null,
  chronicle: false,
  npcTurn: null,
  ...EMPTY_RESOLVE_SNAPSHOT,
  lastSeq: 0,
};

const FAIL = {
  verdict: "fail",
  issues: [
    {
      kind: "ledger-mismatch",
      detail: "The prose does not deliver the settled outcome or learned fact.",
    },
  ],
};
const PASS = { verdict: "pass", issues: [] };

async function run(facts: NarrationFacts, calls: unknown[]) {
  const scripted = createScriptedDm(
    loadDmScript({
      v: 1,
      name: "declared-outcome",
      dice: [],
      calls,
    } as never),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const base = makeCtx({
    deps: {
      gateway,
      loadProjections: async () =>
        projectDm(freeEventsThrough("action.resolved")),
    },
  });
  const assembled = await assemble(base);
  if (!assembled.ok) throw new Error("assemble failed");
  const diceLines = renderDiceLines(facts);
  const narrated: NarrateOutput = {
    prose: MARKS_ONLY,
    diceLines,
    text: `${MARKS_ONLY}\n\n${diceLines.join("\n")}`,
    actionIds: ["a1"],
    attempt: 1,
    skipped: false,
    facts,
    withheld: [],
  };
  const out = await audit({
    ...base,
    results: {
      assemble: assembled.output,
      director,
      resolve: resolved,
      narrate: narrated,
    },
  });
  if (!out.ok) throw new Error("audit failed");
  return out.output;
}

describe("declared outcome over the reconstructed claw-marks turn (spec 080)", () => {
  it("the fixture is labelled reconstructed", () => {
    expect(fixture.reconstructed).toBe(true);
  });

  it("the roll fact carries the success outcome and the named clue (card AC #2, #5)", () => {
    const roll = buildFacts().actions[0]?.rolls[0];
    expect(roll?.consequence).toBe(SUCCESS);
    expect(roll?.revealed).toMatch(/goblin/i);
  });

  it("narrate and audit prompts carry the settled lines and the delivery rule (card AC #3)", () => {
    const facts = buildFacts();
    const projections = projectDm(freeEventsThrough("action.resolved"));
    const snapshot = buildSnapshot(projections, SEED);
    const a = buildAuditPrompt({ facts, snapshot, prose: MARKS_ONLY });
    expect(a.user).toContain(`outcome (settled): ${SUCCESS}`);
    expect(a.user).toContain("learned (settled):");
    expect(a.system).toContain("does not deliver a roll's settled outcome");
    const n = buildNarratePrompt({
      seed: SEED as never,
      roster: rosterOf(projections.party),
      assembled: {
        transcriptTail: [],
        presentNpcIds: [],
        projections,
      } as never,
      snapshot,
      facts,
      prior: null,
    });
    expect(n.user).toContain("learned (settled):");
    expect(n.system).toContain("A success means the attempted task happens.");
  });

  it("marks-only prose fails the audit; the regenerated draft naming goblins ships (card AC #4)", async () => {
    const out = await run(buildFacts(), [
      { purpose: "dm.audit", respond: { type: "json", value: FAIL } },
      {
        purpose: "dm.narrate",
        respond: {
          type: "text",
          value:
            "Tamsin studies the prints and knows them: goblin feet, small and splayed, leading to the causeway.",
        },
      },
      { purpose: "dm.audit", respond: { type: "json", value: PASS } },
    ]);
    expect(out.record.final).toBe("passed-after-regenerate");
    expect(out.record.attempts).toHaveLength(2);
    expect(out.shipped?.prose).toMatch(/goblin/i);
  });

  it("when every draft fails the fallback ships and names the goblins", async () => {
    const draft = {
      purpose: "dm.narrate",
      respond: { type: "text", value: MARKS_ONLY },
    };
    const out = await run(buildFacts(), [
      { purpose: "dm.audit", respond: { type: "json", value: FAIL } },
      draft,
      { purpose: "dm.audit", respond: { type: "json", value: FAIL } },
      draft,
      { purpose: "dm.audit", respond: { type: "json", value: FAIL } },
    ]);
    expect(out.record.final).toBe("fallback");
    expect(out.shipped?.fallback).toBe(true);
    expect(out.shipped?.prose).toMatch(/goblin/i);
  });
});
