import { randomUUID } from "node:crypto";
import type { StoredEvent } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { greyhollowDuo } from "./snapshot-fixtures.js";
import { clearDmJobsBeforeEach } from "./worker-world.js";
import { db, loudSkip, reachable, requireDb } from "./world.js";

/** Rule 8 (TASK-0314): a human DM's ruling that answers an open request queues one resume turn. */

loudSkip("enqueue-ruling.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const ruling = (seq: number, actor: string, answers: string | null) =>
  ({
    sessionId: "",
    seq,
    actor,
    type: "intent.recorded",
    payload: { outcome: "accepted", answers },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-11-11T00:00:00.000Z",
  }) as unknown as StoredEvent;

function setup(seat: "human" | "ai") {
  const sessionId = randomUUID();
  const { projections } = greyhollowDuo();
  projections.gate = {
    ...projections.gate,
    seat: seat === "ai" ? { kind: "ai" } : { kind: "human", userId: "dm-user" },
  } as typeof projections.gate;
  const enqueuer = createDmEnqueuer({
    db: requireDb(),
    nudge: () => {},
    loadProjections: async () => projections,
  });
  const turns = () => listDmJobs(requireDb(), sessionId, 20, "turn");
  return { sessionId, enqueuer, turns };
}

describe.skipIf(!reachable)("ruling resume enqueue (database)", () => {
  it("a human DM ruling that answers a request queues one approval turn", async () => {
    const { sessionId, enqueuer, turns } = setup("human");
    await enqueuer.onAppended(sessionId, [ruling(7, "dm-user", "act.0")]);
    const rows = await turns();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({
      trigger: "approval",
      triggerSeq: 7,
    });
  });

  it("coalesces with an already-queued turn", async () => {
    const { sessionId, enqueuer, turns } = setup("human");
    await enqueueTurn(requireDb(), sessionId, "approval", 5);
    await enqueuer.onAppended(sessionId, [ruling(7, "dm-user", "act.0")]);
    expect(await turns()).toHaveLength(1);
  });

  it("an ai:dm ruling queues nothing here (rule 2 already resumes)", async () => {
    const { sessionId, enqueuer, turns } = setup("ai");
    await enqueuer.onAppended(sessionId, [ruling(7, "ai:dm", "act.0")]);
    expect(await turns()).toHaveLength(0);
  });

  it("a human row that answers nothing queues nothing", async () => {
    const { sessionId, enqueuer, turns } = setup("human");
    await enqueuer.onAppended(sessionId, [ruling(7, "dm-user", null)]);
    expect(await turns()).toHaveLength(0);
  });
});
