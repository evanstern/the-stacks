import { emptyState, scriptedRng } from "@the-stacks/dnd5e-engine";
import { type Intent, IntentSchema, parse } from "@the-stacks/intent";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type PlannedRow,
  type PlanResult,
  planProposal,
  project,
  type SessionProjections,
} from "../src/index.js";
import { DM_USER, OPERATOR } from "./gate-helpers.js";
import {
  batchSpecs,
  makeRows,
  PLAYER_A,
  PLAYER_B,
  type RowSpec,
  run,
} from "./helpers.js";

// The stop test needs a planner that returns a crafted command list.
const override = vi.hoisted(() => ({ result: null as unknown }));
vi.mock("@the-stacks/planner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@the-stacks/planner")>();
  return {
    ...actual,
    plan: (...args: Parameters<typeof actual.plan>) =>
      override.result ?? actual.plan(...args),
  };
});
afterEach(() => {
  override.result = null;
});

const zone = (id: string, hidden = false) => ({
  id,
  name: id.toUpperCase(),
  kind: "area",
  tags: [],
  hidden,
});
const SPACE = {
  zones: [zone("a"), zone("b"), zone("c", true)],
  edges: [
    { from: "a", to: "b", kind: "open", feet: 30 },
    { from: "b", to: "c", kind: "open", feet: 30 },
  ],
};
const stats = (attacks: unknown[] = []) => ({
  abilityMods: { str: 3, dex: 1, con: 1, int: 0, wis: 1, cha: 0 },
  proficiencyBonus: 2,
  saves: {},
  skills: { athletics: 5 },
  attacks,
  spellcastingAbility: null,
  abilityScores: { str: 14, dex: 12, con: 12, int: 10, wis: 12, cha: 10 },
});
const sword = {
  name: "Longsword",
  range: "melee",
  reachFt: 5,
  toHit: 5,
  damage: [
    {
      amount: { kind: "roll", expression: "1d8+3" },
      damageType: "slashing",
    },
  ],
};
const fighter = (id: string, zoneId: string, extra = {}) => ({
  id,
  name: id,
  hp: { max: 12 },
  zeroHpRule: "death-saves",
  ac: 12,
  stats: stats([sword]),
  placement: { zoneId },
  speed: 30,
  ...extra,
});
const member = (id: string, userId: string) => ({
  characterId: id,
  name: id,
  controller: { kind: "player", userId },
  combatantId: id,
});

const ana = { kind: "human", userId: PLAYER_A, role: "player" } as const;
const cade = { kind: "human", userId: PLAYER_B, role: "player" } as const;
const dmUser = { kind: "human", userId: DM_USER, role: "player" } as const;
const aiDm = { kind: "ai", actor: "ai:dm" } as const;

/** Turn mode, Ana's turn; Ana and the goblin in zone a, Cade in b, snag fogged in c. */
function world(opts: { humanDm?: boolean; revealC?: boolean } = {}) {
  let state = emptyState();
  const specs: RowSpec[] = [];
  if (opts.humanDm) {
    specs.push({
      type: "dm.seat.changed",
      payload: {
        reason: "seat",
        before: { kind: "ai" },
        after: { kind: "human", userId: DM_USER },
      },
      opts: { actor: OPERATOR },
    });
  }
  const mech = (command: unknown, batchId: string, visibility = "public") => {
    const done = run(state, command);
    state = done.state;
    specs.push(...batchSpecs(done.events, batchId, { visibility }));
  };
  mech({ type: "space.define", space: SPACE, reason: "r" }, "b-space", "dm");
  for (const [id, z] of [
    ["ana", "a"],
    ["cade", "b"],
    ["goblin", "a"],
    ["snag", "c"],
  ] as const) {
    mech(
      {
        type: "combatant.add",
        combatant: fighter(id, z),
        reason: "r",
      },
      `b-${id}`,
    );
  }
  specs.push({
    type: "zone.revealed",
    payload: {
      reason: "The party's view of the scene",
      reset: true,
      zones: SPACE.zones.filter((z) => !z.hidden),
      edges: [SPACE.edges[0]],
      occupants: { ana: "a", cade: "b", goblin: "a" },
    },
  });
  specs.push(
    {
      type: "party.member.changed",
      payload: {
        reason: "j",
        characterId: "ana",
        before: null,
        after: member("ana", PLAYER_A),
      },
    },
    {
      type: "party.member.changed",
      payload: {
        reason: "j",
        characterId: "cade",
        before: null,
        after: member("cade", PLAYER_B),
      },
    },
  );
  mech(
    {
      type: "initiative.roll",
      participants: ["ana", "cade", "goblin"].map((combatantId) => ({
        combatantId,
        mode: "normal",
      })),
      reason: "r",
    },
    "b-init",
  );
  specs.push({
    type: "table-mode.changed",
    payload: {
      reason: "turns",
      before: { mode: "free" },
      after: { mode: "turn", activeActor: PLAYER_A, activeCharacterId: "ana" },
    },
  });
  if (opts.revealC) {
    specs.push({
      type: "zone.revealed",
      payload: {
        reason: "reveal",
        reset: false,
        zones: [{ ...zone("c"), hidden: false }],
        edges: [SPACE.edges[1]],
        occupants: { snag: "c" },
      },
    });
  }
  return specs;
}

const fold = (specs: RowSpec[]): SessionProjections =>
  project(makeRows(specs), { role: "dm" });

const asSpecs = (rows: PlannedRow[]): RowSpec[] =>
  rows.map((r) => ({
    type: r.type,
    payload: r.payload,
    opts: { actor: r.actor, visibility: r.visibility },
  }));

const intent = (over: Record<string, unknown>): Intent =>
  IntentSchema.parse({
    id: "i-1",
    actor: { kind: "pc", id: "ana" },
    source: "composer",
    commit: "confirmed",
    ...over,
  });
const attack = (over: Record<string, unknown> = {}) =>
  intent({
    kind: "attack",
    targets: [{ kind: "actor", id: "goblin" }],
    params: { weapon: "Longsword" },
    ...over,
  });

function plan(
  p: SessionProjections,
  who: Parameters<typeof planProposal>[1],
  i: Intent,
  faces: number[] = [],
): PlanResult {
  return planProposal(
    p,
    who,
    { kind: "intent", summary: null, rationale: null, intent: i },
    scriptedRng(faces),
    { batchId: "b-plan" },
    null,
  );
}
function rowsOf(r: PlanResult): PlannedRow[] {
  if (!r.ok) throw new Error(`refused ${r.refusal.code}: ${r.refusal.message}`);
  return r.rows;
}
function codeOf(r: PlanResult): string {
  if (r.ok) throw new Error("expected a refusal");
  return r.refusal.code;
}
const carrierOf = (rows: PlannedRow[]) => {
  const last = rows[rows.length - 1] as PlannedRow;
  expect(last.type).toBe("intent.recorded");
  return last.payload as {
    outcome: string;
    batchId: string | null;
    facts: { kind: string; reason?: string }[];
    request: { requestId: string; ask: string } | null;
    answers: string | null;
    stopped: { code: string } | null;
  };
};

describe("settled kinds (AC #1)", () => {
  const p = fold(world());

  it("a confirmed attack settles with engine rows then the carrier", () => {
    const rows = rowsOf(plan(p, ana, attack(), [15, 4]));
    expect(rows.map((r) => r.type)).toEqual([
      "dice.rolled",
      "attack.resolved",
      "dice.rolled",
      "hp.changed",
      "encounter.changed",
      "intent.recorded",
    ]);
    expect(rows.some((r) => r.type === "hp.changed")).toBe(true);
    expect(carrierOf(rows)).toMatchObject({
      outcome: "settled",
      batchId: "b-plan",
    });
  });

  it("a miss skips the damage commands", () => {
    const rows = rowsOf(plan(p, ana, attack(), [2]));
    expect(rows.some((r) => r.type === "hp.changed")).toBe(false);
    expect(carrierOf(rows).outcome).toBe("settled");
  });

  it("the carrier is public and the engine rows are mechanics envelopes", () => {
    const rows = rowsOf(plan(p, ana, attack(), [15, 4]));
    expect(rows.every((r) => r.visibility === "public")).toBe(true);
    expect(rows[0]?.payload).toMatchObject({
      batchId: "b-plan",
      actionId: null,
    });
  });
});

describe("hosted finding 5: one Action per turn", () => {
  it("the second /attack in one turn refuses NO_ACTION_LEFT and writes nothing", () => {
    const text = "/attack @goblin with Longsword";
    const parsed = (id: string) => {
      const r = parse(text, {
        id,
        actor: { kind: "pc", id: "ana" },
        source: "composer",
        commit: "confirmed",
      });
      if (!r.ok) throw new Error(r.refusal.code);
      return r.intent;
    };
    const p0 = fold(world());
    const first = rowsOf(plan(p0, ana, parsed("f5-80"), [15, 4]));
    expect(first.map((r) => r.type).slice(-2)).toEqual([
      "encounter.changed",
      "intent.recorded",
    ]);
    expect(carrierOf(first).outcome).toBe("settled");
    const p1 = fold([...world(), ...asSpecs(first)]);
    const second = plan(p1, ana, parsed("f5-85"), [15, 4]);
    expect(second.ok).toBe(false);
    if (!second.ok)
      expect(second.refusal).toMatchObject({
        source: "gate",
        code: "NO_ACTION_LEFT",
      });
  });
});

describe("refusals", () => {
  const p = fold(world());
  const human = fold(world({ humanDm: true }));

  it("DRAFT_NOT_ACCEPTED", () => {
    expect(codeOf(plan(p, ana, attack({ commit: "draft" })))).toBe(
      "DRAFT_NOT_ACCEPTED",
    );
  });

  it("DM_SEAT_REQUIRED for a player's DM-control kind", () => {
    const i = intent({
      kind: "apply_damage",
      targets: [{ kind: "actor", id: "goblin" }],
      params: {
        amount: { kind: "roll", expression: "1d6" },
        damageType: "fire",
      },
    });
    expect(codeOf(plan(p, ana, i))).toBe("DM_SEAT_REQUIRED");
  });

  it("NOT_AUTHORIZED when a seat is excluded from a kind that a player seat may send", () => {
    const i = intent({ kind: "ask_dm", text: "x" });
    expect(codeOf(plan(p, { kind: "ai", actor: "ai:companion:bram" }, i))).toBe(
      "NOT_AUTHORIZED",
    );
  });

  it("NOT_YOUR_ACTOR", () => {
    expect(
      codeOf(plan(p, ana, attack({ actor: { kind: "pc", id: "cade" } }))),
    ).toBe("NOT_YOUR_ACTOR");
  });

  it("NOT_YOUR_TURN for a player off turn", () => {
    expect(
      codeOf(
        plan(p, cade, attack({ actor: { kind: "pc", id: "cade" } }), [15, 4]),
      ),
    ).toBe("NOT_YOUR_TURN");
  });

  it("NOT_YOUR_TURN while the DM holds the floor is not asserted for DM seats", () => {
    const i = intent({
      kind: "apply_heal",
      actor: { kind: "dm" },
      targets: [{ kind: "actor", id: "goblin" }],
      params: { amount: { kind: "roll", expression: "1d4" } },
    });
    expect(plan(human, dmUser, i, [2]).ok).toBe(true);
  });

  it("INTENT_EXISTS for a recorded id", () => {
    const rows = rowsOf(plan(p, ana, attack(), [15, 4]));
    const after = fold([...world(), ...asSpecs(rows)]);
    expect(codeOf(plan(after, ana, attack(), [15, 4]))).toBe("INTENT_EXISTS");
  });

  it("MODEL_NUMBER for an ai:dm amend body with a literal dc", () => {
    const attempt = intent({ kind: "attempt", text: "I climb." });
    const asked = rowsOf(plan(p, ana, attempt));
    const after = fold([...world(), ...asSpecs(asked)]);
    const ruling = {
      id: "r-1",
      kind: "ruling",
      actor: { kind: "ai:dm" },
      source: "ai",
      commit: "confirmed",
      params: {
        requestId: "i-1",
        decision: "amend",
        amend: {
          kind: "check",
          targets: [],
          params: { skill: "athletics", dc: 15 },
          text: "climb",
        },
      },
    };
    // The schema already tags a top-level dc; an amend body is the gate's check (FR-012).
    const parsed = IntentSchema.safeParse(ruling);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(codeOf(plan(after, aiDm, parsed.data))).toBe("MODEL_NUMBER");
    }
  });

  it("TARGET_UNSEEN from fog", () => {
    const r = plan(
      p,
      ana,
      attack({ id: "i-2", targets: [{ kind: "actor", id: "snag" }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.refusal).toMatchObject({
        source: "gate",
        code: "TARGET_UNSEEN",
      });
  });

  it("a planner KIND_UNSERVED surfaces with source gate", () => {
    const r = plan(p, ana, intent({ kind: "delay" }));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.refusal).toMatchObject({
        source: "gate",
        code: "KIND_UNSERVED",
      });
  });

  it("an engine refusal on the first command refuses and writes nothing", () => {
    const r = plan(
      p,
      ana,
      attack({ targets: [{ kind: "actor", id: "ghost" }] }),
    );
    expect(r.ok).toBe(false);
  });
});

describe("zone reveal (AC #4)", () => {
  const reveal = (
    id = "i-rev",
    zoneId = "c",
    over: Record<string, unknown> = {},
  ) =>
    intent({
      id,
      kind: "reveal",
      actor: { kind: "dm" },
      targets: [{ kind: "zone", id: zoneId }],
      params: { to: "party" },
      ...over,
    });

  it("writes zone.revealed then the carrier, and seen flips", () => {
    const human = fold(world({ humanDm: true }));
    const before = project(makeRows(world({ humanDm: true })), {
      role: "player",
      userId: PLAYER_A,
    });
    expect(
      plan(
        human,
        dmUser,
        attack({
          id: "i-x",
          actor: { kind: "pc", id: "ana" },
          targets: [{ kind: "actor", id: "snag" }],
        }),
      ).ok,
    ).toBe(false);
    const rows = rowsOf(plan(human, dmUser, reveal()));
    expect(rows.map((r) => r.type)).toEqual([
      "zone.revealed",
      "intent.recorded",
    ]);
    expect(rows[0]?.visibility).toBe("public");
    expect(before.spatial.placements.snag).toBeUndefined();
    const after = fold([...world({ humanDm: true }), ...asSpecs(rows)]);
    const ok = plan(
      after,
      ana,
      attack({ id: "i-y", targets: [{ kind: "actor", id: "snag" }] }),
      [15, 4],
    );
    // The target is now seen; any refusal is no longer TARGET_UNSEEN.
    if (!ok.ok) expect(ok.refusal.code).not.toBe("TARGET_UNSEEN");
  });

  it("an already revealed zone writes only the carrier", () => {
    const human = fold(world({ humanDm: true }));
    const rows = rowsOf(plan(human, dmUser, reveal("i-rev", "a")));
    expect(rows.map((r) => r.type)).toEqual(["intent.recorded"]);
  });

  it("a player gets DM_SEAT_REQUIRED", () => {
    const p = fold(world());
    expect(
      codeOf(
        plan(
          p,
          ana,
          reveal("i-rev", "c", { actor: { kind: "pc", id: "ana" } }),
        ),
      ),
    ).toBe("DM_SEAT_REQUIRED");
  });

  it("an unknown zone is TARGET_NOT_PRESENT", () => {
    const human = fold(world({ humanDm: true }));
    expect(codeOf(plan(human, dmUser, reveal("i-rev", "nowhere")))).toBe(
      "TARGET_NOT_PRESENT",
    );
  });

  it("an item target is KIND_UNSERVED with owner TASK-0288", () => {
    const human = fold(world({ humanDm: true }));
    const r = plan(
      human,
      dmUser,
      reveal("i-rev", "c", { targets: [{ kind: "item", id: "key" }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.refusal.code).toBe("KIND_UNSERVED");
      expect(r.refusal.details).toMatchObject({ owner: "TASK-0288" });
    }
  });
});

describe("not-planned kinds (FR-018)", () => {
  const human = fold(world({ humanDm: true }));

  it("say maps to an ic talk row", () => {
    const rows = rowsOf(
      plan(human, ana, intent({ kind: "say", text: "Hello." })),
    );
    expect(rows.map((r) => r.type)).toEqual(["talk", "intent.recorded"]);
    expect(rows[0]?.payload).toMatchObject({
      channel: "ic",
      characterId: "ana",
    });
  });

  it("ooc maps to an ooc talk row", () => {
    const rows = rowsOf(plan(human, ana, intent({ kind: "ooc", text: "brb" })));
    expect(rows[0]?.payload).toMatchObject({
      channel: "ooc",
      characterId: null,
    });
  });

  it("narrate maps to a narration row", () => {
    const rows = rowsOf(
      plan(
        human,
        dmUser,
        intent({ kind: "narrate", actor: { kind: "dm" }, text: "Thunder." }),
      ),
    );
    expect(rows.map((r) => r.type)).toEqual(["narration", "intent.recorded"]);
  });

  it("an unowned kind is KIND_UNSERVED with an owner", () => {
    const r = plan(
      human,
      dmUser,
      intent({ kind: "bookmark", actor: { kind: "dm" }, text: "x" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.refusal.code).toBe("KIND_UNSERVED");
      expect(r.refusal.details?.owner).toBeDefined();
    }
  });
});

describe("end_turn (FR-020)", () => {
  it("advances the turn and writes table-mode.changed before the carrier", () => {
    const p = fold(world());
    const rows = rowsOf(plan(p, ana, intent({ kind: "end_turn" })));
    const types = rows.map((r) => r.type);
    expect(types).toContain("table-mode.changed");
    expect(types[types.length - 1]).toBe("intent.recorded");
    const mode = rows.find((r) => r.type === "table-mode.changed");
    expect(mode?.payload).toMatchObject({
      after: { mode: "turn", activeActor: PLAYER_B, activeCharacterId: "cade" },
    });
  });
});

describe("rule 4 stop (planner contract section 3)", () => {
  it("keeps earlier events and records the stop", () => {
    const p = fold(world());
    override.result = {
      kind: "commands",
      facts: [],
      commands: [
        {
          command: {
            type: "roll",
            expression: "1d20",
            mode: "normal",
            reason: "r",
          },
        },
        {
          command: {
            type: "healing.apply",
            targetId: "ghost",
            amount: { kind: "fixed", value: 1 },
            reason: "r",
          },
        },
      ],
    };
    const rows = rowsOf(plan(p, ana, attack(), [10]));
    expect(rows.map((r) => r.type)).toEqual(["dice.rolled", "intent.recorded"]);
    expect(carrierOf(rows).stopped).not.toBeNull();
  });

  it("a refused first command refuses the Intent", () => {
    const p = fold(world());
    override.result = {
      kind: "commands",
      facts: [],
      commands: [
        {
          command: {
            type: "healing.apply",
            targetId: "ghost",
            amount: { kind: "fixed", value: 1 },
            reason: "r",
          },
        },
      ],
    };
    const r = plan(p, ana, attack());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.source).toBe("engine");
  });
});

describe("declared then confirmed (FR-009)", () => {
  const declared = () => attack({ commit: "declared" });

  it("a declared mechanical Intent is recorded, not planned", () => {
    const p = fold(world());
    const rows = rowsOf(plan(p, ana, declared()));
    expect(rows.map((r) => r.type)).toEqual(["intent.recorded"]);
    expect(carrierOf(rows).outcome).toBe("declared");
  });

  it("an equal confirmed body plans; a different body is INTENT_EXISTS", () => {
    const first = rowsOf(plan(fold(world()), ana, declared()));
    const p = fold([...world(), ...asSpecs(first)]);
    const ok = rowsOf(plan(p, ana, attack(), [15, 4]));
    expect(carrierOf(ok).outcome).toBe("settled");
    expect(
      codeOf(
        plan(
          p,
          ana,
          attack({ params: { weapon: "Longsword", mode: "advantage" } }),
          [15, 4],
        ),
      ),
    ).toBe("INTENT_EXISTS");
  });
});

describe("needs_ruling and answers (AC #2)", () => {
  const attemptI = () => intent({ kind: "attempt", text: "I climb the rope." });
  const asked = (humanDm: boolean) => {
    const base = world({ humanDm });
    const rows = rowsOf(plan(fold(base), ana, attemptI()));
    return { base, rows, p: fold([...base, ...asSpecs(rows)]) };
  };
  const answer = (
    params: Record<string, unknown>,
    actor = { kind: "dm" } as Record<string, unknown>,
  ) => intent({ id: "r-1", kind: "ruling", actor, source: "console", params });
  const stillOpen = (p: SessionProjections) =>
    p.intents.find((v) => v.id === "i-1")?.status;

  it("an attempt writes a needs_ruling carrier with the request", () => {
    const { rows, p } = asked(false);
    expect(rows.map((r) => r.type)).toEqual(["intent.recorded"]);
    expect(carrierOf(rows)).toMatchObject({
      outcome: "needs_ruling",
      request: { requestId: "i-1", ask: "outcome" },
    });
    expect(stillOpen(p)).toBe("needs_ruling");
  });

  it("a player check with no DC asks for a difficulty", () => {
    const rows = rowsOf(
      plan(
        fold(world()),
        ana,
        intent({ kind: "check", params: { skill: "athletics" } }),
      ),
    );
    expect(carrierOf(rows)).toMatchObject({
      outcome: "needs_ruling",
      request: { ask: "difficulty" },
    });
  });

  it("ruling accept on an outcome ask settles with fact no-roll and closes it", () => {
    const { base, p } = asked(true);
    const rows = rowsOf(
      plan(p, dmUser, answer({ requestId: "i-1", decision: "accept" })),
    );
    const carrier = carrierOf(rows);
    expect(carrier.answers).toBe("i-1");
    expect(carrier.facts.map((f) => f.kind)).toEqual(["ruling", "no-roll"]);
    expect(
      stillOpen(
        fold([...base, ...asSpecs(asked(true).rows), ...asSpecs(rows)]),
      ),
    ).toBe("answered");
  });

  it("ruling reject closes the request", () => {
    const { base, rows: askRows, p } = asked(true);
    const rows = rowsOf(
      plan(
        p,
        dmUser,
        answer({ requestId: "i-1", decision: "reject", reason: "no" }),
      ),
    );
    expect(carrierOf(rows).answers).toBe("i-1");
    expect(
      stillOpen(fold([...base, ...asSpecs(askRows), ...asSpecs(rows)])),
    ).toBe("answered");
  });

  it("ruling amend plans the amended body and closes the request", () => {
    const { base, rows: askRows, p } = asked(true);
    const rows = rowsOf(
      plan(
        p,
        dmUser,
        answer({
          requestId: "i-1",
          decision: "amend",
          difficulty: "easy",
          amend: {
            kind: "check",
            targets: [],
            params: { skill: "athletics" },
            text: "climb",
          },
        }),
        [12],
      ),
    );
    expect(rows.some((r) => r.type === "check.resolved")).toBe(true);
    expect(carrierOf(rows).answers).toBe("i-1");
    expect(
      stillOpen(fold([...base, ...asSpecs(askRows), ...asSpecs(rows)])),
    ).toBe("answered");
  });

  it("set_dc on a difficulty ask rolls the check and closes the request", () => {
    const base = world({ humanDm: true });
    const askRows = rowsOf(
      plan(
        fold(base),
        ana,
        intent({ kind: "check", params: { skill: "athletics" } }),
      ),
    );
    const p = fold([...base, ...asSpecs(askRows)]);
    const rows = rowsOf(
      plan(
        p,
        dmUser,
        intent({
          id: "r-2",
          kind: "set_dc",
          actor: { kind: "dm" },
          source: "console",
          params: { for: "i-1", difficulty: "medium" },
        }),
        [12],
      ),
    );
    expect(rows.some((r) => r.type === "check.resolved")).toBe(true);
    const carrier = carrierOf(rows);
    expect(carrier.answers).toBe("i-1");
    expect(
      stillOpen(fold([...base, ...asSpecs(askRows), ...asSpecs(rows)])),
    ).toBe("answered");
  });

  it("a ruling for no open request is REQUEST_NOT_OPEN", () => {
    const p = fold(world({ humanDm: true }));
    expect(
      codeOf(
        plan(p, dmUser, answer({ requestId: "nope", decision: "accept" })),
      ),
    ).toBe("REQUEST_NOT_OPEN");
  });
});
