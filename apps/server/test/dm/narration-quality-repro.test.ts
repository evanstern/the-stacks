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
import { buildChroniclePrompt } from "../../src/dm/prompts/chronicle.js";
import { rosterOf, transcriptEntries } from "../../src/dm/prompts/common.js";
import { buildCompanionPrompt } from "../../src/dm/prompts/companion.js";
import {
  buildNarratePrompt,
  factEntries,
} from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { freeEventsThrough, makeCtx, projectDm, testSeed } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/**
 * TASK-0106 Phase 1: each test reproduces a run-5 defect on the UNFIXED code,
 * from the real rows of run 5 (fixtures/run5-narration-quality.json). Phase 2 flips
 * the leak tests (T013) and the F76 line (T014) to the fixed behavior. Later
 * phases flip the rest.
 */

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures/run5-narration-quality.json"), "utf8"),
) as { source: string; transcript: StoredEvent[]; ledger: { seq: number }[] };

const SEED = testSeed();
const VIEW = playerFacingSeed(SEED);
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
  ...EMPTY_RESOLVE_SNAPSHOT,
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
  rows: StoredEvent[] = [],
): NarrationFacts {
  return buildNarrationFacts({
    trigger: "commit",
    seed: VIEW,
    beatNpcIds: [],
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
      appendedRows: rows,
    }),
    presentNpcIds: [],
    modeBefore,
    appendedRows: rows,
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

describe("F23: the fallback states the ledger in the fiction (T012, flipped)", () => {
  it("seq 88 says the fight stops and drops 'nothing changes'", () => {
    const facts = noEffectFacts(
      87,
      "turn",
      KESTREL,
      [],
      fixture.transcript.filter((r) => r.seq >= 85 && r.seq <= 87),
    );
    expect(facts.modeChange).toEqual({ from: "turn", to: "free" });
    expect(factualSummary(facts)).toBe(
      "Kestrel goes ahead with it. The fighting stops.",
    );
  });

  it("seq 53 states the fight, the joiners and the first mover, and asks", () => {
    const facts = noEffectFacts(
      52,
      "free",
      TAMSIN_PT4,
      [{ actionId: "pt-4", question: "Which way do you press on?" }],
      fixture.transcript.filter((r) => r.seq >= 39 && r.seq <= 52),
    );
    const out = factualSummary(facts);
    expect(out).toBe(
      "A fight breaks out. Snag, Goblin with a pot-helm, Goblin lookout and Goblin by the fire join the fight. Snag moves first. Which way do you press on?",
    );
    expect(out).not.toContain("clearer description");
  });
});

describe("leaks: DM-only seed facts no longer reach player-facing prompts (T013)", () => {
  const assembled = {
    transcriptTail: [],
    presentNpcIds: [],
  } as unknown as Parameters<typeof buildNarratePrompt>[0]["assembled"];

  it("the narrate system prompt no longer holds 'river things' (L1, doctrine example)", () => {
    const facts = noEffectFacts(87, "turn", KESTREL);
    const prompt = buildNarratePrompt({
      seed: VIEW,
      roster: [],
      assembled,
      snapshot: buildSnapshot(projectedThrough(87), SEED),
      facts,
      prior: null,
    });
    expect(prompt.system).not.toMatch(/river[- ]things?/i);
  });

  it("the reed-camp narrate prompt carries Snag's shown want, not the river-things (L2)", () => {
    const facts = buildNarrationFacts({
      trigger: "commit",
      seed: VIEW,
      beatNpcIds: ["snag", "pell"],
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
    expect(snag?.want).toBe(
      "To keep the clapper and make the big-feet pay to cross his reeds.",
    );
    const prompt = buildNarratePrompt({
      seed: VIEW,
      roster: [],
      assembled,
      snapshot: buildSnapshot(projectedThrough(87), SEED),
      facts,
      prior: null,
    });
    expect(prompt.user).toContain("make the big-feet pay");
    expect(prompt.user).not.toMatch(/river[- ]things?/i);
  });

  it("Odo's companion prompt no longer holds 'wards' (L3)", () => {
    const prompt = buildCompanionPrompt({
      seed: VIEW,
      projections: projectedThrough(87),
      snapshot: buildSnapshot(projectedThrough(87), SEED),
      characterId: "odo",
      active: false,
    });
    expect(prompt.user).not.toMatch(/\bwards?\b/i);
    expect(prompt.user).toContain("anything that rings or shines");
  });
});

describe("F17 and F76: facts and transcript lines lose detail (T014)", () => {
  it("F17: the Goblin-3 NPC turn facts render the roll reason and target", () => {
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
      seed: VIEW,
      beatNpcIds: [],
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
    expect(factEntries(facts).join("\n")).toContain(
      "jabs at Tamsin with its dagger",
    );
  });

  it("F76: the transcript line for row 187 names 'Tamsin Vale' and drops the user id (public, with roster)", () => {
    const p = projectedThrough(188);
    const entry = p.transcript.filter((e) => e.seq === 187);
    expect(entry).toHaveLength(1);
    // Without a roster the line is unchanged (director and interpret).
    expect(transcriptEntries(entry)[0]).toContain(PLAYER_USER_ID);
    const lines = transcriptEntries(entry, rosterOf(p.party));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Tamsin Vale");
    expect(lines[0]).not.toContain(PLAYER_USER_ID);
    // A dm-visibility entry drops out under a roster.
    const dm = [{ ...entry[0], seq: 999, visibility: "dm" }] as typeof entry;
    expect(transcriptEntries(dm, rosterOf(p.party))).toEqual([]);
    // Chronicle, companion and narrate all pass the roster.
    const chronicle = buildChroniclePrompt({
      snapshot: buildSnapshot(p, SEED),
      transcript: entry,
      goal: "",
      trackerNames: [],
      roster: rosterOf(p.party),
    });
    expect(chronicle.user).toContain("Tamsin Vale");
    expect(chronicle.user).not.toContain(PLAYER_USER_ID);
    const companion = buildCompanionPrompt({
      seed: VIEW,
      projections: p,
      snapshot: buildSnapshot(p, SEED),
      characterId: "odo",
      active: false,
    });
    expect(companion.user).toContain("Tamsin Vale declared");
    expect(companion.user).not.toContain(PLAYER_USER_ID);
  });
});

describe("A3 and A4: clarify relay and craft judgments (T015)", () => {
  const CLEAN =
    "The tumblers give way, and the vault door swings inward on a breath of cold air. Something moves inside.";

  it("A3 (flipped): the narrate prompt tells the model to ask in its own words, never to offer options", () => {
    const facts = noEffectFacts(
      194,
      "free",
      {
        ...TAMSIN_PT4,
        actionId: "pt-18",
      },
      [{ actionId: "pt-18", question: CLARIFY_QUESTION }],
    );
    const assembled = {
      transcriptTail: [],
      presentNpcIds: [],
    } as unknown as Parameters<typeof buildNarratePrompt>[0]["assembled"];
    const prompt = buildNarratePrompt({
      seed: VIEW,
      roster: [],
      assembled,
      snapshot: buildSnapshot(projectedThrough(87), SEED),
      facts,
      prior: null,
    });
    expect(prompt.system).toContain(
      "end with the Unclear intent question exactly as written",
    );
    expect(prompt.system).toContain("except the Unclear intent question.");
    expect(prompt.user).toContain(
      "on hold (the intent is unclear; nothing happened yet)",
    );
  });

  it("A3 (flipped by spec 073): prose ending with the clarify question passes the option-menu check", () => {
    const facts = noEffectFacts(194, "free", TAMSIN_PT4, [
      { actionId: "pt-4", question: CLARIFY_QUESTION },
    ]);
    const r = deterministicChecks(
      facts,
      {
        prose: `Snag's spear stays level and the reeds hold their breath. ${CLARIFY_QUESTION}`,
        diceLines: renderDiceLines(facts),
      },
      EMPTY_RESOLVE_SNAPSHOT,
    );
    expect(r.pass).toBe(true);
  });

  it("A4 (flipped): a doctrine-only dm.audit failure ships the narration on attempt 1", async () => {
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
        calls: [text(CLEAN), doctrineOnly],
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
    expect(out.output.record.attempts).toHaveLength(1);
    expect(out.output.record.final).toBe("passed");
    expect(out.output.record.flagged).toBe(false);
    expect(out.output.shipped?.fallback).toBe(false);
    expect(out.output.shipped?.prose).toBe(CLEAN);
  });
});
