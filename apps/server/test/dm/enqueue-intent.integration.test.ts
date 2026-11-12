import { randomUUID } from "node:crypto";
import type { StoredEvent } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { greyhollowDuo } from "./snapshot-fixtures.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  createWorld,
  db,
  loudSkip,
  payloadOf,
  player,
  reachable,
  readRows,
  requireDb,
  TAMSIN_USER,
} from "./world.js";

/**
 * Rule 9 (spec 066 FR-031, card AC #7): a direct settled Intent queues one coalesced `intent`
 * turn; a row a job appended queues none; a 👍 and a human ruling in one window coalesce.
 */

loudSkip("enqueue-intent.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const carrier = (
  seq: number,
  actor: string,
  over: Record<string, unknown> = {},
) =>
  ({
    sessionId: "",
    seq,
    actor,
    type: "intent.recorded",
    payload: {
      outcome: "settled",
      batchId: "batch-1",
      answers: null,
      stopped: null,
      ...over,
    },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-11-11T00:00:00.000Z",
  }) as unknown as StoredEvent;

function setup(seat: "human" | "ai" = "ai") {
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

describe.skipIf(!reachable)("intent turn enqueue (database)", () => {
  it("a direct settled Intent with engine rows queues one intent turn", async () => {
    const { sessionId, enqueuer, turns } = setup();
    await enqueuer.onAppended(sessionId, [carrier(9, "user-tamsin")]);
    const rows = await turns();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({ trigger: "intent", triggerSeq: 9 });
  });

  it("a stopped refusal queues one intent turn", async () => {
    const { sessionId, enqueuer, turns } = setup();
    await enqueuer.onAppended(sessionId, [
      carrier(9, "user-tamsin", {
        batchId: null,
        stopped: { code: "X", message: "y" },
      }),
    ]);
    expect(await turns()).toHaveLength(1);
  });

  it("a row a job appended (an ai: actor) queues none", async () => {
    const { sessionId, enqueuer, turns } = setup();
    await enqueuer.onAppended(sessionId, [carrier(9, "ai:dm")]);
    expect(await turns()).toHaveLength(0);
  });

  it("speech or a declared Intent (no engine rows) queues none", async () => {
    const { sessionId, enqueuer, turns } = setup();
    await enqueuer.onAppended(sessionId, [
      carrier(9, "user-tamsin", { batchId: null }),
      carrier(10, "user-tamsin", { outcome: "declared", batchId: null }),
    ]);
    expect(await turns()).toHaveLength(0);
  });

  it("a 👍 and a human ruling in one window coalesce to one queued turn", async () => {
    const { sessionId, enqueuer, turns } = setup("human");
    // The 👍: a confirmed Intent, direct, with engine rows. Then a human ruling answering a request.
    await enqueuer.onAppended(sessionId, [carrier(9, "user-tamsin")]);
    await enqueuer.onAppended(sessionId, [
      carrier(10, "dm-user", { answers: "act.0", batchId: null }),
    ]);
    const rows = await turns();
    expect(rows).toHaveLength(1);
  });

  it("one human ruling row fires rules 8 and 9 into one queued turn, not two", async () => {
    const { sessionId, enqueuer, turns } = setup("human");
    // Settled with engine rows AND answering a request: both rules match this single row.
    await enqueuer.onAppended(sessionId, [
      carrier(7, "dm-user", { answers: "act.0" }),
    ]);
    const rows = await turns();
    expect(rows).toHaveLength(1);
    // Rule 8's trigger wins the insert (it runs first); rule 9 coalesces into it.
    expect(rows[0]?.input).toMatchObject({
      trigger: "approval",
      triggerSeq: 7,
    });
  });

  it("coalesces with an already-queued turn", async () => {
    const { sessionId, enqueuer, turns } = setup();
    await enqueueTurn(requireDb(), sessionId, "commit", 5);
    await enqueuer.onAppended(sessionId, [carrier(9, "user-tamsin")]);
    expect(await turns()).toHaveLength(1);
  });
});

describe.skipIf(!reachable)(
  "an intent turn narrates its facts (database)",
  () => {
    it("a direct confirmed hide queues one intent turn, then one narration row ships", async () => {
      const start = script("scene-start.json");
      const w = await createWorld({
        dice: [14],
        calls: [
          ...start.calls,
          {
            purpose: "dm.chronicle",
            respond: { type: "json", value: { entries: [] } },
          },
          {
            purpose: "dm.narrate",
            respond: {
              type: "text",
              value: "Tamsin eases behind the stacked barrels and goes still.",
            },
          },
          {
            purpose: "dm.chronicle",
            respond: { type: "json", value: { entries: [] } },
          },
        ],
      });
      const { worker } = workerFor(w, {
        retrieve: async () => ({
          mode: "fts" as const,
          embeddingModel: null,
          candidates: { vector: null, fts: 0 },
          passages: [],
        }),
      });
      await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
        start: {
          seedId: "greyhollow-ford-duo",
          seats: {
            tamsin: TAMSIN_USER,
            kestrel: "00000000-0000-4000-8000-0000000000a2",
          },
        },
      });
      await drainAll(worker);
      const before = (await readRows(w)).length;
      const res = await w.as(player, {
        kind: "intent",
        intent: {
          id: "hide-direct",
          kind: "hide",
          actor: { kind: "pc", id: "tamsin" },
          source: "composer",
          commit: "confirmed",
        },
      });
      expect(res.ok).toBe(true);
      await tick();
      const turnJobs = (
        await listDmJobs(requireDb(), w.sessionId, 20, "turn")
      ).filter((j) => (j.input as { trigger: string }).trigger === "intent");
      expect(turnJobs).toHaveLength(1);
      await drainAll(worker);
      const after = (await readRows(w)).slice(before);
      const narrations = after.filter((r) => r.type === "narration");
      expect(narrations).toHaveLength(1);
      expect(payloadOf<{ text: string }>(narrations[0]).text).toContain(
        "barrels",
      );
      const [done] = (
        await listDmJobs(requireDb(), w.sessionId, 20, "turn")
      ).filter((j) => (j.input as { trigger: string }).trigger === "intent");
      expect(done?.status).toBe("succeeded");
    });
  },
);
