import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../../src/db.js";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import {
  cancelFloorCheck,
  claimDmJob,
  enqueueChronicle,
  enqueueCompanion,
  enqueueCompanionReact,
  enqueueFloorCheck,
  enqueueTurn,
  enqueueTurnForced,
  listDmJobs,
  loadCheckpoint,
  reconcileTurnJobs,
  saveCheckpoint,
  type TurnCheckpoint,
} from "../../src/dm/jobs.js";
import {
  finishJob,
  heartbeat,
  saveResult,
  setStage,
} from "../../src/jobs/queue.js";
import { events } from "../../src/schema/events.js";
import { jobs } from "../../src/schema/jobs.js";

/**
 * DM jobs on the jobs queue (specs/031-dm-runtime T006; card AC #1, #9)
 * against a REAL Postgres: partial unique indexes, SKIP LOCKED, lease expiry
 * and fencing cannot be reproduced by a fake.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/dm/jobs.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about DM job claim/lease/fencing. Start one with: pnpm env:up.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) throw new Error("DM jobs integration tests require a database");
  return db;
}

async function ageHeartbeat(id: string, secondsAgo: number) {
  await requireDb().execute(
    sql`UPDATE jobs SET heartbeat_at = now() - (interval '1 second' * ${secondsAgo}) WHERE id = ${id}`,
  );
}

async function statusOf(id: string) {
  const [row] = await requireDb().select().from(jobs).where(eq(jobs.id, id));
  return row;
}

/** Claims by repeatedly calling until this session's job comes up (other sessions' leftovers are cleared in beforeEach). */
async function claim() {
  return claimDmJob(requireDb());
}

describe.skipIf(!reachable)("DM jobs queue (Phase 1, integration)", () => {
  beforeEach(async () => {
    await requireDb().execute(
      sql`DELETE FROM jobs WHERE kind IN ('turn', 'companion', 'chronicle', 'floor')`,
    );
  });

  it("one queued turn per session under 20 concurrent commits", async () => {
    const sessionId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        enqueueTurn(requireDb(), sessionId, "commit", i + 1),
      ),
    );
    expect(results.filter((r) => r.inserted)).toHaveLength(1);
    expect(new Set(results.map((r) => r.jobId)).size).toBe(1);
    const queued = await requireDb()
      .select()
      .from(jobs)
      .where(and(eq(jobs.sessionId, sessionId), eq(jobs.kind, "turn")));
    expect(queued).toHaveLength(1);
  });

  it("a queued turn is not claimable while a turn or companion job runs for its session", async () => {
    const sessionId = randomUUID();
    await enqueueTurn(requireDb(), sessionId, "commit", 1);
    const running = await claim();
    expect(running?.kind).toBe("turn");

    // A commit during the running beat queues the next beat.
    const next = await enqueueTurn(requireDb(), sessionId, "commit", 2);
    expect(next.inserted).toBe(true);
    expect(await claim()).toBeNull();

    // A companion job for the same session is blocked too.
    await enqueueCompanion(requireDb(), {
      sessionId,
      companions: ["mira"],
      reason: "turn",
      beatJobId: null,
    });
    expect(await claim()).toBeNull();

    // Another session is unaffected.
    const other = randomUUID();
    await enqueueTurn(requireDb(), other, "commit", 1);
    const otherClaim = await claim();
    expect(otherClaim?.sessionId).toBe(other);

    // Ending the running turn releases the queued beat (turn before companion).
    if (!running) throw new Error("expected a claim");
    expect(await finishJob(requireDb(), running, { result: {} })).toBe(true);
    const afterEnd = await claim();
    expect(afterEnd?.id).toBe(next.jobId);
  });

  it("claims in priority order: turn, companion, chronicle", async () => {
    const [s1, s2, s3] = [randomUUID(), randomUUID(), randomUUID()];
    await enqueueChronicle(requireDb(), s1, 5);
    await enqueueCompanion(requireDb(), {
      sessionId: s2,
      companions: ["mira"],
      reason: "prompt",
      beatJobId: null,
    });
    await enqueueTurn(requireDb(), s3, "commit", 1);
    const order = [await claim(), await claim(), await claim()];
    expect(order.map((c) => c?.kind)).toEqual([
      "turn",
      "companion",
      "chronicle",
    ]);
    expect(await claim()).toBeNull();
  });

  it("a chronicle job is claimable while the session's turn runs", async () => {
    const sessionId = randomUUID();
    await enqueueTurn(requireDb(), sessionId, "commit", 1);
    await claim();
    await enqueueChronicle(requireDb(), sessionId, 3);
    const chronicle = await claim();
    expect(chronicle?.kind).toBe("chronicle");
  });

  it("a lease expiry reclaims with a new token and attempts + 1, keeping the checkpoint", async () => {
    const sessionId = randomUUID();
    await enqueueTurn(requireDb(), sessionId, "commit", 1);
    const first = await claim();
    if (!first) throw new Error("expected a claim");
    const checkpoint: TurnCheckpoint = {
      beat: ["a1"],
      npcTurn: null,
      director: null,
      interpret: null,
      submissions: [],
      lastSeq: 7,
      narration: null,
    };
    expect(await saveCheckpoint(requireDb(), first, checkpoint)).toBe(true);

    // Fresh lease: nothing to reclaim.
    expect(await claim()).toBeNull();

    await ageHeartbeat(first.id, 61);
    const second = await claim();
    expect(second?.id).toBe(first.id);
    expect(second?.claimToken).not.toBe(first.claimToken);
    expect(second?.attempts).toBe(2);
    expect(second && loadCheckpoint(second)).toEqual(checkpoint);
  });

  it("a stale token's writes return false and change nothing", async () => {
    const sessionId = randomUUID();
    await enqueueTurn(requireDb(), sessionId, "commit", 1);
    const stale = await claim();
    if (!stale) throw new Error("expected a claim");
    await ageHeartbeat(stale.id, 61);
    const fresh = await claim();
    if (!fresh) throw new Error("expected a reclaim");

    expect(await heartbeat(requireDb(), stale)).toBe(false);
    expect(await setStage(requireDb(), stale, "resolve")).toBe(false);
    expect(await saveResult(requireDb(), stale, { x: 1 })).toBe(false);
    expect(
      await saveCheckpoint(requireDb(), stale, {
        beat: null,
        npcTurn: null,
        director: null,
        interpret: null,
        submissions: [],
        lastSeq: 0,
        narration: null,
      }),
    ).toBe(false);
    expect(await finishJob(requireDb(), stale, { error: "stale" })).toBe(false);

    const row = await statusOf(stale.id);
    expect(row.status).toBe("running");
    expect(row.stage).toBe("assemble");
    expect(row.result).toBeNull();
    expect(await setStage(requireDb(), fresh, "resolve")).toBe(true);
  });

  it("attempts beyond the maximum fail the job and return nothing", async () => {
    const sessionId = randomUUID();
    const queued = await enqueueTurn(requireDb(), sessionId, "commit", 1);
    for (let i = 0; i < 3; i += 1) {
      const c = await claim();
      expect(c?.id).toBe(queued.jobId);
      await ageHeartbeat(queued.jobId, 61);
    }
    expect(await claim()).toBeNull(); // 4th claim: attempts 4 > 3
    const row = await statusOf(queued.jobId);
    expect(row.status).toBe("failed");
    expect(row.error).toMatch(/abandoned 3 times/);
  });

  it("enqueueTurnForced inserts a forced job or flips the queued job's flag", async () => {
    const sessionId = randomUUID();
    const inserted = await enqueueTurnForced(requireDb(), sessionId);
    expect(inserted.inserted).toBe(true);
    let row = await statusOf(inserted.jobId);
    expect((row.input as { forceResolve: boolean }).forceResolve).toBe(true);

    const other = randomUUID();
    const plain = await enqueueTurn(requireDb(), other, "commit", 1);
    const forced = await enqueueTurnForced(requireDb(), other);
    expect(forced.jobId).toBe(plain.jobId);
    expect(forced.inserted).toBe(false);
    row = await statusOf(plain.jobId);
    expect((row.input as { forceResolve: boolean }).forceResolve).toBe(true);
    const all = await listDmJobs(requireDb(), other);
    expect(all).toHaveLength(1);
  });

  it("reconcile enqueues only sessions with an unanswered commit and no active turn job", async () => {
    const unanswered = randomUUID();
    const answered = randomUUID();
    const covered = randomUUID();
    const row = (
      sessionId: string,
      seq: number,
      type: string,
      actionId: string,
    ) => ({
      sessionId,
      seq,
      actor: "ai:dm",
      type,
      payload: { actionId },
      payloadVersion: 1,
    });
    await requireDb()
      .insert(events)
      .values([
        row(unanswered, 1, "action.committed", "a1"),
        row(answered, 1, "action.committed", "a1"),
        row(answered, 2, "action.resolved", "a1"),
        row(covered, 1, "action.committed", "a1"),
      ]);
    await enqueueTurn(requireDb(), covered, "commit", 1);

    const enqueued = await reconcileTurnJobs(requireDb());
    expect(enqueued).toContain(unanswered);
    expect(enqueued).not.toContain(answered);
    expect(enqueued).not.toContain(covered);
    const [job] = await listDmJobs(requireDb(), unanswered);
    expect((job.input as { trigger: string }).trigger).toBe("reconcile");

    // Idempotent: a second pass finds the queued job and adds nothing.
    expect(await reconcileTurnJobs(requireDb())).not.toContain(unanswered);
  });
});

describe.skipIf(!reachable)("DM enqueuer and the presence marker", () => {
  it("queues no turn for a presence.recorded row", async () => {
    const sessionId = randomUUID();
    const enqueuer = createDmEnqueuer({
      db: requireDb(),
      nudge: () => {},
      loadProjections: async () => {
        throw new Error("a marker must not need a projection");
      },
    });
    await enqueuer.onAppended(sessionId, [
      {
        sessionId,
        seq: 1,
        actor: "system",
        type: "presence.recorded",
        payload: { present: [], purpose: "director" },
        payloadVersion: 1,
        visibility: "public",
        ts: "2026-10-27T00:00:00.000Z",
      },
    ]);
    const rows = await requireDb()
      .select()
      .from(jobs)
      .where(eq(jobs.sessionId, sessionId));
    expect(rows).toHaveLength(0);
  });
});

describe.skipIf(!reachable)(
  "companion react coalescing (specs/036-companion-react, integration)",
  () => {
    beforeEach(async () => {
      await requireDb().execute(
        sql`DELETE FROM jobs WHERE kind IN ('turn', 'companion', 'chronicle', 'floor')`,
      );
    });

    const opts = { quietMs: 0, maxWaitMs: 10_000 };
    const inputOf = async (id: string) =>
      (await statusOf(id))?.input as {
        companions: string[];
        reason: string;
        firstReactionAt: string;
        notBefore: string;
      };

    it("two enqueues give one queued row naming both companions", async () => {
      const sessionId = randomUUID();
      const a = await enqueueCompanionReact(
        requireDb(),
        sessionId,
        "odo",
        opts,
      );
      const b = await enqueueCompanionReact(
        requireDb(),
        sessionId,
        "mira",
        opts,
      );
      const c = await enqueueCompanionReact(
        requireDb(),
        sessionId,
        "odo",
        opts,
      );
      expect(a.inserted).toBe(true);
      expect(b).toEqual({ jobId: a.jobId, inserted: false });
      expect(c).toEqual({ jobId: a.jobId, inserted: false });
      const queued = await listDmJobs(requireDb(), sessionId, 10, "companion");
      expect(queued).toHaveLength(1);
      expect((await inputOf(a.jobId)).companions).toEqual(["odo", "mira"]);
      expect((await inputOf(a.jobId)).reason).toBe("react");
    });

    it("does not claim a row before notBefore and claims it after", async () => {
      const sessionId = randomUUID();
      const { jobId } = await enqueueCompanionReact(
        requireDb(),
        sessionId,
        "odo",
        {
          quietMs: 60_000,
          maxWaitMs: 120_000,
        },
      );
      expect(await claim()).toBeNull();
      await requireDb().execute(sql`
        UPDATE jobs SET input = jsonb_set(input, '{notBefore}', to_jsonb(to_char((now() - interval '1 second') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
        WHERE id = ${jobId}
      `);
      const claimed = await claim();
      expect(claimed?.id).toBe(jobId);
      expect(claimed?.kind).toBe("companion");
    });

    it("the maximum wait caps a moving notBefore", async () => {
      const sessionId = randomUUID();
      const { jobId } = await enqueueCompanionReact(
        requireDb(),
        sessionId,
        "odo",
        {
          quietMs: 5_000,
          maxWaitMs: 8_000,
        },
      );
      const first = await inputOf(jobId);
      // The first reaction happened 7 s ago; a new reaction would push to now+5s,
      // beyond first+8s, so the cap (first+8s) wins.
      await requireDb().execute(sql`
        UPDATE jobs SET input = jsonb_set(input, '{firstReactionAt}', to_jsonb(to_char((now() - interval '7 seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
        WHERE id = ${jobId}
      `);
      await enqueueCompanionReact(requireDb(), sessionId, "mira", {
        quietMs: 5_000,
        maxWaitMs: 8_000,
      });
      const after = await inputOf(jobId);
      const nowMs = Date.now();
      const notBefore = Date.parse(after.notBefore);
      const firstMs = Date.parse(first.firstReactionAt);
      // capped: about 1 s from now (7 s elapsed of 8 s), far less than now + 5 s
      expect(notBefore).toBeLessThan(nowMs + 3_000);
      expect(notBefore).toBeGreaterThan(nowMs - 3_000);
      expect(Date.parse(after.firstReactionAt)).toBeLessThan(firstMs);
    });

    it("ten concurrent enqueues leave exactly one queued row", async () => {
      const sessionId = randomUUID();
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          enqueueCompanionReact(
            requireDb(),
            sessionId,
            i % 2 ? "odo" : "mira",
            opts,
          ),
        ),
      );
      const queued = (
        await listDmJobs(requireDb(), sessionId, 20, "companion")
      ).filter((j) => j.status === "queued");
      expect(queued).toHaveLength(1);
      expect(
        [
          ...(queued[0] as unknown as { input: { companions: string[] } }).input
            .companions,
        ].sort(),
      ).toEqual(["mira", "odo"]);
    });

    it("a running react job plus a new reaction gives one new queued row", async () => {
      const sessionId = randomUUID();
      const first = await enqueueCompanionReact(
        requireDb(),
        sessionId,
        "odo",
        opts,
      );
      const claimed = await claim();
      expect(claimed?.id).toBe(first.jobId);
      const next = await enqueueCompanionReact(
        requireDb(),
        sessionId,
        "odo",
        opts,
      );
      const again = await enqueueCompanionReact(
        requireDb(),
        sessionId,
        "mira",
        opts,
      );
      expect(next.inserted).toBe(true);
      expect(next.jobId).not.toBe(first.jobId);
      expect(again).toEqual({ jobId: next.jobId, inserted: false });
      const rows = await listDmJobs(requireDb(), sessionId, 10, "companion");
      expect(rows.map((r) => r.status).sort()).toEqual(["queued", "running"]);
    });
  },
);

describe.skipIf(!reachable)(
  "floor jobs (specs/049-turn-floor, integration)",
  () => {
    beforeEach(async () => {
      await requireDb().execute(
        sql`DELETE FROM jobs WHERE kind IN ('turn', 'companion', 'chronicle', 'floor')`,
      );
    });

    const absence = (sessionId: string, holder = "user-a") => ({
      sessionId,
      check: "absence" as const,
      actionId: null,
      holder,
      stanceSeq: null,
    });
    const stall = (sessionId: string, actionId: string, stanceSeq = 0) => ({
      sessionId,
      check: "stall" as const,
      actionId,
      holder: null,
      stanceSeq,
    });

    it("claims in priority order: turn, floor, companion, chronicle", async () => {
      const [s1, s2, s3, s4] = [
        randomUUID(),
        randomUUID(),
        randomUUID(),
        randomUUID(),
      ];
      await enqueueChronicle(requireDb(), s1, 5);
      await enqueueCompanion(requireDb(), {
        sessionId: s2,
        companions: ["mira"],
        reason: "prompt",
        beatJobId: null,
      });
      await enqueueFloorCheck(requireDb(), absence(s3), 0);
      await enqueueTurn(requireDb(), s4, "commit", 1);
      const order = [
        await claim(),
        await claim(),
        await claim(),
        await claim(),
      ];
      expect(order.map((c) => c?.kind)).toEqual([
        "turn",
        "floor",
        "companion",
        "chronicle",
      ]);
    });

    it("holds a floor job back until its notBefore passes", async () => {
      const sessionId = randomUUID();
      await enqueueFloorCheck(requireDb(), absence(sessionId), 60_000);
      expect(await claim()).toBeNull();
      await requireDb().execute(
        sql`UPDATE jobs SET input = jsonb_set(input, '{notBefore}', to_jsonb(to_char((now() - interval '1 second') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) WHERE session_id = ${sessionId}::uuid AND kind = 'floor'`,
      );
      const claimed = await claim();
      expect(claimed?.kind).toBe("floor");
      expect(claimed?.input).toMatchObject({
        check: "absence",
        holder: "user-a",
      });
    });

    it("keeps one queued floor job per (session, check, actionId) and moves its wait", async () => {
      const sessionId = randomUUID();
      const first = await enqueueFloorCheck(
        requireDb(),
        stall(sessionId, "act-1", 3),
        60_000,
      );
      const [before] = await listDmJobs(requireDb(), sessionId, 10, "floor");
      const again = await enqueueFloorCheck(
        requireDb(),
        stall(sessionId, "act-1", 7),
        120_000,
      );
      expect(first.inserted).toBe(true);
      expect(again).toEqual({ jobId: first.jobId, inserted: false });
      const rows = await listDmJobs(requireDb(), sessionId, 10, "floor");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.input).toMatchObject({ stanceSeq: 7 });
      const t0 = Date.parse(
        ((before?.input ?? {}) as { notBefore: string }).notBefore,
      );
      const t1 = Date.parse(
        ((rows[0]?.input ?? {}) as { notBefore: string }).notBefore,
      );
      expect(t1).toBeGreaterThan(t0);

      // Another action, another check and another session each get their own row.
      await enqueueFloorCheck(requireDb(), stall(sessionId, "act-2"), 60_000);
      await enqueueFloorCheck(requireDb(), absence(sessionId), 60_000);
      await enqueueFloorCheck(requireDb(), absence(randomUUID()), 60_000);
      expect(
        await listDmJobs(requireDb(), sessionId, 10, "floor"),
      ).toHaveLength(3);
    });

    it("20 concurrent arms of one check leave one queued row", async () => {
      const sessionId = randomUUID();
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          enqueueFloorCheck(requireDb(), stall(sessionId, "act-1", i), 60_000),
        ),
      );
      expect(
        await listDmJobs(requireDb(), sessionId, 30, "floor"),
      ).toHaveLength(1);
    });

    it("cancels only the named queued check", async () => {
      const sessionId = randomUUID();
      await enqueueFloorCheck(requireDb(), stall(sessionId, "act-1"), 60_000);
      await enqueueFloorCheck(requireDb(), stall(sessionId, "act-2"), 60_000);
      await cancelFloorCheck(requireDb(), sessionId, "stall", "act-1");
      const rows = await listDmJobs(requireDb(), sessionId, 10, "floor");
      expect(
        rows.map((r) => (r.input as { actionId: string }).actionId),
      ).toEqual(["act-2"]);
    });

    it("serialises with turn and companion jobs of the same session", async () => {
      const sessionId = randomUUID();
      await enqueueTurn(requireDb(), sessionId, "commit", 1);
      const running = await claim();
      expect(running?.kind).toBe("turn");
      await enqueueFloorCheck(requireDb(), absence(sessionId), 0);
      expect(await claim()).toBeNull();
      if (!running) throw new Error("expected a claim");
      await finishJob(requireDb(), running, { result: {} });
      const floor = await claim();
      expect(floor?.kind).toBe("floor");

      // A running floor job blocks the session's turn and companion jobs.
      await enqueueTurn(requireDb(), sessionId, "commit", 2);
      await enqueueCompanion(requireDb(), {
        sessionId,
        companions: ["mira"],
        reason: "turn",
        beatJobId: null,
      });
      expect(await claim()).toBeNull();
      if (!floor) throw new Error("expected a floor claim");
      await finishJob(requireDb(), floor, { result: {} });
      expect((await claim())?.kind).toBe("turn");
    });
  },
);
