/**
 * T027 + T029 (DB-gated): the mixed-ZIP expand handler and the end-to-end
 * pipeline — admit the fixture ZIP, run expand, drain the resulting
 * ingest_source jobs through the real driver (stub embed), then run the
 * SC-001 traceability assertions: every chunk under the current generation
 * anchors into a persisted artifact; the .dat entry is skipped with a reason.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Database } from "@stacks/db";
import {
  batches,
  chunks,
  claimNext,
  corpora,
  createDbClient,
  documentSections,
  ingestionEvents,
  jobs,
  runMigrations,
  sources,
} from "@stacks/db";
import type { EmbedClient } from "@stacks/ingestion";
import { admitBatch, createShippedRegistry, ingestSource } from "@stacks/ingestion";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ingestBatchExpandHandler } from "../src/handlers/ingest-batch-expand";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";

const MIXED_ZIP = readFileSync(
  join(__dirname, "..", "..", "..", "packages", "ingestion-plugins", "fixtures", "zips", "export-mixed.zip"),
);
const EMPTY_ZIP = readFileSync(
  join(__dirname, "..", "..", "..", "packages", "ingestion-plugins", "fixtures", "zips", "export-empty.zip"),
);

const stubEmbedClient: EmbedClient = {
  config: { role: "embedding", provider: "stub", endpoint: "http://stub", modelId: "stub-embedder", dimensions: 3 },
  maxBatch: 64,
  embedAll: (texts) => Promise.resolve(texts.map((t) => [t.length % 5, 2, 3])),
};

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("mixed-ZIP expand -> pipeline e2e", () => {
  let db: Database;
  let close: () => Promise<void>;
  let corpusId: string;

  beforeAll(async () => {
    const client = createDbClient(DATABASE_URL);
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
    const [corpus] = await db.select().from(corpora).where(sql`${corpora.name} = 'default'`);
    corpusId = corpus!.id;
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE TABLE ingestion_events, chunks, document_sections, sources, batches, source_archives, jobs CASCADE`,
    );
  });

  it("expands the mixed ZIP: 2 DDB pages ingested, markdown queued-but-unclaimed, .dat skipped (US1 AC-4, US3 AC-4)", async () => {
    const { batch } = await admitBatch(db, {
      corpusId,
      filename: "export-mixed.zip",
      bytes: MIXED_ZIP,
    });
    await ingestBatchExpandHandler(db, {
      payload: { batchId: batch.id },
    } as never);

    const [after] = await db.select().from(batches).where(sql`${batches.id} = ${batch.id}`);
    expect(after!.status).toBe("expanded");

    const report = after!.entryReport as Array<{ name: string; outcome: string; reason?: string }>;
    const byName = Object.fromEntries(report.map((entry) => [entry.name, entry]));
    // notes.md IS admitted (sniffs as markdown) — no markdown plugin is
    // shipped yet (that's US4), so its ingest JOB will fail detection later;
    // admission is type-level, ownership is detect-level. The .dat is the
    // per-entry honest skip.
    expect(byName["grumble.html"]!.outcome).toBe("ingested");
    expect(byName["glimmerburst.html"]!.outcome).toBe("ingested");
    expect(byName["notes.md"]!.outcome).toBe("ingested");
    expect(byName["blob.dat"]).toMatchObject({ outcome: "skipped", reason: "unsupported entry type" });

    // The skip is also in the batch's append-only trail (contracts/events.md).
    const skipEvents = await db
      .select()
      .from(ingestionEvents)
      .where(sql`${ingestionEvents.batchId} = ${batch.id} AND ${ingestionEvents.event} = 'skipped'`);
    expect(skipEvents).toHaveLength(1);
    expect(skipEvents[0]!.detail).toMatchObject({ entryName: "blob.dat" });
  });

  it("runs the full pipeline over the expanded batch: DDB sources indexed and 100% anchor-traceable (SC-001)", async () => {
    const { batch } = await admitBatch(db, { corpusId, filename: "export-mixed.zip", bytes: MIXED_ZIP });
    await ingestBatchExpandHandler(db, { payload: { batchId: batch.id } } as never);

    // US4 shipped the markdown fallback: notes.md now ingests instead of
    // failing detection (all three admitted entries — 2 DDB pages + 1
    // markdown — have an owning plugin).
    let ingested = 0;
    let detectFailures = 0;
    const deps = {
      db,
      registry: createShippedRegistry(),
      embedClient: stubEmbedClient,
      chunkingParams: { targetChars: 800, overlapChars: 80, maxChars: 1200 },
    };
    for (;;) {
      const job = await claimNext(db, { workerId: "test-worker" });
      if (!job) break;
      if (job.kind === "ingest_batch_expand") {
        // Already executed directly above — retire its queue row and move on.
        await db.execute(sql`UPDATE jobs SET status = 'succeeded' WHERE id = ${job.id}`);
        continue;
      }
      const payload = job.payload as { sourceId: string; targetGeneration: number };
      try {
        await ingestSource(deps, payload);
        ingested += 1;
      } catch {
        detectFailures += 1;
      }
      await db.execute(sql`UPDATE jobs SET status = 'succeeded' WHERE id = ${job.id}`);
    }
    expect(ingested).toBe(3);
    expect(detectFailures).toBe(0);

    // SC-001 zero-orphan traceability: every current-generation chunk's anchor
    // names an artifact persisted with its sections.
    const orphanCount = await db.execute<{ n: string }>(sql`
      SELECT count(*) AS n
      FROM chunks c
      JOIN sources s ON s.id = c.source_id
      WHERE c.generation = s.current_generation
        AND NOT EXISTS (
          SELECT 1 FROM document_sections ds
          WHERE ds.source_id = c.source_id
            AND ds.generation = c.generation
            AND ds.anchor->>'artifactId' = c.anchor->>'artifactId'
        )
    `);
    expect(Number(orphanCount.rows[0]!.n)).toBe(0);

    const ingestedSources = await db
      .select()
      .from(sources)
      .where(sql`${sources.batchId} = ${batch.id} AND ${sources.status} = 'ingested'`);
    expect(ingestedSources).toHaveLength(3);
    const byFilename = Object.fromEntries(ingestedSources.map((s) => [s.originalFilename, s]));
    expect(byFilename["grumble.html"]!.pluginName).toBe("ddb-saved-html");
    expect(byFilename["glimmerburst.html"]!.pluginName).toBe("ddb-saved-html");
    expect(byFilename["notes.md"]!.pluginName).toBe("markdown");
    for (const source of ingestedSources) {
      expect(source.currentGeneration).toBe(1);
    }
  });

  it("all-unsupported ZIP lands on the honest `empty` status, not `failed` (T041, US3 AC-4)", async () => {
    const { batch } = await admitBatch(db, { corpusId, filename: "export-empty.zip", bytes: EMPTY_ZIP });
    await ingestBatchExpandHandler(db, { payload: { batchId: batch.id } } as never);

    const [after] = await db.select().from(batches).where(sql`${batches.id} = ${batch.id}`);
    expect(after!.status).toBe("empty");

    const report = after!.entryReport as Array<{ name: string; outcome: string; reason?: string }>;
    expect(report).toHaveLength(2);
    expect(report.every((entry) => entry.outcome === "skipped")).toBe(true);

    const skipEvents = await db
      .select()
      .from(ingestionEvents)
      .where(sql`${ingestionEvents.batchId} = ${batch.id} AND ${ingestionEvents.event} = 'skipped'`);
    expect(skipEvents).toHaveLength(2);
  });

  it("duplicate ZIP submission returns the existing batch, writes nothing new (FR-003)", async () => {
    const first = await admitBatch(db, { corpusId, filename: "export-mixed.zip", bytes: MIXED_ZIP });
    const second = await admitBatch(db, { corpusId, filename: "renamed.zip", bytes: MIXED_ZIP });

    expect(second.duplicate).toBe(true);
    expect(second.batch.id).toBe(first.batch.id);

    const jobRows = await db.select().from(jobs).where(sql`${jobs.kind} = 'ingest_batch_expand'`);
    expect(jobRows).toHaveLength(1); // no second expand job
  });
});
