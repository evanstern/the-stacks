/**
 * T029 (010 US4): the eval_run job handler, TDD'd first. The handler is a
 * thin adapter over executeEvalRun; what it OWNS is the D12 contract:
 * malformed payloads are wiring bugs (throw, no status touch — there is no
 * run to fail), execution errors leave the run row `failed` with a scrubbed
 * message AND re-throw so the queue's retry/backoff machinery still sees
 * the failure. The embedder is injectable for tests, env-built in prod.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbClient,
  ensureSuiteDatabase,
  runMigrations,
  type Database,
  type Job,
} from "@stacks/db";
import {
  createEvalRun,
  createGoldItem,
  fixtureQueryEmbedder,
  resolveRetrievalConfig,
  seedFixtureCorpus,
  FIXTURE_GOLD,
} from "@stacks/retrieval";

import { evalRunHandler, _setEvalEmbedderForTests } from "../src/handlers/eval-run";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";

const job = (payload: unknown): Job =>
  ({ id: "job-1", kind: "eval_run", payload, status: "claimed" }) as unknown as Job;

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("evalRunHandler", () => {
  let db: Database;
  let close: () => Promise<void>;
  let corpusId: string;

  beforeAll(async () => {
    const client = createDbClient(
      // TASK-8: this suite's own database.
      await ensureSuiteDatabase(DATABASE_URL, "worker_eval_run"),
    );
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
    const fixture = await seedFixtureCorpus(db);
    corpusId = fixture.corpusId;
    for (const gold of FIXTURE_GOLD.slice(0, 4)) {
      await createGoldItem(db, {
        corpusId,
        question: gold.question,
        chunkIds: gold.expectedChunkIds,
        split: gold.split,
      });
    }
    _setEvalEmbedderForTests(fixtureQueryEmbedder);
  });

  afterAll(async () => {
    _setEvalEmbedderForTests(null);
    await close();
  });

  it("executes the run to completed", async () => {
    const evalRunId = await createEvalRun(db, {
      corpusId,
      config: resolveRetrievalConfig({}, { configName: "handler-check" }),
    });
    await evalRunHandler(db, job({ evalRunId }));
    const row = await db.execute<{ status: string }>(
      sql`SELECT status FROM eval_runs WHERE id = ${evalRunId}`,
    );
    expect(row.rows[0]!.status).toBe("completed");
  });

  it("a malformed payload throws without touching any run row", async () => {
    await expect(evalRunHandler(db, job({}))).rejects.toThrow(/malformed payload/);
  });

  it("execution failure marks the row failed (scrubbed) AND re-throws for the queue", async () => {
    const evalRunId = await createEvalRun(db, {
      corpusId,
      config: resolveRetrievalConfig({}, { configName: "will-fail" }),
    });
    _setEvalEmbedderForTests(async () => {
      throw new Error("secret internal detail: sidecar exploded at 10.0.0.7");
    });
    try {
      await expect(evalRunHandler(db, job({ evalRunId }))).rejects.toThrow();
    } finally {
      _setEvalEmbedderForTests(fixtureQueryEmbedder);
    }
    const row = await db.execute<{ status: string; error: string }>(
      sql`SELECT status, error FROM eval_runs WHERE id = ${evalRunId}`,
    );
    expect(row.rows[0]!.status).toBe("failed");
    // Scrubbed: the row never carries raw internals (FR-018 lineage).
    expect(row.rows[0]!.error).not.toContain("10.0.0.7");
  });
});
