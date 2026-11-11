import { describe, expect, it } from "vitest";
import {
  actorOf,
  DmProposalKindSchema,
  GATE_REQUEST_KINDS,
  GATE_REQUEST_VERSION,
  GateRequestSchema,
  mechanicsProposal,
  ProposalKindSchema,
  ProposalSchema,
} from "../src/index.js";
import { member, scene, tracker } from "./helpers.js";

const note = { summary: null, rationale: null };

describe("proposal kinds", () => {
  it("has a ProposalSchema option for every kind", () => {
    const options = ProposalSchema.options.map(
      (o) => (o.shape.kind as unknown as { value: string }).value,
    );
    expect([...options].sort()).toEqual([...ProposalKindSchema.options].sort());
    expect(ProposalKindSchema.options).toHaveLength(16);
  });

  it("DM kinds are the sixteen minus action.declare and action.withdraw", () => {
    expect(DmProposalKindSchema.options).toHaveLength(14);
    expect(DmProposalKindSchema.options).not.toContain("action.declare");
    expect(DmProposalKindSchema.options).not.toContain("action.withdraw");
  });

  it("GATE_REQUEST_KINDS has 20 entries", () => {
    expect(GATE_REQUEST_KINDS).toHaveLength(20);
    expect(GATE_REQUEST_KINDS).toContain("proposal.approve");
    expect(GATE_REQUEST_KINDS).toContain("gate.policy");
    expect(GATE_REQUEST_VERSION).toBe(1);
  });
});

describe("defaults", () => {
  it("fills summary, rationale, visibility and actionId", () => {
    const talk = ProposalSchema.parse({
      kind: "talk",
      talk: { text: "Hi", channel: "ooc", characterId: null },
    });
    expect(talk).toMatchObject({
      summary: null,
      rationale: null,
      visibility: "public",
    });
    const mech = ProposalSchema.parse({ kind: "mechanics", command: 1 });
    expect(mech).toMatchObject({ actionId: null, visibility: "public" });
  });

  it("mechanics.command accepts any JSON", () => {
    for (const command of [null, 1, "x", [1, 2], { type: "nope" }]) {
      expect(
        ProposalSchema.safeParse({ kind: "mechanics", command }).success,
      ).toBe(true);
    }
  });

  it("mechanicsProposal builds a parseable mechanics proposal", () => {
    const built = mechanicsProposal(
      { type: "roll", expression: "1d20", reason: "r" } as never,
      { visibility: "dm", summary: "s" },
    );
    expect(built).toMatchObject({
      kind: "mechanics",
      visibility: "dm",
      summary: "s",
      actionId: null,
    });
    expect(ProposalSchema.safeParse(built).success).toBe(true);
  });
});

describe("visibility shapes", () => {
  it("tracker is always dm", () => {
    const base = {
      kind: "tracker",
      reason: "r",
      trackerId: "ritual",
      after: tracker,
    };
    expect(ProposalSchema.parse(base)).toMatchObject({ visibility: "dm" });
    expect(
      ProposalSchema.safeParse({ ...base, visibility: "public" }).success,
    ).toBe(false);
  });

  it("mechanics and journal accept only public or dm", () => {
    expect(
      ProposalSchema.safeParse({
        kind: "mechanics",
        command: null,
        visibility: "some-user",
      }).success,
    ).toBe(false);
    expect(
      ProposalSchema.safeParse({
        kind: "journal",
        entry: { entryId: "j", title: "t", body: "b", sourceActionIds: [] },
        visibility: "some-user",
      }).success,
    ).toBe(false);
  });

  it("scene-presence accepts an absent, public or dm visibility and refuses any other", () => {
    const base = {
      kind: "scene-presence",
      actorId: "goblin",
      reason: "fled",
    };
    expect(ProposalSchema.parse(base)).toMatchObject({ visibility: "public" });
    expect(
      ProposalSchema.parse({ ...base, visibility: "public" }),
    ).toMatchObject({ visibility: "public" });
    expect(ProposalSchema.parse({ ...base, visibility: "dm" })).toMatchObject({
      visibility: "dm",
    });
    expect(
      ProposalSchema.safeParse({ ...base, visibility: "some-user" }).success,
    ).toBe(false);
  });

  it("table-mode, scene, party and tracker carry no before", () => {
    const proposals = [
      { kind: "table-mode", reason: "r", after: { mode: "free" } },
      { kind: "scene", reason: "r", after: scene },
      { kind: "party", reason: "r", characterId: "ana", after: member },
      { kind: "tracker", reason: "r", trackerId: "ritual", after: tracker },
    ];
    for (const proposal of proposals) {
      const parsed = ProposalSchema.parse({ ...proposal, before: "stale" });
      expect("before" in parsed).toBe(false);
    }
  });
});

describe("gate requests", () => {
  it("parses the four supervision requests", () => {
    const requests = [
      { kind: "proposal.approve", proposalId: "prop-1" },
      { kind: "proposal.reject", proposalId: "prop-1" },
      { kind: "dm.seat", reason: "r", after: { kind: "ai" } },
      {
        kind: "gate.policy",
        reason: "r",
        proposalKind: "scene",
        policy: "ask",
      },
    ];
    for (const request of requests) {
      expect(GateRequestSchema.safeParse(request).success).toBe(true);
    }
    expect(
      GateRequestSchema.parse({ kind: "proposal.reject", proposalId: "p" }),
    ).toMatchObject({ reason: null });
  });

  it("rejects an unknown kind and action.declare as a policy kind", () => {
    expect(GateRequestSchema.safeParse({ kind: "nope" }).success).toBe(false);
    expect(
      GateRequestSchema.safeParse({
        kind: "gate.policy",
        reason: "r",
        proposalKind: "action.declare",
        policy: "ask",
      }).success,
    ).toBe(false);
    expect(note).toBeDefined();
  });
});

describe("actorOf", () => {
  it("returns the user id or the AI actor", () => {
    expect(actorOf({ kind: "human", userId: "u1", role: "player" })).toBe("u1");
    expect(actorOf({ kind: "ai", actor: "ai:dm" })).toBe("ai:dm");
    expect(actorOf({ kind: "ai", actor: "ai:companion:bram" })).toBe(
      "ai:companion:bram",
    );
  });
});

describe("floor proposal (spec 049, FT-1)", () => {
  const turn = { round: 1, combatantId: "ana" };
  it("parses each op and defaults the note", () => {
    for (const op of ["end", "take", "return"]) {
      const parsed = ProposalSchema.parse({
        kind: "floor",
        op,
        turn,
        reason: "r",
      });
      expect(parsed).toMatchObject({ kind: "floor", op, summary: null });
    }
  });
  it("rejects a bad op, a round below 1, a bad combatant id and a missing reason", () => {
    const bad = [
      { kind: "floor", op: "give", turn, reason: "r" },
      { kind: "floor", op: "end", turn: { ...turn, round: 0 }, reason: "r" },
      {
        kind: "floor",
        op: "end",
        turn: { ...turn, combatantId: "Bad Id" },
        reason: "r",
      },
      { kind: "floor", op: "end", turn },
    ];
    for (const input of bad) {
      expect(ProposalSchema.safeParse(input).success).toBe(false);
    }
  });
  it("is both a proposal kind and a gate request kind", () => {
    expect(ProposalKindSchema.options).toContain("floor");
    expect(DmProposalKindSchema.options).toContain("floor");
    expect(GATE_REQUEST_KINDS).toContain("floor");
  });
});
