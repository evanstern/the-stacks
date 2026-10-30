import type {
  LedgerRow,
  ProposalView,
  SessionProjections,
} from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import type { TurnCheckpoint } from "../../src/dm/jobs.js";
import type { Ruling } from "../../src/dm/nodes/adjudicate.js";
import type { Submission } from "../../src/dm/nodes/resolve.js";
import type { InterpretReading } from "../../src/dm/nodes/schemas.js";
import {
  awaitingActionIds,
  findResumedPlans,
  needsPriorTurns,
  type PriorTurn,
  refreshSubmission,
} from "../../src/dm/resume.js";
import { emptyCheckpoint } from "./helpers.js";

type Status = ProposalView["status"];

function view(
  id: string,
  proposal: Record<string, unknown>,
  status: Status = "pending",
  proposer = "ai:dm",
  batchId: string | null = null,
): ProposalView {
  return {
    proposalId: id,
    createdSeq: 1,
    ts: "2026-10-28T00:00:00.000Z",
    proposer,
    policy: "ask",
    kind: proposal.kind,
    proposal,
    status,
    decided:
      status === "pending"
        ? null
        : { seq: 2, actor: "dm", batchId, reason: null },
  } as unknown as ProposalView;
}

const mech = (actionId: string) => ({ kind: "mechanics", actionId });
const presence = (actionId: string) => ({ kind: "scene-presence", actionId });
const resolve = (actionId: string) => ({
  kind: "action.resolve",
  resolution: { actionId },
});

function proj(
  proposals: ProposalView[],
  ledger: LedgerRow[] = [],
): SessionProjections {
  return { proposals, ledger } as unknown as SessionProjections;
}

describe("awaitingActionIds", () => {
  it("picks pending ai:dm mechanics, scene-presence and action.resolve proposals", () => {
    const p = proj([
      view("p1", mech("a1")),
      view("p2", presence("a2")),
      view("p3", resolve("a3")),
    ]);
    expect(awaitingActionIds(p, ["a1", "a2", "a3", "a4"])).toEqual(
      new Set(["a1", "a2", "a3"]),
    );
  });

  it("ignores approved, rejected and non-ai:dm proposals", () => {
    const p = proj([
      view("p1", mech("a1"), "approved", "ai:dm", "b1"),
      view("p2", mech("a2"), "rejected"),
      view("p3", mech("a3"), "pending", "00000000-0000-4000-8000-000000000001"),
    ]);
    expect(awaitingActionIds(p, ["a1", "a2", "a3"])).toEqual(new Set());
  });

  it("ignores actions that are not candidates", () => {
    const p = proj([view("p1", mech("other"))]);
    expect(awaitingActionIds(p, ["a1"])).toEqual(new Set());
  });
});

describe("needsPriorTurns", () => {
  it("is true when an ai:dm proposal of a relevant kind names a candidate", () => {
    expect(
      needsPriorTurns(
        proj([view("p1", mech("a1"), "approved", "ai:dm", "b")]),
        ["a1"],
      ),
    ).toBe(true);
  });

  it("is false with no ai:dm proposal naming a candidate", () => {
    expect(needsPriorTurns(proj([]), ["a1"])).toBe(false);
    expect(needsPriorTurns(proj([view("p1", mech("zz"))]), ["a1"])).toBe(false);
  });
});

const reading = (actionId: string): InterpretReading =>
  ({
    actionId,
    kind: "check",
    uncertain: false,
    needsAdjudication: false,
    rulesQuestion: null,
    clarify: null,
    steps: [],
  }) as unknown as InterpretReading;

const ruling = (actionId: string): Ruling => ({
  actionId,
  ruling: "Roll it.",
  improvised: false,
  citations: [],
  dropped: 0,
  steps: [],
  followUps: [],
});

function sub(
  key: string,
  result: Submission["result"],
  proposalId: string | null,
  over: Partial<Submission> = {},
): Submission {
  return {
    stepRef: "job#1",
    key,
    kind: "mechanics",
    result,
    refusal: null,
    batchId: null,
    proposalId,
    outcome: null,
    seqs: [],
    ...over,
  };
}

function prior(
  jobId: string,
  submissions: Submission[],
  readings: InterpretReading[] = [reading("a1")],
  rulings: Ruling[] | null = null,
): PriorTurn {
  const checkpoint: TurnCheckpoint = {
    ...emptyCheckpoint(),
    interpret: { readings } as unknown as TurnCheckpoint["interpret"],
    adjudicate: rulings ? { rulings } : null,
    submissions,
  };
  return { jobId, checkpoint };
}

const approved = (id = "p1") =>
  view(id, mech("a1"), "approved", "ai:dm", "batch-1");

describe("findResumedPlans", () => {
  it("returns a plan when the last submission is pending and approved", () => {
    const s = sub("act:a1:s0", "pending", "p1");
    const plans = findResumedPlans(
      proj([approved()]),
      ["a1"],
      [prior("j1", [s])],
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      actionId: "a1",
      fromJobId: "j1",
      ruling: null,
    });
    expect(plans[0]?.reading.actionId).toBe("a1");
    expect(plans[0]?.submissions).toEqual([s]);
  });

  it("also resumes a suggested submission", () => {
    const s = sub("act:a1:s0", "suggested", "p1");
    expect(
      findResumedPlans(proj([approved()]), ["a1"], [prior("j1", [s])]),
    ).toHaveLength(1);
  });

  it("returns none when the proposal is rejected or pending", () => {
    const s = sub("act:a1:s0", "pending", "p1");
    for (const status of ["rejected", "pending"] as const) {
      const p = proj([view("p1", mech("a1"), status)]);
      expect(findResumedPlans(p, ["a1"], [prior("j1", [s])])).toEqual([]);
    }
  });

  it("returns none when the last submission is applied", () => {
    const subs = [
      sub("act:a1:s0", "pending", "p1"),
      sub("act:a1:s1", "applied", null, { batchId: "b2" }),
    ];
    expect(
      findResumedPlans(proj([approved()]), ["a1"], [prior("j1", subs)]),
    ).toEqual([]);
  });

  it("returns none when the checkpoint holds no reading for the action", () => {
    const s = sub("act:a1:s0", "pending", "p1");
    expect(
      findResumedPlans(
        proj([approved()]),
        ["a1"],
        [prior("j1", [s], [reading("other")])],
      ),
    ).toEqual([]);
  });

  it("takes the newest job when two hold keys", () => {
    const newer = sub("act:a1:s0", "pending", "p1");
    const older = sub("act:a1:s0", "pending", "p0");
    const plans = findResumedPlans(
      proj([approved()]),
      ["a1"],
      [prior("newest", [newer]), prior("oldest", [older])],
    );
    expect(plans.map((x) => x.fromJobId)).toEqual(["newest"]);
  });

  it("carries the ruling when present", () => {
    const s = sub("act:a1:s0", "pending", "p1");
    const plans = findResumedPlans(
      proj([approved()]),
      ["a1"],
      [prior("j1", [s], [reading("a1")], [ruling("a1")])],
    );
    expect(plans[0]?.ruling).toEqual(ruling("a1"));
  });

  it("only keeps submissions keyed for the action", () => {
    const s = sub("act:a1:s0", "pending", "p1");
    const other = sub("act:a2:s0", "applied", null);
    const plans = findResumedPlans(
      proj([approved()]),
      ["a1"],
      [prior("j1", [other, s])],
    );
    expect(plans[0]?.submissions).toEqual([s]);
  });
});

describe("refreshSubmission", () => {
  const outcomeRow = {
    kind: "outcome",
    seq: 5,
    actor: "ai:dm",
    visibility: "public",
    reason: "roll",
    batchId: "batch-1",
    index: 1,
    actionId: "a1",
    outcome: { type: "check.resolved", outcome: "success" },
  } as unknown as LedgerRow;

  it("rewrites an approved pending submission as applied", () => {
    const s = sub("act:a1:s0", "pending", "p1", { stepRef: "job#3" });
    const out = refreshSubmission(proj([approved()], [outcomeRow]), s);
    expect(out).toMatchObject({
      result: "applied",
      batchId: "batch-1",
      outcome: "success",
      seqs: [],
      stepRef: "job#3",
      key: "act:a1:s0",
    });
  });

  it("returns other submissions unchanged", () => {
    const pendingView = proj([view("p1", mech("a1"))]);
    const s = sub("act:a1:s0", "pending", "p1");
    expect(refreshSubmission(pendingView, s)).toEqual(s);
    const applied = sub("act:a1:s1", "applied", null, { batchId: "x" });
    expect(refreshSubmission(proj([approved()]), applied)).toEqual(applied);
  });

  it("sets a null outcome when the batch has no resolved row", () => {
    const s = sub("act:a1:s0", "pending", "p1");
    expect(refreshSubmission(proj([approved()]), s).outcome).toBeNull();
  });
});
