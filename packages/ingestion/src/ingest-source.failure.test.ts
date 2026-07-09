/**
 * T034/T036 (DB-gated): failure legibility and the append-only guarantee —
 * a source that a plugin CLAIMS but cannot transform fails with a scrubbed,
 * cause-typed lastError at the right stage; retries append (never rewrite)
 * their events; and a terminal trail re-reads byte-identical (US2 AC-3,
 * SC-006).
 */
import { deriveArchiveFingerprint } from "@stacks/core";
import type { Database } from "@stacks/db";
import {
  corpora,
  createDbClient,
  ingestionEvents,
  runMigrations,
  sourceArchives,
  sources,
} from "@stacks/db";
import { ddbSavedHtmlPlugin } from "@stacks/ingestion-plugins";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EmbedClient } from "./embed";
import { ingestSource, type IngestDeps } from "./ingest-source";
import { createRegistry } from "./registry";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";

// Claimed-but-untransformable: DDB signals present (saved-from marker,
// article body) so detect says ~0.95, but every heading is body-less, so
// transform finds zero extractable sections -> PluginError("malformed").
const CLAIMED_BUT_EMPTY = Buffer.from(`<!DOCTYPE html>
<!-- saved from url=(0048)https://www.dndbeyond.com/monsters/99999-hollow -->
<html><head><title>Hollow Page</title></head>
<body><main><article><h1>Hollow Page</h1></article></main></body></html>`);

const stubEmbedClient: EmbedClient = {
  config: { role: "embedding", provider: "stub", endpoint: "http://stub", modelId: "stub", dimensions: 3 },
  maxBatch: 64,
  embedAll: (texts) => Promise.resolve(texts.map(() => [1, 2, 3])),
};

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("failure legibility + append-only trail", () => {
  let db: Database;
  let close: () => Promise<void>;
  let corpusId: string;
  let deps: IngestDeps;

  beforeAll(async () => {
    const client = createDbClient(DATABASE_URL);
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
    const [corpus] = await db.select().from(corpora).where(sql`${corpora.name} = 'default'`);
    corpusId = corpus!.id;
    deps = {
      db,
      registry: createRegistry([ddbSavedHtmlPlugin]),
      embedClient: stubEmbedClient,
      chunkingParams: { targetChars: 400, overlapChars: 50, maxChars: 600 },
    };
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE TABLE ingestion_events, chunks, document_sections, sources, batches, source_archives CASCADE`,
    );
  });

  async function seedFailingSource() {
    const fingerprint = deriveArchiveFingerprint(CLAIMED_BUT_EMPTY);
    await db.insert(sourceArchives).values({
      fingerprint,
      bytes: CLAIMED_BUT_EMPTY,
      byteSize: CLAIMED_BUT_EMPTY.length,
      mediaType: "text/html",
    });
    const [source] = await db
      .insert(sources)
      .values({ corpusId, fingerprint, originalFilename: "hollow.html" })
      .returning();
    return source!;
  }

  it("stamps a scrubbed, stage-attributed lastError when the claimed transform fails (US2 AC-2)", async () => {
    const source = await seedFailingSource();

    await expect(
      ingestSource(deps, { sourceId: source.id, targetGeneration: 1 }),
    ).rejects.toMatchObject({ class: "unsupported_type" });

    const [after] = await db.select().from(sources).where(sql`${sources.id} = ${source.id}`);
    expect(after!.status).toBe("failed");
    expect(after!.lastError).toMatchObject({
      class: "unsupported_type",
      stage: "extract",
    });
    // Scrubbed = human-readable cause, no stack traces or internals.
    const message = (after!.lastError as { message: string }).message;
    expect(message).toMatch(/extractable/i);
    expect(message).not.toMatch(/\bat\s+\w+\.\w+\s*\(/); // no stack frames

    // The failed extract event carries the PluginError category (events.md).
    const events = await db
      .select()
      .from(ingestionEvents)
      .where(sql`${ingestionEvents.sourceId} = ${source.id} AND ${ingestionEvents.event} = 'failed'`);
    expect(events).toHaveLength(1);
    expect(events[0]!.detail).toMatchObject({ category: "malformed" });
    expect(events[0]!.ok).toBe(false);
  });

  it("retries APPEND their events — attempts are history, never rewritten (SC-006)", async () => {
    const source = await seedFailingSource();

    for (let attempt = 0; attempt < 2; attempt++) {
      await ingestSource(deps, { sourceId: source.id, targetGeneration: 1 }).catch(() => undefined);
    }

    const trail = await db
      .select()
      .from(ingestionEvents)
      .where(sql`${ingestionEvents.sourceId} = ${source.id}`)
      .orderBy(ingestionEvents.createdAt, ingestionEvents.id);
    // Two attempts, each: detect started/completed + extract started/failed.
    expect(trail.map((e) => `${e.stage}:${e.event}`)).toEqual([
      "detect:started",
      "detect:completed",
      "extract:started",
      "extract:failed",
      "detect:started",
      "detect:completed",
      "extract:started",
      "extract:failed",
    ]);
  });

  it("a terminal trail re-reads identically later (US2 AC-3)", async () => {
    const source = await seedFailingSource();
    await ingestSource(deps, { sourceId: source.id, targetGeneration: 1 }).catch(() => undefined);

    const read = () =>
      db
        .select()
        .from(ingestionEvents)
        .where(sql`${ingestionEvents.sourceId} = ${source.id}`)
        .orderBy(ingestionEvents.createdAt, ingestionEvents.id);

    const first = await read();
    const second = await read();
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });
});
