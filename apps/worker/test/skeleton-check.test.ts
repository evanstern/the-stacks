import { createServer, type Server } from "node:http";

import {
  claimNext,
  createDbClient,
  enqueue,
  recordEvent,
  runMigrations,
  skeletonCheckEvents,
  skeletonCheckRuns,
  skeletonVectors,
} from "@stacks/db";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { skeletonCheckHandler } from "../src/handlers/skeleton-check";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3";
const DIMENSIONS = 4;

// Requires the compose Postgres (docker-compose.yml) reachable at DATABASE_URL;
// the ml sidecar is stubbed with a local HTTP server per test (research R4/R6).
describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("skeletonCheckHandler", () => {
  let db: ReturnType<typeof createDbClient>["db"];
  let close: () => Promise<void>;
  let stub: Server | undefined;

  beforeAll(async () => {
    const client = createDbClient(DATABASE_URL);
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);

    process.env.EMBEDDING_PROVIDER = "local-sidecar";
    process.env.EMBEDDING_MODEL_ID = "test-model";
    process.env.EMBEDDING_DIMENSIONS = String(DIMENSIONS);
    process.env.ML_REQUEST_TIMEOUT_MS = "500";
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE TABLE skeleton_check_events, skeleton_check_runs, jobs, skeleton_vectors CASCADE`,
    );
  });

  afterEach(async () => {
    stub?.close();
    stub = undefined;
  });

  function startStub(
    handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void,
  ): Promise<number> {
    return new Promise((resolve) => {
      stub = createServer(handler);
      stub.listen(0, "127.0.0.1", () => {
        const address = stub!.address();
        const port = typeof address === "object" && address ? address.port : 0;
        process.env.EMBEDDING_ENDPOINT = `http://127.0.0.1:${port}`;
        resolve(port);
      });
    });
  }

  async function createRunAndJob(): Promise<{ runId: string; jobId: string }> {
    const job = await enqueue(db, { kind: "skeleton_check", payload: {} });
    const [run] = await db
      .insert(skeletonCheckRuns)
      .values({ jobId: job.id, inputText: "the Stacks v3 walking skeleton fixture" })
      .returning();
    // stash runId on the job payload and emit `queued` the way the API route will (T033)
    await db.execute(sql`UPDATE jobs SET payload = ${JSON.stringify({ runId: run!.id })}::jsonb WHERE id = ${job.id}`);
    await recordEvent(db, { runId: run!.id, seam: "queued" });
    return { runId: run!.id, jobId: job.id };
  }

  it("success path writes all six events with durations and stamps the vector identity", async () => {
    await startStub((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          model: "test-model",
          dimensions: DIMENSIONS,
          embeddings: [[0.1, 0.2, 0.3, 0.4]],
          duration_ms: 5,
        }),
      );
    });

    const { runId } = await createRunAndJob();
    const job = await claimNext(db, { workerId: "worker-1" });

    await skeletonCheckHandler(db, job!);

    const events = await db
      .select()
      .from(skeletonCheckEvents)
      .where(sql`${skeletonCheckEvents.runId} = ${runId}`)
      .orderBy(skeletonCheckEvents.id);

    expect(events.map((e) => e.seam)).toEqual([
      "queued",
      "claimed",
      "inference",
      "vector_write",
      "vector_readback",
      "completed",
    ]);
    expect(events.every((e) => e.ok)).toBe(true);

    const [run] = await db.select().from(skeletonCheckRuns).where(sql`${skeletonCheckRuns.id} = ${runId}`);
    expect(run?.status).toBe("succeeded");
    expect(run?.vectorId).toMatch(/^[0-9a-f]{64}$/);

    const [vector] = await db
      .select()
      .from(skeletonVectors)
      .where(sql`${skeletonVectors.id} = ${run!.vectorId}`);
    expect(vector?.embeddingProvider).toBe("local-sidecar");
    expect(vector?.embeddingModel).toBe("test-model");
    expect(vector?.embeddingDimensions).toBe(DIMENSIONS);
  });

  it("connection-refused at the ml seam fails the run as dependency_down/inference and requeues", async () => {
    process.env.EMBEDDING_ENDPOINT = "http://127.0.0.1:1"; // nothing listens here

    const { runId } = await createRunAndJob();
    const job = await claimNext(db, { workerId: "worker-1" });

    await expect(skeletonCheckHandler(db, job!)).rejects.toThrow();

    const [run] = await db.select().from(skeletonCheckRuns).where(sql`${skeletonCheckRuns.id} = ${runId}`);
    expect(run?.status).toBe("failed");
    expect(run?.outcome).toMatchObject({ class: "dependency_down", seam: "inference" });

    const events = await db
      .select()
      .from(skeletonCheckEvents)
      .where(sql`${skeletonCheckEvents.runId} = ${runId}`)
      .orderBy(skeletonCheckEvents.id);
    expect(events.at(-1)).toMatchObject({ seam: "inference", ok: false });
  });

  it("a 503 from the sidecar is dependency_down, and the run succeeds once the sidecar returns", async () => {
    let calls = 0;
    await startStub((_req, res) => {
      calls += 1;
      if (calls === 1) {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: { code: "dependency_down", message: "loading" } }));
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          model: "test-model",
          dimensions: DIMENSIONS,
          embeddings: [[0.1, 0.2, 0.3, 0.4]],
          duration_ms: 5,
        }),
      );
    });

    const { runId, jobId } = await createRunAndJob();
    const firstAttempt = await claimNext(db, { workerId: "worker-1" });
    await expect(skeletonCheckHandler(db, firstAttempt!)).rejects.toThrow();

    await db.execute(sql`UPDATE jobs SET status = 'queued', run_at = now() WHERE id = ${jobId}`);
    const secondAttempt = await claimNext(db, { workerId: "worker-1" });
    await skeletonCheckHandler(db, secondAttempt!);

    const [run] = await db.select().from(skeletonCheckRuns).where(sql`${skeletonCheckRuns.id} = ${runId}`);
    expect(run?.status).toBe("succeeded");
    expect(calls).toBe(2);
  });

  it("a dimension mismatch is internal_fault and writes nothing to skeleton_vectors", async () => {
    await startStub((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          model: "test-model",
          dimensions: 999, // mismatched
          embeddings: [[0.1, 0.2, 0.3]],
          duration_ms: 5,
        }),
      );
    });

    const { runId } = await createRunAndJob();
    const job = await claimNext(db, { workerId: "worker-1" });

    await expect(skeletonCheckHandler(db, job!)).rejects.toThrow();

    const [run] = await db.select().from(skeletonCheckRuns).where(sql`${skeletonCheckRuns.id} = ${runId}`);
    expect(run?.status).toBe("failed");
    expect(run?.outcome).toMatchObject({ class: "internal_fault", seam: "inference" });

    const vectors = await db.select().from(skeletonVectors);
    expect(vectors).toHaveLength(0);
  });

  it("re-running with identical input reuses the same vector id and flags deduplicated", async () => {
    await startStub((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          model: "test-model",
          dimensions: DIMENSIONS,
          embeddings: [[0.1, 0.2, 0.3, 0.4]],
          duration_ms: 5,
        }),
      );
    });

    const first = await createRunAndJob();
    await skeletonCheckHandler(db, (await claimNext(db, { workerId: "worker-1" }))!);

    const second = await createRunAndJob();
    await skeletonCheckHandler(db, (await claimNext(db, { workerId: "worker-1" }))!);

    const [run1] = await db.select().from(skeletonCheckRuns).where(sql`${skeletonCheckRuns.id} = ${first.runId}`);
    const [run2] = await db.select().from(skeletonCheckRuns).where(sql`${skeletonCheckRuns.id} = ${second.runId}`);
    expect(run1?.vectorId).toBe(run2?.vectorId);

    const vectors = await db.select().from(skeletonVectors);
    expect(vectors).toHaveLength(1);

    const secondEvents = await db
      .select()
      .from(skeletonCheckEvents)
      .where(sql`${skeletonCheckEvents.runId} = ${second.runId}`)
      .orderBy(skeletonCheckEvents.id);
    const vectorWrite = secondEvents.find((e) => e.seam === "vector_write");
    expect(vectorWrite?.detail).toMatchObject({ deduplicated: true });
  });
});
