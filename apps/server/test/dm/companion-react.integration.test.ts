import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { listDmJobs } from "../../src/dm/jobs.js";
import { loudSkip, reachable, requireDb } from "./world.js";

/**
 * The gate listener's react rule (specs/036-companion-react FR-001-FR-004):
 * a human reaction on a companion's open action queues one coalesced
 * `react` companion job.
 */

loudSkip("companion-react.integration.test.ts");

const HUMAN = "00000000-0000-4000-8000-0000000000a1";

const commented = (
  actor: string,
  actionId: string,
  stance: "comment" | "approve" | "object",
  seq: number,
) =>
  ({
    sessionId: "",
    seq,
    actor,
    type: "action.commented",
    payload: { actionId, stance, text: `t${seq}` },
    payloadVersion: 1,
    visibility: "table",
    ts: "2026-10-26T00:00:00.000Z",
  }) as never;

function setup(actions: { actionId: string; actor: string; status: string }[]) {
  const sessionId = randomUUID();
  const enqueuer = createDmEnqueuer({
    db: requireDb(),
    nudge: () => {},
    loadProjections: async () => ({ actions }) as never,
    reactQuietMs: 0,
  });
  const jobs = () => listDmJobs(requireDb(), sessionId, 20, "companion");
  return { sessionId, enqueuer, jobs };
}

const reasonOf = (job: { input: unknown }) =>
  (job.input as { reason: string }).reason;

const companions = (job: { input: unknown }) =>
  (job.input as { companions: string[] }).companions;

describe.skipIf(!reachable)("companion react trigger (database)", () => {
  it.each(["comment", "approve", "object"] as const)(
    "a human %s on a companion's open action queues one react job",
    async (stance) => {
      const { sessionId, enqueuer, jobs } = setup([
        {
          actionId: "act-odo-1",
          actor: "ai:companion:odo",
          status: "declared",
        },
      ]);
      await enqueuer.onAppended(sessionId, [
        commented(HUMAN, "act-odo-1", stance, 5),
      ]);
      const rows = await jobs();
      expect(rows).toHaveLength(1);
      expect(reasonOf(rows[0] as never)).toBe("react");
      expect(companions(rows[0] as never)).toEqual(["odo"]);
    },
  );

  it("comments by ai:dm and by a companion queue none", async () => {
    const { sessionId, enqueuer, jobs } = setup([
      { actionId: "act-odo-1", actor: "ai:companion:odo", status: "discussed" },
    ]);
    await enqueuer.onAppended(sessionId, [
      commented("ai:dm", "act-odo-1", "comment", 5),
      commented("ai:companion:mira", "act-odo-1", "comment", 6),
    ]);
    expect(await jobs()).toHaveLength(0);
  });

  it("a human comment on a human's action, or on a closed action, queues none", async () => {
    const { sessionId, enqueuer, jobs } = setup([
      { actionId: "act-h-1", actor: HUMAN, status: "declared" },
      { actionId: "act-odo-2", actor: "ai:companion:odo", status: "committed" },
    ]);
    await enqueuer.onAppended(sessionId, [
      commented(HUMAN, "act-h-1", "comment", 5),
      commented(HUMAN, "act-odo-2", "comment", 6),
    ]);
    expect(await jobs()).toHaveLength(0);
  });

  it("five human comments queue one job", async () => {
    const { sessionId, enqueuer, jobs } = setup([
      { actionId: "act-odo-1", actor: "ai:companion:odo", status: "discussed" },
    ]);
    for (let seq = 5; seq < 10; seq++) {
      await enqueuer.onAppended(sessionId, [
        commented(HUMAN, "act-odo-1", "comment", seq),
      ]);
    }
    const rows = await jobs();
    expect(rows).toHaveLength(1);
    expect(companions(rows[0] as never)).toEqual(["odo"]);
  });
});
