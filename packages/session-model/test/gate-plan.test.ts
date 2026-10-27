import { scriptedRng } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  catalogEntry,
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
  bram,
  DM_USER,
  dmFold,
  dmFoldWith,
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
