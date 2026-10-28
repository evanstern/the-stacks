import type {
  ProposalView,
  Scene,
  SessionProjections,
} from "@the-stacks/session-model";
import { project } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import {
  START_CONFLICT_MESSAGE,
  sceneStartState,
} from "../../src/dm/scene-start.js";

// TASK-0167 (spec 059): the one predicate behind the start route's 409 and
// the play header. Pure: no database.

function base(): SessionProjections {
  return project([], { role: "dm" });
}

function withScene(p: SessionProjections): SessionProjections {
  return { ...p, scene: { sceneId: "greyhollow-ford" } as unknown as Scene };
}

function sceneProposal(
  over: {
    status?: ProposalView["status"];
    proposer?: string;
    after?: unknown;
  } = {},
): ProposalView {
  return {
    proposalId: "p-1",
    createdSeq: 1,
    ts: "2026-10-28T00:00:00.000Z",
    proposer: over.proposer ?? "ai:dm",
    policy: "suggest",
    kind: "scene",
    proposal: {
      kind: "scene",
      after: "after" in over ? over.after : { sceneId: "greyhollow-ford" },
    } as unknown as ProposalView["proposal"],
    status: over.status ?? "pending",
    decided: null,
  };
}

function withProposals(
  p: SessionProjections,
  proposals: ProposalView[],
): SessionProjections {
  return { ...p, proposals };
}

const job = (status: string, trigger: string) => ({
  status,
  input: { trigger },
});

describe("sceneStartState", () => {
  it("is none for an empty session", () => {
    expect(sceneStartState(base(), [])).toBe("none");
  });

  it("is started when a scene exists", () => {
    expect(sceneStartState(withScene(base()), [])).toBe("started");
  });

  it("is queued for a queued scene-start job", () => {
    expect(sceneStartState(base(), [job("queued", "scene-start")])).toBe(
      "queued",
    );
  });

  it("is queued for a running scene-start job", () => {
    expect(sceneStartState(base(), [job("running", "scene-start")])).toBe(
      "queued",
    );
  });

  it("is none for a succeeded scene-start job", () => {
    expect(sceneStartState(base(), [job("succeeded", "scene-start")])).toBe(
      "none",
    );
  });

  it("is none for a queued job with another trigger", () => {
    expect(sceneStartState(base(), [job("queued", "manual")])).toBe("none");
  });

  it("is pending for a pending ai:dm scene proposal with an after", () => {
    const p = withProposals(base(), [sceneProposal()]);
    expect(sceneStartState(p, [])).toBe("pending");
  });

  it("is none once that proposal is rejected", () => {
    const p = withProposals(base(), [sceneProposal({ status: "rejected" })]);
    expect(sceneStartState(p, [])).toBe("none");
  });

  it("is none for a pending scene proposal from a human proposer", () => {
    const p = withProposals(base(), [sceneProposal({ proposer: "user:u1" })]);
    expect(sceneStartState(p, [])).toBe("none");
  });

  it("is none for a pending ai:dm scene proposal with a null after", () => {
    const p = withProposals(base(), [sceneProposal({ after: null })]);
    expect(sceneStartState(p, [])).toBe("none");
  });

  it("is started when a scene exists beside a queued job", () => {
    expect(
      sceneStartState(withScene(base()), [job("queued", "scene-start")]),
    ).toBe("started");
  });

  it("is queued before pending when both hold", () => {
    const p = withProposals(base(), [sceneProposal()]);
    expect(sceneStartState(p, [job("queued", "scene-start")])).toBe("queued");
  });
});

describe("START_CONFLICT_MESSAGE", () => {
  it("names the contract's text for every refused state", () => {
    expect(START_CONFLICT_MESSAGE).toEqual({
      started: "The session already has a scene.",
      queued: "A scene start is already queued.",
      pending: "A scene start is waiting for the DM.",
    });
  });
});
