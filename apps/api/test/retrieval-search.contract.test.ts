/**
 * T012 (010 US1): POST /api/retrieval/search contract, TDD'd before the
 * route exists (contracts/api.md §1). The response IS the receipt's content:
 * whatever the wire says, the retrieval_runs row says identically.
 */
import bcrypt from "bcrypt";
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
} from "@stacks/db";

import { buildApp } from "../src/app";
import {
  deterministicEmbedding,
  FIXTURE_EMBEDDING_STAMP,
  resolveRetrievalConfig,
  type QueryEmbedder,
} from "@stacks/retrieval";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";
const PASSWORD = "correct horse battery staple";

const fixtureEmbedder: QueryEmbedder = async (text) => ({
  vector: deterministicEmbedding(text),
  ...FIXTURE_EMBEDDING_STAMP,
});

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("POST /api/retrieval/search", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let close: () => Promise<void>;
  let cookie: string;

  beforeAll(async () => {
    const { db, pool } = createDbClient(
      // TASK-8: this suite's own database.
      await ensureSuiteDatabase(DATABASE_URL, "api_retrieval_search"),
    );
    close = () => pool.end();
    await runMigrations(db);
    await pool.query(
      "TRUNCATE TABLE retrieval_results, retrieval_runs, chunks, sources, source_archives, corpora CASCADE",
    );

    const [corpus] = await db.insert(corpora).values({ name: "default" }).returning();
    await db
      .insert(sourceArchives)
      .values({ fingerprint: "b".repeat(64), bytes: Buffer.from("x"), byteSize: 1, mediaType: "text/html" });
    const [source] = await db
      .insert(sources)
      .values({
        corpusId: corpus!.id,
        fingerprint: "b".repeat(64),
        originalFilename: "rules.html",
        currentGeneration: 1,
        status: "ingested",
      })
      .returning();
    const content = "The grapple rule: a creature can seize another and hold it in place.";
    await db.insert(chunks).values({
      id: "chunk-grapple",
      sourceId: source!.id,
      corpusId: corpus!.id,
      generation: 1,
      chunkIndex: 0,
      content,
      sectionIds: ["sec-1"],
      anchor: { headingTrail: ["Combat"] },
      pluginName: "fixture-plugin",
      pluginVersion: "1.0.0",
      embedding: deterministicEmbedding(content),
      embeddingProvider: FIXTURE_EMBEDDING_STAMP.provider,
      embeddingModel: FIXTURE_EMBEDDING_STAMP.model,
      embeddingDimensions: FIXTURE_EMBEDDING_STAMP.dimensions,
    });

    app = await buildApp({
      db,
      pool,
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: "a".repeat(32),
      sessionCookieSecure: false,
      embedQuery: fixtureEmbedder,
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

  it("401s without a session (the global guard covers new routes too)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/retrieval/search",
      payload: { query: "grapple" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("400 invalid_input on an empty or oversized query (schema-validated)", async () => {
    const empty = await app.inject({
      method: "POST",
      url: "/api/retrieval/search",
      payload: { query: "" },
      headers: { cookie },
    });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().error.code).toBe("invalid_input");

    const oversized = await app.inject({
      method: "POST",
      url: "/api/retrieval/search",
      payload: { query: "x".repeat(2000) },
      headers: { cookie },
    });
    expect(oversized.statusCode).toBe(400);
  });

  it("200: the receipt shape — runId, config, scored/attributed results", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/retrieval/search",
      payload: { query: "grapple" },
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.runId).toBeTruthy();
    expect(body.query).toBe("grapple");
    expect(body.config).toMatchObject({ fusion: "rrf", configName: "env-default" });
    expect(body.results[0]).toMatchObject({
      rank: 1,
      chunkId: "chunk-grapple",
      generation: 1,
    });
    expect(body.results[0].content).toContain("grapple rule");
    expect(body.results[0].scores.fused).toBeGreaterThan(0);
    expect(body.timings).toHaveProperty("fts");

    // The wire response and the receipt agree (Principle III).
    const run = await app.deps.pool.query(
      "SELECT result_count FROM retrieval_runs WHERE id = $1",
      [body.runId],
    );
    expect(run.rows[0].result_count).toBe(body.results.length);
  });

  it("503 dependency_down when the embedder's dependency is unreachable, stage named", async () => {
    const downApp = await buildApp({
      db: app.deps.db,
      pool: app.deps.pool,
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: "a".repeat(32),
      sessionCookieSecure: false,
      embedQuery: async () => {
        const { DomainError } = await import("@stacks/core");
        throw new DomainError({
          class: "dependency_down",
          seam: "embed",
          message: "Embedding sidecar unreachable.",
        });
      },
      retrievalConfig: resolveRetrievalConfig({}),
    });
    await downApp.ready();
    const login = await downApp.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: PASSWORD },
    });
    const downCookie = String(login.headers["set-cookie"]).split(";")[0]!;
    const res = await downApp.inject({
      method: "POST",
      url: "/api/retrieval/search",
      payload: { query: "grapple" },
      headers: { cookie: downCookie },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("dependency_down");
    await downApp.close();
  });
});
