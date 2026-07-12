/**
 * T008 (010 Foundational): recordRetrievalRun, TDD'd before it exists.
 *
 * The receipt discipline under test (data-model.md):
 *  - ONE transaction writes the run header and every result line — a torn
 *    receipt (header without lines, lines without header) is unrepresentable.
 *  - append-only BY CONSTRUCTION: the module exports exactly one writer and
 *    zero update/delete helpers — the same posture recordEvent pinned in 007.
 *  - resultCount is derived by the writer from the lines it inserts; a
 *    caller can't make the denormalization lie.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "../src/client";
import { createDbClient } from "../src/client";
import { ensureSuiteDatabase } from "../src/test-db";
import { runMigrations } from "../src/migrate";
import { corpora, sourceArchives, sources } from "../src/schema/ingestion";
import * as retrievalRunsModule from "../src/retrieval-runs";
import { recordRetrievalRun } from "../src/retrieval-runs";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("recordRetrievalRun", () => {
  let db: Database;
  let close: () => Promise<void>;
  let corpusId: string;
  let sourceId: string;

  beforeAll(async () => {
    const client = createDbClient(
      // TASK-8: a database of our own — beforeEach TRUNCATEs can never race
      // another package's suite (isolation by construction, not by locking).
      await ensureSuiteDatabase(DATABASE_URL, "db_retrieval_runs"),
    );
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
    // The suite database persists across runs by design (TASK-8); each run
    // starts from a clean slate it owns.
    await db.execute(
      sql`TRUNCATE TABLE retrieval_results, retrieval_runs, sources, source_archives, corpora CASCADE`,
    );

    const [corpus] = await db.insert(corpora).values({ name: "retrieval-runs-test" }).returning();
    corpusId = corpus!.id;
    await db
      .insert(sourceArchives)
      .values({ fingerprint: "f".repeat(64), bytes: Buffer.from("x"), byteSize: 1, mediaType: "text/plain" })
      .onConflictDoNothing();
    const [source] = await db
      .insert(sources)
      .values({ corpusId, fingerprint: "f".repeat(64), originalFilename: "fixture.txt" })
      .returning();
    sourceId = source!.id;
  });

  afterAll(async () => {
    await close();
  });

  const baseRun = () => ({
    query: "how does grappling work",
    config: { configName: "env-default", fusion: "rrf", rrfK: 60, k: 10 },
    corpusId,
    origin: "interactive" as const,
    embeddingProvider: "fixture",
    embeddingModel: "deterministic-v1",
    embeddingDimensions: 32,
    stageTimings: { embed: 3, fts: 5, vector: 7, fusion: 0, rerank: null },
  });

  const line = (rank: number) => ({
    rank,
    chunkId: `chunk-${rank}`,
    sourceId,
    generation: 1,
    contentSnapshot: `passage ${rank}`,
    anchorSnapshot: { headingTrail: ["Combat"] },
    sectionIds: ["sec-1"],
    contentSha256: "a".repeat(64),
    ftsScore: 0.5,
    vectorScore: 0.8,
    fusedScore: 0.03,
    rerankScore: null,
    prerankPosition: null,
  });

  it("writes header + all lines in one transaction and derives resultCount", async () => {
    const run = await recordRetrievalRun(db, { ...baseRun(), results: [line(1), line(2)] });
    expect(run.id).toBeTruthy();
    expect(run.resultCount).toBe(2);

    const results = await db.execute(
      sql`SELECT rank, content_snapshot FROM retrieval_results WHERE run_id = ${run.id} ORDER BY rank`,
    );
    expect(results.rows).toHaveLength(2);
    expect(results.rows[0]).toMatchObject({ rank: 1, content_snapshot: "passage 1" });
  });

  it("a failing line tears down the WHOLE receipt (no orphan headers)", async () => {
    const before = await db.execute(sql`SELECT count(*)::int AS n FROM retrieval_runs`);
    await expect(
      // duplicate rank violates the (run_id, rank) primary key mid-batch
      recordRetrievalRun(db, { ...baseRun(), results: [line(1), line(1)] }),
    ).rejects.toThrow();
    const after = await db.execute(sql`SELECT count(*)::int AS n FROM retrieval_runs`);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("records an honest empty search (zero results is still a receipt)", async () => {
    const run = await recordRetrievalRun(db, { ...baseRun(), query: "zqxv kjw", results: [] });
    expect(run.resultCount).toBe(0);
  });

  it("exports no update/delete path — append-only by construction", () => {
    const exported = Object.keys(retrievalRunsModule);
    expect(exported).toEqual(["recordRetrievalRun"]);
  });
});
