import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  commitAction,
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  reachable,
  readRows,
  requireDb,
  startScene,
  type World,
} from "./world.js";

// TASK-0168 (spec 057): with a human DM seated, the turn that follows the
// DM's approval of a roll resumes the paused plan. It narrates the result and
// proposes no second roll.

loudSkip("human-dm-roll-resume.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const ACTION = "act-search";
const CHRONICLE = {
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
};

type TurnResult = {
  outcome: { status: string };
  calls: { purpose: string }[];
};

/** A world with the scene started under the AI seat, then a human DM seated and the action committed. */
async function humanDmWorld(scriptName: string) {
  const s = script(scriptName);
  const w = await createWorld({
    dice: s.dice,
    // Spec 104 adds one resume turn (the confirm's approval) before the ruling's: one more director call.
    calls: [
      ...s.calls,
      s.calls.find((c) => (c as { purpose: string }).purpose === "dm.director"),
      CHRONICLE,
    ],
  });
  const { worker } = workerFor(w);
  await startScene(w);
  const seat = await w.as(operator, {
    kind: "dm.seat",
    reason: "A human takes the DM seat before the action",
    after: { kind: "human", userId: HUMAN_DM },
  });
  expect(seat.ok ? "ok" : seat.refusal).toBe("ok");
  await commitAction(
    w,
    "I search the ferry-house for whoever cut the bell rope.",
    ACTION,
  );
  await tick();
  await drainAll(worker);
  return { w, worker };
}

type View = {
  proposalId: string;
  kind: string;
  status: string;
  proposal: {
    command?: { type?: string };
    narration?: { actionIds?: string[] };
  };
};

/** The session's pending proposals of one kind (and, for mechanics, one command type). */
async function pending(w: World, kind: string, commandType?: string) {
  const p = await w.projections();
  return (p.proposals as unknown as View[]).filter(
    (v) =>
      v.kind === kind &&
      v.status === "pending" &&
      (commandType === undefined || v.proposal.command?.type === commandType),
  );
}

/** Every proposal of one mechanics command type, whatever its status. */
async function mechanics(w: World, commandType: string) {
  const p = await w.projections();
  return (p.proposals as unknown as View[]).filter(
    (v) => v.kind === "mechanics" && v.proposal.command?.type === commandType,
  );
}

async function approve(
  w: World,
  worker: { drain: () => Promise<number> },
  id: string,
) {
  const r = await w.as(operator, { kind: "proposal.approve", proposalId: id });
  expect(r.ok ? "ok" : r.refusal).toBe("ok");
  await tick();
  await drainAll(worker);
}

/**
 * Spec 104: under a human DM seat the stage's confirm is a pending `intent` proposal; approving
 * it plans a difficulty ask, which the DM answers with a `ruling` Intent (the roll then runs).
 * Returns the approved confirm proposal's id.
 */
async function approveRoll(w: World, worker: { drain: () => Promise<number> }) {
  const [confirm] = await pending(w, "intent");
  expect(confirm).toBeDefined();
  await approve(w, worker, confirm?.proposalId as string);
  const ruled = await w.as(operator, {
    kind: "intent",
    intent: {
      id: "dc-1",
      kind: "ruling",
      actor: { kind: "dm" },
      params: {
        requestId: `${ACTION}.0`,
        decision: "accept",
        difficulty: "medium",
      },
      source: "console",
      commit: "confirmed",
    },
  });
  expect(ruled.ok ? "ok" : ruled.refusal).toBe("ok");
  // Enqueue rule 8 (TASK-0314): the human DM's ruling queues the resume turn itself.
  await tick();
  await drainAll(worker);
  return confirm?.proposalId as string;
}

/** The session's turn jobs, oldest first. */
async function turnJobs(w: World) {
  return (await listDmJobs(requireDb(), w.sessionId, 40, "turn")).reverse();
}

const purposes = (j: { result: unknown } | undefined) =>
  ((j?.result as TurnResult | undefined)?.calls ?? []).map((c) => c.purpose);

describe.skipIf(!reachable)(
  "a turn resumes a paused roll after the human DM approves it (database)",
  () => {
    it("(a) approving the roll narrates in the resumed turn, with no second roll proposal", async () => {
      const { w, worker } = await humanDmWorld("human-dm-approval.json");

      expect(await pending(w, "intent")).toHaveLength(1);
      expect(
        (await w.projections()).actions.find((a) => a.actionId === ACTION),
      ).toMatchObject({ status: "committed" });

      const rollView = await approveRoll(w, worker);

      const jobs = (await turnJobs(w)).filter(
        (j) => (j.input as { trigger?: string }).trigger === "approval",
      );
      // The confirm's approval queues one turn (it finds the ask still open); the ruling, one more.
      expect(jobs).toHaveLength(2);
      const job = jobs.at(-1);
      expect(job?.status).toBe("succeeded");
      expect((job?.result as TurnResult | undefined)?.outcome.status).toBe(
        "completed",
      );
      expect(purposes(job)).toEqual(["dm.director", "dm.narrate"]);

      // One roll proposal ever, and it is the approved one.
      // Spec 104: the confirm is one approved `intent` proposal; the ruling Intent's batch holds the roll.
      expect(await pending(w, "intent")).toHaveLength(0);
      const view = (await w.projections()).proposals.find(
        (v) => v.proposalId === rollView,
      );
      expect(view).toMatchObject({ status: "approved" });
      const batchId = (await w.projections()).intents.find(
        (v) => v.id === `${ACTION}.0`,
      )?.batchIds[0];
      expect(batchId).toBeTruthy();

      const action = (await w.projections()).actions.find(
        (a) => a.actionId === ACTION,
      );
      expect(action?.status).toBe("resolved");
      expect(action?.resolved?.outcome).toBe("applied");
      expect(action?.resolved?.batchIds).toContain(batchId);

      // The human DM still approves the narration.
      const narrations = await pending(w, "narration");
      expect(narrations).toHaveLength(1);
      expect(narrations[0]?.proposal.narration?.actionIds).toContain(ACTION);

      expect(w.scripted.remaining().dice).toBe(0);
      expect(w.scripted.remaining().calls).toMatchObject({
        "dm.director": 0,
        "dm.interpret": 0,
        "dm.narrate": 0,
      });
    });

    it("(b) a manual turn while the roll is pending is an empty beat and proposes no second roll", async () => {
      const { w, worker } = await humanDmWorld("human-dm-approval.json");
      expect(await pending(w, "intent")).toHaveLength(1);
      const before = (await turnJobs(w)).length;

      await enqueueTurn(requireDb(), w.sessionId, "manual", null);
      await tick();
      await drainAll(worker);

      const jobs = await turnJobs(w);
      expect(jobs).toHaveLength(before + 1);
      const manual = jobs.at(-1);
      expect((manual?.input as { trigger?: string } | undefined)?.trigger).toBe(
        "manual",
      );
      expect(manual?.status).toBe("succeeded");
      expect((manual?.result as TurnResult | undefined)?.outcome.status).toBe(
        "empty-beat",
      );
      expect(purposes(manual)).toEqual([]);
      expect(await pending(w, "intent")).toHaveLength(1);
      expect(await mechanics(w, "check.roll")).toHaveLength(0);
    });

    it("(c) a chain resumes step by step: roll, then effect, then one narration", async () => {
      const { w, worker } = await humanDmWorld("human-dm-roll-chain.json");

      // Approve the roll: the next turn only plans, proposes the effect, no second roll.
      expect(await pending(w, "intent")).toHaveLength(1);
      const rollView = await approveRoll(w, worker);

      let jobs = (await turnJobs(w)).filter(
        (j) => (j.input as { trigger?: string }).trigger === "approval",
      );
      expect(jobs).toHaveLength(2);
      expect(purposes(jobs.at(-1))).toEqual(["dm.director"]);
      expect(await mechanics(w, "check.roll")).toHaveLength(0);
      const effects = await pending(w, "mechanics", "condition.apply");
      expect(effects).toHaveLength(1);
      expect(
        (await w.projections()).actions.find((a) => a.actionId === ACTION)
          ?.status,
      ).toBe("committed");

      // Approve the effect: the next turn narrates and resolves with both batches.
      await approve(w, worker, effects[0]?.proposalId as string);

      jobs = (await turnJobs(w)).filter(
        (j) => (j.input as { trigger?: string }).trigger === "approval",
      );
      expect(jobs).toHaveLength(3);
      expect(purposes(jobs.at(-1))).toEqual(["dm.director", "dm.narrate"]);
      expect(await mechanics(w, "check.roll")).toHaveLength(0);

      const p = await w.projections();
      const batches = [
        p.intents.find((v) => v.id === `${ACTION}.0`)?.batchIds[0],
        p.proposals.find((v) => v.proposalId === effects[0]?.proposalId)
          ?.decided?.batchId,
      ];
      expect(rollView).toBeTruthy();
      expect(batches.every((b) => !!b)).toBe(true);
      const action = p.actions.find((a) => a.actionId === ACTION);
      expect(action?.status).toBe("resolved");
      expect(action?.resolved?.outcome).toBe("applied");
      expect(action?.resolved?.batchIds).toEqual(
        expect.arrayContaining(batches as string[]),
      );
      expect(
        (await readRows(w)).filter((r) => r.type === "action.resolved"),
      ).toHaveLength(1);
      expect(w.scripted.remaining().dice).toBe(0);
    });
  },
);
