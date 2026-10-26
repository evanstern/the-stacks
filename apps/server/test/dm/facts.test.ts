import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LedgerRow, StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import {
  buildNarrationFacts,
  collectFacts,
  type NarrationFacts,
  renderChangeLine,
  renderDiceLines,
  renderRollLine,
  stripMarker,
} from "../../src/dm/facts.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { factEntries } from "../../src/dm/prompts/narrate.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { projectDm, testSeed } from "./helpers.js";

const names: Record<string, string> = { ana: "Ana", goblin: "Goblin" };
const nameOf = (id: string | null) => (id ? (names[id] ?? id) : "The scene");

const common = (seq: number, batchId: string, index: number) => ({
  seq,
  actor: "ai:dm",
  visibility: "public",
  batchId,
  index,
  actionId: "a1",
});

function roll(
  seq: number,
  batchId: string,
  index: number,
  over: {
    reason: string;
    expression: string;
    purpose: string;
    combatantId: string | null;
    faces: number[];
    mod: number;
    natural: number | null;
    critical?: boolean;
  },
): LedgerRow {
  const sum = over.faces.reduce((a, b) => a + b, 0) + over.mod;
  return {
    kind: "roll",
    ...common(seq, batchId, index),
    reason: over.reason,
    roll: {
      type: "dice.rolled",
      v: 1,
      reason: over.reason,
      expression: over.expression,
      mode: "normal",
      purpose: over.purpose,
      critical: over.critical ?? false,
      combatantId: over.combatantId,
      terms: [
        {
          kind: "dice",
          sign: 1,
          count: over.faces.length,
          sides: 20,
          keep: null,
          faces: over.faces,
          kept: over.faces.map(() => true),
          subtotal: over.faces.reduce((a, b) => a + b, 0),
        },
        { kind: "modifier", value: over.mod },
      ],
      total: sum,
      natural: over.natural,
    },
  } as unknown as LedgerRow;
}

const outcomeRow = (
  seq: number,
  batchId: string,
  index: number,
  outcome: object,
): LedgerRow =>
  ({
    kind: "outcome",
    ...common(seq, batchId, index),
    reason: "r",
    outcome,
  }) as unknown as LedgerRow;

const hpRow = (
  seq: number,
  batchId: string,
  index: number,
  subject: string,
  before: number,
  after: number,
): LedgerRow =>
  ({
    kind: "change",
    ...common(seq, batchId, index),
    reason: "dmg",
    type: "hp.changed",
    subject,
    before: { current: before, temp: 0 },
    after: { current: after, temp: 0 },
  }) as unknown as LedgerRow;

const attackRows = (
  outcome: "hit" | "miss" | "critical-hit",
  natural: number,
): LedgerRow[] => [
  roll(1, "b1", 0, {
    reason: "Ana swings her sword [0a#1]",
    expression: "1d20+5",
    purpose: "attack",
    combatantId: "ana",
    faces: [natural],
    mod: 5,
    natural,
  }),
  outcomeRow(2, "b1", 1, {
    type: "attack.resolved",
    v: 1,
    reason: "Ana swings her sword",
    attackerId: "ana",
    targetId: "goblin",
    rollIndex: 0,
    ac: 15,
    acSource: "command",
    total: natural + 5,
    natural,
    outcome,
  }),
];

describe("stripMarker", () => {
  it("removes the trailing step marker only", () => {
    expect(stripMarker("Ana picks the lock [0000-aa#12]")).toBe(
      "Ana picks the lock",
    );
    expect(stripMarker("a [x] b")).toBe("a [x] b");
  });
});

describe("dice-line renderer", () => {
  it("renders a check", () => {
    const rows = [
      roll(1, "b1", 0, {
        reason: "Ana picks the lock [0a#1]",
        expression: "1d20+5",
        purpose: "check",
        combatantId: "ana",
        faces: [13],
        mod: 5,
        natural: 13,
      }),
      outcomeRow(2, "b1", 1, {
        type: "check.resolved",
        v: 1,
        reason: "x",
        combatantId: "ana",
        kind: "ability-check",
        ability: "dex",
        skill: null,
        rollIndex: 0,
        dc: 15,
        total: 18,
        natural: 13,
        autoFail: null,
        outcome: "success",
      }),
    ];
    const c = collectFacts(rows, nameOf);
    expect(c.rolls.map(renderRollLine)).toEqual([
      "Ana — Ana picks the lock: 1d20+5 → 13 = 18 vs DC 15: success",
    ]);
    expect(c.outcomes).toEqual(["success"]);
  });

  it("renders an attack hit with a damage line", () => {
    const rows = [
      ...attackRows("hit", 14),
      roll(3, "b2", 0, {
        reason: "Ana swings her sword: damage [0a#2]",
        expression: "1d8+3",
        purpose: "damage",
        combatantId: "ana",
        faces: [4],
        mod: 3,
        natural: null,
      }),
      hpRow(4, "b2", 1, "goblin", 7, 0),
    ];
    const c = collectFacts(rows, nameOf, new Map([[4, "slashing"]]));
    expect([
      ...c.rolls.map(renderRollLine),
      ...c.changes.map((x) => renderChangeLine(x) ?? ""),
    ]).toEqual([
      "Ana — Ana swings her sword: 1d20+5 → 14 = 19 vs AC 15: hit",
      "Ana — Ana swings her sword: damage: 1d8+3 → 4 = 7",
      "Goblin takes 7 slashing (7→0 HP)",
    ]);
  });

  it("renders a critical hit", () => {
    const c = collectFacts(attackRows("critical-hit", 20), nameOf);
    expect(c.rolls.map(renderRollLine)).toEqual([
      "Ana — Ana swings her sword: 1d20+5 → 20 = 25 vs AC 15: critical hit",
    ]);
    expect(c.outcomes).toEqual(["critical-hit"]);
  });

  it("renders a miss with no damage line", () => {
    const c = collectFacts(attackRows("miss", 3), nameOf);
    expect(c.rolls.map(renderRollLine)).toEqual([
      "Ana — Ana swings her sword: 1d20+5 → 3 = 8 vs AC 15: miss",
    ]);
    expect(c.changes).toEqual([]);
  });

  it("renders no line for an engine refusal (no rows)", () => {
    const facts = {
      actions: [
        {
          actionId: "a1",
          characterName: "Ana",
          text: "x",
          outcome: "refused",
          refusalCode: "UNKNOWN_COMBATANT",
          rolls: [],
          outcomes: [],
          changes: [],
        },
      ],
      npcTurn: null,
    } as unknown as NarrationFacts;
    expect(renderDiceLines(facts)).toEqual([]);
  });

  it("renders an auto-fail with no roll", () => {
    const rows = [
      outcomeRow(2, "b1", 0, {
        type: "check.resolved",
        v: 1,
        reason: "x",
        combatantId: "ana",
        kind: "ability-check",
        ability: "str",
        skill: null,
        rollIndex: null,
        dc: 20,
        total: null,
        natural: null,
        autoFail: { reason: "Ana is paralyzed" },
        outcome: "failure",
      }),
    ];
    const c = collectFacts(rows, nameOf);
    expect(c.rolls.map(renderRollLine)).toEqual([
      "Ana — Ana is paralyzed: auto-fail vs DC 20: failure",
    ]);
  });

  it("renders healing and records life-state and condition changes", () => {
    const rows = [
      hpRow(1, "b1", 0, "ana", 3, 9),
      {
        kind: "change",
        ...common(2, "b1", 1),
        reason: "r",
        type: "life-state.changed",
        subject: "ana",
        before: "unconscious",
        after: "conscious",
      } as unknown as LedgerRow,
      {
        kind: "change",
        ...common(3, "b1", 2),
        reason: "r",
        type: "condition.applied",
        subject: "ana",
        before: null,
        after: { condition: "poisoned" },
      } as unknown as LedgerRow,
    ];
    const c = collectFacts(rows, nameOf);
    expect(renderChangeLine(c.changes[0] as never)).toBe(
      "Ana regains 6 HP (3→9 HP)",
    );
    expect(c.changes.map((x) => x.kind)).toEqual([
      "hp",
      "life-state",
      "condition",
    ]);
    expect(renderChangeLine(c.changes[2] as never)).toBeNull();
  });
});

describe("facts v2: party, events, target, setting (run-5 rows)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixture = JSON.parse(
    readFileSync(join(here, "fixtures/run5-narration-quality.json"), "utf8"),
  ) as { transcript: StoredEvent[] };
  const VIEW = playerFacingSeed(testSeed());
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
  const resolveOf = (over: Partial<ResolveOutput> = {}): ResolveOutput => ({
    submissions: [],
    actionResults: [],
    appendedRows: [],
    nextJob: null,
    chronicle: false,
    npcTurn: null,
    lastSeq: 0,
    ...over,
  });
  const build = (
    through: number,
    from: number,
    modeBefore: "free" | "turn",
    over: Partial<ResolveOutput> = {},
  ) => {
    const rows = fixture.transcript.filter(
      (r) => r.seq >= from && r.seq <= through,
    );
    return buildNarrationFacts({
      trigger: "commit",
      seed: VIEW,
      beatNpcIds: [],
      projections: projectDm(
        fixture.transcript.filter((r) => r.seq <= through),
      ),
      beat: [],
      director,
      adjudicate: null,
      resolve: resolveOf({ appendedRows: rows, ...over }),
      presentNpcIds: [],
      modeBefore,
      appendedRows: rows,
      clarify: [],
    });
  };

  it("builds events from rows 39 to 58 and never from tracker.changed", () => {
    const f = build(58, 39, "free");
    expect(f.events.map((e) => e.kind)).toEqual([
      "encounter-started",
      "turn-advanced",
    ]);
    const start = f.events[0];
    expect(start).toMatchObject({ kind: "encounter-started", first: "Snag" });
    expect(start?.kind === "encounter-started" && start.combatants).toEqual([
      "Snag",
      "Goblin with a pot-helm",
      "Goblin lookout",
      "Goblin by the fire",
    ]);
    expect(f.events[1]).toEqual({
      kind: "turn-advanced",
      next: "Goblin lookout",
    });
    expect(f.modeChange).toEqual({ from: "free", to: "turn" });
    expect(JSON.stringify(f.events)).not.toMatch(/alarm|alerted/i);
  });

  it("skips non-public rows", () => {
    const rows = fixture.transcript
      .filter((r) => r.seq === 56)
      .map((r) => ({ ...r, visibility: "dm" as const }));
    const f = build(58, 56, "turn");
    expect(f.events).toHaveLength(1);
    const g = buildNarrationFacts({
      trigger: "commit",
      seed: VIEW,
      beatNpcIds: [],
      projections: projectDm(fixture.transcript.filter((r) => r.seq <= 58)),
      beat: [],
      director,
      adjudicate: null,
      resolve: resolveOf({ appendedRows: rows }),
      presentNpcIds: [],
      modeBefore: "turn",
      appendedRows: rows,
      clarify: [],
    });
    expect(g.events).toEqual([]);
  });

  it("drops turn-advanced when the encounter ends in the same turn", () => {
    const f = build(87, 85, "turn");
    expect(f.events).toEqual([{ kind: "encounter-ended" }]);
  });

  it("reads target and reason from rows 60 and 61", () => {
    const rows = fixture.transcript.filter((r) => r.seq >= 60 && r.seq <= 61);
    const batchId = (rows[0] as { payload: { batchId: string } }).payload
      .batchId;
    const f = build(61, 60, "turn", {
      npcTurn: {
        combatantId: "goblin-3",
        batchIds: [batchId],
        awaitingDm: false,
      },
    });
    const r = f.npcTurn?.rolls[0];
    expect(r?.target).toBe("Tamsin Vale");
    expect(r?.reason).toBe(
      "Goblin-3, frightened and defending the camp, jabs at Tamsin with its dagger.",
    );
    const lines = factEntries(f);
    expect(lines).toContain(
      "  roll: Goblin-3, frightened and defending the camp, jabs at Tamsin with its dagger. target Tamsin Vale -> miss",
    );
  });

  it("marks odo and kestrel as AI companions and carries the setting", () => {
    const f = build(58, 39, "free");
    const by = (id: string) => f.party.find((m) => m.characterId === id);
    expect(by("odo")?.controller).toBe("ai-companion");
    expect(by("kestrel")?.controller).toBe("ai-companion");
    expect(by("tamsin")?.controller).toBe("human");
    expect(f.setting).toEqual({
      locationName: VIEW.location.name,
      openingFraming: VIEW.openingFraming,
    });
    expect(f.npcNames).toContain("Snag");
    expect(new Set(f.npcNames).size).toBe(f.npcNames.length);
    expect(f.npcNames).not.toContain("Odo");
  });

  it("renders no-effect, on-hold and event lines", () => {
    const base = build(58, 39, "free");
    const act = {
      actionId: "a1",
      characterName: "Ana",
      text: "waves",
      outcome: "no-effect" as const,
      refusalCode: null,
      rolls: [],
      outcomes: [],
      changes: [],
    };
    const none = factEntries({ ...base, actions: [act], clarify: [] });
    expect(none[0]).toBe(
      'Action a1 by Ana: "waves" -> no rules effect (nothing rolled, no game state changed; the attempt still happens in the story)',
    );
    const hold = factEntries({
      ...base,
      actions: [act],
      clarify: [{ actionId: "a1", question: "Which way?" }],
    });
    expect(hold[0]).toBe(
      'Action a1 by Ana: "waves" -> on hold (the intent is unclear; nothing happened yet)',
    );
    expect(hold).toContain("Unclear intent for a1: Which way?");
    const ev = factEntries({ ...base, actions: [], clarify: [] });
    expect(ev).toContain(
      "Event: a fight starts (Snag, Goblin with a pot-helm, Goblin lookout, Goblin by the fire); Snag acts first",
    );
    expect(ev).toContain("Event: Goblin lookout acts next");
    expect(
      factEntries({
        ...base,
        events: [
          { kind: "encounter-ended" },
          { kind: "combatant-joined", name: "Pell" },
          { kind: "combatant-left", name: "Pell" },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        "Event: the fight ends",
        "Event: Pell joins",
        "Event: Pell leaves",
      ]),
    );
  });
});
