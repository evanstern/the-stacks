import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LedgerRow, StoredEvent } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import {
  type BuildFactsInput,
  buildNarrationFacts,
  collectFacts,
  deriveInvoluntary,
  type NarrationFacts,
  renderChangeLine,
  renderDiceLines,
  renderRollLine,
  stripMarker,
} from "../../src/dm/facts.js";
import { factualSummary } from "../../src/dm/fallback.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { factEntries } from "../../src/dm/prompts/narrate.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { projectDm, testSeed } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

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

  it("TASK-0242: an NPC hit's separate damage submission states damage dealt (run 1 seq 163-166)", () => {
    const rows = [
      ...attackRows("hit", 13),
      roll(3, "b2", 0, {
        reason: "Goblin by the fire stabs: damage",
        expression: "1d4+2",
        purpose: "damage",
        combatantId: "goblin",
        faces: [2],
        mod: 2,
        natural: null,
      }),
      hpRow(4, "b2", 1, "ana", 13, 9),
    ];
    const c = collectFacts(rows, nameOf, new Map([[4, "piercing"]]));
    expect(c.rolls[1]?.damage?.dealt).toEqual({
      amount: 4,
      type: "piercing",
      target: "Ana",
    });
    const f = {
      npcTurn: {
        name: "Goblin",
        rolls: c.rolls,
        outcomes: c.outcomes,
        changes: c.changes,
      },
      actions: [],
      events: [],
      rulings: [],
      clarify: [],
      presentNpcs: [],
      party: [],
      director: {
        goalNote: "",
        sceneEnded: false,
        pacing: { tension: "high", spotlight: null, beatId: null },
      },
    } as unknown as NarrationFacts;
    const text = factEntries(f).join("\n");
    expect(text).toContain("damage dealt: 4 piercing to Ana");
    expect(text).not.toContain("no result");
  });

  it("TASK-0242: a damage roll with no hp row never invents damage", () => {
    const rows = [
      roll(3, "b2", 0, {
        reason: "Goblin stabs: damage",
        expression: "1d4+2",
        purpose: "damage",
        combatantId: "goblin",
        faces: [2],
        mod: 2,
        natural: null,
      }),
    ];
    expect(collectFacts(rows, nameOf).rolls[0]?.damage).toEqual({
      dealt: null,
    });
  });

  it("renders a critical hit", () => {
    const c = collectFacts(attackRows("critical-hit", 20), nameOf);
    expect(c.rolls.map(renderRollLine)).toEqual([
      "Ana — Ana swings her sword: 1d20+5 → 20 = 25 vs AC 15: critical hit",
    ]);
    expect(c.outcomes).toEqual(["critical-hit"]);
  });

  it("sets reaction from the linked attack.resolved (spec 079)", () => {
    const rows = attackRows("hit", 14);
    (
      rows[1] as unknown as { outcome: { reaction?: boolean } }
    ).outcome.reaction = true;
    expect(collectFacts(rows, nameOf).rolls[0]?.reaction).toBe(true);
    expect(
      collectFacts(attackRows("hit", 14), nameOf).rolls[0]?.reaction,
    ).toBeUndefined();
  });

  it("renders a reaction roll as its own line (spec 079)", () => {
    const rows = attackRows("hit", 14);
    (
      rows[1] as unknown as { outcome: { reaction?: boolean } }
    ).outcome.reaction = true;
    const c = collectFacts(rows, nameOf);
    const line = factEntries({
      actions: [{ rolls: c.rolls, changes: [], followUps: [] }],
      clarify: [],
      events: [],
      modeChange: null,
      party: [],
      presentNpcs: [],
      rulings: [],
      director: { pacing: {}, goalNote: "", sceneEnded: false },
    } as never).find((l) => l.includes("reaction:"));
    expect(line).toBe(
      "  reaction: Ana strikes at Goblin as they pull away -> hit",
    );
  });

  it("renders an open followUp from an earlier beat (spec 079)", () => {
    const f = {
      actions: [],
      clarify: [],
      events: [],
      modeChange: null,
      rulings: [],
      director: { sceneEnded: false },
      openFollowUps: [{ name: "Kestrel", text: "cut Pell's bonds" }],
    };
    expect(factEntries(f as never)).toContain(
      "Earlier beat, not yet attempted: Kestrel: cut Pell's bonds",
    );
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

  describe("bands (spec 070)", () => {
    const checkRows = (event: object, withRoll = true): LedgerRow[] => [
      ...(withRoll
        ? [
            roll(1, "b1", 0, {
              reason: "Ana picks the lock [0a#1]",
              expression: "1d20+5",
              purpose: "check",
              combatantId: "ana",
              faces: [5],
              mod: 5,
              natural: 5,
            }),
          ]
        : []),
      outcomeRow(2, "b1", 1, {
        type: "check.resolved",
        v: 1,
        reason: "Ana picks the lock [0a#1]",
        combatantId: "ana",
        kind: "ability-check",
        ability: "dex",
        skill: null,
        rollIndex: withRoll ? 0 : null,
        dc: 12,
        total: withRoll ? 10 : null,
        natural: withRoll ? 5 : null,
        autoFail: null,
        outcome: "success",
        ...event,
      }),
    ];
    const stakes = new Map([
      [
        "b1",
        {
          success: "The attempt works as intended.",
          cost: "The pick bites her palm.",
          failure: "The lock holds.",
          severe: "The pick snaps off in the lock.",
        },
      ],
    ]);

    it.each([
      ["success", "The attempt works as intended.", 1, "success"],
      ["success-at-cost", "The pick bites her palm.", -2, "success at a cost"],
      ["failure", "The lock holds.", -3, "failure"],
      [
        "severe-failure",
        "The pick snaps off in the lock.",
        -7,
        "severe failure",
      ],
    ])(
      "carries band %s, margin and consequence",
      (band, consequence, margin, word) => {
        const outcome =
          band === "success" || band === "success-at-cost"
            ? "success"
            : "failure";
        const c = collectFacts(
          checkRows({ band, margin, outcome }),
          nameOf,
          new Map(),
          stakes,
        );
        expect(c.rolls[0]).toMatchObject({ band, margin, consequence });
        const failed = band === "failure" || band === "severe-failure";
        expect(c.rolls[0]?.unmetSuccess).toBe(
          failed ? "The attempt works as intended." : null,
        );
        expect(renderRollLine(c.rolls[0] as never)).toContain(`: ${word}`);
      },
    );

    it("sets revealed on both success bands and null on both failure bands (spec 080)", () => {
      const revealed = new Map([["b1", "Goblin prints."]]);
      const got = (band: string, outcome: string) =>
        collectFacts(
          checkRows({ band, margin: 0, outcome }),
          nameOf,
          new Map(),
          stakes,
          revealed,
        ).rolls[0]?.revealed;
      expect(got("success", "success")).toBe("Goblin prints.");
      expect(got("success-at-cost", "success")).toBe("Goblin prints.");
      expect(got("failure", "failure")).toBeNull();
      expect(got("severe-failure", "failure")).toBeNull();
    });

    it("gives a null consequence for an old submission with success null", () => {
      const old = new Map([
        ["b1", { ...stakes.get("b1"), success: null } as never],
      ]);
      const c = collectFacts(
        checkRows({ band: "success", margin: 1, outcome: "success" }),
        nameOf,
        new Map(),
        old,
      );
      expect(c.rolls[0]?.consequence).toBeNull();
    });

    it("leaves band null-free on an old row with no band", () => {
      const c = collectFacts(checkRows({}), nameOf, new Map(), stakes);
      expect(c.rolls[0]?.band).toBeUndefined();
      expect(c.rolls[0]?.consequence).toBeUndefined();
      expect(renderRollLine(c.rolls[0] as never)).toBe(
        "Ana — Ana picks the lock: 1d20+5 → 5 = 10 vs DC 12: success",
      );
    });

    it("renders a free retry as auto-success", () => {
      const c = collectFacts(
        checkRows({ band: "success", margin: null }, false),
        nameOf,
        new Map(),
        stakes,
      );
      expect(c.rolls[0]).toMatchObject({
        autoSuccess: true,
        autoFail: false,
        band: "success",
        consequence: "The attempt works as intended.",
      });
      expect(renderRollLine(c.rolls[0] as never)).toBe(
        "Ana — Ana picks the lock: no roll needed: success vs DC 12".replace(
          ": success vs DC 12",
          ": success",
        ),
      );
    });
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
    ...EMPTY_RESOLVE_SNAPSHOT,
    lastSeq: 0,
    ...over,
  });
  const build = (
    through: number,
    from: number,
    modeBefore: "free" | "turn",
    over: Partial<ResolveOutput> = {},
    extra: Partial<BuildFactsInput> = {},
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
      ...extra,
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
  });

  describe("monster plan and turn (spec 071)", () => {
    const npc = {
      combatantId: "goblin-3",
      batchIds: [] as string[],
      awaitingDm: false,
    };
    const plan = {
      intent: "talk",
      steps: [{ reason: "Snag offers a parley." }],
    };

    it("carries the plan and the turn from the new inputs", () => {
      const f = build(
        58,
        56,
        "turn",
        { npcTurn: npc },
        { npcPlan: plan, turnActorId: "goblin-3" },
      );
      expect(f.npcTurn?.plan).toEqual({
        intent: "talk",
        reasons: ["Snag offers a parley."],
        say: null,
        held: false,
      });
      expect(f.turn?.actor).toBe(f.npcTurn?.name);
      const lines = factEntries(f);
      expect(lines).toContain("  planned: talk; Snag offers a parley.");
      expect(lines[0]).toMatch(/^Turn: .+ acts in this beat\.$/);
    });

    it("offTurn lists present standing combatants, not the on-turn actor (TASK-0214)", () => {
      const f = build(
        58,
        56,
        "turn",
        { npcTurn: npc },
        { npcPlan: plan, turnActorId: "goblin-3" },
      );
      const off = f.turn?.offTurn ?? [];
      expect(off.length).toBeGreaterThan(0);
      expect(off).not.toContain(f.turn?.actor);
      expect(new Set(off).size).toBe(off.length);
      expect(factEntries(f)).toContain(
        `Off turn: ${off.join(", ")} (may speak, look or flinch; no strike, shot, cast, throw or charge).`,
      );
      // An absent S1 actor leaves the list.
      const gone = off[0] as string;
      const order = projectDm(
        fixture.transcript.filter((r) => r.seq <= 58),
      ).encounter?.order.find((o) => o.name === gone);
      const g = build(
        58,
        56,
        "turn",
        {
          npcTurn: npc,
          snapshot: {
            ...EMPTY_RESOLVE_SNAPSHOT.snapshot,
            actors: [
              {
                id: "x",
                combatantId: order?.combatantId ?? null,
                presence: "absent",
              } as never,
            ],
          },
        },
        { npcPlan: plan, turnActorId: "goblin-3" },
      );
      expect(g.turn?.offTurn ?? []).not.toContain(gone);
    });

    describe("step actors and held groups (TASK-0244)", () => {
      const base = () =>
        build(
          58,
          56,
          "turn",
          { npcTurn: npc },
          { npcPlan: plan, turnActorId: "goblin-3" },
        );
      const standing = () => {
        const name = base().turn?.offTurn?.[0] as string;
        const id = projectDm(
          fixture.transcript.filter((r) => r.seq <= 58),
        ).encounter?.order.find((o) => o.name === name)?.combatantId as string;
        return { name, id };
      };
      const item = {
        actionId: "pa1",
        committedSeq: 57,
        actor: "user:1",
        characterId: null,
        scope: "party" as const,
        text: "Odo casts Cure Wounds on Tamsin.",
        status: "committed" as const,
      };
      const withResult = (r: Record<string, unknown>) =>
        build(
          58,
          56,
          "turn",
          {
            npcTurn: npc,
            actionResults: [
              { actionId: "pa1", batchIds: [], refusalCode: null, ...r },
            ] as never,
          },
          { npcPlan: plan, turnActorId: "goblin-3", beat: [item] },
        );

      it("a step actor of a ran group is not off turn", () => {
        const { name, id } = standing();
        const f = withResult({ outcome: "applied", stepActors: [id] });
        expect(f.turn?.offTurn ?? []).not.toContain(name);
      });
      it("a held group keeps its companion off turn, yields one held entry and no action", () => {
        const { name, id } = standing();
        const f = withResult({ outcome: "held", heldFor: id });
        expect(f.held).toEqual([{ name, text: item.text }]);
        expect(f.actions).toEqual([]);
        expect(f.turn?.offTurn).toContain(name);
      });
      it("a plan-refused group adds no step actor", () => {
        const { name } = standing();
        const f = withResult({
          outcome: "refused",
          refusalCode: "STEP_ACTOR_MISMATCH",
        });
        expect(f.turn?.offTurn).toContain(name);
      });
    });

    it("offTurn is absent in free mode", () => {
      expect(build(58, 39, "free").turn).toBeUndefined();
    });

    it("a refused null verdict sets held", () => {
      const f = build(
        58,
        56,
        "turn",
        {
          npcTurn: npc,
          planGate: [
            {
              actionId: null,
              ok: false,
              code: "UNKNOWN_COMBATANT",
              failure: {} as never,
            },
          ],
        },
        { npcPlan: plan },
      );
      expect(f.npcTurn?.plan?.held).toBe(true);
      expect(factEntries(f)).toContain("  held: the plan did not go ahead");
    });

    it("carries the monster's say line; a refused plan drops it; a line alone is not held (specs/081)", () => {
      const said = { ...plan, say: "Two more hide left of the fire!" };
      const f = build(58, 56, "turn", { npcTurn: npc }, { npcPlan: said });
      expect(f.npcTurn?.plan?.say).toBe("Two more hide left of the fire!");
      expect(factEntries(f)).toContain(
        "  says: Two more hide left of the fire!",
      );
      const refused = build(
        58,
        56,
        "turn",
        {
          npcTurn: npc,
          planGate: [
            {
              actionId: null,
              ok: false,
              code: "UNKNOWN_COMBATANT",
              failure: {} as never,
            },
          ],
        },
        { npcPlan: said },
      );
      expect(refused.npcTurn?.plan?.say).toBeNull();
      expect(factEntries(refused).join("\n")).not.toContain("says:");
      const lineOnly = build(
        58,
        56,
        "turn",
        { npcTurn: npc },
        { npcPlan: { intent: "talk", steps: [], say: "Hold!" } },
      );
      expect(lineOnly.npcTurn?.plan?.held).toBe(false);
    });

    it("absent inputs give the empty plan and no turn", () => {
      const f = build(58, 56, "turn", { npcTurn: npc });
      expect(f.npcTurn?.plan).toEqual({
        intent: "other",
        reasons: [],
        say: null,
        held: true,
      });
      expect(build(58, 39, "free").turn).toBeUndefined();
    });
  });

  it("a refused action carries no follow-ups and renders 'it did not happen' (spec 088)", () => {
    const item = {
      actionId: "pa1",
      committedSeq: 57,
      actor: "user:1",
      characterId: null,
      scope: "party" as const,
      text: "Odo parleys with the lookout.",
      status: "committed" as const,
    };
    const f = build(
      58,
      56,
      "free",
      {
        actionResults: [
          {
            actionId: "pa1",
            batchIds: [],
            outcome: "refused",
            refusalCode: "UNKNOWN_COMBATANT",
          },
        ] as never,
      },
      { beat: [item], followUps: { pa1: ["Hail the camp."] } },
    );
    expect(f.actions[0]?.followUps).toEqual([]);
    const lines = factEntries(f).join("\n");
    expect(lines).toContain(
      "refused (refused: UNKNOWN_COMBATANT): it did not happen; nothing was rolled and nothing changed",
    );
    expect(lines).not.toContain("not yet attempted");
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
      followUps: ["Hail the camp."],
    };
    const none = factEntries({ ...base, actions: [act], clarify: [] });
    expect(none[0]).toBe(
      'Action a1 by Ana: "waves" -> no rules effect (nothing rolled, no game state changed; the attempt still happens in the story)',
    );
    expect(none[1]).toBe("  not yet attempted: Hail the camp.");
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

describe("presence fact (spec 048, User Story 2)", () => {
  it("maps a landed scene-presence.changed row to a presence fact and a fallback line", () => {
    const row = {
      seq: 70,
      type: "scene-presence.changed",
      visibility: "public",
      actor: "ai:dm",
      payload: {
        actorId: "snag",
        before: "present",
        after: "absent",
        reason: "fled",
        actionId: null,
      },
    } as unknown as StoredEvent;
    const here = dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(
      readFileSync(join(here, "fixtures/run5-narration-quality.json"), "utf8"),
    ) as { transcript: StoredEvent[] };
    const facts = buildNarrationFacts({
      trigger: "commit",
      seed: playerFacingSeed(testSeed()),
      beatNpcIds: [],
      projections: projectDm(fixture.transcript.filter((r) => r.seq <= 58)),
      beat: [],
      director: {
        beat: { decision: "resolve" },
        tableMode: { to: "stay" },
        trackers: [],
        scene: { status: "continue" },
        pacing: { tension: "low", spotlight: null, beatId: null },
        goalNote: "",
        companionPrompts: [],
        overrides: [],
      } as DirectorNodeOutput,
      adjudicate: null,
      resolve: {
        submissions: [],
        actionResults: [],
        appendedRows: [row],
        nextJob: null,
        chronicle: false,
        npcTurn: null,
        ...EMPTY_RESOLVE_SNAPSHOT,
        lastSeq: 0,
      } as ResolveOutput,
      presentNpcIds: [],
      modeBefore: "free",
      appendedRows: [row],
      clarify: [],
    });
    const ev = facts.events.find((e) => e.kind === "presence");
    expect(ev).toMatchObject({ presence: "absent", reason: "fled" });
    expect(factEntries(facts)).toContain(
      `Event: ${(ev as { name: string }).name} is now absent (fled)`,
    );
    expect(factualSummary(facts)).toMatch(/flees\./);
  });
});

describe("dm presence rows (spec 050, OQ-4)", () => {
  const input = (rows: StoredEvent[]) => {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(
      readFileSync(join(here, "fixtures/run5-narration-quality.json"), "utf8"),
    ) as { transcript: StoredEvent[] };
    return buildNarrationFacts({
      trigger: "commit",
      seed: playerFacingSeed(testSeed()),
      beatNpcIds: [],
      projections: projectDm(fixture.transcript.filter((r) => r.seq <= 58)),
      beat: [],
      director: {
        beat: { decision: "resolve" },
        tableMode: { to: "stay" },
        trackers: [],
        scene: { status: "continue" },
        pacing: { tension: "low", spotlight: null, beatId: null },
        goalNote: "",
        companionPrompts: [],
        overrides: [],
      } as DirectorNodeOutput,
      adjudicate: null,
      resolve: {
        submissions: [],
        actionResults: [],
        appendedRows: rows,
        nextJob: null,
        chronicle: false,
        npcTurn: null,
        ...EMPTY_RESOLVE_SNAPSHOT,
        lastSeq: 0,
      } as ResolveOutput,
      presentNpcIds: [],
      modeBefore: "free",
      appendedRows: rows,
      clarify: [],
    });
  };
  const presenceRow = (visibility: string) =>
    ({
      seq: 70,
      type: "scene-presence.changed",
      visibility,
      actor: "ai:dm",
      payload: {
        actorId: "snag",
        before: "present",
        after: "absent",
        reason: "removed",
        actionId: null,
      },
    }) as unknown as StoredEvent;

  it("yields no presence fact for a dm row and one for a public row", () => {
    expect(
      input([presenceRow("dm")]).events.filter((e) => e.kind === "presence"),
    ).toEqual([]);
    expect(
      input([presenceRow("public")]).events.filter(
        (e) => e.kind === "presence",
      ),
    ).toHaveLength(1);
  });
});

describe("settled death saves (TASK-0112, plan D5)", () => {
  const saveRows = (natural: number, before: number, after: number) => [
    roll(1, "s1", 0, {
      reason: "Death saving throw at the start of the turn [0a#3]",
      expression: "1d20",
      purpose: "death-save",
      combatantId: "ana",
      faces: [natural],
      mod: 0,
      natural,
    }),
    {
      kind: "change",
      ...common(2, "s1", 1),
      actionId: null,
      reason: "Death saving throw at the start of the turn [0a#3]",
      type: "death-saves.changed",
      subject: "ana",
      before: { successes: 0, failures: before },
      after: { successes: 0, failures: after },
    } as unknown as LedgerRow,
  ];

  it("yields a roll line and a tally line for the save", () => {
    const c = collectFacts(saveRows(4, 1, 2), nameOf);
    expect(c.rolls.map(renderRollLine)).toEqual([
      "Ana — Death saving throw at the start of the turn: 1d20 → 4 = 4",
    ]);
    expect(c.changes).toEqual([
      {
        kind: "death-saves",
        target: "Ana",
        successes: 0,
        failures: 2,
        failed: true,
      },
    ]);
    expect(c.changes.map(renderChangeLine)).toEqual([
      "Ana death saves: 0 successes, 2 failures",
    ]);
  });

  it("renders a settled save in the dice lines and the narration facts", () => {
    const c = collectFacts(saveRows(4, 1, 2), nameOf);
    const facts = {
      actions: [],
      npcTurn: null,
      settled: [{ name: "Ana", ...c }],
      events: [],
      rulings: [],
      clarify: [],
      modeChange: null,
      director: { sceneEnded: false },
    } as unknown as NarrationFacts;
    expect(renderDiceLines(facts)).toEqual([
      "Ana — Death saving throw at the start of the turn: 1d20 → 4 = 4",
      "Ana death saves: 0 successes, 2 failures",
    ]);
    const entries = factEntries(facts);
    expect(entries).toContain("Downed turn: Ana");
    expect(entries).toContain("  change: Ana fails a death saving throw");
    // The model never sees a digit from the tally.
    expect(entries.filter((e) => e.includes("change:")).join("")).not.toMatch(
      /\d/,
    );
  });
});

describe("deriveInvoluntary (spec 074 D3)", () => {
  const party = new Set(["ana"]);
  const maxes: Record<string, number> = { ana: 20, goblin: 20 };
  const derive = (rows: LedgerRow[]) =>
    deriveInvoluntary(rows, party, (id) => maxes[id] ?? null, nameOf);
  const attack = (
    seq: number,
    targetId: string,
    outcome: "hit" | "miss" | "critical-hit",
  ): LedgerRow =>
    ({
      kind: "outcome",
      ...common(seq, "b", seq),
      reason: "attack",
      outcome: {
        type: "attack.resolved",
        v: 1,
        reason: "attack",
        attackerId: targetId === "ana" ? "goblin" : "ana",
        targetId,
        rollIndex: 0,
        ac: 12,
        acSource: "record",
        total: 15,
        natural: 15,
        outcome,
      },
    }) as unknown as LedgerRow;
  const hp = (seq: number, subject: string, lost: number): LedgerRow =>
    ({
      kind: "change",
      ...common(seq, "b", seq),
      reason: "damage",
      type: "hp.changed",
      subject,
      before: { current: 20, temp: 0 },
      after: { current: 20 - lost, temp: 0 },
    }) as unknown as LedgerRow;
  const save = (
    seq: number,
    combatantId: string,
    outcome: "success" | "failure",
    ability = "dex",
  ): LedgerRow =>
    ({
      kind: "outcome",
      ...common(seq, "b", seq),
      reason: "save",
      outcome: {
        type: "check.resolved",
        v: 1,
        reason: "save",
        combatantId,
        kind: "saving-throw",
        ability,
        skill: null,
        rollIndex: 0,
        dc: 13,
        total: 8,
        natural: 8,
        autoFail: null,
        outcome,
      },
    }) as unknown as LedgerRow;

  it("a critical hit on a party member gives stagger", () => {
    expect(derive([attack(1, "ana", "critical-hit")])).toEqual([
      { name: "Ana", trigger: "stagger", detail: "critical hit by Goblin" },
    ]);
  });
  it("damage of exactly half max HP gives heavy-hit; one less gives none", () => {
    expect(derive([hp(1, "ana", 10)]).map((i) => i.trigger)).toEqual([
      "heavy-hit",
    ]);
    expect(derive([hp(1, "ana", 9)])).toEqual([]);
  });
  it("a failed DEX save gives flinch; a monster gives none; a success gives none", () => {
    expect(derive([save(1, "ana", "failure")])).toEqual([
      { name: "Ana", trigger: "flinch", detail: "failed dex save" },
    ]);
    expect(derive([save(1, "goblin", "failure")])).toEqual([]);
    expect(derive([save(1, "ana", "success")])).toEqual([]);
  });
  it("a failed death save gives none (death-saves.changed only)", () => {
    const row = {
      kind: "change",
      ...common(1, "b", 1),
      reason: "death save",
      type: "death-saves.changed",
      subject: "ana",
      before: { successes: 0, failures: 0 },
      after: { successes: 0, failures: 1 },
    } as unknown as LedgerRow;
    expect(derive([row])).toEqual([]);
  });
  it("a crit with heavy damage gives both", () => {
    expect(
      derive([attack(1, "ana", "critical-hit"), hp(2, "ana", 12)]).map(
        (i) => i.trigger,
      ),
    ).toEqual(["stagger", "heavy-hit"]);
  });
  it("max HP 0 gives no heavy-hit", () => {
    maxes.ana = 0;
    expect(derive([hp(1, "ana", 5)])).toEqual([]);
    maxes.ana = 20;
  });
  it("a foe's miss on a party member gives avoid; on a monster gives none", () => {
    expect(derive([attack(1, "ana", "miss")])).toEqual([
      { name: "Ana", trigger: "avoid", detail: "missed by Goblin" },
    ]);
    expect(derive([attack(1, "goblin", "miss")])).toEqual([]);
  });
});

describe("assist facts (spec 084 D13)", () => {
  const assistRow = (kind: "ability-check" | "attack") =>
    [
      {
        kind: "change",
        ...common(1, "h1", 0),
        reason: "Goblin helps Ana",
        type: "assist.granted",
        subject: "ana",
        before: null,
        after:
          kind === "attack"
            ? { kind, helperId: "goblin", expiresAt: null }
            : {
                kind,
                helperId: "goblin",
                skill: "acrobatics",
                expiresAt: null,
              },
      },
    ] as unknown as LedgerRow[];

  for (const kind of ["ability-check", "attack"] as const) {
    it(`builds an assist fact for a ${kind} assist and adds no dice line`, () => {
      const c = collectFacts(assistRow(kind), nameOf);
      expect(c.changes).toEqual([
        { kind: "assist", target: "Ana", helper: "Goblin", assist: kind },
      ]);
      expect(c.changes.map(renderChangeLine)).toEqual([null]);
    });
  }
});
