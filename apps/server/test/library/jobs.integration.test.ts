import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../../src/db.js";
import { ConflictError } from "../../src/errors.js";
import {
  claimJob,
  enqueueIngest,
  finishJob,
  getJob,
  heartbeat,
  JobStatusSchema,
  listJobs,
  setStage,
} from "../../src/library/ingest/jobs.js";
import { jobs } from "../../src/schema/jobs.js";

/**
 * Integration tests for the `jobs` claim/lease/fencing store
 * (specs/017-ingestion-pipeline T007) against a REAL Postgres — SKIP
 * LOCKED, lease expiry, and fencing all depend on real transactional
 * behaviour a fake can't reproduce.
 *
 * Pattern copied from library/store.integration.test.ts (loud-skip harness).
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/library/jobs.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `These are the ingestion jobs store integration tests (spec 017 Phase 1); a skip here ` +
    `proves NOTHING about claim/lease/fencing behavior. Start one with: pnpm env:up, then ` +
    `set TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) {
    throw new Error(
      "jobs store integration tests require a reachable database",
    );
  }
  return db;
}

let counter = 0;
/** A fresh book name per test — `jobs_active_book_key` is unique on active jobs. */
function freshBook(label: string): string {
  counter += 1;
  return `${label} ${Date.now()}-${counter}`;
}

function enqueue(book: string) {
  return enqueueIngest(requireDb(), {
    book,
    format: "html",
    filename: "book.html",
    bytes: 1234,
    uploadPath: "/tmp/does-not-matter.upload",
  });
}

/** Backdates a job's heartbeat past the lease, simulating a dead worker. */
async function ageHeartbeat(id: string, secondsAgo: number) {
  await requireDb().execute(
    sql`UPDATE jobs SET heartbeat_at = now() - (interval '1 second' * ${secondsAgo}) WHERE id = ${id}`,
  );
}

/**
 * The claim query picks the OLDEST claimable job across the whole table
 * (research R6 SQL), so a job left `queued` by an earlier test would
 * otherwise get claimed ahead of the job a later test just enqueued. Drain
 * every claimable job before each test so "claim the job I just made" tests
 * see a clean queue.
 */
async function drainQueue() {
  for (;;) {
    const claimed = await claimJob(requireDb());
    if (!claimed) break;
    await finishJob(requireDb(), claimed, {
      error: "drained for test isolation",
    });
  }
}

describe.skipIf(!reachable)("jobs store (Phase 1, integration)", () => {
  beforeEach(async () => {
    await drainQueue();
  });

  it("T007: enqueue returns a queued job", async () => {
    const status = await enqueue(freshBook("Enqueue Basic"));
    expect(status.status).toBe("queued");
    expect(status.stage).toBeNull();
    expect(status.attempts).toBe(0);
  });

  it("T007: a second active enqueue for the same book (case/whitespace-insensitive) conflicts", async () => {
    const book = freshBook("Basic Rules");
    await enqueue(`  ${book}  `);

    await expect(enqueue(book.toUpperCase())).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("T007: two concurrent claimJob calls never return the same job", async () => {
    const book = freshBook("Concurrent Claim");
    const queued = await enqueue(book);

    const [a, b] = await Promise.all([
      claimJob(requireDb()),
      claimJob(requireDb()),
    ]);
    const claimed = [a, b].filter((c) => c?.id === queued.id);
    expect(claimed).toHaveLength(1);
  });

  it("T007: a running job with a fresh heartbeat is not reclaimed", async () => {
    const status = await enqueue(freshBook("Fresh Heartbeat"));
    const claimed = await claimJob(requireDb());
    expect(claimed?.id).toBe(status.id);

    // The queue was drained in beforeEach and the heartbeat is fresh, so a
    // second claim attempt finds nothing to reclaim.
    const second = await claimJob(requireDb());
    expect(second).toBeNull();
  });

  it("T007: a running job whose heartbeat is older than the lease is reclaimed (attempts 2, new token)", async () => {
    const status = await enqueue(freshBook("Stale Heartbeat"));
    const first = await claimJob(requireDb());
    expect(first?.id).toBe(status.id);
    await ageHeartbeat(status.id, 61);

    const reclaimed = await claimJob(requireDb());
    expect(reclaimed?.id).toBe(status.id);
    expect(reclaimed?.claimToken).not.toBe(first?.claimToken);

    const [row] = await requireDb()
      .select()
      .from(jobs)
      .where(eq(jobs.id, status.id));
    expect(row.attempts).toBe(2);
  });

  it("T007: a stale claim token's setStage/finishJob/heartbeat return false and change nothing", async () => {
    const status = await enqueue(freshBook("Fenced Out"));
    const staleClaim = await claimJob(requireDb());
    if (!staleClaim) throw new Error("expected a claim");
    await ageHeartbeat(status.id, 61);
    const fresh = await claimJob(requireDb());
    if (!fresh) throw new Error("expected a reclaim");
    expect(fresh.claimToken).not.toBe(staleClaim.claimToken);

    expect(await heartbeat(requireDb(), staleClaim)).toBe(false);
    expect(await setStage(requireDb(), staleClaim, "parse")).toBe(false);
    expect(await finishJob(requireDb(), staleClaim, { error: "stale" })).toBe(
      false,
    );

    const [row] = await requireDb()
      .select()
      .from(jobs)
      .where(eq(jobs.id, status.id));
    expect(row.claimToken).toBe(fresh.claimToken);
    expect(row.status).toBe("running");
    expect(row.stage).toBe("extract");
  });

  it("T007: the fourth claim yields failed", async () => {
    const status = await enqueue(freshBook("Abandoned"));
    for (let i = 0; i < 3; i++) {
      const claimed = await claimJob(requireDb());
      expect(claimed?.id).toBe(status.id);
      await ageHeartbeat(status.id, 61);
    }

    const fourth = await claimJob(requireDb());
    expect(fourth).toBeNull();

    const [row] = await requireDb()
      .select()
      .from(jobs)
      .where(eq(jobs.id, status.id));
    expect(row.status).toBe("failed");
    expect(row.attempts).toBe(4);
    expect(row.error).toBe("abandoned 3 times (process died mid-job)");
  });

  it("T007: JobStatusSchema never exposes uploadPath or claim_token", async () => {
    const status = await enqueue(freshBook("No Leakage"));
    const parsed = JobStatusSchema.parse(status);
    expect(parsed).not.toHaveProperty("uploadPath");
    expect(parsed).not.toHaveProperty("claim_token");
    expect(parsed).not.toHaveProperty("claimToken");

    const listed = await listJobs(requireDb(), 20);
    expect(listed.some((j) => j.id === status.id)).toBe(true);
    const fetched = await getJob(requireDb(), status.id);
    expect(fetched?.id).toBe(status.id);
  });
});
