import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "../src/client";
import { createDbClient } from "../src/client";
import { jobs } from "../src/schema/jobs";
import { runMigrations } from "../src/migrate";
import { claimNext, complete, enqueue, fail, reclaimStale } from "../src/queue";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3";

// Requires the compose Postgres (docker-compose.yml) reachable at DATABASE_URL.
describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("queue", () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const client = createDbClient(DATABASE_URL);
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE jobs CASCADE`);
  });

  it("enqueues a job in queued status", async () => {
    const job = await enqueue(db, { kind: "skeleton_check", payload: {} });
    expect(job.status).toBe("queued");
    expect(job.attempts).toBe(0);
  });

  it("claims the next queued job with SKIP LOCKED and marks it claimed", async () => {
    await enqueue(db, { kind: "skeleton_check", payload: {} });

    const claimed = await claimNext(db, { workerId: "worker-1" });

    expect(claimed?.status).toBe("claimed");
    expect(claimed?.claimedBy).toBe("worker-1");
    expect(claimed?.attempts).toBe(1);
  });

  it("returns undefined when nothing is claimable", async () => {
    const claimed = await claimNext(db, { workerId: "worker-1" });
    expect(claimed).toBeUndefined();
  });

  it("does not let two concurrent claimers take the same job", async () => {
    await enqueue(db, { kind: "skeleton_check", payload: {} });

    const [a, b] = await Promise.all([
      claimNext(db, { workerId: "worker-a" }),
      claimNext(db, { workerId: "worker-b" }),
    ]);

    const claimedBoth = [a, b].filter(Boolean);
    expect(claimedBoth).toHaveLength(1);
  });

  it("marks a claimed job succeeded on complete()", async () => {
    await enqueue(db, { kind: "skeleton_check", payload: {} });
    const claimed = await claimNext(db, { workerId: "worker-1" });
    await complete(db, claimed!.id);

    const [row] = await db.select().from(jobs).where(sql`${jobs.id} = ${claimed!.id}`);
    expect(row?.status).toBe("succeeded");
  });

  it("requeues a retryable failure with attempts left, applying backoff to run_at", async () => {
    await enqueue(db, { kind: "skeleton_check", payload: {}, maxAttempts: 3 });
    const claimed = await claimNext(db, { workerId: "worker-1" });

    await fail(db, claimed!.id, { code: "dependency_down", message: "sidecar down" });

    const [row] = await db.select().from(jobs).where(sql`${jobs.id} = ${claimed!.id}`);
    expect(row?.status).toBe("queued");
    expect(row?.lastError).toMatchObject({ code: "dependency_down" });
    expect(row?.runAt.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("fails a job permanently once attempts exhaust", async () => {
    await enqueue(db, { kind: "skeleton_check", payload: {}, maxAttempts: 1 });
    const claimed = await claimNext(db, { workerId: "worker-1" });

    await fail(db, claimed!.id, { code: "dependency_down", message: "sidecar down" });

    const [row] = await db.select().from(jobs).where(sql`${jobs.id} = ${claimed!.id}`);
    expect(row?.status).toBe("failed");
  });

  it("reclaims a claim whose visibility timeout has elapsed", async () => {
    await enqueue(db, { kind: "skeleton_check", payload: {} });
    await claimNext(db, { workerId: "worker-1" });

    // simulate a stuck claim by backdating claimed_at
    await db.execute(
      sql`UPDATE jobs SET claimed_at = now() - interval '10 minutes' WHERE status = 'claimed'`,
    );

    const reclaimed = await reclaimStale(db, { visibilityTimeoutMs: 60_000 });
    expect(reclaimed).toBe(1);

    const [row] = await db.select().from(jobs);
    expect(row?.status).toBe("queued");
  });
});
