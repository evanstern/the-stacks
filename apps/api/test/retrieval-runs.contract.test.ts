/**
 * T016 (010 US2): the receipts surface — GET /api/retrieval/runs (paged,
 * newest-first, the 009 {items,total,limit,offset} envelope) and
 * GET /api/retrieval/runs/:id (the full receipt, each result carrying the
 * VIEW-TIME superseded derivation). TDD'd before the routes exist.
 *
 * The superseded rule under test (data-model.md): a result is superseded
 * when NO chunk with its content_sha256 exists at its source's current
 * generation — a re-ingest that reproduced identical text does NOT
 * supersede (the hash survives), a changed text does. Nothing is stored;
 * the receipt rows stay immutable.
 */
import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  chunks,
  corpora,
  createDbClient,
  ensureSuiteDatabase,
  recordRetrievalRun,
  runMigrations,
  sourceArchives,
  sources,
} from "@stacks/db";
import {
  deterministicEmbedding,
  FIXTURE_EMBEDDING_STAMP,
  resolveRetrievalConfig,
} from "@stacks/retrieval";

import { buildApp } from "../src/app";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";
const PASSWORD = "correct horse battery staple";
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

const KEPT = "This passage survives the re-ingest byte for byte.";
const SWEPT = "This passage gets rewritten by the re-ingest.";

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("retrieval runs records", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let close: () => Promise<void>;
  let cookie: string;
  let runId: string;

  beforeAll(async () => {
    const { db, pool } = createDbClient(
      // TASK-8: this suite's own database.
      await ensureSuiteDatabase(DATABASE_URL, "api_retrieval_runs"),
    );
    close = () => pool.end();
    await runMigrations(db);
    await pool.query(
      "TRUNCATE TABLE retrieval_results, retrieval_runs, chunks, sources, source_archives, corpora CASCADE",
    );

    const [corpus] = await db.insert(corpora).values({ name: "default" }).returning();
    await db
      .insert(sourceArchives)
      .values({ fingerprint: "c".repeat(64), bytes: Buffer.from("x"), byteSize: 1, mediaType: "text/html" });
    const [source] = await db
      .insert(sources)
      .values({
        corpusId: corpus!.id,
        fingerprint: "c".repeat(64),
        originalFilename: "rules.html",
        // Generation 2 is ALREADY current: the receipt below was recorded at
        // generation 1, simulating a run that predates a re-ingest.
        currentGeneration: 2,
        status: "ingested",
      })
      .returning();

    // Current-generation reality: KEPT survived verbatim (new chunk id, same
    // text hash); SWEPT's text was rewritten.
    const seed = (id: string, content: string) =>
      db.insert(chunks).values({
        id,
        sourceId: source!.id,
        corpusId: corpus!.id,
        generation: 2,
        chunkIndex: 0,
        content,
        sectionIds: ["sec-1"],
        anchor: { headingTrail: ["Rules"] },
        pluginName: "fixture-plugin",
        pluginVersion: "1.0.0",
        embedding: deterministicEmbedding(content),
        embeddingProvider: FIXTURE_EMBEDDING_STAMP.provider,
        embeddingModel: FIXTURE_EMBEDDING_STAMP.model,
        embeddingDimensions: FIXTURE_EMBEDDING_STAMP.dimensions,
      });
    await seed("gen2-kept", KEPT);
    await seed("gen2-rewritten", "Completely new text after the re-ingest.");

    // The months-old receipt: recorded when generation 1 was current.
    const line = (rank: number, chunkId: string, content: string) => ({
      rank,
      chunkId,
      sourceId: source!.id,
      generation: 1,
      contentSnapshot: content,
      anchorSnapshot: { headingTrail: ["Rules"] },
      sectionIds: ["sec-1"],
      contentSha256: sha(content),
      ftsScore: 0.4,
      vectorScore: 0.7,
      fusedScore: 0.031,
      rerankScore: null,
      prerankPosition: null,
    });
    const recorded = await recordRetrievalRun(db, {
      query: "which passages survive",
      config: resolveRetrievalConfig({}),
      corpusId: corpus!.id,
      origin: "interactive",
      embeddingProvider: FIXTURE_EMBEDDING_STAMP.provider,
      embeddingModel: FIXTURE_EMBEDDING_STAMP.model,
      embeddingDimensions: FIXTURE_EMBEDDING_STAMP.dimensions,
      stageTimings: { embed: 1, fts: 1, vector: 1, fusion: 0, rerank: null },
      results: [line(1, "gen1-kept", KEPT), line(2, "gen1-swept", SWEPT)],
    });
    runId = recorded.id;
    // A second, newer run so list ordering is observable.
    await recordRetrievalRun(db, {
      query: "newest first",
      config: resolveRetrievalConfig({}),
      corpusId: corpus!.id,
      origin: "interactive",
      embeddingProvider: FIXTURE_EMBEDDING_STAMP.provider,
      embeddingModel: FIXTURE_EMBEDDING_STAMP.model,
      embeddingDimensions: FIXTURE_EMBEDDING_STAMP.dimensions,
      stageTimings: { embed: 1, fts: 1, vector: 1, fusion: 0, rerank: null },
      results: [],
    });

    app = await buildApp({
      db,
      pool,
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: "a".repeat(32),
      sessionCookieSecure: false,
      retrievalConfig: resolveRetrievalConfig({}),
    });
    await app.ready();
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: PASSWORD },
    });
    cookie = String(login.headers["set-cookie"]).split(";")[0]!;
  });

  afterAll(async () => {
    await app.close();
    await close();
  });

  it("lists runs newest-first in the {items,total,limit,offset} envelope", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/retrieval/runs?limit=10&offset=0",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
    expect(body.items[0]).toMatchObject({ query: "newest first", origin: "interactive", resultCount: 0 });
    expect(body.items[1]).toMatchObject({ query: "which passages survive", resultCount: 2 });
    expect(body.items[1].configName).toBe("env-default");
  });

  it("run detail: snapshots render with the view-time superseded derivation", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/retrieval/runs/${runId}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.query).toBe("which passages survive");
    expect(body.config).toMatchObject({ configName: "env-default" });
    expect(body.results).toHaveLength(2);
    const [kept, swept] = body.results;
    // Identical text re-ingested under a new chunk id: NOT superseded.
    expect(kept).toMatchObject({ rank: 1, content: KEPT, superseded: false });
    // Rewritten text: the snapshot still renders, marked superseded.
    expect(swept).toMatchObject({ rank: 2, content: SWEPT, superseded: true });
    expect(swept.scores.vector).toBeCloseTo(0.7, 5);
  });

  it("404 unknown_thing for an absent run id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/retrieval/runs/00000000-0000-0000-0000-000000000000",
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("unknown_thing");
  });

  it("401 without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/retrieval/runs" });
    expect(res.statusCode).toBe(401);
  });
});
