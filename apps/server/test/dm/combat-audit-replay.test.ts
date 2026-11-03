import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import type { ClaimState } from "../../src/dm/claims.js";
import {
  type FactAction,
  type FactChange,
  type FactNpcTurn,
  type FactRoll,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { factualSummary } from "../../src/dm/fallback.js";
import type { AssembleOutput } from "../../src/dm/nodes/assemble.js";
import {
  audit,
  deterministicChecks,
  llmIssueBlocksFor,
} from "../../src/dm/nodes/audit.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import {
  dropStockEnding,
  withholdRefusedInputs,
} from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { buildAuditPrompt } from "../../src/dm/prompts/audit.js";
import { buildNarratePrompt, TURN_RULE } from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { makeCtx, projectDm, testSeed } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/**
 * TASK-0214 (spec 085) replay of runbook A playtest run 1, the five refusals at
 * seq 103, 126, 131, 161 and 196. Source: docs/playtests/2026-11-02-runbook-a-playtest.md
 * findings 10 to 28, session 9296c653, seed greyhollow-ford-reed-camp. The rows live
 * on vm-104, so each beat is REBUILT from that log (OQ-1 (a)): the fixture is the run 5
 * encounter (same party and goblin names), and any prose marked `// rebuilt` is not run 1
 * text. Only the logged fallback lines and the finding wording are from the log.
 */

const SEED_VIEW = playerFacingSeed(testSeed());
const EVENTS = JSON.parse(
  readFileSync("test/dm/fixtures/run5-narration-quality.json", "utf8"),
) as { transcript: Parameters<typeof projectDm>[0] };
const SNAPSHOT = buildSnapshot(
  projectDm(EVENTS.transcript.filter((r) => r.seq <= 58)),
  testSeed(),
);
const NO_DIFF = { fromSeq: 0, toSeq: 1, actors: [], stage: [] };

const state = (kestrelDown = false): ClaimState => ({
  snapshot: {
    ...SNAPSHOT,
    actors: SNAPSHOT.actors.map((a) =>
      kestrelDown && a.id === "kestrel"
        ? { ...a, lifeState: "unconscious" as const }
        : a,
    ),
  },
  diff: kestrelDown
    ? {
        ...NO_DIFF,
        actors: [
          {
            kind: "life-state" as const,
            actorId: "kestrel",
            before: "conscious" as const,
            after: "unconscious" as const,
          },
        ],
      }
    : NO_DIFF,
});

const POT = "Goblin with a pot-helm";
const PARTY = [
  { characterId: "tamsin", name: "Tamsin Vale", controller: "human" as const },
  {
    characterId: "odo",
    name: "Brother Odo",
    controller: "ai-companion" as const,
  },
  { characterId: "kestrel", name: "Kestrel", controller: "human" as const },
];

const roll = (
  name: string,
  target: string | null,
  over: Partial<FactRoll> = {},
): FactRoll => ({
  name,
  reason: `${name} attacks`,
  expression: "1d20+4",
  shown: "15",
  total: 19,
  against: { kind: "AC", value: 14 },
  outcome: "hit",
  autoFail: false,
  target,
  ...over,
});

function facts(over: Partial<NarrationFacts> = {}): NarrationFacts {
  return {
    trigger: "npc-turn" as NarrationFacts["trigger"],
    actions: [],
    npcTurn: null,
    director: {
      pacing: { tension: "high", spotlight: null, beatId: null },
      goalNote: "",
      sceneEnded: false,
    },
    modeChange: null,
    presentNpcs: [],
    rulings: [],
    clarify: [],
    party: PARTY,
    events: [],
    setting: { locationName: "The reed camp", openingFraming: "Smoke." },
    ...over,
  };
}

const npcTurn = (
  name: string,
  over: Partial<FactNpcTurn> = {},
): FactNpcTurn => ({
  name,
  plan: { intent: "other", reasons: [], say: null, held: false },
  rolls: [],
  outcomes: [],
  changes: [],
  ...over,
});

const OFF = (...skip: string[]) =>
  [
    "Snag",
    "Tamsin Vale",
    "Brother Odo",
    "Goblin lookout",
    "Goblin by the fire",
    POT,
    "Kestrel",
  ].filter((n) => !skip.includes(n));

const issueKinds = (f: NarrationFacts, prose: string, st = state()) =>
  deterministicChecks(
    f,
    { prose, diceLines: renderDiceLines(f) },
    st,
  ).issues.map((i) => i.kind);
const passes = (f: NarrationFacts, prose: string, st = state()) =>
  deterministicChecks(f, { prose, diceLines: renderDiceLines(f) }, st).pass;

/** The next-version prompts hold the shared turn rule and the Off turn line. */
function promptsHoldTurnRule(f: NarrationFacts, prose = "x") {
  const np = buildNarratePrompt({
    seed: SEED_VIEW,
    roster: [],
    assembled: { transcriptTail: [] } as unknown as AssembleOutput,
    snapshot: SNAPSHOT,
    facts: f,
    prior: null,
  });
  expect(np.system).toContain(TURN_RULE);
  expect(np.user).toContain(`Off turn: ${f.turn?.offTurn?.join(", ")}`);
  const ap = buildAuditPrompt({ facts: f, snapshot: SNAPSHOT, prose });
  expect(ap.system).toContain(TURN_RULE);
  return { np, ap };
}

const fallbackPasses = (f: NarrationFacts, st = state()) => {
  const prose = factualSummary(f, st);
  expect(passes(f, prose, st)).toBe(true);
  return prose;
};

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "high", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};

type Call = { purpose: string; respond: unknown };
const text = (value: string): Call => ({
  purpose: "dm.narrate",
  respond: { type: "text", value },
});
const auditJson = (verdict: "pass" | "fail", issues: unknown[] = []): Call => ({
  purpose: "dm.audit",
  respond: { type: "json", value: { verdict, issues } },
});

/** Runs the real audit loop over a prebuilt narration with a scripted gateway. */
async function runAudit(
  f: NarrationFacts,
  prose: string,
  calls: Call[],
  st = state(),
) {
  const scripted = createScriptedDm(
    loadDmScript({ v: 1, name: "replay", dice: [], calls: calls as never }),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const diceLines = renderDiceLines(f);
  const resolve: ResolveOutput = {
    submissions: [],
    actionResults: [],
    appendedRows: [],
    nextJob: null,
    chronicle: false,
    npcTurn: null,
    ...EMPTY_RESOLVE_SNAPSHOT,
    snapshot: st.snapshot,
    diff: st.diff ?? NO_DIFF,
    lastSeq: 0,
  };
  const ctx = makeCtx({ deps: { gateway } });
  const out = await audit({
    ...ctx,
    results: {
      assemble: {
        transcriptTail: [],
        projections: { party: [] },
      } as unknown as AssembleOutput,
      director,
      resolve,
      narrate: {
        prose,
        diceLines,
        text: prose,
        actionIds: [],
        attempt: 1,
        skipped: false,
        facts: f,
        withheld: [],
      },
    },
  });
  if (!out.ok) throw new Error("audit failed");
  return out;
}

describe("run 1 seq 103: Snag pulls Pell in (findings 11, 28)", () => {
  const f = facts({
    npcTurn: npcTurn("Snag", {
      plan: {
        intent: "other",
        reasons: ["Snag drags Pell into the fight."],
        say: null,
        held: false,
      },
    }),
    turn: {
      actor: "Snag",
      next: "Goblin lookout",
      offTurn: OFF("Snag", "Kestrel"),
    },
    pulled: [
      {
        name: "Pell Marsh",
        rolls: [
          roll("Pell Marsh", null, {
            reason: "Pell Marsh rolls initiative",
            against: null,
            outcome: null,
            total: 16,
          }),
        ],
        outcomes: [],
        changes: [],
      },
    ],
  });
  it("the prompts hold the turn rule and the Off turn line", () => {
    promptsHoldTurnRule(f);
  });
  it("blocks Odo firing an arrow in code, before dm.audit", () => {
    // rebuilt: finding 11 names "Odo firing an arrow", not the prose.
    expect(issueKinds(f, "Brother Odo looses an arrow at Snag.")).toContain(
      "invented-mechanics",
    );
  });
  it("blocks 'the lookout dies' with no dead actor", () => {
    // rebuilt: finding 11 names "dies with no dead actor", not the prose.
    expect(issueKinds(f, "The goblin lookout dies.")).toContain(
      "ledger-mismatch",
    );
  });
  it("the fallback passes and holds Pell's initiative dice line (TASK-0213)", () => {
    fallbackPasses(f);
    expect(renderDiceLines(f).join("\n")).toContain("Pell Marsh");
  });
});

describe("run 1 seq 126: Pell's talk turn (findings 15, 16)", () => {
  const SAY = "Two goblins hide left of the fire.";
  const f = facts({
    npcTurn: npcTurn("Pell Marsh", {
      plan: {
        intent: "talk",
        reasons: ["Pell shouts a warning about the clapper."],
        say: SAY,
        held: false,
      },
    }),
    turn: { actor: "Pell Marsh", next: POT, offTurn: OFF() },
  });
  it("the prompts hold the turn rule and the Off turn line", () => {
    promptsHoldTurnRule(f);
  });
  it("blocks the next actor lunging at Kestrel", () => {
    // rebuilt: finding 16 says the narration shows the next actor acting.
    expect(
      issueKinds(f, "The goblin with a pot-helm lunges at Kestrel."),
    ).toContain("invented-mechanics");
  });
  it("ships attempt 1 when the audit's player-agency issue is about an NPC", async () => {
    const prose = `Pell Marsh cups his hands and shouts, "${SAY}"`; // rebuilt
    expect(passes(f, prose)).toBe(true);
    const issue = {
      kind: "player-agency",
      detail: "Narration decides what Kestrel feels about Snag's sneer.",
      actor: "Snag",
    };
    expect(llmIssueBlocksFor(issue as never, PARTY)).toBe(false);
    const out = await runAudit(f, prose, [
      text(prose),
      auditJson("fail", [issue]),
    ]);
    expect(out.output.record.attempts).toHaveLength(1);
    expect(out.output.record.final).toBe("passed");
    expect(out.output.shipped?.prose).toBe(prose);
  });
  it("the fallback passes", () => {
    fallbackPasses(f);
  });
});

describe("run 1 seq 131: the pot-helm goblin, step none (findings 16)", () => {
  const f = facts({
    npcTurn: npcTurn(POT),
    turn: {
      actor: POT,
      next: "Goblin by the fire",
      offTurn: OFF(POT, "Kestrel"),
    },
    director: {
      pacing: { tension: "high", spotlight: null, beatId: null },
      goalNote: "Two goblins down; Snag eyes a bargain.",
      sceneEnded: false,
    },
  });
  it("the prompts hold the turn rule and the Off turn line", () => {
    promptsHoldTurnRule(f);
  });
  it("passes the logged text on the turn check", () => {
    // Logged: "rises from the rushes at Kestrel's flank, scimitar ready"; the subject is rebuilt.
    expect(
      passes(
        f,
        "The goblin with a pot-helm rises from the rushes at Kestrel's flank, scimitar ready.",
      ),
    ).toBe(true);
  });
  it("blocks the goblin by the fire hurling a spear", () => {
    // rebuilt: finding 16 says another NPC acted in this beat.
    expect(issueKinds(f, "The goblin by the fire hurls a spear.")).toContain(
      "invented-mechanics",
    );
  });
  it("withholds the goal note, which states a count", () => {
    const w = withholdRefusedInputs(f, state());
    expect(w.facts.director.goalNote).toBe("");
    expect(w.withheld.length).toBeGreaterThan(0);
    const { np } = promptsHoldTurnRule(w.facts);
    expect(np.user).not.toContain("Two goblins down");
  });
  it("drops the stock ending before the audit sees the prose", () => {
    // rebuilt: finding 3 names the "What do you do?" ending, not this prose.
    const prose = dropStockEnding(
      "The goblin with a pot-helm rises from the rushes, scimitar ready. What do you do?",
    );
    expect(prose).not.toMatch(/what do you do/i);
    expect(passes(f, prose)).toBe(true);
  });
  it("the fallback passes", () => {
    fallbackPasses(f);
  });
});

describe("run 1 seq 161: Kestrel's move and the reaction hit (findings 19)", () => {
  const action: FactAction = {
    actionId: "a1",
    characterName: "Kestrel",
    text: "I run to Pell and attempt to free him",
    outcome: "applied",
    refusalCode: null,
    rolls: [roll(POT, "Kestrel", { reaction: true })],
    outcomes: ["hit"],
    changes: [],
    followUps: ["Kestrel attempts to cut or untie Pell's bonds"],
  };
  const f = facts({
    trigger: "commit",
    actions: [action],
    turn: {
      actor: "Kestrel",
      next: "Snag",
      offTurn: OFF("Kestrel", POT),
    },
  });
  it("the prompts hold the turn rule and the Off turn line", () => {
    promptsHoldTurnRule(f);
  });
  it("passes the reaction roller striking (on turn by its roll)", () => {
    // rebuilt: finding 19 names the pot-helm goblin's reaction swing.
    expect(
      passes(f, "The goblin with a pot-helm strikes as Kestrel pulls away."),
    ).toBe(true);
  });
  it("blocks Snag striking at Kestrel", () => {
    // rebuilt: finding 19 says Snag's next narration showed a strike and a free.
    expect(issueKinds(f, "Snag strikes at Kestrel with his spear.")).toContain(
      "invented-mechanics",
    );
  });
  it("passes the free in code (OQ-2) and blocks it on a scripted audit issue", async () => {
    const prose = "Kestrel's blade parts the rope."; // rebuilt: finding 19 quotes 'finds the rope'
    expect(passes(f, prose)).toBe(true);
    const ap = buildAuditPrompt({ facts: f, snapshot: SNAPSHOT, prose });
    expect(ap.user).toContain("not yet attempted:");
    const out = await runAudit(f, prose, [
      text(prose),
      auditJson("fail", [
        {
          kind: "invented-mechanics",
          detail: "The free was not attempted; the rope parts with no roll.",
        },
      ]),
      text("Kestrel breaks away from the goblin's reaction swing."), // rebuilt
      auditJson("pass"),
    ]);
    const first = out.output.record.attempts[0]?.llm;
    expect(first).toMatchObject({
      issues: [{ kind: "invented-mechanics", blocking: true }],
    });
    expect(out.output.record.final).toBe("passed-after-regenerate");
  });
  it("the fallback passes", () => {
    fallbackPasses(f);
  });
});

describe("run 1 seq 196: the goblin drops Kestrel (findings 25)", () => {
  const changes: FactChange[] = [
    {
      kind: "hp",
      target: "Kestrel",
      direction: "damage",
      amount: 5,
      damageType: "slashing",
      before: 5,
      after: 0,
    },
    {
      kind: "life-state",
      target: "Kestrel",
      before: "conscious",
      after: "unconscious",
    },
    {
      kind: "condition",
      target: "Kestrel",
      op: "applied",
      condition: "unconscious",
    },
  ];
  const f = facts({
    npcTurn: npcTurn(POT, {
      rolls: [roll(POT, "Kestrel")],
      outcomes: ["hit"],
      changes,
    }),
    turn: { actor: POT, next: "Snag", offTurn: OFF(POT, "Kestrel") },
  });
  const st = state(true);
  it("the prompts hold the turn rule and the Off turn line", () => {
    promptsHoldTurnRule(f);
  });
  it("blocks Odo lunging at the goblin; the cry alone passes", () => {
    // rebuilt: finding 25 does not name the Odo prose; the OQ-3 seq 196 audit issue is the source.
    expect(
      issueKinds(f, "Brother Odo cries out and lunges at the goblin.", st),
    ).toContain("invented-mechanics");
    expect(
      passes(f, "Brother Odo cries out as Kestrel falls unconscious.", st),
    ).toBe(true);
  });
  it("an audit player-agency issue about Odo blocks (OQ-3 (a)); about Snag is advisory", () => {
    const about = (actor: string) => ({
      kind: "player-agency" as const,
      detail: "Narration decides what Odo feels as Kestrel falls.",
      actor,
    });
    expect(llmIssueBlocksFor(about("Odo"), PARTY)).toBe(true);
    expect(llmIssueBlocksFor(about("Snag"), PARTY)).toBe(false);
  });
  it("the fallback says 'falls unconscious' once (TASK-0212)", () => {
    const prose = fallbackPasses(f, st);
    expect(prose.match(/falls unconscious/g)).toHaveLength(1);
  });
});
