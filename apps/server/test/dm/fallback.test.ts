import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { type ClaimState, checkClaims } from "../../src/dm/claims.js";
import {
  buildNarrationFacts,
  type FactAction,
  type FactChange,
  type FactEvent,
  type FactOutcome,
  type FactRoll,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { factualSummary, SYSTEM_WORDS } from "../../src/dm/fallback.js";
import { deterministicChecks } from "../../src/dm/nodes/audit.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { nameTerms } from "../../src/dm/snapshot/aliases.js";
import type {
  ActorChange,
  LifeState,
  SnapshotActor,
} from "../../src/dm/snapshot/types.js";
import { projectDm, testSeed } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/**
 * A ClaimState derived from a fact set: one actor per name, life states from
 * the life-state and unconscious-condition changes (dead outranks unconscious),
 * and a diff holding those changes as this turn's.
 */
function claimStateFor(
  f: NarrationFacts,
  names: readonly string[],
  extra: Record<string, LifeState> = {},
): ClaimState {
  const life = new Map<string, LifeState>(Object.entries(extra));
  const changes: ActorChange[] = [];
  const set = (name: string, after: LifeState) => {
    const prior = life.get(name);
    if (prior === "dead") return;
    if (prior === "unconscious" && after !== "dead") return;
    life.set(name, after);
    changes.push({
      kind: "life-state",
      actorId: name,
      before: "conscious",
      after,
    });
  };
  const all = [
    ...f.actions.flatMap((a) => a.changes),
    ...(f.npcTurn?.changes ?? []),
  ];
  for (const c of all) {
    if (
      c.kind === "life-state" &&
      (c.after === "dead" || c.after === "unconscious")
    )
      set(c.target, c.after);
    if (
      c.kind === "condition" &&
      c.condition === "unconscious" &&
      c.op === "applied"
    )
      set(c.target, "unconscious");
  }
  const actors: SnapshotActor[] = names.map((n) => ({
    id: n,
    combatantId: n,
    characterId: null,
    name: n,
    aliases: nameTerms(n, [n]),
    kind: /^(Ana|Bram)$/.test(n) ? "party" : "monster",
    controller: { kind: "dm" },
    hp: null,
    lifeState: life.get(n) ?? "conscious",
    conditions: [],
    ac: null,
    initiative: null,
    resources: null,
    sheet: null,
    presence: "present",
  }));
  return {
    snapshot: { ...EMPTY_RESOLVE_SNAPSHOT.snapshot, actors },
    diff: { fromSeq: 0, toSeq: 1, actors: changes, stage: [] },
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(here, "fixtures/run5-narration-quality.json"), "utf8"),
) as { transcript: StoredEvent[] };

const roll = (
  outcome: FactOutcome | null = "success",
  over: Partial<FactRoll> = {},
): FactRoll => ({
  name: "Ana",
  reason: "Ana picks the lock",
  expression: "1d20+5",
  shown: "13",
  total: 18,
  against: { kind: "DC", value: 15 },
  outcome,
  autoFail: false,
  target: null,
  ...over,
});

function action(over: Partial<FactAction> = {}): FactAction {
  return {
    actionId: "a1",
    characterName: "Ana",
    text: "picks the lock",
    outcome: "applied",
    refusalCode: null,
    rolls: [],
    outcomes: [],
    changes: [],
    followUps: [],
    ...over,
  };
}

function facts(over: Partial<NarrationFacts> = {}): NarrationFacts {
  return {
    trigger: "commit",
    actions: [],
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
    setting: {
      locationName: "The Vault",
      openingFraming: "Cold air drifts from the vault door.",
    },
    ...over,
  };
}

const sum = (f: NarrationFacts) => factualSummary(f);

describe("factualSummary: one sentence per fact", () => {
  it("scene-start gives the opening framing verbatim", () => {
    expect(sum(facts({ trigger: "scene-start" }))).toBe(
      "Cold air drifts from the vault door.",
    );
  });

  it("an applied action with a roll gives the reason and the outcome", () => {
    const a = action({ rolls: [roll("success")], outcomes: ["success"] });
    expect(sum(facts({ actions: [a] }))).toBe(
      "Ana picks the lock. Ana pulls it off.",
    );
    const f = action({ rolls: [roll("failure")], outcomes: ["failure"] });
    expect(sum(facts({ actions: [f] }))).toBe(
      "Ana picks the lock. Ana comes up short.",
    );
  });

  it("hit, critical hit and miss outcome sentences", () => {
    for (const [o, line] of [
      ["hit", "Ana strikes home."],
      ["critical-hit", "Ana strikes home, hard."],
      ["miss", "Ana misses."],
    ] as const) {
      const a = action({
        rolls: [roll(o, { reason: "Ana swings at the guard" })],
        outcomes: [o],
      });
      expect(sum(facts({ actions: [a] }))).toBe(
        `Ana swings at the guard. ${line}`,
      );
    }
  });

  it("drops a reason that holds a system word or a contradicting verb", () => {
    const sys = action({
      rolls: [roll("success", { reason: "Roll a check for the lock" })],
      outcomes: ["success"],
    });
    expect(sum(facts({ actions: [sys] }))).toBe("Ana pulls it off.");
    const bad = action({
      rolls: [roll("miss", { reason: "Ana hits the door with her sword" })],
      outcomes: ["miss"],
    });
    expect(sum(facts({ actions: [bad] }))).toBe("Ana misses.");
  });

  it("speaks a digit name in a reason", () => {
    const f = facts({
      npcTurn: {
        name: "Goblin-3",
        rolls: [
          roll("miss", {
            name: "Goblin-3",
            reason: "Goblin-3 jabs at Tamsin with its dagger.",
            target: "Tamsin Vale",
          }),
        ],
        outcomes: ["miss"],
        changes: [],
      },
    });
    expect(sum(f)).toBe(
      "Goblin three jabs at Tamsin with its dagger. Goblin three misses.",
    );
  });

  it("no roll, no-effect without a clarify, and refused", () => {
    expect(sum(facts({ actions: [action()] }))).toBe("Ana goes ahead with it.");
    expect(sum(facts({ actions: [action({ outcome: "no-effect" })] }))).toBe(
      "Ana goes ahead with it.",
    );
    expect(
      sum(
        facts({
          actions: [action({ outcome: "refused", characterName: null })],
        }),
      ),
    ).toBe("The party cannot do that here.");
  });

  it("changes", () => {
    const changes: FactChange[] = [
      {
        kind: "hp",
        target: "Guard",
        direction: "damage",
        amount: 4,
        damageType: null,
        before: 9,
        after: 5,
      },
      {
        kind: "hp",
        target: "Ana",
        direction: "heal",
        amount: 2,
        damageType: null,
        before: 3,
        after: 5,
      },
      {
        kind: "life-state",
        target: "Guard",
        before: "conscious",
        after: "dead",
      },
      {
        kind: "life-state",
        target: "Bram",
        before: "conscious",
        after: "unconscious",
      },
      {
        kind: "condition",
        target: "Ana",
        op: "applied",
        condition: "poisoned",
      },
      {
        kind: "condition",
        target: "Ana",
        op: "removed",
        condition: "poisoned",
      },
    ];
    expect(sum(facts({ actions: [action({ changes })] }))).toBe(
      "Ana goes ahead with it. Guard is wounded. Ana is healed. Guard is dead. Bram falls unconscious. Ana is poisoned. Ana is no longer poisoned.",
    );
  });

  it("an NPC turn with and without a roll", () => {
    const withRoll = facts({
      npcTurn: {
        name: "Warden",
        rolls: [roll("hit", { name: "Warden", reason: "The Warden lunges" })],
        outcomes: ["hit"],
        changes: [],
      },
    });
    expect(sum(withRoll)).toBe("The Warden lunges. Warden strikes home.");
    const bare = facts({
      npcTurn: { name: "Warden", rolls: [], outcomes: [], changes: [] },
    });
    expect(sum(bare)).toBe("Warden holds back, watching.");
  });

  it("an NPC turn without a roll voices its plan", () => {
    const npc = (intent: string, reasons: string[], held = false) =>
      facts({
        npcTurn: {
          name: "Snag",
          rolls: [],
          outcomes: [],
          changes: [],
          plan: { intent, reasons, held },
        },
      });
    expect(sum(npc("talk", ["Snag offers a parley."]))).toBe(
      "Snag offers a parley.",
    );
    expect(sum(npc("talk", []))).toBe("Snag speaks up.");
    expect(sum(npc("move", []))).toBe("Snag shifts ground.");
    expect(sum(npc("help", []))).toBe("Snag lends a hand.");
    expect(sum(npc("attack", []))).toBe("Snag holds back, watching.");
    expect(sum(npc("talk", ["Snag offers a parley."], true))).toBe(
      "Snag holds back, watching.",
    );
    // a digit or system word is not voiced; the intent sentence stands in
    expect(sum(npc("talk", ["Snag rolls a 4 to bluff."]))).toBe(
      "Snag speaks up.",
    );
  });

  it("events", () => {
    const e = (events: FactEvent[], modeChange = null as never) =>
      sum(facts({ events, modeChange }));
    expect(
      e([
        {
          kind: "encounter-started",
          combatants: ["Snag", "Goblin-2", "Goblin-3"],
          first: "Snag",
        },
      ]),
    ).toBe(
      "A fight breaks out. Snag, Goblin two and Goblin three join the fight. Snag moves first.",
    );
    expect(e([{ kind: "turn-advanced", next: "Odo" }])).toBe("Odo moves next.");
    expect(e([{ kind: "combatant-joined", name: "Pell" }])).toBe(
      "Pell joins them.",
    );
    expect(e([{ kind: "combatant-left", name: "Pell" }])).toBe("Pell is gone.");
    expect(e([{ kind: "encounter-ended" }])).toBe("The fighting stops.");
  });

  it("mode changes", () => {
    expect(sum(facts({ modeChange: { from: "turn", to: "free" } }))).toBe(
      "The fighting stops.",
    );
    expect(sum(facts({ modeChange: { from: "free", to: "turn" } }))).toBe(
      "A fight breaks out.",
    );
    // An ended fight and a mode change say it once.
    expect(
      sum(
        facts({
          events: [{ kind: "encounter-ended" }],
          modeChange: { from: "turn", to: "free" },
        }),
      ),
    ).toBe("The fighting stops.");
  });

  it("scene end, clarify and the empty turn", () => {
    const end = facts({ director: { ...facts().director, sceneEnded: true } });
    expect(sum(end)).toBe("That is the end of it at The Vault.");
    const hold = facts({
      actions: [action({ outcome: "no-effect" })],
      clarify: [{ actionId: "a1", question: "Which door?" }],
    });
    expect(sum(hold)).toBe("Which door?");
    const party = facts({
      actions: [action({ outcome: "no-effect", characterName: null })],
      clarify: [{ actionId: "a1", question: "Roll for it?" }],
    });
    expect(sum(party)).toBe("What does the party do?");
    expect(sum(facts())).toBe("The moment holds.");
  });

  it("run 1 seq 172-176: ends on the clarify question, no turn handoff", () => {
    const f = facts({
      actions: [action({ outcome: "no-effect", characterName: "Tamsin" })],
      clarify: [
        {
          actionId: "a1",
          question: "Longsword in melee, or the light crossbow at range?",
        },
      ],
    });
    const out = sum(f);
    expect(
      out.endsWith("Longsword in melee, or the light crossbow at range?"),
    ).toBe(true);
    expect(out).not.toContain("moves next");
  });

  it("an unspeakable clarify question keeps the stock line", () => {
    const f = facts({
      actions: [action({ outcome: "no-effect" })],
      clarify: [{ actionId: "a1", question: "Roll for it?" }],
    });
    expect(sum(f)).toBe("What does Ana do?");
  });
});

// Run-5 replays.

const SEED_VIEW = playerFacingSeed(testSeed());

const director = (): DirectorNodeOutput => ({
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
});

function replay(
  through: number,
  modeBefore: "free" | "turn",
  actionId: string,
  characterId: string,
  actor: string,
  rows: StoredEvent[],
  clarify: { actionId: string; question: string }[] = [],
): NarrationFacts {
  const resolve: ResolveOutput = {
    submissions: [],
    actionResults: [
      { actionId, outcome: "no-effect", batchIds: [], refusalCode: null },
    ],
    appendedRows: rows,
    nextJob: null,
    chronicle: false,
    npcTurn: null,
    ...EMPTY_RESOLVE_SNAPSHOT,
    lastSeq: 0,
  };
  return buildNarrationFacts({
    trigger: "commit",
    seed: SEED_VIEW,
    beatNpcIds: [],
    projections: projectDm(fixture.transcript.filter((r) => r.seq <= through)),
    beat: [
      {
        actionId,
        committedSeq: 0,
        actor,
        characterId,
        scope: "character",
        text: "x",
        status: "resolved",
      },
    ],
    director: director(),
    adjudicate: null,
    resolve,
    presentNpcIds: [],
    modeBefore,
    appendedRows: rows,
    clarify,
  });
}

describe("factualSummary: run-5 replays", () => {
  it("seq 88 reads 'Kestrel goes ahead with it. The fighting stops.'", () => {
    const rows = fixture.transcript.filter((r) => r.seq >= 85 && r.seq <= 87);
    const f = replay(
      87,
      "turn",
      "act-kestrel-1",
      "kestrel",
      "ai:companion:kestrel",
      rows,
    );
    expect(sum(f)).toBe("Kestrel goes ahead with it. The fighting stops.");
  });

  it("seq 53 states the fight, the joiners, the first mover and asks", () => {
    const rows = fixture.transcript.filter((r) => r.seq >= 39 && r.seq <= 52);
    const f = replay(52, "free", "pt-4", "tamsin", "u", rows, [
      { actionId: "pt-4", question: "Which way do you press on?" },
    ]);
    const out = sum(f);
    expect(out).toContain("A fight breaks out.");
    expect(out).toContain("Snag");
    expect(out).toContain("join the fight.");
    expect(out).toContain("Snag moves first.");
    expect(out.endsWith("Which way do you press on?")).toBe(true);
    expect(out).not.toMatch(/[0-9]/);
    expect(out).not.toMatch(/clearer|The party enters/);
  });
});

describe("factualSummary: the roller is the subject (spec 079)", () => {
  it("run 1 seq 154-161: the goblin's reaction hit names the goblin", () => {
    const hit = roll("hit", {
      name: "Goblin with a pot-helm",
      reason: "Goblin with a pot-helm strikes as Kestrel pulls away",
      against: { kind: "AC", value: 14 },
      target: "Kestrel",
      reaction: true,
    });
    const out = sum(
      facts({
        actions: [
          action({
            characterName: "Kestrel",
            rolls: [hit],
            outcomes: ["hit"],
            changes: [
              {
                kind: "hp",
                target: "Kestrel",
                direction: "damage",
                amount: 4,
                damageType: "slashing",
                before: 9,
                after: 5,
              },
            ],
          }),
        ],
      }),
    );
    expect(out).toContain("Goblin with a pot-helm strikes home.");
    expect(out).toContain("Kestrel is wounded.");
    expect(out).not.toContain("Kestrel strikes home");
  });

  it("an own check still names the character", () => {
    const out = sum(facts({ actions: [action({ rolls: [roll("success")] })] }));
    expect(out).toContain("Ana pulls it off.");
  });
});

describe("factualSummary: property", () => {
  it("holds no system word or digit, passes the checks, covers every fact", () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const pick = <T>(xs: readonly T[]): T => xs[rnd(xs.length)] as T;
    const names = ["Ana", "Bram", "Goblin 2", "Goblin-3", "Warden"];
    const reasons = [
      "Ana picks the lock",
      "Goblin-3 jabs at Tamsin with its dagger.",
      "Roll initiative: The camp",
      "Bram checks the hinges",
      "The Warden swings 2 times",
      "Ana hits the door",
    ];
    const outcomes: FactOutcome[] = [
      "hit",
      "miss",
      "critical-hit",
      "success",
      "failure",
    ];
    for (let i = 0; i < 400; i++) {
      const acts: FactAction[] = Array.from({ length: rnd(4) }, (_, k) => {
        const outs = Array.from({ length: rnd(3) }, () => pick(outcomes));
        const changes: FactChange[] = [];
        if (rnd(2)) {
          changes.push({
            kind: "hp",
            target: pick(names),
            direction: pick(["damage", "heal"] as const),
            amount: rnd(20) + 1,
            damageType: pick(["slashing", null]),
            before: 10,
            after: 3,
          });
        }
        if (rnd(3) === 0) {
          changes.push({
            kind: "life-state",
            target: pick(names),
            before: "conscious",
            after: pick(["dead", "unconscious"]),
          });
        }
        if (rnd(3) === 0) {
          changes.push({
            kind: "condition",
            target: pick(names),
            op: pick(["applied", "removed"] as const),
            condition: pick(["poisoned", "unconscious", "prone"]),
          });
        }
        return action({
          actionId: `a${k}`,
          characterName: rnd(4) === 0 ? null : pick(names),
          outcome: pick(["applied", "refused", "no-effect"] as const),
          rolls: outs.map((o) => roll(o, { reason: pick(reasons) })),
          outcomes: outs,
          changes,
        });
      });
      const events: FactEvent[] = [];
      if (rnd(3) === 0) {
        events.push({
          kind: "encounter-started",
          combatants: [pick(names), pick(names)],
          first: pick(names),
        });
      }
      if (rnd(3) === 0)
        events.push({ kind: "turn-advanced", next: pick(names) });
      if (rnd(4) === 0)
        events.push({ kind: "combatant-joined", name: pick(names) });
      if (rnd(4) === 0)
        events.push({ kind: "combatant-left", name: pick(names) });
      if (rnd(4) === 0) events.push({ kind: "encounter-ended" });
      const f = facts({
        actions: acts,
        events,
        trigger: rnd(5) === 0 ? "scene-start" : "commit",
        modeChange: rnd(3) === 0 ? { from: "free", to: "turn" } : null,
        clarify: acts
          .filter(() => rnd(3) === 0)
          .map((a) => ({ actionId: a.actionId, question: "Which way?" })),
      });
      if (rnd(2)) {
        f.npcTurn = {
          name: pick(names),
          rolls: [roll("hit", { reason: pick(reasons) })],
          outcomes: ["hit"],
          changes: [],
        };
      } else if (rnd(3) === 0) {
        f.npcTurn = {
          name: pick(names),
          rolls: [],
          outcomes: [],
          changes: [],
          plan: {
            intent: pick(["talk", "move", "help", "attack", "other"]),
            reasons: rnd(2) ? [pick(reasons)] : [],
            held: rnd(3) === 0,
          },
        };
      }
      f.director.sceneEnded = rnd(4) === 0;
      const state = claimStateFor(f, names);
      const prose = factualSummary(f, state);
      // Names are exempt from the system-word rule.
      const scrubbed = names.reduce(
        (t, n) => t.split(n.replace(/-(?=\d)/, " ")).join(""),
        prose,
      );
      expect(scrubbed, prose).not.toMatch(SYSTEM_WORDS);
      expect(prose).not.toMatch(/[0-9]/);
      const r = deterministicChecks(
        f,
        { prose, diceLines: renderDiceLines(f) },
        state,
      );
      expect(r.issues, prose).toEqual([]);
      expect(checkClaims(state, prose).issues, prose).toEqual([]);
      // Coverage: every action, change and event adds a sentence.
      const held = new Set(f.clarify.map((c) => c.actionId));
      const expectedMin =
        f.actions.filter(
          (a) => !(a.outcome === "no-effect" && held.has(a.actionId)),
        ).length +
        f.actions.reduce((n, a) => n + a.changes.length, 0) +
        f.events.filter((e) => e.kind !== "encounter-ended").length +
        f.clarify.length;
      const sentences = prose.split(/(?<=[.?!])\s+/).length;
      expect(sentences, prose).toBeGreaterThanOrEqual(expectedMin);
    }
  });

  it("does not voice a roll reason that claims two kin fell with one dead (M2 seq 221, US4.4)", () => {
    const reason = "The goblin shrieks, shouting that two kin have fallen";
    const f = facts({
      actions: [
        action({
          characterName: "Goblin 2",
          rolls: [roll("hit", { reason })],
          outcomes: ["hit"],
        }),
      ],
    });
    const state = claimStateFor(f, ["Ana", "Goblin 2", "Goblin-3"], {
      "Goblin-3": "dead",
    });
    expect(checkClaims(state, reason).pass).toBe(false);
    const out = factualSummary(f, state);
    expect(out).not.toContain("kin have fallen");
    expect(out).toContain("strikes home");
    expect(checkClaims(state, out).pass).toBe(true);
    // Without a state the reason is voiced, as before (existing callers).
    expect(factualSummary(f)).toContain("kin have fallen");
  });

  it("never names a tracker or a DM-only fact", () => {
    const f = replay(
      52,
      "free",
      "pt-4",
      "tamsin",
      "u",
      fixture.transcript.filter((r) => r.seq >= 39 && r.seq <= 55),
      [{ actionId: "pt-4", question: "Which way?" }],
    );
    const out = sum(f).toLowerCase();
    for (const t of ["alarm", "alerted", "ambush", "causeway", "segment"]) {
      expect(out).not.toContain(t);
    }
  });
});
