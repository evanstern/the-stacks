/**
 * T020 (010 US3): the gold-set routes, TDD'd before they exist
 * (contracts/api.md §3). The labeling doctrine under test (research R6):
 * expected passages are referenced by CONTENT HASH resolved server-side at
 * creation, so identical re-ingests auto-heal and rewritten text flags the
 * item for re-confirmation — both DERIVED at read time. Splits are assigned
 * at creation (every 4th item heldout, deterministically) and immutable
 * afterwards: moving items after tuning began would leak choices into the
 * holdout (FR-013).
 */
import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
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

const ALIVE = "Opportunity attacks trigger when a creature leaves reach.";
const DOOMED = "This passage will be rewritten after labeling.";

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("gold-set routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let close: () => Promise<void>;
  let cookie: string;
  let sourceId: string;

  const post = (payload: unknown) =>
    app.inject({ method: "POST", url: "/api/evals/gold", payload, headers: { cookie } });

  beforeAll(async () => {
    const { db, pool } = createDbClient(
      // TASK-8: this suite's own database.
      await ensureSuiteDatabase(DATABASE_URL, "api_evals_gold"),
    );
    close = () => pool.end();
    await runMigrations(db);
    await pool.query(
      "TRUNCATE TABLE gold_items, retrieval_results, retrieval_runs, chunks, sources, source_archives, corpora CASCADE",
    );

    const [corpus] = await db.insert(corpora).values({ name: "default" }).returning();
    await db
      .insert(sourceArchives)
      .values({ fingerprint: "d".repeat(64), bytes: Buffer.from("x"), byteSize: 1, mediaType: "text/html" });
    const [source] = await db
      .insert(sources)
      .values({
        corpusId: corpus!.id,
        fingerprint: "d".repeat(64),
        originalFilename: "rules.html",
        currentGeneration: 1,
        status: "ingested",
      })
      .returning();
    sourceId = source!.id;

    const seed = (id: string, content: string, generation: number) =>
      db.insert(chunks).values({
        id,
        sourceId: source!.id,
        corpusId: corpus!.id,
        generation,
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
    await seed("chunk-alive", ALIVE, 1);
    await seed("chunk-doomed", DOOMED, 1);
    // A stale row from an older generation — not labelable.
    await seed("chunk-old-gen", "Old generation text.", 0);

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

  it("401 without a session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/evals/gold",
      payload: { question: "q", expected: [{ chunkId: "chunk-alive" }] },
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates an item: chunk resolved to {chunkId, sourceId, contentSha256} server-side", async () => {
    const res = await post({
      question: "when do opportunity attacks trigger?",
      expected: [{ chunkId: "chunk-alive" }],
    });
    expect(res.statusCode).toBe(201);
    const item = res.json();
    expect(item.split).toBe("tuning"); // first item
    expect(item.expected[0]).toEqual({
      chunkId: "chunk-alive",
      sourceId,
      contentSha256: sha(ALIVE),
    });
  });

  it("rejects a chunk that isn't current-generation (invalid_input)", async () => {
    const res = await post({ question: "q", expected: [{ chunkId: "chunk-old-gen" }] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("invalid_input");
  });

  it("assigns every 4th item to heldout deterministically; explicit split wins", async () => {
    // Items 2 and 3 (tuning), item 4 (heldout by count).
    await post({ question: "q2", expected: [{ chunkId: "chunk-alive" }] });
    await post({ question: "q3", expected: [{ chunkId: "chunk-doomed" }] });
    const fourth = await post({ question: "q4", expected: [{ chunkId: "chunk-alive" }] });
    expect(fourth.json().split).toBe("heldout");
    const explicit = await post({
      question: "q5",
      expected: [{ chunkId: "chunk-alive" }],
      split: "heldout",
    });
    expect(explicit.json().split).toBe("heldout");
  });

  it("lists items with needsReconfirmation DERIVED against the current generation", async () => {
    // Simulate the re-ingest: generation 2 keeps ALIVE verbatim (new id),
    // rewrites DOOMED, and becomes current.
    await app.deps.pool.query(
      `INSERT INTO chunks (id, source_id, corpus_id, generation, chunk_index, content, section_ids, anchor, plugin_name, plugin_version)
       SELECT 'gen2-alive', source_id, corpus_id, 2, 0, content, section_ids, anchor, plugin_name, plugin_version
       FROM chunks WHERE id = 'chunk-alive'`,
    );
    await app.deps.pool.query(
      `INSERT INTO chunks (id, source_id, corpus_id, generation, chunk_index, content, section_ids, anchor, plugin_name, plugin_version)
       SELECT 'gen2-rewritten', source_id, corpus_id, 2, 1, 'Rewritten beyond recognition.', section_ids, anchor, plugin_name, plugin_version
       FROM chunks WHERE id = 'chunk-doomed'`,
    );
    await app.deps.pool.query(`UPDATE sources SET current_generation = 2 WHERE id = $1`, [sourceId]);

    const res = await app.inject({ method: "GET", url: "/api/evals/gold", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{
      question: string;
      needsReconfirmation: boolean;
    }>;
    const byQuestion = Object.fromEntries(items.map((i) => [i.question, i.needsReconfirmation]));
    // ALIVE's hash survived into generation 2 → auto-healed, no flag.
    expect(byQuestion["when do opportunity attacks trigger?"]).toBe(false);
    // DOOMED's hash is gone → flagged for re-confirmation.
    expect(byQuestion["q3"]).toBe(true);
  });

  it("re-labels via PUT (expected replaced, updatedAt moves); split is immutable", async () => {
    const list = await app.inject({ method: "GET", url: "/api/evals/gold", headers: { cookie } });
    const flagged = (list.json().items as Array<{ id: string; question: string; split: string }>).find(
      (i) => i.question === "q3",
    )!;

    const relabel = await app.inject({
      method: "PUT",
      url: `/api/evals/gold/${flagged.id}`,
      payload: { question: "q3", expected: [{ chunkId: "gen2-rewritten" }] },
      headers: { cookie },
    });
    expect(relabel.statusCode).toBe(200);
    expect(relabel.json().needsReconfirmation).toBe(false);

    const moveSplit = await app.inject({
      method: "PUT",
      url: `/api/evals/gold/${flagged.id}`,
      payload: { question: "q3", expected: [{ chunkId: "gen2-rewritten" }], split: "heldout" },
      headers: { cookie },
    });
    expect(moveSplit.statusCode).toBe(400);
    expect(moveSplit.json().error.message).toMatch(/split/i);
  });

  it("404 unknown_thing on a missing item", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/evals/gold/00000000-0000-0000-0000-000000000000",
      payload: { question: "q", expected: [{ chunkId: "gen2-alive" }] },
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
