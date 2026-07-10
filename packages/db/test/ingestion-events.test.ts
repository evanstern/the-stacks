/**
 * T012 (DB-gated): the ingestion_events writer and — because runMigrations
 * applies 0002 here — the whole ingestion migration: generated fts column,
 * CHECK constraints, the seeded default corpus, and the append-only scope
 * rule. Requires the compose Postgres (docker-compose.yml) at DATABASE_URL.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "../src/client";
import { createDbClient } from "../src/client";
import { ensureSuiteDatabase } from "../src/test-db";
import { recordIngestionEvent } from "../src/ingestion-events";
import { runMigrations } from "../src/migrate";
import { corpora, ingestionEvents, sourceArchives, sources } from "../src/schema/ingestion";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3";

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("ingestion events + migration", () => {
  let db: Database;
  let close: () => Promise<void>;
  let corpusId: string;
  let sourceId: string;

  beforeAll(async () => {
    const client = createDbClient(
      // TASK-8: a database of our own — beforeEach TRUNCATEs can never race
      // another package's suite (isolation by construction, not by locking).
      await ensureSuiteDatabase(DATABASE_URL, "db_ingestion_events"),
    );
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);

    const [corpus] = await db.select().from(corpora).where(sql`${corpora.name} = 'default'`);
    // The 0002 migration seeds the single live corpus (D4/FR-022).
    expect(corpus).toBeDefined();
    corpusId = corpus!.id;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE TABLE ingestion_events, chunks, document_sections, sources, batches, source_archives CASCADE`,
    );
    const fingerprint = "f".repeat(64);
    await db.insert(sourceArchives).values({
      fingerprint,
      bytes: Buffer.from("<html>fixture</html>"),
      byteSize: 20,
      mediaType: "text/html",
    });
    const [source] = await db
      .insert(sources)
      .values({ corpusId, fingerprint, originalFilename: "fixture.html" })
      .returning();
    sourceId = source!.id;
  });

  it("records an event with ok defaulting by event kind", async () => {
    await recordIngestionEvent(db, { sourceId, stage: "detect", event: "started" });
    await recordIngestionEvent(db, {
      sourceId,
      stage: "detect",
      event: "failed",
      detail: { class: "unsupported_type" },
    });

    const rows = await db
      .select()
      .from(ingestionEvents)
      .orderBy(ingestionEvents.createdAt);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ stage: "detect", event: "started", ok: true });
    expect(rows[1]).toMatchObject({ event: "failed", ok: false, detail: { class: "unsupported_type" } });
  });

  it("rejects an event scoped to neither source nor batch (table CHECK)", async () => {
    await expect(
      recordIngestionEvent(db, { stage: "intake", event: "completed" }),
    ).rejects.toThrow(/ingestion_events_scope_check/);
  });

  it("rejects unknown stages and event kinds (vocabulary CHECKs)", async () => {
    await expect(
      db.execute(
        sql`INSERT INTO ingestion_events (source_id, stage, event, ok) VALUES (${sourceId}, 'teleport', 'completed', true)`,
      ),
    ).rejects.toThrow(/ingestion_events_stage_check/);
    await expect(
      db.execute(
        sql`INSERT INTO ingestion_events (source_id, stage, event, ok) VALUES (${sourceId}, 'detect', 'exploded', true)`,
      ),
    ).rejects.toThrow(/ingestion_events_event_check/);
  });

  it("chunks: the generated fts column tracks content, and the embedding stamp CHECK holds", async () => {
    const chunkId = "c".repeat(64);
    await db.execute(
      sql`INSERT INTO chunks (id, source_id, corpus_id, generation, chunk_index, content, section_ids, anchor, plugin_name, plugin_version)
          VALUES (${chunkId}, ${sourceId}, ${corpusId}, 1, 0, 'goblins ambush the caravan', '[]'::jsonb, '{}'::jsonb, 'test', '1.0.0')`,
    );
    // GENERATED ALWAYS AS: the DB itself maintains fts from content (R5).
    const match = await db.execute(
      sql`SELECT id FROM chunks WHERE fts @@ websearch_to_tsquery('english', 'goblin ambush')`,
    );
    expect(match.rows).toHaveLength(1);

    // FR-020 structurally: an embedding without its identity stamp is unrepresentable.
    await expect(
      db.execute(
        sql`UPDATE chunks SET embedding = '[1,2,3]' WHERE id = ${chunkId}`,
      ),
    ).rejects.toThrow(/chunks_embedding_stamp_check/);
  });

  it("sources: content dedupe is per corpus and by fingerprint (unique index)", async () => {
    await expect(
      db
        .insert(sources)
        .values({ corpusId, fingerprint: "f".repeat(64), originalFilename: "renamed.html" }),
    ).rejects.toThrow(/sources_corpus_fingerprint_idx/);
  });
});
