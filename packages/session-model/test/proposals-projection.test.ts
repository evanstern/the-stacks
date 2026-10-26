import { describe, expect, it } from "vitest";
import {
  findProposal,
  pendingProposals,
  project,
  type Viewer,
} from "../src/index.js";
import { makeRows, PLAYER_A, type RowSpec } from "./helpers.js";

const DM_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const dm: Viewer = { role: "dm" };
const player: Viewer = { role: "player", userId: PLAYER_A };

function created(id: string, policy: "ask" | "suggest" = "ask"): RowSpec {
  return {
    type: "proposal.created",
    payload: {
      proposalId: id,
      policy,
      proposal: {
        kind: "narration",
        summary: null,
        rationale: null,
        narration: { text: "Thunder.", actionIds: [] },
        visibility: "public",
      },
    },
    opts: { visibility: "dm" },
  };
}
const approved = (id: string, batchId: string | null = null): RowSpec => ({
  type: "proposal.approved",
  payload: { proposalId: id, batchId },
  opts: { actor: DM_USER, visibility: "dm" },
});
const rejected = (id: string, reason: string | null = null): RowSpec => ({
  type: "proposal.rejected",
  payload: { proposalId: id, reason },
  opts: { actor: DM_USER, visibility: "dm" },
});

describe("proposal transitions", () => {
  it("creates a pending view, then approves it", () => {
    const p = project(makeRows([created("p1"), approved("p1", "b-1")]), dm);
    expect(p.proposals).toHaveLength(1);
    expect(p.proposals[0]).toMatchObject({
      proposalId: "p1",
      createdSeq: 1,
      proposer: "ai:dm",
      policy: "ask",
      kind: "narration",
      status: "approved",
      decided: { seq: 2, actor: DM_USER, batchId: "b-1", reason: null },
    });
    expect(p.diagnostics.ignoredTransitions).toBe(0);
  });

  it("rejects with a reason", () => {
    const p = project(makeRows([created("p1"), rejected("p1", "no")]), dm);
    expect(p.proposals[0]).toMatchObject({
      status: "rejected",
      decided: { reason: "no", batchId: null },
    });
  });

  it("lets a suggestion be rejected but not approved", () => {
    const stuck = project(
      makeRows([created("p1", "suggest"), approved("p1")]),
      dm,
    );
    expect(stuck.proposals[0]?.status).toBe("pending");
    expect(stuck.diagnostics.ignoredTransitions).toBe(1);
    const gone = project(
      makeRows([created("p1", "suggest"), rejected("p1")]),
      dm,
    );
    expect(gone.proposals[0]?.status).toBe("rejected");
  });

  it("ignores a duplicate id, a double decision and an unknown id", () => {
    const p = project(
      makeRows([
        created("p1"),
        created("p1"),
        approved("p1"),
        rejected("p1"),
        approved("p1"),
        approved("ghost"),
      ]),
      dm,
    );
    expect(p.proposals).toHaveLength(1);
    expect(p.proposals[0]?.status).toBe("approved");
    expect(p.diagnostics.ignoredTransitions).toBe(4);
  });

  it("pendingProposals and findProposal read the view", () => {
    const p = project(
      makeRows([created("p1"), created("p2"), approved("p1")]),
      dm,
    );
    expect(pendingProposals(p).map((v) => v.proposalId)).toEqual(["p2"]);
    expect(findProposal(p, "p1")?.status).toBe("approved");
    expect(findProposal(p, "nope")).toBeUndefined();
  });

  it("a player viewer has no proposals and no diagnostics from them", () => {
    const p = project(makeRows([created("p1"), approved("p1")]), player);
    expect(p.proposals).toEqual([]);
    expect(p.diagnostics.ignoredTransitions).toBe(0);
    expect(p.throughSeq).toBe(0);
  });

  it("a proposal row mislabelled public still never reaches a player", () => {
    const leaked: RowSpec = {
      ...created("p1"),
      opts: { visibility: "public" },
    };
    const p = project(makeRows([leaked]), player);
    expect(p.proposals).toEqual([]);
    expect(JSON.stringify(p)).not.toContain("p1");
  });
});

describe("gate configuration events", () => {
  const seat: RowSpec = {
    type: "dm.seat.changed",
    payload: {
      reason: "a human takes the seat",
      before: { kind: "ai" },
      after: { kind: "human", userId: DM_USER },
    },
    opts: { actor: DM_USER },
  };
  const policy: RowSpec = {
    type: "gate.policy.changed",
    payload: {
      reason: "journal needs a look",
      proposalKind: "journal",
      before: "auto",
      after: "ask",
    },
    opts: { actor: DM_USER },
  };

  it("starts with the AI seat and no overrides", () => {
    const p = project([], dm);
    expect(p.gate).toEqual({ seat: { kind: "ai" }, policyOverrides: {} });
    expect(p.proposals).toEqual([]);
  });

  it("sets the seat and the override and writes change rows", () => {
    const p = project(makeRows([seat, policy]), dm);
    expect(p.gate.seat).toEqual({ kind: "human", userId: DM_USER });
    expect(p.gate.policyOverrides).toEqual({ journal: "ask" });
    expect(p.diagnostics.beforeMismatches).toBe(0);
    expect(p.ledger).toMatchObject([
      { kind: "change", type: "dm.seat.changed", subject: null },
      { kind: "change", type: "gate.policy.changed", subject: "journal" },
    ]);
  });

  it("counts a before that disagrees with the projected state", () => {
    const badSeat: RowSpec = {
      ...seat,
      payload: {
        reason: "x",
        before: { kind: "human", userId: DM_USER },
        after: { kind: "ai" },
      },
    };
    const badPolicy: RowSpec = {
      ...policy,
      payload: {
        reason: "x",
        proposalKind: "scene",
        before: "auto",
        after: "ask",
      },
    };
    const p = project(makeRows([badSeat, badPolicy]), dm);
    expect(p.diagnostics.beforeMismatches).toBe(2);
    expect(p.gate.seat).toEqual({ kind: "ai" });
    expect(p.gate.policyOverrides).toEqual({ scene: "ask" });
  });

  it("is visible to players (public) and does not touch their proposals", () => {
    const p = project(makeRows([seat, policy]), player);
    expect(p.gate.seat).toEqual({ kind: "human", userId: DM_USER });
    expect(p.proposals).toEqual([]);
  });
});
