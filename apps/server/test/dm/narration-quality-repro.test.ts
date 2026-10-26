import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import {
  buildNarrationFacts,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { factualSummary } from "../../src/dm/fallback.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import {
  audit,
  deterministicChecks,
  MAX_NARRATION_ATTEMPTS,
} from "../../src/dm/nodes/audit.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { transcriptEntries } from "../../src/dm/prompts/common.js";
import { buildCompanionPrompt } from "../../src/dm/prompts/companion.js";
import {
  buildNarratePrompt,
  factEntries,
} from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { freeEventsThrough, makeCtx, projectDm, testSeed } from "./helpers.js";

/**
 * TASK-0106 Phase 1: each test reproduces a run-5 defect on the UNFIXED code,
 * from the real rows of run 5 (fixtures/run5-narration-quality.json). Each one
 * asserts the defective behavior today. Later phases flip these assertions.
 */

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures/run5-narration-quality.json"), "utf8"),
) as { source: string; transcript: StoredEvent[]; ledger: { seq: number }[] };

const SEED = testSeed();
const PLAYER_USER_ID = "00000000-0000-4000-8000-0000000000a1";

/** The run's DM projections as of `seq` (inclusive). */
function projectedThrough(seq: number) {
  return projectDm(fixture.transcript.filter((r) => r.seq <= seq));
}

const director = (
  over: Partial<DirectorNodeOutput["pacing"]> = {},
): DirectorNodeOutput => ({
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null, ...over },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
});

const noResolve = (over: Partial<ResolveOutput> = {}): ResolveOutput => ({
  submissions: [],
  actionResults: [],
  appendedRows: [],
  nextJob: null,
  chronicle: false,
  npcTurn: null,
  lastSeq: 0,
  ...over,
});

interface ActionSpec {
  actionId: string;
  characterId: string;
  actor: string;
  text: string;
}

/** Facts for one no-effect action turn, built from the run's rows. */
function noEffectFacts(
  throughSeq: number,
  modeBefore: "free" | "turn",
  action: ActionSpec,
  clarify: { actionId: string; question: string }[] = [],
): NarrationFacts {
  return buildNarrationFacts({
    trigger: "commit",
    seed: SEED,
    projections: projectedThrough(throughSeq),
    beat: [
      {
        actionId: action.actionId,
        committedSeq: 0,
        actor: action.actor,
        characterId: action.characterId,
        scope: "character",
        text: action.text,
        status: "resolved",
      },
    ],
    director: director(),
    adjudicate: null,
    resolve: noResolve({
      actionResults: [
        {
          actionId: action.actionId,
          outcome: "no-effect",
          batchIds: [],
          refusalCode: null,
        },
      ],
    }),
    presentNpcIds: [],
    modeBefore,
    appendedRows: [],
    clarify,
  });
}

const KESTREL: ActionSpec = {
  actionId: "act-kestrel-1",
  characterId: "kestrel",
  actor: "ai:companion:kestrel",
  text: "I lower my drawn shortbow, step back from the fight line, and hold my palms visible toward Snag.",
};

const TAMSIN_PT4: ActionSpec = {
  actionId: "pt-4",
  characterId: "tamsin",
  actor: PLAYER_USER_ID,
  text: "I press on toward the ferry before dark.",
};

const CLARIFY_QUESTION =
  "Walk past the standoff to the ferry, or do something about Snag's terms first?";

describe("run-5 fixture", () => {
  it("names its source and carries the selected rows", () => {
    expect(fixture.source).toBe("20261026T171359Z-greyhollow-ford-provider");
    const seqs = fixture.transcript.map((r) => r.seq);
    for (const s of [1, 7, 37, 64, 81, 88, 187, 195, 211, 216]) {
      expect(seqs).toContain(s);
    }
    expect(fixture.ledger.length).toBeGreaterThan(0);
  });
});

describe("F23: the fallback contradicts the ledger (T012)", () => {
  it("seq 88 says nothing changes and that the fight is over", () => {
    const facts = noEffectFacts(87, "turn", KESTREL);
    expect(facts.modeChange).toEqual({ from: "turn", to: "free" });
    expect(factualSummary(facts)).toBe(
      "Kestrel acts, and nothing changes. The fight is over.",
    );
  });

  it("seq 53 holds the system commentary 'One action needs a clearer description.'", () => {
    const facts = noEffectFacts(52, "free", TAMSIN_PT4, [
      { actionId: "pt-4", question: "Which way do you press on?" },
    ]);
    expect(factualSummary(facts)).toContain(
      "One action needs a clearer description.",
    );
  });
});

describe("leaks: DM-only seed facts reach player-facing prompts (T013)", () => {
  it("the narrate system prompt holds 'river things' (L1, doctrine example)", () => {
    const facts = noEffectFacts(87, "turn", KESTREL);
    const ctx = makeCtx({});
    const assembled = {
      transcriptTail: [],
      presentNpcIds: [],
    } as unknown as Parameters<typeof buildNarratePrompt>[0]["assembled"];
    const prompt = buildNarratePrompt({ ctx, assembled, facts, prior: null });
    expect(prompt.system).toContain("river things");
  });

  it("the reed-camp narrate prompt holds Snag's want with 'river-things' (L2)", () => {
    const facts = buildNarrationFacts({
      trigger: "commit",
      seed: SEED,
      projections: projectedThrough(87),
      beat: [],
      director: director({ beatId: "reed-camp" }),
      adjudicate: null,
      resolve: noResolve(),
      presentNpcIds: [],
      modeBefore: "free",
      appendedRows: [],
      clarify: [],
    });
    const snag = facts.presentNpcs.find((n) => n.id === "snag");
    expect(snag?.want).toContain("river-things");
    const ctx = makeCtx({});
    const assembled = {
      transcriptTail: [],
      presentNpcIds: [],
    } as unknown as Parameters<typeof buildNarratePrompt>[0]["assembled"];
    const prompt = buildNarratePrompt({ ctx, assembled, facts, prior: null });
    expect(prompt.user).toContain("river-things");
  });

  it("Odo's companion prompt holds 'wards' (L3)", () => {
    const prompt = buildCompanionPrompt({
      seed: SEED,
      projections: projectedThrough(87),
      characterId: "odo",
      active: false,
    });
    expect(prompt.user).toContain("wards");
  });
});

describe("F17 and F76: facts and transcript lines lose detail (T014)", () => {
  it("F17: the Goblin-3 NPC turn facts do not hold 'jabs'", () => {
    const batchIds = [
      ...new Set(
        (fixture.ledger as { seq: number; batchId?: string | null }[]).flatMap(
          (r) => (r.seq === 60 || r.seq === 61 ? [r.batchId] : []),
        ),
      ),
    ].filter((b): b is string => !!b);
    expect(batchIds.length).toBe(1);
    const facts = buildNarrationFacts({
      trigger: "npc-turn",
      seed: SEED,
      projections: projectedThrough(61),
      beat: [],
      director: director(),
      adjudicate: null,
      resolve: noResolve({
        npcTurn: {
          combatantId: "goblin-3",
          batchIds,
          awaitingDm: false,
        },
      }),
      presentNpcIds: [],
      modeBefore: "turn",
      appendedRows: [],
      clarify: [],
    });
    expect(facts.npcTurn?.rolls.length).toBeGreaterThan(0);
    expect(facts.npcTurn?.rolls[0]?.reason).toContain("jabs");
    expect(factEntries(facts).join("\n")).not.toContain("jabs");
  });

  it("F76: the transcript line for row 187 holds the seat's user id, not 'Tamsin'", () => {
    const p = projectedThrough(188);
    const entry = p.transcript.filter((e) => e.seq === 187);
    expect(entry).toHaveLength(1);
    const lines = transcriptEntries(entry);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(PLAYER_USER_ID);
    expect(lines[0]).not.toContain("Tamsin");
  });
});

describe("A3 and A4: clarify relay and craft judgments (T015)", () => {
  const CLEAN =
    "The tumblers give way, and the vault door swings inward on a breath of cold air. Something moves inside.";

  it("A3: the narrate prompt relays the clarify question verbatim", () => {
    const facts = noEffectFacts(
      194,
      "free",
      {
        ...TAMSIN_PT4,
        actionId: "pt-18",
      },
      [{ actionId: "pt-18", question: CLARIFY_QUESTION }],
    );
    const ctx = makeCtx({});
    const assembled = {
      transcriptTail: [],
      presentNpcIds: [],
    } as unknown as Parameters<typeof buildNarratePrompt>[0]["assembled"];
    const prompt = buildNarratePrompt({ ctx, assembled, facts, prior: null });
    expect(prompt.user).toContain(CLARIFY_QUESTION);
  });

  it("A3: prose ending with that question fails deterministicChecks as an option menu", () => {
    const facts = noEffectFacts(194, "free", TAMSIN_PT4, [
      { actionId: "pt-4", question: CLARIFY_QUESTION },
    ]);
    const r = deterministicChecks(facts, {
      prose: `Snag's spear stays level and the reeds hold their breath. ${CLARIFY_QUESTION}`,
      diceLines: renderDiceLines(facts),
    });
    expect(r.pass).toBe(false);
    expect(r.issues).toContainEqual({
      kind: "doctrine",
      detail: "The prose has a list line or ends on an either-or question.",
    });
  });

  it("A4: three doctrine-only dm.audit failures ship the fallback", async () => {
    expect(MAX_NARRATION_ATTEMPTS).toBe(3);
    type Call = { purpose: string; respond: unknown };
    const text = (value: string): Call => ({
      purpose: "dm.narrate",
      respond: { type: "text", value },
    });
    const doctrineOnly: Call = {
      purpose: "dm.audit",
      respond: {
        type: "json",
        value: {
          verdict: "fail",
          issues: [
            {
              kind: "doctrine",
              detail: "Ends on atmosphere rather than a demand.",
            },
          ],
        },
      },
    };
    const scripted = createScriptedDm(
      loadDmScript({
        v: 1,
        name: "audit-doctrine-only",
        dice: [],
        calls: [
          text(CLEAN),
          doctrineOnly,
          text(CLEAN),
          doctrineOnly,
          text(CLEAN),
          doctrineOnly,
        ],
      }),
    );
    const gateway = createGateway({
      config: scripted.aiConfig,
      sink: memorySink(),
      adapters: { fake: () => scripted.provider },
    });
    const events = freeEventsThrough("action.resolved");
    const base = makeCtx({
      deps: { gateway, loadProjections: async () => projectDm(events) },
    });
    const assembled = await assemble(base);
    if (!assembled.ok) throw new Error("assemble failed");
    const ctx0 = {
      ...base,
      results: {
        assemble: assembled.output,
        director: director(),
        resolve: noResolve(),
      },
    };
    const narrated = await narrate(ctx0);
    if (!narrated.ok) throw new Error("narrate failed");
    const out = await audit({
      ...ctx0,
      results: { ...ctx0.results, narrate: narrated.output },
    });
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.attempts).toHaveLength(3);
    expect(out.output.record.final).toBe("fallback");
    expect(out.output.shipped?.fallback).toBe(true);
  });
});
