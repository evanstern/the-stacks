import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import type { ClaimState } from "../../src/dm/claims.js";
import {
  type FactAction,
  type FactOutcome,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import {
  AuditModelOutput,
  audit,
  detailNamesPartyMember,
  deterministicChecks,
  llmIssueBlocksFor,
  MAX_NARRATION_ATTEMPTS,
} from "../../src/dm/nodes/audit.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import type {
  ActorChange,
  LifeState,
  SnapshotActor,
} from "../../src/dm/snapshot/types.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

const roll = (outcome: FactOutcome | null = "success") => ({
  name: "Ana",
  reason: "Ana picks the lock",
  expression: "1d20+5",
  shown: "13",
  total: 18,
  against: { kind: "DC" as const, value: 15 },
  outcome,
  autoFail: false,
  target: null,
});

function action(over: Partial<FactAction> = {}): FactAction {
  return {
    actionId: "a1",
    characterName: "Ana",
    text: "picks the lock",
    outcome: "applied",
    refusalCode: null,
    rolls: [roll()],
    outcomes: ["success"],
    changes: [],
    followUps: [],
    ...over,
  };
}

function facts(actions: FactAction[] = [action()]): NarrationFacts {
  return {
    trigger: "commit",
    actions,
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
    setting: { locationName: "The Vault", openingFraming: "The vault waits." },
  };
}

const CLEAN =
  "The last tumbler gives, and the vault door sighs open on cold air. Something shifts in the dark beyond.";

function guard(over: Partial<SnapshotActor> = {}): SnapshotActor {
  return {
    id: "guard",
    combatantId: "guard",
    characterId: null,
    name: "Guard",
    aliases: ["Guard"],
    kind: "monster",
    controller: { kind: "dm" },
    hp: { current: 5, max: 5, temp: 0 },
    lifeState: "conscious",
    conditions: [],
    ac: 12,
    initiative: null,
    resources: null,
    sheet: null,
    presence: "present",
    ...over,
  };
}

/** A ClaimState with one Guard; `changes` is this turn's diff. */
function claimState(
  life: LifeState | null = "conscious",
  changes: ActorChange[] = [],
): ClaimState {
  return {
    snapshot: {
      ...EMPTY_RESOLVE_SNAPSHOT.snapshot,
      actors: [guard({ lifeState: life })],
    },
    diff: { fromSeq: 0, toSeq: 1, actors: changes, stage: [] },
  };
}

const guardLife = (
  after: LifeState,
  before: LifeState = "conscious",
): ActorChange => ({ kind: "life-state", actorId: "guard", before, after });

function check(prose: string, f = facts(), state: ClaimState = claimState()) {
  return deterministicChecks(
    f,
    { prose, diceLines: renderDiceLines(f) },
    state,
  );
}

describe("deterministicChecks", () => {
  describe("spell-slot claims (TASK-0211 AC #3)", () => {
    const claim =
      "Odo spends his last first-level slot and light floods the wound.";
    const spend = action({
      changes: [
        { kind: "spell-slot", target: "Odo", pool: "standard", level: 1 },
      ],
    });
    it("fails prose that says a slot was spent when the engine spent none", () => {
      const r = check(claim);
      expect(r.pass).toBe(false);
      expect(r.issues[0]?.kind).toBe("ledger-mismatch");
    });
    it("passes the same prose when the engine spent a slot", () => {
      expect(check(claim, facts([spend])).pass).toBe(true);
    });
    it("ignores a slot that is not a spell slot", () => {
      expect(check("Ana uses the slot in the door to peer through.").pass).toBe(
        true,
      );
    });
  });

  it("passes a clean narration", () => {
    expect(check(CLEAN)).toEqual({ pass: true, issues: [] });
  });

  it("does not pair the character with a reaction attack's outcome (spec 079)", () => {
    const hit = {
      ...roll("hit"),
      name: "Goblin with a pot-helm",
      reaction: true,
      target: "Ana",
    };
    const f = facts([action({ rolls: [hit], outcomes: ["hit"] })]);
    expect(check("Ana misses her footing in the mud.", f).pass).toBe(true);
    const own = facts([action({ rolls: [roll("hit")], outcomes: ["hit"] })]);
    expect(check("Ana misses her footing in the mud.", own).pass).toBe(false);
  });

  it("refuses a success-at-cost actor paired with a failure word (spec 070 US4 #3)", () => {
    const cost = {
      ...roll("success"),
      band: "success-at-cost" as const,
      margin: -2,
      consequence: "It works, at a small price.",
    };
    const f = facts([action({ rolls: [cost], outcomes: ["success"] })]);
    expect(check("Ana fails to move the stuck lock.", f).pass).toBe(false);
    expect(check("Ana forces the lock, wincing at the cost.", f).pass).toBe(
      true,
    );
  });

  it("fails on digits", () => {
    const r = check("Ana opens 3 locks. The door groans.");
    expect(r.pass).toBe(false);
    expect(r.issues[0]?.kind).toBe("ledger-mismatch");
  });

  it("fails on dice language when the turn has no roll", () => {
    const f = facts([action({ rolls: [], outcomes: [] })]);
    const bad = check("Ana rolls a die and the lock gives way.", f);
    expect(bad.issues.map((i) => i.kind)).toContain("invented-mechanics");
    expect(check("Ana rolls a die and the lock gives way.").pass).toBe(true);
  });

  it("fails an attributed death on a living Guard (keyed, not anonymous)", () => {
    const r = check("The guard dies where he stands.");
    expect(r.pass).toBe(false);
    expect(r.issues[0]?.kind).toBe("ledger-mismatch");
    expect(r.issues[0]?.detail).toMatch(/^Actor state: /);
  });

  it("passes a death word for a Guard already dead in S1", () => {
    expect(
      check(
        "The guard is dead, and the lock gives.",
        facts(),
        claimState("dead"),
      ).pass,
    ).toBe(true);
  });

  it("does not block the omission of a diff death; code writes the life-state row (spec 098 OQ-6)", () => {
    const dead = claimState("dead", [guardLife("dead")]);
    expect(check(CLEAN, facts(), dead).pass).toBe(true);
    expect(
      check("The guard is dead, and the lock gives.", facts(), dead).pass,
    ).toBe(true);
  });

  it("fails an attributed drop on a living Guard", () => {
    const r = check("The guard is knocked out.");
    expect(r.pass).toBe(false);
    expect(r.issues[0]?.detail).toMatch(/^Actor state: /);
  });

  it("passes a drop word for a Guard already unconscious in S1", () => {
    expect(
      check("The guard is knocked out.", facts(), claimState("unconscious"))
        .pass,
    ).toBe(true);
  });

  it("does not block the omission of a diff drop (spec 098 OQ-6)", () => {
    const down = claimState("unconscious", [guardLife("unconscious")]);
    expect(check(CLEAN, facts(), down).pass).toBe(true);
    expect(
      check("The guard falls unconscious. The lock gives.", facts(), down).pass,
    ).toBe(true);
  });

  it("passes an unattributed death word when S1 holds a dead actor, fails it otherwise", () => {
    expect(check("Someone dies in the dark.").pass).toBe(false);
    expect(
      check("Someone dies in the dark.", facts(), claimState("dead")).pass,
    ).toBe(true);
  });

  it("marks every claim issue ledger-mismatch with an 'Actor state:' detail (OQ-4)", () => {
    const r = check("The guard dies where he stands. The guard speaks.");
    const claims = r.issues.filter((i) => i.detail.startsWith("Actor state: "));
    expect(claims.length).toBeGreaterThan(0);
    for (const i of claims) expect(i.kind).toBe("ledger-mismatch");
  });

  it("fails when the actor's name pairs with the opposite outcome word", () => {
    const r = check("Ana fails to move the lock at all.");
    expect(r.issues[0]?.kind).toBe("ledger-mismatch");
    const miss = facts([action({ rolls: [roll("miss")], outcomes: ["miss"] })]);
    expect(check("Ana hits the door with her sword.", miss).pass).toBe(false);
    expect(check("Ana swings and the blade bites air.", miss).pass).toBe(true);
  });

  it("matches a full name by its first or last word", () => {
    const f = facts([
      action({
        characterName: "Brother Odo",
        rolls: [{ ...roll(), name: "Brother Odo" }],
      }),
    ]);
    expect(check("Odo fails to move the lock.", f).pass).toBe(false);
    expect(check("Brother fails to move the lock.", f).pass).toBe(false);
  });

  it("fails on length over 220 words", () => {
    const long = Array.from({ length: 230 }, () => "word").join(" ");
    expect(check(long).issues.map((i) => i.kind)).toContain("doctrine");
  });

  it("fails on a list line or an either-or ending", () => {
    expect(check("- the door\n- the lock").pass).toBe(false);
    expect(check("1. The door opens.").pass).toBe(false);
    expect(check("The door opens. Do you fight or flee?").pass).toBe(false);
    expect(check("The door opens. What waits behind it?").pass).toBe(true);
  });

  it("fails a clarify turn whose prose has no closing question, passes an open one", () => {
    const f = {
      ...facts(),
      clarify: [{ actionId: "a1", question: "What does Ana do?" }],
    };
    const bad = check(CLEAN, f);
    expect(bad.issues).toContainEqual({
      kind: "doctrine",
      detail: "The facts ask a question and the prose does not end with one.",
    });
    expect(check(`${CLEAN} What does Ana do next?`, f).pass).toBe(true);
    expect(check(CLEAN).pass).toBe(true);
  });

  it("exempts the clarify question from the option-menu check", () => {
    const q = "Longsword in melee, or the light crossbow at range?";
    const f = { ...facts(), clarify: [{ actionId: "a1", question: q }] };
    expect(check(`${CLEAN} ${q}`, f).pass).toBe(true);
    const other = check(`${CLEAN} Do you fight or flee?`, f);
    expect(other.issues.some((i) => i.detail.includes("option menu"))).toBe(
      true,
    );
    const list = check(`- one\n- two\n${q}`, f);
    expect(list.issues.some((i) => i.detail.includes("option menu"))).toBe(
      true,
    );
  });

  it("quotes the matched words, the closing question and the word count", () => {
    const death = check("The guard dies where he stands.").issues[0];
    expect(death?.detail).toMatch(/^Actor state: .*dies/);
    const menu = check("The door opens. Do you fight or flee?").issues[0];
    expect(menu?.detail).toContain('"Do you fight or flee?"');
    const long = Array.from({ length: 230 }, () => "word").join(" ");
    expect(check(long).issues[0]?.detail).toBe(
      "The prose is 230 words; the limit is 220.",
    );
  });

  it("fails when the dice lines differ from the renderer", () => {
    const f = facts();
    const r = deterministicChecks(
      f,
      { prose: CLEAN, diceLines: ["forged"] },
      claimState(),
    );
    expect(r.issues[0]?.detail).toMatch(/dice lines/);
  });
});

describe("restate block (spec 098 R4)", () => {
  const f = {
    ...facts([
      action({
        characterName: "Ana",
        text: "I hold my ground",
        rolls: [{ ...roll("miss"), name: "Goblin", target: "Ana" }],
        outcomes: ["miss"],
      }),
    ]),
    party: [{ characterId: "ana", name: "Ana", controller: "human" as const }],
  };
  // The restate quotes the player's words; a dodge in it is the player's, not the DM's.
  const restate = "Ana means to dodge the blow.";
  const rest = "The blow goes wide of the post.";
  it("the agency check skips the restate block", () => {
    const r = deterministicChecks(
      f,
      {
        prose: `${restate}\n\n${rest}`,
        diceLines: renderDiceLines(f),
        restate,
      },
      claimState(),
    );
    expect(r.issues.filter((i) => i.kind === "player-agency")).toEqual([]);
  });
  it("the agency check still reads the describe slot", () => {
    const r = deterministicChecks(
      f,
      {
        prose: `${restate}\n\nAna dodges the blow.`,
        diceLines: renderDiceLines(f),
        restate,
      },
      claimState(),
    );
    expect(r.issues.some((i) => i.kind === "player-agency")).toBe(true);
  });
});

const SEED_PARTY: NarrationFacts["party"] = [
  { characterId: "tamsin", name: "Tamsin Vale", controller: "human" },
  { characterId: "odo", name: "Brother Odo", controller: "ai-companion" },
  { characterId: "kestrel", name: "Kestrel", controller: "ai-companion" },
];

describe("literal stock ending (TASK-0204)", () => {
  const literal = (prose: string, f = facts()) =>
    check(prose, f).issues.some((i) =>
      i.detail.startsWith('The prose ends on "What do you do?".'),
    );

  it("fails narration that ends on the literal question", () => {
    expect(literal(`${CLEAN} What do you do?`)).toBe(true);
    expect(literal(`${CLEAN} "What do you all do?"`)).toBe(true);
    expect(literal(`${CLEAN} What do you two do?`)).toBe(true);
  });

  it("passes a named-character question and the phrase mid-prose", () => {
    expect(literal(`${CLEAN} What does Tamsin do?`)).toBe(false);
    expect(literal(`What do you do? ${CLEAN}`)).toBe(false);
  });

  it("a clarify question never ends on the literal phrase", () => {
    const q = "Kestrel's player decides what Kestrel does. What do you do?";
    const f = { ...facts(), clarify: [{ actionId: "a1", question: q }] };
    expect(literal(`${CLEAN} ${q}`, f)).toBe(true);
  });

  it("covers the scene-start opening path", () => {
    const f = { ...facts(), trigger: "scene-start" as const };
    expect(literal(`${CLEAN} What do you do?`, f)).toBe(true);
    expect(literal(`${CLEAN} What does Tamsin do?`, f)).toBe(false);
  });
});

describe("off-turn actors (TASK-0214)", () => {
  const f = (offTurn?: string[]) => ({
    ...facts(),
    turn: { actor: "Ana", next: null, ...(offTurn ? { offTurn } : {}) },
  });
  it("blocks an off-turn turn action as invented-mechanics", () => {
    const r = check(`${CLEAN} Guard hurls a spear.`, f(["Guard"]));
    expect(r.issues.map((i) => i.kind)).toContain("invented-mechanics");
    expect(r.issues.some((i) => i.detail.includes("off turn"))).toBe(true);
  });
  it("runs no check without an offTurn list", () => {
    expect(check(`${CLEAN} Guard hurls a spear.`, f()).pass).toBe(true);
    expect(check(`${CLEAN} Guard hurls a spear.`).pass).toBe(true);
  });
});

describe("issue actor blocking rule (TASK-0214)", () => {
  const issue = (actor?: string) => ({
    kind: "player-agency" as const,
    detail: "Narration decides what Kestrel feels about Snag's sneer.",
    ...(actor ? { actor } : {}),
  });
  it("an NPC actor is advisory even when the detail names a party member", () => {
    expect(llmIssueBlocksFor(issue("Snag"), SEED_PARTY)).toBe(false);
  });
  it("a party actor blocks", () => {
    expect(llmIssueBlocksFor(issue("Brother Odo"), SEED_PARTY)).toBe(true);
  });
  it("no actor falls back to the detail test", () => {
    expect(llmIssueBlocksFor(issue(), SEED_PARTY)).toBe(true);
  });
  it("parses a reply with and without actor", () => {
    const base = {
      verdict: "fail",
      issues: [{ kind: "doctrine", detail: "x" }],
    };
    expect(AuditModelOutput.safeParse(base).success).toBe(true);
    expect(
      AuditModelOutput.safeParse({
        ...base,
        issues: [{ kind: "doctrine", detail: "x", actor: "Snag" }],
      }).success,
    ).toBe(true);
  });
});

describe("detailNamesPartyMember (party-name filter, E2)", () => {
  const cases: [string, string, boolean][] = [
    [
      "world character only (seq 86)",
      "Narration decides Pell's emotional state and inner determination: it states what he feels.",
      false,
    ],
    [
      "world character the auditor calls party (seq 196)",
      "Narration decides Pell's emotional state ('eyes wide') ... Pell is not a party member; the rule is about party members only.",
      false,
    ],
    [
      "world character, words in mouth (seq 278)",
      "The narration puts words in Snag's mouth ...",
      false,
    ],
    [
      "given name of a human player (seq 278)",
      "Narration decides Tamsin 'straightens, sword easing down but not sheathed' ...",
      true,
    ],
    [
      "given name of a titled companion (seq 153)",
      "Narration states 'Odo doesn't flinch from the wound beneath his hands' ...",
      true,
    ],
    ["full titled name", "Narration decides what Brother Odo feels.", true],
    ["one-word companion name", "Narration decides Kestrel's reply.", true],
    ["character id, lowercase", "decides tamsin's stance", true],
    ["curly possessive", "decides what Odo\u2019s hands do", true],
    [
      "whitespace in a multi-word term",
      "decides what Brother   Odo feels",
      true,
    ],
    ["surname alone", "The Vale road is quiet; Pell flinches.", false],
    ["title word alone", "Pell calls for his brother.", false],
    ["term inside a longer word", "An odor of smoke; Pell coughs.", false],
    ["hyphenated suffix", "A Tamsin-like pose; Pell coughs.", false],
  ];
  it.each(cases)("%s", (_name, detail, blocks) => {
    expect(detailNamesPartyMember(detail, SEED_PARTY)).toBe(blocks);
  });

  it("matches nothing for an empty party", () => {
    expect(detailNamesPartyMember("Tamsin acts", [])).toBe(false);
  });
});

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

type Call = { purpose: string; respond: unknown };
const text = (purpose: string, value: string): Call => ({
  purpose,
  respond: { type: "text", value },
});
const json = (purpose: string, value: unknown): Call => ({
  purpose,
  respond: { type: "json", value },
});
const PASS = { verdict: "pass", issues: [] };
const FAIL = {
  verdict: "fail",
  issues: [{ kind: "ledger-mismatch", detail: "The door did not open." }],
};

async function loop(calls: Call[]) {
  const scripted = createScriptedDm(
    loadDmScript({ v: 1, name: "audit", dice: [], calls }),
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
    results: { assemble: assembled.output, director, resolve: resolved },
  };
  const narrated = await narrate(ctx0);
  if (!narrated.ok) throw new Error("narrate failed");
  const ctx = {
    ...ctx0,
    results: { ...ctx0.results, narrate: narrated.output },
  };
  const out = await audit(ctx);
  return { out, scripted, narrated: narrated.output };
}

describe("audit loop", () => {
  it("passes on the first attempt", async () => {
    const { out, scripted } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.final).toBe("passed");
    expect(out.output.record.flagged).toBe(false);
    expect(out.output.shipped?.prose).toContain(CLEAN);
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);
  });

  it("regenerates after a failed verdict and records the failed attempt", async () => {
    const { out } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", FAIL),
      text("dm.narrate", `${CLEAN} A draft stirs.`),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    const r = out.output.record;
    expect(r.final).toBe("passed-after-regenerate");
    expect(r.flagged).toBe(true);
    expect(r.attempts).toHaveLength(2);
    expect(r.attempts[0]?.llm).toMatchObject({ verdict: "fail" });
    expect(out.output.shipped?.prose).toContain("A draft stirs.");
    expect(out.output.shipped?.fallback).toBe(false);
  });

  it("passes on a doctrine-only fail and records the issue as advisory", async () => {
    const { out, scripted } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", {
        verdict: "fail",
        issues: [{ kind: "doctrine", detail: "Ends on atmosphere." }],
      }),
    ]);
    if (!out.ok) throw new Error("audit failed");
    const r = out.output.record;
    expect(r.final).toBe("passed");
    expect(r.flagged).toBe(false);
    expect(r.attempts).toHaveLength(1);
    expect(r.attempts[0]?.words).toBeGreaterThanOrEqual(
      CLEAN.split(/\s+/).length,
    );
    expect(r.attempts[0]?.llm).toMatchObject({
      issues: [{ kind: "doctrine", blocking: false }],
    });
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);
  });

  it("regenerates on player-agency and hands over only blocking issues", async () => {
    const { out } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", {
        verdict: "fail",
        issues: [
          { kind: "player-agency", detail: "Ana is made to feel afraid." },
          { kind: "doctrine", detail: "Too atmospheric." },
          { kind: "other", detail: "Odd phrasing." },
        ],
      }),
      text("dm.narrate", `${CLEAN} A draft stirs.`),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.final).toBe("passed-after-regenerate");
    expect(out.output.record.flagged).toBe(true);
    expect(out.output.record.attempts[0]?.llm).toMatchObject({
      issues: [
        { kind: "player-agency", blocking: true },
        { kind: "doctrine", blocking: false },
        { kind: "other", blocking: false },
      ],
    });
  });

  it("sends the regeneration prompt only the blocking issues", async () => {
    const seen: string[] = [];
    const calls: Call[] = [
      text("dm.narrate", CLEAN),
      json("dm.audit", {
        verdict: "fail",
        issues: [
          { kind: "invented-mechanics", detail: "A wound no fact records." },
          { kind: "doctrine", detail: "Too atmospheric." },
        ],
      }),
      text("dm.narrate", CLEAN),
      json("dm.audit", PASS),
    ];
    const scripted = createScriptedDm(
      loadDmScript({ v: 1, name: "audit", dice: [], calls }),
    );
    const provider = scripted.provider;
    const orig = provider.chat?.bind(provider);
    if (!orig) throw new Error("scripted provider has no chat");
    (provider as { chat: typeof orig }).chat = (model, req, opts) => {
      seen.push(JSON.stringify(req));
      return orig(model, req, opts);
    };
    const gateway = createGateway({
      config: scripted.aiConfig,
      sink: memorySink(),
      adapters: { fake: () => provider },
    });
    const events = freeEventsThrough("action.resolved");
    const base = makeCtx({
      deps: { gateway, loadProjections: async () => projectDm(events) },
    });
    const assembled = await assemble(base);
    if (!assembled.ok) throw new Error("assemble failed");
    const ctx0 = {
      ...base,
      results: { assemble: assembled.output, director, resolve: resolved },
    };
    const narrated = await narrate(ctx0);
    if (!narrated.ok) throw new Error("narrate failed");
    await audit({
      ...ctx0,
      results: { ...ctx0.results, narrate: narrated.output },
    });
    const regen = seen.find((s) => s.includes("Your previous text"));
    expect(regen).toContain("Issue (invented-mechanics)");
    expect(regen).not.toContain("Too atmospheric");
  });

  it("skips the model audit when a deterministic check fails", async () => {
    const { out } = await loop([
      text("dm.narrate", "Ana opens 3 locks."),
      text("dm.narrate", CLEAN),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.attempts[0]?.llm).toEqual({ skipped: true });
    expect(out.output.record.attempts[0]?.deterministic.pass).toBe(false);
  });

  it("stops at three attempts and ships the fallback with a flag", async () => {
    expect(MAX_NARRATION_ATTEMPTS).toBe(3);
    const { out, scripted } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", FAIL),
      text("dm.narrate", CLEAN),
      json("dm.audit", FAIL),
      text("dm.narrate", CLEAN),
      json("dm.audit", FAIL),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.attempts).toHaveLength(3);
    expect(out.output.record.final).toBe("fallback");
    expect(out.output.shipped?.fallback).toBe(true);
    expect(out.output.shipped?.flagBody).toMatch(/Attempt 3/);
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);
  });

  it("ships the fallback when the audit call itself errors", async () => {
    const { out } = await loop([
      text("dm.narrate", CLEAN),
      {
        purpose: "dm.audit",
        respond: { type: "error", kind: "upstream", message: "down" },
      },
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.attempts).toHaveLength(1);
    expect(out.output.record.attempts[0]?.llm).toEqual({ error: "gateway" });
    expect(out.output.shipped?.fallback).toBe(true);
    expect(out.output.shipped?.text).toContain("\n\n");
  });

  it("records a hash, not the prose", async () => {
    const { out } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(JSON.stringify(out.output.record)).not.toContain("tumbler");
    expect(out.output.record.attempts[0]?.proseSha256).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  const agency = (detail: string) => ({ kind: "player-agency", detail });

  it("ships on the first attempt when the only issue names a world character, recorded advisory", async () => {
    const { out, scripted } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", {
        verdict: "fail",
        issues: [agency("Narration decides Pell's emotional state.")],
      }),
    ]);
    if (!out.ok) throw new Error("audit failed");
    const r = out.output.record;
    expect(r.final).toBe("passed");
    expect(r.attempts).toHaveLength(1);
    expect(r.attempts[0]?.llm).toMatchObject({
      issues: [{ kind: "player-agency", blocking: false }],
    });
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);
  });

  it("regenerates when the only player-agency issue names a party member", async () => {
    const { out } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", {
        verdict: "fail",
        issues: [agency("Narration decides what Ana feels.")],
      }),
      text("dm.narrate", `${CLEAN} A draft stirs.`),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.final).toBe("passed-after-regenerate");
    expect(out.output.record.attempts[0]?.llm).toMatchObject({
      issues: [{ kind: "player-agency", blocking: true }],
    });
  });

  it("hands regeneration only the party issue when a world-character issue sits beside it", async () => {
    const seen: string[] = [];
    const calls: Call[] = [
      text("dm.narrate", CLEAN),
      json("dm.audit", {
        verdict: "fail",
        issues: [
          agency("Narration decides Pell's emotional state."),
          agency("Narration states 'Bram does not flinch'."),
        ],
      }),
      text("dm.narrate", CLEAN),
      json("dm.audit", PASS),
    ];
    const scripted = createScriptedDm(
      loadDmScript({ v: 1, name: "audit", dice: [], calls }),
    );
    const provider = scripted.provider;
    const orig = provider.chat?.bind(provider);
    if (!orig) throw new Error("scripted provider has no chat");
    (provider as { chat: typeof orig }).chat = (model, req, opts) => {
      seen.push(JSON.stringify(req));
      return orig(model, req, opts);
    };
    const gateway = createGateway({
      config: scripted.aiConfig,
      sink: memorySink(),
      adapters: { fake: () => provider },
    });
    const events = freeEventsThrough("action.resolved");
    const base = makeCtx({
      deps: { gateway, loadProjections: async () => projectDm(events) },
    });
    const assembled = await assemble(base);
    if (!assembled.ok) throw new Error("assemble failed");
    const ctx0 = {
      ...base,
      results: { assemble: assembled.output, director, resolve: resolved },
    };
    const narrated = await narrate(ctx0);
    if (!narrated.ok) throw new Error("narrate failed");
    await audit({
      ...ctx0,
      results: { ...ctx0.results, narrate: narrated.output },
    });
    const regen = seen.find((s) => s.includes("Your previous text"));
    expect(regen).toContain("Bram does not flinch");
    expect(regen).not.toContain("emotional state");
  });

  it("still blocks a deterministic issue beside an advisory player-agency issue", () => {
    // Deterministic issues are recorded blocking: true in the loop; the filter
    // never touches them.
    const r = check("Ana opens 3 locks.");
    expect(r.pass).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });
});

describe("off-turn act blocks before dm.audit (TASK-0214)", () => {
  it.each([
    ["Guard hurls a spear at Ana."],
    ["Guard draws back for another try."],
    ["Guard shifts its grip on the spear."],
  ])(
    "refuses the attempt in code and records no dm.audit call for it: %s",
    async (line) => {
      // One dm.audit response only: a call on attempt 1 would consume it and pass the off-turn prose.
      const scripted = createScriptedDm(
        loadDmScript({
          v: 1,
          name: "audit",
          dice: [],
          calls: [
            text("dm.narrate", `${CLEAN} ${line}`),
            text("dm.narrate", CLEAN),
            json("dm.audit", PASS),
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
      const resolve: ResolveOutput = {
        ...resolved,
        snapshot: claimState().snapshot,
      };
      const ctx0 = {
        ...base,
        results: { assemble: assembled.output, director, resolve },
      };
      const narrated = await narrate(ctx0);
      if (!narrated.ok) throw new Error("narrate failed");
      const withTurn = {
        ...narrated.output,
        facts: {
          ...narrated.output.facts,
          turn: { actor: "Ana", next: null, offTurn: ["Guard"] },
        },
      };
      const out = await audit({
        ...ctx0,
        results: { ...ctx0.results, narrate: withTurn },
      });
      if (!out.ok) throw new Error("audit failed");
      const r = out.output.record;
      expect(r.attempts[0]?.llm).toEqual({ skipped: true });
      expect(r.attempts[0]?.deterministic.issues[0]?.kind).toBe(
        "invented-mechanics",
      );
      expect(r.final).toBe("passed-after-regenerate");
      expect(r.attempts).toHaveLength(2);
      expect(scripted.remaining().calls["dm.audit"]).toBe(0);
      expect(out.calls.filter((c) => c.purpose === "dm.audit")).toHaveLength(1);
    },
  );
});

describe("unmet success reveal (TASK-0237)", () => {
  const f = () =>
    facts([
      action({
        rolls: [
          {
            ...roll(),
            band: "severe-failure",
            consequence: "The reeds give nothing.",
            unmetSuccess: "Guard waits alive at the post",
          },
        ],
      }),
    ]);
  const absent = () => {
    const st = claimState();
    for (const a of st.snapshot.actors) a.presence = "absent";
    return st;
  };
  it("blocks the unmet NPC as ledger-mismatch, so dm.audit is skipped", () => {
    const r = check(`${CLEAN} Guard stands at the post.`, f(), absent());
    expect(r.pass).toBe(false);
    expect(r.issues.some((i) => i.detail.startsWith("Reveal: "))).toBe(true);
    expect(r.issues[0]?.kind).toBe("ledger-mismatch");
  });
  it("passes when the prose does not show them", () => {
    expect(check(`${CLEAN} The reeds hold still.`, f(), absent()).pass).toBe(
      true,
    );
  });
});
