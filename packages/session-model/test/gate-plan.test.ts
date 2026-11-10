import { scriptedRng } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  catalogEntry,
  checkPermission,
  currentVersion,
  mechanicsProposal,
  type PlanContext,
  type PlanResult,
  type Proposal,
  ProposalSchema,
  type Proposer,
  planProposal,
  project,
  type SessionProjections,
} from "../src/index.js";
import {
  aiDm,
  ana,
  BRAM_ACTOR,
  bram,
  CADE_USER,
  DM_USER,
  dmFold,
  dmFoldWith,
  floorFold,
  OPERATOR,
  outsider,
  seatedDm,
} from "./gate-helpers.js";
import {
  batchSpecs,
  deepFreeze,
  member,
  PLAYER_A,
  PLAYER_B,
  run,
  scene,
  tracker,
} from "./helpers.js";

const ids = { batchId: "b-plan" };
const parse = (x: unknown): Proposal => ProposalSchema.parse(x);

function plan(
  p: SessionProjections,
  proposer: Proposer,
  proposal: Proposal,
  faces: number[] = [],
  proposalId: string | null = null,
  context?: PlanContext,
): PlanResult {
  return planProposal(
    p,
    proposer,
    proposal,
    scriptedRng(faces),
    ids,
    proposalId,
    context,
  );
}

function okRows(result: PlanResult) {
  if (!result.ok) throw new Error(`refused ${result.refusal.code}`);
  return result.rows;
}

const checkRoll = {
  type: "check.roll",
  combatantId: "ana",
  kind: "ability-check",
  ability: "dex",
  skill: null,
  expression: "1d20+5",
  mode: "normal",
  dc: 15,
  autoFail: null,
  reason: "Ana picks the lock",
};

describe("planProposal rows per kind (gate-api.md section 1)", () => {
  const p = dmFold({ humanDm: true });

  const cases: {
    name: string;
    proposer: Proposer;
    proposal: Proposal;
    type: string;
    actor: string;
    visibility: string;
    check?: (payload: Record<string, unknown>) => void;
  }[] = [
    {
      name: "talk",
      proposer: ana,
      proposal: parse({
        kind: "talk",
        talk: { text: "Hi", channel: "ic", characterId: "ana" },
      }),
      type: "talk",
      actor: PLAYER_A,
      visibility: "public",
    },
    {
      name: "talk (whisper)",
      proposer: seatedDm,
      proposal: parse({
        kind: "talk",
        talk: { text: "psst", channel: "ic", characterId: null },
        visibility: PLAYER_A,
      }),
      type: "talk",
      actor: DM_USER,
      visibility: PLAYER_A,
    },
    {
      name: "action.declare",
      proposer: ana,
      proposal: parse({
        kind: "action.declare",
        action: {
          actionId: "act-new",
          characterId: "ana",
          scope: "character",
          text: "Ana waits.",
        },
      }),
      type: "action.declared",
      actor: PLAYER_A,
      visibility: "public",
    },
    {
      name: "action.comment",
      proposer: bram,
      proposal: parse({
        kind: "action.comment",
        comment: { actionId: "act-ana", stance: "approve", text: "" },
      }),
      type: "action.commented",
      actor: "ai:companion:bram",
      visibility: "public",
    },
    {
      name: "action.commit",
      proposer: ana,
      proposal: parse({ kind: "action.commit", actionId: "act-ana" }),
      type: "action.committed",
      actor: PLAYER_A,
      visibility: "public",
      check: (payload) =>
        expect(payload).toEqual({ actionId: "act-ana", authority: "declarer" }),
    },
    {
      name: "action.withdraw",
      proposer: ana,
      proposal: parse({ kind: "action.withdraw", actionId: "act-ana" }),
      type: "action.withdrawn",
      actor: PLAYER_A,
      visibility: "public",
      check: (payload) => expect(payload).toEqual({ actionId: "act-ana" }),
    },
    {
      name: "narration",
      proposer: seatedDm,
      proposal: parse({
        kind: "narration",
        narration: { text: "x", actionIds: ["act-ana"] },
      }),
      type: "narration",
      actor: DM_USER,
      visibility: "public",
    },
    {
      name: "table-mode",
      proposer: aiDm,
      proposal: parse({
        kind: "table-mode",
        reason: "combat",
        after: {
          mode: "turn",
          activeActor: PLAYER_A,
          activeCharacterId: "ana",
        },
      }),
      type: "table-mode.changed",
      actor: "ai:dm",
      visibility: "public",
      check: (payload) => expect(payload.before).toEqual({ mode: "free" }),
    },
    {
      name: "scene",
      proposer: aiDm,
      proposal: parse({
        kind: "scene",
        reason: "move",
        after: { ...scene, sceneId: "hall" },
      }),
      type: "scene.changed",
      actor: "ai:dm",
      visibility: "public",
      check: (payload) => expect(payload.before).toEqual(scene),
    },
    {
      name: "party",
      proposer: aiDm,
      proposal: parse({
        kind: "party",
        reason: "leave",
        characterId: "bram",
        after: null,
      }),
      type: "party.member.changed",
      actor: "ai:dm",
      visibility: "public",
      check: (payload) =>
        expect((payload.before as { characterId: string }).characterId).toBe(
          "bram",
        ),
    },
    {
      name: "tracker",
      proposer: aiDm,
      proposal: parse({
        kind: "tracker",
        reason: "start",
        trackerId: "ritual",
        after: tracker,
      }),
      type: "tracker.changed",
      actor: "ai:dm",
      visibility: "dm",
      check: (payload) => expect(payload.before).toBeNull(),
    },
    {
      name: "journal",
      proposer: aiDm,
      proposal: parse({
        kind: "journal",
        entry: {
          entryId: "j-new",
          title: "t",
          body: "b",
          sourceActionIds: ["act-ana"],
        },
        visibility: "dm",
      }),
      type: "journal.entry.added",
      actor: "ai:dm",
      visibility: "dm",
    },
  ];

  for (const c of cases) {
    it(`${c.name} plans one ${c.type} row`, () => {
      const result = plan(p, c.proposer, c.proposal);
      const rows = okRows(result);
      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect(row).toMatchObject({
        type: c.type,
        actor: c.actor,
        visibility: c.visibility,
      });
      c.check?.(row?.payload as Record<string, unknown>);
      if (result.ok) expect(result.batchId).toBeNull();
    });
  }

  it("action.resolve plans one action.resolved row for a committed action", () => {
    const q = dmFoldWith([checkRoll], {
      extra: [
        {
          type: "action.committed",
          payload: { actionId: "act-ana", authority: "declarer" },
          opts: { actor: PLAYER_A },
        },
      ],
    });
    const ledgerBatch = q.ledger.find((r) => r.actionId === "act-ana");
    expect(ledgerBatch).toBeUndefined(); // the helper batch has no actionId
    const resolution = {
      kind: "action.resolve",
      resolution: {
        actionId: "act-ana",
        outcome: "no-effect",
        batchIds: [],
        refusalCode: null,
      },
    };
    const rows = okRows(plan(q, aiDm, parse(resolution)));
    expect(rows[0]).toMatchObject({ type: "action.resolved", actor: "ai:dm" });
  });

  it("records the declared scope on the action.declared row (card AC #1)", () => {
    const q = dmFold({ humanDm: true });
    const declare = (scope: "character" | "party", actionId: string) =>
      okRows(
        plan(
          q,
          ana,
          parse({
            kind: "action.declare",
            action: {
              actionId,
              characterId: scope === "party" ? null : "ana",
              scope,
              text: "x",
            },
          }),
        ),
      )[0];
    expect(declare("party", "n-party")).toMatchObject({
      type: "action.declared",
      payload: { scope: "party" },
    });
    expect(declare("character", "n-char")).toMatchObject({
      type: "action.declared",
      payload: { scope: "character" },
    });
  });

  it("every planned payload validates against its catalog schema", () => {
    for (const c of cases) {
      for (const row of okRows(plan(p, c.proposer, c.proposal))) {
        const version = currentVersion(row.type) as number;
        const entry = catalogEntry(row.type, version);
        expect(entry?.schema.safeParse(row.payload).success, c.name).toBe(true);
      }
    }
  });
});

describe("planProposal refusals (AC #8)", () => {
  const p = dmFold({ humanDm: true });

  const refused: [string, Proposer, unknown, string][] = [
    [
      "ACTION_EXISTS",
      ana,
      {
        kind: "action.declare",
        action: {
          actionId: "act-ana",
          characterId: "ana",
          scope: "character",
          text: "x",
        },
      },
      "ACTION_EXISTS",
    ],
    [
      "declare for a character the proposer does not control",
      ana,
      {
        kind: "action.declare",
        action: {
          actionId: "n",
          characterId: "bram",
          scope: "character",
          text: "x",
        },
      },
      "NOT_AUTHORIZED",
    ],
    [
      "party declare by an outsider",
      outsider,
      {
        kind: "action.declare",
        action: { actionId: "n", characterId: null, scope: "party", text: "x" },
      },
      "NOT_AUTHORIZED",
    ],
    [
      "IC talk as a character the proposer does not control",
      ana,
      { kind: "talk", talk: { text: "x", channel: "ic", characterId: "bram" } },
      "NOT_AUTHORIZED",
    ],
    [
      "comment on an unknown action",
      ana,
      {
        kind: "action.comment",
        comment: { actionId: "nope", stance: "comment", text: "x" },
      },
      "UNKNOWN_ACTION",
    ],
    [
      "commit by a non-controller",
      outsider,
      { kind: "action.commit", actionId: "act-ana" },
      "COMMIT_NOT_ALLOWED",
    ],
    [
      "withdraw an unknown action",
      ana,
      { kind: "action.withdraw", actionId: "nope" },
      "UNKNOWN_ACTION",
    ],
    [
      "resolve an uncommitted action",
      aiDm,
      {
        kind: "action.resolve",
        resolution: {
          actionId: "act-ana",
          outcome: "no-effect",
          batchIds: [],
          refusalCode: null,
        },
      },
      "ACTION_NOT_COMMITTED",
    ],
    [
      "narration naming an unknown action",
      aiDm,
      { kind: "narration", narration: { text: "x", actionIds: ["nope"] } },
      "UNKNOWN_ACTION",
    ],
    [
      "party with no before and no after",
      aiDm,
      { kind: "party", reason: "r", characterId: "ghost", after: null },
      "INVALID_PROPOSAL",
    ],
    [
      "party after.characterId differing from characterId",
      aiDm,
      { kind: "party", reason: "r", characterId: "ghost", after: member },
      "INVALID_PROPOSAL",
    ],
    [
      "tracker with no before and no after",
      aiDm,
      { kind: "tracker", reason: "r", trackerId: "ritual", after: null },
      "INVALID_PROPOSAL",
    ],
    [
      "mechanics naming an unknown action",
      aiDm,
      { kind: "mechanics", command: checkRoll, actionId: "nope" },
      "UNKNOWN_ACTION",
    ],
  ];

  for (const [name, proposer, input, code] of refused) {
    it(`${name} -> ${code}`, () => {
      const result = plan(p, proposer, parse(input));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal.code).toBe(code);
        expect(result.refusal.source).toBe("gate");
      }
    });
  }

  it("scene with no before and no after -> INVALID_PROPOSAL", () => {
    const empty = project([], { role: "dm" });
    const result = plan(
      empty,
      aiDm,
      parse({ kind: "scene", reason: "r", after: null }),
    );
    expect(result).toMatchObject({
      ok: false,
      refusal: { code: "INVALID_PROPOSAL", source: "gate" },
    });
  });

  it("journal entry id reuse -> JOURNAL_ENTRY_EXISTS", () => {
    const q = dmFold({
      extra: [
        {
          type: "journal.entry.added",
          payload: {
            entryId: "j-1",
            title: "t",
            body: "b",
            sourceActionIds: [],
          },
        },
      ],
    });
    const result = plan(
      q,
      aiDm,
      parse({
        kind: "journal",
        entry: { entryId: "j-1", title: "t", body: "b", sourceActionIds: [] },
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      refusal: { code: "JOURNAL_ENTRY_EXISTS" },
    });
  });

  it("withdraw of a committed or withdrawn action -> ACTION_NOT_OPEN", () => {
    const committed = dmFold({
      extra: [
        {
          type: "action.committed",
          payload: { actionId: "act-ana", authority: "declarer" },
          opts: { actor: PLAYER_A },
        },
      ],
    });
    const withdrawnAlready = dmFold({
      extra: [
        {
          type: "action.withdrawn",
          payload: { actionId: "act-ana" },
          opts: { actor: PLAYER_A },
        },
      ],
    });
    for (const q of [committed, withdrawnAlready]) {
      expect(
        plan(q, ana, parse({ kind: "action.withdraw", actionId: "act-ana" })),
      ).toMatchObject({ ok: false, refusal: { code: "ACTION_NOT_OPEN" } });
    }
  });

  it("the seated DM plans a withdraw of a player's open action", () => {
    const rows = okRows(
      plan(
        dmFold({ humanDm: true }),
        seatedDm,
        parse({ kind: "action.withdraw", actionId: "act-bram" }),
      ),
    );
    expect(rows[0]).toMatchObject({
      type: "action.withdrawn",
      actor: DM_USER,
      payload: { actionId: "act-bram" },
    });
  });

  it("resolve naming a batch the ledger ties to the action plans the row", () => {
    const base = dmFold();
    const executed = run(base.engine, checkRoll);
    const q = dmFold({
      extra: [
        {
          type: "action.committed",
          payload: { actionId: "act-ana", authority: "declarer" },
          opts: { actor: PLAYER_A },
        },
        ...batchSpecs(executed.events, "b-act", {
          actionId: "act-ana",
          actor: "ai:dm",
        }),
      ],
    });
    const rows = okRows(
      plan(
        q,
        aiDm,
        parse({
          kind: "action.resolve",
          resolution: {
            actionId: "act-ana",
            outcome: "applied",
            batchIds: ["b-act"],
            refusalCode: null,
          },
        }),
      ),
    );
    expect(rows[0]?.type).toBe("action.resolved");
  });

  it("resolve with a batch the ledger does not tie to the action -> UNKNOWN_BATCH", () => {
    const q = dmFold({
      extra: [
        {
          type: "action.committed",
          payload: { actionId: "act-ana", authority: "declarer" },
          opts: { actor: PLAYER_A },
        },
      ],
    });
    const result = plan(
      q,
      aiDm,
      parse({
        kind: "action.resolve",
        resolution: {
          actionId: "act-ana",
          outcome: "applied",
          batchIds: ["b-ana"],
          refusalCode: null,
        },
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      refusal: { code: "UNKNOWN_BATCH" },
    });
  });
});

describe("mechanics through the engine (AC #8)", () => {
  const dead = dmFoldWith([
    {
      type: "damage.apply",
      targetId: "goblin",
      components: [
        { amount: { kind: "fixed", value: 7 }, damageType: "slashing" },
      ],
      reason: "r",
    },
  ]);
  const live = dmFold();

  const engineCases: [string, SessionProjections, unknown][] = [
    [
      "TARGET_DEAD",
      dead,
      {
        type: "attack.roll",
        attackerId: "ana",
        targetId: "goblin",
        expression: "1d20+4",
        reason: "r",
      },
    ],
    [
      "UNKNOWN_COMBATANT",
      live,
      {
        type: "attack.roll",
        attackerId: "ana",
        targetId: "ghost",
        expression: "1d20+4",
        reason: "r",
      },
    ],
    ["INVALID_COMMAND", live, { type: "not-a-command" }],
    [
      "D20_TERM_REQUIRED",
      live,
      {
        type: "attack.roll",
        attackerId: "ana",
        targetId: "goblin",
        expression: "2d6",
        reason: "r",
      },
    ],
    ["NO_ACTIVE_ENCOUNTER", live, { type: "turn.advance", reason: "r" }],
  ];

  for (const [code, state, command] of engineCases) {
    it(`returns the engine's ${code} with source engine and draws no die`, () => {
      const rng = scriptedRng([]);
      const result = planProposal(
        state,
        aiDm,
        parse({ kind: "mechanics", command }),
        rng,
        ids,
        null,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal.source).toBe("engine");
        expect(result.refusal.code).toBe(code);
      }
      expect(rng.calls()).toBe(0);
    });
  }

  it("applies a roll as one batch of envelopes stamped with the proposal id", () => {
    const result = plan(
      live,
      aiDm,
      mechanicsProposal(checkRoll as never, { actionId: "act-ana" }),
      [13],
      "prop-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batchId).toBe("b-plan");
    expect(result.rows.map((r) => r.type)).toEqual([
      "dice.rolled",
      "check.resolved",
    ]);
    result.rows.forEach((row, i) => {
      expect(row.payload).toMatchObject({
        batchId: "b-plan",
        index: i,
        count: 2,
        actionId: "act-ana",
        proposalId: "prop-1",
      });
    });
  });

  it("a dm-visibility roll keeps the visibility on every row", () => {
    const result = plan(
      live,
      aiDm,
      mechanicsProposal(checkRoll as never, { visibility: "dm" }),
      [13],
    );
    for (const row of okRows(result)) expect(row.visibility).toBe("dm");
  });
});

describe("direct and approved plans of one command agree (AC #7)", () => {
  it("equal dice give deeply equal engine events; only proposalId differs", () => {
    const p = dmFold({ humanDm: true });
    const proposal = mechanicsProposal(checkRoll as never, {
      actionId: "act-ana",
    });
    const direct = okRows(plan(p, seatedDm, proposal, [13], null));
    const approved = okRows(plan(p, aiDm, proposal, [13], "prop-9"));
    expect(direct).toHaveLength(approved.length);
    direct.forEach((row, i) => {
      const a = row.payload as Record<string, unknown>;
      const b = approved[i]?.payload as Record<string, unknown>;
      expect(a.event).toEqual(b.event);
      expect({ ...a, proposalId: undefined }).toEqual({
        ...b,
        proposalId: undefined,
      });
      expect(a.proposalId).toBeNull();
      expect(b.proposalId).toBe("prop-9");
    });
  });
});

describe("planProposal purity", () => {
  it("mutates no input and reads no clock", () => {
    const p = deepFreeze(dmFoldWith([], { humanDm: true }));
    const proposal = deepFreeze(mechanicsProposal(checkRoll as never));
    const before = JSON.stringify(p);
    const realNow = Date.now;
    Date.now = () => {
      throw new Error("clock read");
    };
    try {
      expect(plan(p, aiDm, proposal, [13]).ok).toBe(true);
      expect(
        plan(
          p,
          aiDm,
          deepFreeze(parse({ kind: "scene", reason: "r", after: scene })),
        ).ok,
      ).toBe(true);
    } finally {
      Date.now = realNow;
    }
    expect(JSON.stringify(p)).toBe(before);
    expect(OPERATOR).toBeDefined();
  });
});

describe("action.declare able-actor gate (CHARACTER_UNABLE, TASK-0112)", () => {
  const dmg = (value: number) => ({
    type: "damage.apply",
    targetId: "ana",
    components: [{ amount: { kind: "fixed", value }, damageType: "fire" }],
    reason: "r",
  });
  const declareFor = (scope: "character" | "party") =>
    parse({
      kind: "action.declare",
      action: {
        actionId: "act-new",
        characterId: scope === "character" ? "ana" : null,
        scope,
        text: "Ana tries.",
      },
    });
  const unconscious = dmFoldWith([dmg(14)]);
  const stable = dmFoldWith([
    dmg(14),
    { type: "stabilize", targetId: "ana", reason: "r" },
  ]);
  const dead = dmFoldWith([dmg(30)]);

  it.each([
    ["unconscious", unconscious],
    ["stable", stable],
    ["dead", dead],
  ] as const)("refuses a %s character before any row", (state, fold) => {
    expect(
      fold.party.find((m) => m.characterId === "ana")?.combatant?.lifeState,
    ).toBe(state);
    const result = plan(fold, ana, declareFor("character"));
    expect(result).toMatchObject({
      ok: false,
      refusal: {
        source: "gate",
        code: "CHARACTER_UNABLE",
        details: { characterId: "ana", reason: "life-state", lifeState: state },
      },
    });
  });

  it("accepts a conscious character and a member with no combatant", () => {
    expect(plan(dmFold(), ana, declareFor("character")).ok).toBe(true);
    const noCombatant = dmFold({
      extra: [
        {
          type: "party.member.changed",
          payload: {
            reason: "j",
            characterId: "dara",
            before: null,
            after: {
              characterId: "dara",
              name: "Dara",
              controller: { kind: "player", userId: PLAYER_A },
              combatantId: null,
            },
          },
        },
      ],
    });
    const daraDeclare = parse({
      kind: "action.declare",
      action: {
        actionId: "act-dara",
        characterId: "dara",
        scope: "character",
        text: "Dara waits.",
      },
    });
    expect(plan(noCombatant, ana, daraDeclare).ok).toBe(true);
  });

  it("party scope: refused when every controlled character is down, accepted when one is conscious", () => {
    expect(plan(unconscious, ana, declareFor("party"))).toMatchObject({
      ok: false,
      refusal: { code: "CHARACTER_UNABLE" },
    });
    const extra = [
      {
        type: "party.member.changed",
        payload: {
          reason: "j",
          characterId: "dara",
          before: null,
          after: {
            characterId: "dara",
            name: "Dara",
            controller: { kind: "player", userId: PLAYER_A },
            combatantId: null,
          },
        },
      },
    ];
    const mixed = dmFoldWith([dmg(14)], { extra });
    expect(plan(mixed, ana, declareFor("party")).ok).toBe(true);
  });

  it("an unauthorised proposer for a downed character is still NOT_AUTHORIZED", () => {
    expect(plan(unconscious, outsider, declareFor("character"))).toMatchObject({
      ok: false,
      refusal: { code: "NOT_AUTHORIZED" },
    });
  });
});

describe("group sign-off planning (specs/044-group-signoff/contracts/signoff.md)", () => {
  const cade: Proposer = { kind: "human", userId: PLAYER_B, role: "player" };
  const present = [PLAYER_A, PLAYER_B];
  const comment = (stance: string) =>
    parse({
      kind: "action.comment",
      comment: { actionId: "act-party", stance, text: "ok" },
    });
  const commit = parse({ kind: "action.commit", actionId: "act-party" });
  const marker = () => ({
    actor: "system",
    type: "presence.recorded",
    visibility: "public",
    payload: { present, purpose: "signoff", actionId: "act-party" },
  });

  it("a two-human explicit group commit plans the marker then the commit", () => {
    const p = dmFold({
      twoHumans: true,
      extra: [
        {
          type: "action.commented",
          payload: { actionId: "act-party", stance: "approve", text: "ok" },
          opts: { actor: PLAYER_B },
        },
      ],
    });
    const rows = okRows(plan(p, ana, commit, [], null, { present }));
    expect(rows.map((r) => r.type)).toEqual([
      "presence.recorded",
      "action.committed",
    ]);
    expect(rows[0]).toEqual(marker());
    expect(rows[1]).toMatchObject({
      actor: PLAYER_A,
      payload: { actionId: "act-party", authority: "group" },
    });
  });

  it("the marker holds the acting human even when the present set omits them", () => {
    const p = dmFold({
      twoHumans: true,
      extra: [
        {
          type: "action.commented",
          payload: { actionId: "act-party", stance: "approve", text: "ok" },
          opts: { actor: PLAYER_B },
        },
      ],
    });
    const rows = okRows(
      plan(p, ana, commit, [], null, { present: [PLAYER_B] }),
    );
    expect(rows[0]?.payload).toMatchObject({ present: [PLAYER_A, PLAYER_B] });
  });

  it("the completing approval plans comment, marker and commit as the proposer", () => {
    const p = dmFold({ twoHumans: true });
    const rows = okRows(
      plan(p, cade, comment("approve"), [], null, { present }),
    );
    expect(rows.map((r) => r.type)).toEqual([
      "action.commented",
      "presence.recorded",
      "action.committed",
    ]);
    expect(rows[0]?.actor).toBe(PLAYER_B);
    expect(rows[1]).toEqual(marker());
    expect(rows[2]).toMatchObject({
      actor: PLAYER_B,
      payload: { actionId: "act-party", authority: "group" },
    });
  });

  it("an approve that leaves the quorum unmet plans one row", () => {
    // A third present human who has not signed off keeps the quorum open.
    const third = {
      type: "party.member.changed",
      payload: {
        reason: "j",
        characterId: "dara",
        before: null,
        after: {
          characterId: "dara",
          name: "Dara",
          controller: {
            kind: "player",
            userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          },
          combatantId: null,
        },
      },
    };
    const p3 = dmFold({ twoHumans: true, extra: [third] });
    const rows = okRows(
      plan(p3, cade, comment("approve"), [], null, {
        present: [...present, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
      }),
    );
    expect(rows.map((r) => r.type)).toEqual(["action.commented"]);
  });

  it("an object never commits", () => {
    const p = dmFold({ twoHumans: true });
    const rows = okRows(
      plan(p, cade, comment("object"), [], null, { present }),
    );
    expect(rows.map((r) => r.type)).toEqual(["action.commented"]);
  });

  it("without a present set a comment never commits", () => {
    const p = dmFold({ twoHumans: true });
    const rows = okRows(plan(p, cade, comment("approve")));
    expect(rows.map((r) => r.type)).toEqual(["action.commented"]);
  });

  it("a single-human party plans exactly today's rows (FR-014)", () => {
    const p = dmFold();
    const committed = okRows(
      plan(p, ana, commit, [], null, { present: [PLAYER_A] }),
    );
    expect(committed.map((r) => r.type)).toEqual(["action.committed"]);
    const approved = okRows(
      plan(p, ana, comment("approve"), [], null, { present: [PLAYER_A] }),
    );
    expect(approved.map((r) => r.type)).toEqual(["action.commented"]);
  });

  it("a DM commit plans one row and no marker", () => {
    const p = dmFold({ twoHumans: true });
    const rows = okRows(plan(p, aiDm, commit, [], null, { present }));
    expect(rows.map((r) => r.type)).toEqual(["action.committed"]);
    expect(rows[0]?.payload).toMatchObject({ authority: "dm" });
  });

  it("an objection refuses the commit with waiting and objecting details", () => {
    const p = dmFold({
      twoHumans: true,
      extra: [
        {
          type: "action.commented",
          payload: { actionId: "act-party", stance: "object", text: "no" },
          opts: { actor: PLAYER_B },
        },
      ],
    });
    const result = plan(p, ana, commit, [], null, { present });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.refusal).toMatchObject({
      source: "gate",
      code: "GROUP_SIGNOFF_REQUIRED",
      details: { waiting: [], objecting: [PLAYER_B] },
    });
  });
});

describe("stall override (spec 049 research R11, ruling FT-5)", () => {
  const cade: Proposer = { kind: "human", userId: CADE_USER, role: "player" };
  const present = [PLAYER_A, PLAYER_B];
  const stall = (actionId = "act-party") =>
    parse({ kind: "action.commit", actionId, override: "stall" });
  const refusalOf = (result: PlanResult) => {
    if (result.ok) throw new Error("expected a refusal");
    return result.refusal;
  };

  it("parses override stall and rejects any other value", () => {
    expect(stall()).toMatchObject({ override: "stall" });
    expect(
      ProposalSchema.safeParse({
        kind: "action.commit",
        actionId: "act-party",
        override: "force",
      }).success,
    ).toBe(false);
  });

  it("ai:dm with no objection plans the signoff marker then the dm commit", () => {
    const p = dmFold({ twoHumans: true });
    const rows = okRows(plan(p, aiDm, stall(), [], null, { present }));
    expect(rows.map((r) => r.type)).toEqual([
      "presence.recorded",
      "action.committed",
    ]);
    expect(rows[0]).toEqual({
      actor: "system",
      type: "presence.recorded",
      visibility: "public",
      payload: { present, purpose: "signoff", actionId: "act-party" },
    });
    expect(rows[1]).toMatchObject({
      actor: "ai:dm",
      payload: { actionId: "act-party", authority: "dm" },
    });
  });

  it("a waiting (silent) quorum member does not block the override", () => {
    const p = dmFold({ twoHumans: true });
    expect(plan(p, aiDm, stall(), [], null, { present }).ok).toBe(true);
  });

  it("from a human proposer -> INVALID_PROPOSAL", () => {
    const p = dmFold({ twoHumans: true });
    expect(refusalOf(plan(p, ana, stall(), [], null, { present })).code).toBe(
      "INVALID_PROPOSAL",
    );
    expect(refusalOf(plan(p, cade, stall(), [], null, { present })).code).toBe(
      "INVALID_PROPOSAL",
    );
    const seated = dmFold({ twoHumans: true, humanDm: true });
    expect(
      refusalOf(plan(seated, seatedDm, stall(), [], null, { present })).code,
    ).toBe("INVALID_PROPOSAL");
  });

  it("on a character action -> INVALID_PROPOSAL", () => {
    const p = dmFold({ twoHumans: true });
    expect(
      refusalOf(plan(p, aiDm, stall("act-ana"), [], null, { present })).code,
    ).toBe("INVALID_PROPOSAL");
  });

  it("with one party human -> INVALID_PROPOSAL", () => {
    const p = dmFold();
    expect(
      refusalOf(plan(p, aiDm, stall(), [], null, { present: [PLAYER_A] })).code,
    ).toBe("INVALID_PROPOSAL");
  });

  it("an unknown action keeps UNKNOWN_ACTION", () => {
    const p = dmFold({ twoHumans: true });
    expect(
      refusalOf(plan(p, aiDm, stall("nope"), [], null, { present })).code,
    ).toBe("UNKNOWN_ACTION");
  });

  it("a quorum member's objection -> GROUP_SIGNOFF_REQUIRED with objecting", () => {
    const p = dmFold({
      twoHumans: true,
      extra: [
        {
          type: "action.commented",
          payload: { actionId: "act-party", stance: "object", text: "no" },
          opts: { actor: PLAYER_B },
        },
      ],
    });
    const refusal = refusalOf(plan(p, aiDm, stall(), [], null, { present }));
    expect(refusal).toMatchObject({
      source: "gate",
      code: "GROUP_SIGNOFF_REQUIRED",
      details: { waiting: [], objecting: [PLAYER_B] },
    });
  });

  it("an objector outside the present set does not block", () => {
    const p = dmFold({
      twoHumans: true,
      extra: [
        {
          type: "action.commented",
          payload: { actionId: "act-party", stance: "object", text: "no" },
          opts: { actor: PLAYER_B },
        },
      ],
    });
    const rows = okRows(
      plan(p, aiDm, stall(), [], null, { present: [PLAYER_A] }),
    );
    expect(rows[0]?.payload).toMatchObject({ present: [PLAYER_A] });
  });

  it("a plain dm commit still writes no marker", () => {
    const p = dmFold({ twoHumans: true });
    const rows = okRows(
      plan(
        p,
        aiDm,
        parse({ kind: "action.commit", actionId: "act-party" }),
        [],
        null,
        {
          present,
        },
      ),
    );
    expect(rows.map((r) => r.type)).toEqual(["action.committed"]);
  });
});

describe("scene-presence planner (TASK-0141)", () => {
  const presence = (actorId: string, reason: string, actionId?: string) =>
    parse({
      kind: "scene-presence",
      actorId,
      reason,
      actionId: actionId ?? null,
    });
  const init = {
    type: "initiative.roll",
    participants: [{ combatantId: "ana" }, { combatantId: "goblin" }],
    reason: "r",
  };
  const turnOpts = {
    turn: { activeActor: PLAYER_A, activeCharacterId: "ana" },
  };

  it("a free-mode fled lands one presence row only", () => {
    const p = dmFold();
    const rows = okRows(plan(p, aiDm, presence("goblin", "fled")));
    expect(rows).toEqual([
      {
        actor: "ai:dm",
        type: "scene-presence.changed",
        visibility: "public",
        payload: {
          actorId: "goblin",
          before: "present",
          after: "absent",
          reason: "fled",
          actionId: null,
        },
      },
    ]);
  });

  it("a dm proposal plans a dm row; a default proposal plans public", () => {
    const dm = parse({
      kind: "scene-presence",
      actorId: "goblin",
      reason: "fled",
      visibility: "dm",
    });
    const rows = okRows(plan(dmFold(), aiDm, dm));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "scene-presence.changed",
      visibility: "dm",
    });
    const dflt = okRows(plan(dmFold(), aiDm, presence("goblin", "fled")));
    expect(dflt[0].visibility).toBe("public");
  });

  it("engine rows planned beside a dm row stay public", () => {
    const p = dmFoldWith([init], turnOpts);
    const dm = parse({
      kind: "scene-presence",
      actorId: "goblin",
      reason: "fled",
      visibility: "dm",
    });
    const rows = okRows(plan(p, aiDm, dm));
    expect(rows[0].visibility).toBe("dm");
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows.slice(1)) expect(row.visibility).toBe("public");
  });

  it("turn mode, in the order, fled: presence row then combatant.depart rows in one batch", () => {
    const p = dmFoldWith([init], turnOpts);
    const result = plan(p, aiDm, presence("goblin", "fled"));
    const rows = okRows(result);
    expect(rows[0].type).toBe("scene-presence.changed");
    expect(rows.slice(1).map((r) => r.type)).toEqual(["encounter.changed"]);
    expect(result.ok && result.batchId).toBe("b-plan");
    expect(
      (rows[1].payload as { event: { after: { order: unknown[] } } }).event
        .after.order,
    ).toHaveLength(1);
  });

  it("an absent combatant out of the order, arrived: presence row then initiative.join rows", () => {
    const base = dmFoldWith([init], turnOpts);
    const left = dmFoldWith(
      [init, { type: "initiative.leave", combatantId: "goblin", reason: "r" }],
      {
        ...turnOpts,
        extra: [
          {
            type: "scene-presence.changed",
            payload: {
              actorId: "goblin",
              before: "present",
              after: "absent",
              reason: "fled",
              actionId: null,
            },
          },
        ],
      },
    );
    expect(base.engine.encounter?.order).toHaveLength(2);
    expect(left.engine.encounter?.order).toHaveLength(1);
    const rows = okRows(plan(left, aiDm, presence("goblin", "arrived"), [12]));
    expect(rows.map((r) => r.type)[0]).toBe("scene-presence.changed");
    expect(rows.slice(1).map((r) => r.type)).toContain("dice.rolled");
    expect(rows.slice(1).map((r) => r.type)).toContain("encounter.changed");
  });

  it("yielded in turn mode: presence row only, order unchanged", () => {
    const p = dmFoldWith([init], turnOpts);
    const rows = okRows(plan(p, aiDm, presence("goblin", "surrendered")));
    expect(rows.map((r) => r.type)).toEqual(["scene-presence.changed"]);
  });

  it("refuses the same value with INVALID_PROPOSAL", () => {
    expect(plan(dmFold(), aiDm, presence("goblin", "arrived"))).toMatchObject({
      ok: false,
      refusal: { source: "gate", code: "INVALID_PROPOSAL" },
    });
  });

  it("refuses an unknown action with UNKNOWN_ACTION", () => {
    expect(
      plan(dmFold(), aiDm, presence("goblin", "fled", "act-missing")),
    ).toMatchObject({ ok: false, refusal: { code: "UNKNOWN_ACTION" } });
  });

  it("the last entry fleeing ends the encounter (spec 099)", () => {
    const solo = dmFoldWith([
      { ...init, participants: [{ combatantId: "goblin" }] },
    ]);
    const rows = okRows(plan(solo, aiDm, presence("goblin", "fled")));
    expect(rows.slice(1).map((r) => r.type)).toEqual(["encounter.ended"]);
  });

  it("a placed combatant that fled in free mode gets a combatant.placed null row", () => {
    const p = dmFoldWith([
      {
        type: "space.define",
        space: {
          zones: [
            { id: "z", name: "z", kind: "room", tags: [], hidden: false },
          ],
          edges: [],
        },
        reason: "r",
      },
      {
        type: "combatant.place",
        combatantId: "goblin",
        zoneId: "z",
        reason: "r",
      },
    ]);
    const rows = okRows(plan(p, aiDm, presence("goblin", "fled")));
    expect(rows.map((r) => r.type)).toEqual([
      "scene-presence.changed",
      "combatant.placed",
    ]);
    expect(
      (rows[1].payload as { event: { after: unknown } }).event.after,
    ).toBeNull();
  });

  it("a surrendered hostile goes neutral; a sideless or party yield gets the presence row only", () => {
    const hostile = dmFoldWith([
      {
        type: "combatant.side",
        combatantId: "goblin",
        side: "hostile",
        reason: "r",
      },
    ]);
    const rows = okRows(plan(hostile, aiDm, presence("goblin", "surrendered")));
    expect(rows.map((r) => r.type)).toEqual([
      "scene-presence.changed",
      "combatant.sided",
    ]);
    expect((rows[1].payload as { event: { after: string } }).event.after).toBe(
      "neutral",
    );
    const party = dmFoldWith([
      {
        type: "combatant.side",
        combatantId: "goblin",
        side: "party",
        reason: "r",
      },
    ]);
    expect(
      okRows(plan(party, aiDm, presence("goblin", "conceded"))).map(
        (r) => r.type,
      ),
    ).toEqual(["scene-presence.changed"]);
  });

  it("a seated human DM may propose it; players and companions are refused", () => {
    const p = dmFold({ humanDm: true });
    expect(plan(p, seatedDm, presence("goblin", "fled")).ok).toBe(true);
    for (const who of [ana, bram, outsider]) {
      const result = checkPermission(p, who, presence("goblin", "fled"));
      expect(result.ok).toBe(false);
    }
  });
});

describe("action.declare absent gate (CHARACTER_UNABLE, TASK-0141)", () => {
  const absentRow = (actorId: string, reason = "left") => ({
    type: "scene-presence.changed",
    payload: {
      actorId,
      before: "present",
      after: reason === "surrendered" ? "yielded" : "absent",
      reason,
      actionId: null,
    },
  });
  const declareFor = (scope: "character" | "party") =>
    parse({
      kind: "action.declare",
      action: {
        actionId: "act-new",
        characterId: scope === "character" ? "ana" : null,
        scope,
        text: "Ana tries.",
      },
    });

  it("refuses an absent character with reason absent", () => {
    const p = dmFold({ extra: [absentRow("ana")] });
    expect(plan(p, ana, declareFor("character"))).toMatchObject({
      ok: false,
      refusal: {
        source: "gate",
        code: "CHARACTER_UNABLE",
        details: { characterId: "ana", reason: "absent" },
      },
    });
  });

  it("party scope: refused when every controlled member is absent", () => {
    const p = dmFold({ extra: [absentRow("ana")] });
    expect(plan(p, ana, declareFor("party"))).toMatchObject({
      ok: false,
      refusal: {
        code: "CHARACTER_UNABLE",
        details: { reason: "absent" },
      },
    });
  });

  it("party scope: reason is absent when one member is absent and the other unable", () => {
    const dara = {
      type: "party.member.changed",
      payload: {
        reason: "j",
        characterId: "dara",
        before: null,
        after: {
          characterId: "dara",
          name: "Dara",
          controller: { kind: "player", userId: PLAYER_A },
          combatantId: "dara",
        },
      },
    };
    const p = dmFoldWith(
      [
        {
          type: "combatant.add",
          combatant: {
            id: "dara",
            name: "Dara",
            hp: { max: 12 },
            zeroHpRule: "death-saves",
            ac: 12,
            hitDice: [],
            spellSlots: { standard: {}, pact: null },
          },
          reason: "r",
        },
        {
          type: "damage.apply",
          targetId: "dara",
          components: [
            { amount: { kind: "fixed", value: 14 }, damageType: "fire" },
          ],
          reason: "r",
        },
      ],
      { extra: [dara, absentRow("ana")] },
    );
    const result = plan(p, ana, declareFor("party"));
    expect(result).toMatchObject({
      ok: false,
      refusal: { code: "CHARACTER_UNABLE", details: { reason: "absent" } },
    });
  });

  it("a yielded character declares", () => {
    const p = dmFold({ extra: [absentRow("ana", "surrendered")] });
    expect(plan(p, ana, declareFor("character")).ok).toBe(true);
  });

  it("an arrived character declares", () => {
    const p = dmFold({
      extra: [
        absentRow("ana"),
        {
          type: "scene-presence.changed",
          payload: {
            actorId: "ana",
            before: "absent",
            after: "present",
            reason: "arrived",
            actionId: null,
          },
        },
      ],
    });
    expect(plan(p, ana, declareFor("character")).ok).toBe(true);
  });

  it("an unauthorised proposer still gets NOT_AUTHORIZED", () => {
    const p = dmFold({ extra: [absentRow("ana")] });
    expect(plan(p, outsider, declareFor("character"))).toMatchObject({
      ok: false,
      refusal: { code: "NOT_AUTHORIZED" },
    });
  });
});

describe("floor planner (spec 049, research R3 to R5)", () => {
  const cade: Proposer = { kind: "human", userId: CADE_USER, role: "player" };
  const turnOf = (combatantId: string, round = 1) => ({ round, combatantId });
  const floor = (
    op: "end" | "take" | "return",
    turn: { round: number; combatantId: string },
    reason = "Turn handled.",
  ) => parse({ kind: "floor", op, turn, reason });
  const types = (rows: { type: string }[]) => rows.map((r) => r.type);
  const refusalOf = (result: PlanResult) => {
    if (result.ok) throw new Error("expected a refusal");
    return result.refusal;
  };

  it("end by the active human plans one mechanics batch then the next holder", () => {
    const p = floorFold({ active: "ana" });
    const result = plan(
      p,
      ana,
      floor("end", turnOf("ana"), "Ana ends her turn."),
    );
    const rows = okRows(result);
    expect(result.ok && result.batchId).toBe("b-plan");
    const last = rows[rows.length - 1];
    expect(rows.slice(0, -1).map((r) => r.type)).toContain("turn.advanced");
    for (const r of rows.slice(0, -1)) {
      expect(r.payload).toMatchObject({ batchId: "b-plan" });
    }
    expect(last).toEqual({
      actor: PLAYER_A,
      type: "table-mode.changed",
      visibility: "public",
      payload: {
        reason: "Ana ends her turn.",
        before: p.tableMode,
        after: {
          mode: "turn",
          activeActor: BRAM_ACTOR,
          activeCharacterId: "bram",
        },
      },
    });
  });

  it("the companion ends its own turn", () => {
    const p = floorFold({ active: "bram" });
    const rows = okRows(plan(p, bram, floor("end", turnOf("bram"))));
    expect(rows[rows.length - 1]?.payload).toMatchObject({
      after: { activeActor: CADE_USER, activeCharacterId: "cade" },
    });
  });

  it("end past the last combatant starts the next round and names the goblin's turn as ai:dm", () => {
    const p = floorFold({ active: "cade" });
    const rows = okRows(plan(p, cade, floor("end", turnOf("cade"))));
    expect(rows[rows.length - 1]?.payload).toMatchObject({
      after: { mode: "turn", activeActor: "ai:dm", activeCharacterId: null },
    });
    const wrap = floorFold({ active: "goblin" });
    const wrapRows = okRows(
      plan(wrap, seatedDm, floor("end", turnOf("goblin"))),
    );
    expect(wrapRows[wrapRows.length - 1]?.payload).toMatchObject({
      after: { activeActor: PLAYER_A, activeCharacterId: "ana" },
    });
  });

  it("end with a dying next combatant rolls a death save, then passes it (scripted fail)", () => {
    const p = floorFold({ active: "ana", downBram: true });
    const result = plan(p, ana, floor("end", turnOf("ana")), [5]);
    const rows = okRows(result);
    const kinds = types(rows);
    expect(kinds.filter((t) => t === "turn.advanced")).toHaveLength(2);
    expect(kinds).toContain("death-saves.changed");
    expect(result.ok && result.batchId).toBe("b-plan");
    const mech = rows.slice(0, -1);
    mech.forEach((r, i) => {
      expect(r.payload).toMatchObject({ batchId: "b-plan", index: i });
      expect(r.payload).toMatchObject({ count: mech.length });
    });
    expect(rows[rows.length - 1]?.payload).toMatchObject({
      after: { activeActor: CADE_USER, activeCharacterId: "cade" },
    });
  });

  it("a natural 20 revives the dying combatant and keeps the turn on it", () => {
    const p = floorFold({ active: "ana", downBram: true });
    const rows = okRows(plan(p, ana, floor("end", turnOf("ana")), [20]));
    const kinds = types(rows);
    expect(kinds.filter((t) => t === "turn.advanced")).toHaveLength(1);
    expect(kinds).toContain("life-state.changed");
    expect(rows[rows.length - 1]?.payload).toMatchObject({
      after: { activeActor: BRAM_ACTOR, activeCharacterId: "bram" },
    });
  });

  it("the seated DM passes (end) during a player's turn and while holding the floor", () => {
    const p = floorFold({ active: "ana" });
    const rows = okRows(plan(p, seatedDm, floor("end", turnOf("ana"))));
    expect(rows[rows.length - 1]?.actor).toBe(DM_USER);
    const held = floorFold({ active: "ana", held: true });
    const heldRows = okRows(plan(held, seatedDm, floor("end", turnOf("ana"))));
    expect(heldRows[heldRows.length - 1]?.payload).toMatchObject({
      before: { activeActor: DM_USER },
      after: { activeActor: BRAM_ACTOR },
    });
  });

  it("take plans one table-mode row naming the DM and leaves the engine turn alone", () => {
    const p = floorFold({ active: "ana" });
    const result = plan(
      p,
      seatedDm,
      floor("take", turnOf("ana"), "DM steps in."),
    );
    expect(okRows(result)).toEqual([
      {
        actor: DM_USER,
        type: "table-mode.changed",
        visibility: "public",
        payload: {
          reason: "DM steps in.",
          before: p.tableMode,
          after: {
            mode: "turn",
            activeActor: DM_USER,
            activeCharacterId: null,
          },
        },
      },
    ]);
    expect(result.ok && result.batchId).toBeNull();
  });

  it("return plans one table-mode row for the active combatant's actor", () => {
    const p = floorFold({ active: "cade", held: true });
    const rows = okRows(plan(p, seatedDm, floor("return", turnOf("cade"))));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({
      before: { activeActor: DM_USER },
      after: {
        mode: "turn",
        activeActor: CADE_USER,
        activeCharacterId: "cade",
      },
    });
  });

  it("ai:dm ending an absent human's turn writes a floor marker first", () => {
    const p = floorFold({ active: "ana" });
    const rows = okRows(
      plan(p, aiDm, floor("end", turnOf("ana")), [], null, {
        present: [CADE_USER],
      }),
    );
    expect(rows[0]).toEqual({
      actor: "system",
      type: "presence.recorded",
      visibility: "public",
      payload: { present: [CADE_USER], purpose: "floor" },
    });
    expect(rows[rows.length - 1]?.type).toBe("table-mode.changed");
    expect(types(rows)).toContain("turn.advanced");
  });

  describe("refusals append nothing (research R5 order)", () => {
    it("free mode, or turn mode with no encounter -> NOT_TURN_MODE", () => {
      expect(
        refusalOf(plan(dmFold(), ana, floor("end", turnOf("ana")))).code,
      ).toBe("NOT_TURN_MODE");
      const noEncounter = dmFold({
        turn: { activeActor: PLAYER_A, activeCharacterId: "ana" },
      });
      const refusal = refusalOf(
        plan(noEncounter, ana, floor("end", turnOf("ana"))),
      );
      expect(refusal).toMatchObject({ source: "gate", code: "NOT_TURN_MODE" });
    });

    it("a stale turn -> TURN_MOVED with expected and actual", () => {
      const p = floorFold({ active: "bram" });
      const refusal = refusalOf(plan(p, ana, floor("end", turnOf("ana"))));
      expect(refusal.code).toBe("TURN_MOVED");
      expect(refusal.details).toEqual({
        expected: turnOf("ana"),
        actual: turnOf("bram"),
      });
      const round = refusalOf(
        plan(floorFold(), ana, floor("end", turnOf("ana", 2))),
      );
      expect(round.code).toBe("TURN_MOVED");
    });

    it("TURN_MOVED comes before the proposer check", () => {
      const p = floorFold({ active: "bram" });
      expect(refusalOf(plan(p, cade, floor("end", turnOf("ana")))).code).toBe(
        "TURN_MOVED",
      );
    });

    it("another party member -> FLOOR_NOT_HELD with the holder", () => {
      const p = floorFold({ active: "ana" });
      const refusal = refusalOf(plan(p, cade, floor("end", turnOf("ana"))));
      expect(refusal.code).toBe("FLOOR_NOT_HELD");
      expect(refusal.details).toEqual({ holder: PLAYER_A });
    });

    it("a player ending while the DM holds the floor -> FLOOR_NOT_HELD", () => {
      const p = floorFold({ active: "ana", held: true });
      const refusal = refusalOf(plan(p, ana, floor("end", turnOf("ana"))));
      expect(refusal.code).toBe("FLOOR_NOT_HELD");
      expect(refusal.details).toEqual({ holder: DM_USER });
    });

    it("take while held and return while not held -> INVALID_PROPOSAL", () => {
      const held = floorFold({ active: "ana", held: true });
      expect(
        refusalOf(plan(held, seatedDm, floor("take", turnOf("ana")))).code,
      ).toBe("INVALID_PROPOSAL");
      const free = floorFold({ active: "ana" });
      expect(
        refusalOf(plan(free, seatedDm, floor("return", turnOf("ana")))).code,
      ).toBe("INVALID_PROPOSAL");
    });

    it("ai:dm ending a present human's turn -> NOT_AUTHORIZED", () => {
      const p = floorFold({ active: "ana" });
      const refusal = refusalOf(
        plan(p, aiDm, floor("end", turnOf("ana")), [], null, {
          present: [PLAYER_A, CADE_USER],
        }),
      );
      expect(refusal.code).toBe("NOT_AUTHORIZED");
    });

    it("ai:dm take or return -> NOT_AUTHORIZED; a player's take -> NOT_DM", () => {
      const p = floorFold({ active: "ana" });
      expect(refusalOf(plan(p, aiDm, floor("take", turnOf("ana")))).code).toBe(
        "NOT_AUTHORIZED",
      );
      const held = floorFold({ active: "ana", held: true });
      expect(
        refusalOf(plan(held, aiDm, floor("return", turnOf("ana")))).code,
      ).toBe("NOT_AUTHORIZED");
      expect(refusalOf(plan(p, ana, floor("take", turnOf("ana")))).code).toBe(
        "NOT_DM",
      );
    });

    it("a refusal carries no rows", () => {
      const result = plan(floorFold(), cade, floor("end", turnOf("ana")));
      expect(result.ok).toBe(false);
      expect("rows" in result).toBe(false);
    });
  });

  it("mutates no input", () => {
    const p = deepFreeze(floorFold({ active: "ana", downBram: true }));
    expect(() => plan(p, ana, floor("end", turnOf("ana")), [5])).not.toThrow();
  });
});
