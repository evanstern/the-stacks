/**
 * T010 (010 US1): the hybrid engine end-to-end against a real Postgres,
 * TDD'd before search.ts exists. The stub embed function is the injection
 * seam apps/api will fill with the real sidecar client — tests stay
 * deterministic (research R8) and the vector channel is exercised by
 * CONSTRUCTION: the "paraphrase" query's stub vector equals its target
 * chunk's embedding even though the texts share no keywords.
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  chunks,
  corpora,
  createDbClient,
  ensureSuiteDatabase,
  runMigrations,
  sourceArchives,
  sources,
  type Database,
} from "@stacks/db";
import { DomainError } from "@stacks/core";

import { resolveRetrievalConfig } from "./config";
import { searchCorpus, type QueryEmbedder } from "./search";
import {
  deterministicEmbedding,
  FIXTURE_EMBEDDING_STAMP,
} from "./eval/fixture/deterministic-embedding";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** Stub embedder: fixture stamp; specific query texts map to a TARGET
 *  chunk's vector (the by-construction paraphrase). */
const embedderFor = (paraphraseTargets: Record<string, string>): QueryEmbedder => {
  return async (text: string) => ({
    vector: deterministicEmbedding(paraphraseTargets[text] ?? text),
    ...FIXTURE_EMBEDDING_STAMP,
  });
};

const GRAPPLE = "The grapple rule: a creature can seize another and hold it in place.";
const FIREBALL = "Fireball detonates in a twenty foot radius sphere of flame.";
const STEALTH = "Stealth checks contest the passive perception of observers.";

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("searchCorpus", () => {
  let db: Database;
  let close: () => Promise<void>;
  let corpusId: string;
  let sourceId: string;

  const seedChunk = async (id: string, content: string, generation: number) => {
    await db.insert(chunks).values({
      id,
      sourceId,
      corpusId,
      generation,
      chunkIndex: 0,
      content,
      sectionIds: [`sec-${id}`],
      anchor: { headingTrail: ["Rules"], chunkId: id },
      pluginName: "fixture-plugin",
      pluginVersion: "1.0.0",
      embedding: deterministicEmbedding(content),
      embeddingProvider: FIXTURE_EMBEDDING_STAMP.provider,
      embeddingModel: FIXTURE_EMBEDDING_STAMP.model,
      embeddingDimensions: FIXTURE_EMBEDDING_STAMP.dimensions,
    });
  };

  beforeAll(async () => {
    const client = createDbClient(
      // TASK-8: a database of our own — nothing outside this file can touch it.
      await ensureSuiteDatabase(DATABASE_URL, "retrieval_search"),
    );
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
    // The suite database persists across runs by design (TASK-8); each run
    // starts from a clean slate it owns.
    await db.execute(
      sql`TRUNCATE TABLE retrieval_results, retrieval_runs, chunks, sources, source_archives, corpora CASCADE`,
    );

    const [corpus] = await db.insert(corpora).values({ name: "search-test" }).returning();
    corpusId = corpus!.id;
    await db
      .insert(sourceArchives)
      .values({ fingerprint: "a".repeat(64), bytes: Buffer.from("x"), byteSize: 1, mediaType: "text/html" })
      .onConflictDoNothing();
    const [source] = await db
      .insert(sources)
      .values({
        corpusId,
        fingerprint: "a".repeat(64),
        originalFilename: "rules.html",
        currentGeneration: 1,
        status: "ingested",
      })
      .returning();
    sourceId = source!.id;

    await seedChunk("chunk-grapple", GRAPPLE, 1);
    await seedChunk("chunk-fireball", FIREBALL, 1);
    await seedChunk("chunk-stealth", STEALTH, 1);
    // Written-aside re-ingest row: current generation is 1, this is 2 — the
    // reader predicate must make it invisible (FR-002).
    await seedChunk("chunk-grapple-gen2", "REVISED grapple text, not yet current.", 2);
  });

  afterAll(async () => {
    await close();
  });

  const config = resolveRetrievalConfig({});
  const deps = () => ({ db, embedQuery: embedderFor({ "hold an enemy in place": GRAPPLE }) });

  it("verbatim term: FTS carries the expected chunk to the top, attributed and scored", async () => {
    const search = await searchCorpus(deps(), { corpusId, query: "grapple", config });
    expect(search.results[0]!.chunkId).toBe("chunk-grapple");
    const top = search.results[0]!;
    expect(top.sourceId).toBe(sourceId);
    expect(top.contentSnapshot).toBe(GRAPPLE);
    expect(top.anchorSnapshot).toMatchObject({ chunkId: "chunk-grapple" });
    expect(top.contentSha256).toBe(sha(GRAPPLE));
    expect(top.ftsScore).not.toBeNull();
    expect(top.fusedScore).toBeGreaterThan(0);
  });

  it("paraphrase: the vector signal carries a no-shared-keyword query (by construction)", async () => {
    const search = await searchCorpus(deps(), {
      corpusId,
      query: "hold an enemy in place",
      config,
    });
    const ranks = search.results.map((r) => r.chunkId);
    expect(ranks.slice(0, 5)).toContain("chunk-grapple");
    const hit = search.results.find((r) => r.chunkId === "chunk-grapple")!;
    expect(hit.vectorScore).not.toBeNull();
  });

  it("reader predicate: a written-aside generation never surfaces (FR-002)", async () => {
    const search = await searchCorpus(deps(), { corpusId, query: "grapple REVISED", config });
    expect(search.results.map((r) => r.chunkId)).not.toContain("chunk-grapple-gen2");
  });

  it("no match: honest empty, and the run is STILL a receipt", async () => {
    const search = await searchCorpus(deps(), { corpusId, query: "zqxv kjw", config });
    expect(search.results).toHaveLength(0);
    const run = await db.execute(
      sql`SELECT origin, result_count FROM retrieval_runs WHERE id = ${search.runId}`,
    );
    expect(run.rows[0]).toMatchObject({ origin: "interactive", result_count: 0 });
  });

  it("records the full receipt: config verbatim, stamps, timings, result lines", async () => {
    const search = await searchCorpus(deps(), { corpusId, query: "fireball", config });
    const run = await db.execute(
      sql`SELECT config, embedding_provider, stage_timings FROM retrieval_runs WHERE id = ${search.runId}`,
    );
    expect(run.rows[0]!.config).toMatchObject({ configName: "env-default", fusion: "rrf" });
    expect(run.rows[0]!.embedding_provider).toBe("fixture");
    expect(run.rows[0]!.stage_timings).toHaveProperty("fts");
    const lines = await db.execute(
      sql`SELECT count(*)::int AS n FROM retrieval_results WHERE run_id = ${search.runId}`,
    );
    expect(lines.rows[0]).toEqual({ n: search.results.length });
  });

  it("REFUSES an embedding-space mismatch, naming both stamps (research R4)", async () => {
    const wrongSpace: QueryEmbedder = async () => ({
      vector: deterministicEmbedding("x", 8),
      provider: "local-sidecar",
      model: "some-other-model",
      dimensions: 8,
    });
    await expect(
      searchCorpus({ db, embedQuery: wrongSpace }, { corpusId, query: "grapple", config }),
    ).rejects.toMatchObject({
      constructor: DomainError,
      class: "invalid_input",
      message: expect.stringMatching(/fixture.*some-other-model|some-other-model.*fixture/s),
    });
  });
});
