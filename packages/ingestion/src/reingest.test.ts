/**
 * T048 (DB-gated): the re-ingestion domain operations (US5 AC-3, FR-016,
 * FR-023, SC-008) — NOT an HTTP endpoint (contracts/api.md's pinned
 * decision, 2026-07-07: mutation verbs are the lifecycle spec's job with its
 * own guardrails). This is the exact-candidate-enumeration + generation-N+1
 * job-enqueue seam the lifecycle spec will wrap in a guarded endpoint later.
 *
 * The generation-flip PHYSICS (replace without duplication, archive
 * untouched) is already proven exhaustively in ingest-source.test.ts; this
 * suite proves the higher-level convenience: which sources a plugin version
 * produced, and that asking to re-ingest one enqueues — not runs inline —
 * a real job at the next generation (async-only, Principle IV).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deriveArchiveFingerprint } from "@stacks/core";
import type { Database } from "@stacks/db";
import {
  chunks,
  claimNext,
  corpora,
  createDbClient,
  ensureSuiteDatabase,
  jobs,
  runMigrations,
  sourceArchives,
  sources,
} from "@stacks/db";
import { ddbSavedHtmlPlugin, markdownPlugin } from "@stacks/ingestion-plugins";
// demo-format is test-only (SC-007): reached via its own package.json subpath
// export ("./demo"), NOT the main barrel — it is deliberately absent from
// shipped.ts's registry list.
import { demoFormatPlugin } from "@stacks/ingestion-plugins/demo";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EmbedClient } from "./embed";
import type { IngestDeps } from "./ingest-source";
import { ingestSource } from "./ingest-source";
import { reingestSource, sourcesByPluginVersion } from "./reingest";
import { createRegistry } from "./registry";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";

const GOBLIN = readFileSync(
  join(__dirname, "..", "..", "ingestion-plugins", "fixtures", "ddb", "goblin-page.html"),
);
const SPELL = readFileSync(
  join(__dirname, "..", "..", "ingestion-plugins", "fixtures", "ddb", "glimmerburst-spell.html"),
);
const NOTES = readFileSync(
  join(__dirname, "..", "..", "ingestion-plugins", "fixtures", "markdown", "notes.md"),
);
const DEMO_DOC = readFileSync(
  join(__dirname, "..", "..", "ingestion-plugins", "fixtures", "demo", "sample.demo"),
);

const stubEmbedClient: EmbedClient = {
  config: { role: "embedding", provider: "stub", endpoint: "http://stub", modelId: "stub-embedder", dimensions: 3 },
  maxBatch: 64,
  embedAll: (texts) => Promise.resolve(texts.map((t) => [t.length % 7, 1, 2])),
};

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("reingest domain operations (US5 AC-3)", () => {
  let db: Database;
  let close: () => Promise<void>;
  let corpusId: string;
  let deps: IngestDeps;

  beforeAll(async () => {
    const client = createDbClient(
      // TASK-8: a database of our own — beforeEach TRUNCATEs can never race
      // another package's suite (isolation by construction, not by locking).
      await ensureSuiteDatabase(DATABASE_URL, "ingestion_reingest"),
    );
    db = client.db;
    close = () => client.pool.end();
    await runMigrations(db);
    const [corpus] = await db.select().from(corpora).where(sql`${corpora.name} = 'default'`);
    corpusId = corpus!.id;
    deps = {
      db,
      registry: createRegistry([ddbSavedHtmlPlugin, markdownPlugin]),
      embedClient: stubEmbedClient,
      chunkingParams: { targetChars: 400, overlapChars: 50, maxChars: 600 },
    };
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE TABLE ingestion_events, chunks, document_sections, sources, batches, source_archives, jobs CASCADE`,
    );
  });

  async function seedIngestedSource(bytes: Buffer, filename: string, mediaType: string) {
    const fingerprint = deriveArchiveFingerprint(bytes);
    await db.insert(sourceArchives).values({ fingerprint, bytes, byteSize: bytes.length, mediaType });
    const [source] = await db.insert(sources).values({ corpusId, fingerprint, originalFilename: filename }).returning();
    await ingestSource(deps, { sourceId: source!.id, targetGeneration: 1 });
    const [after] = await db.select().from(sources).where(sql`${sources.id} = ${source!.id}`);
    return after!;
  }

  it("enumerates EXACTLY the sources a plugin version produced, nothing else (FR-016)", async () => {
    const ddbSource1 = await seedIngestedSource(GOBLIN, "goblin.html", "text/html");
    const ddbSource2 = await seedIngestedSource(SPELL, "spell.html", "text/html");
    const mdSource = await seedIngestedSource(NOTES, "notes.md", "text/markdown");

    const ddbCandidates = await sourcesByPluginVersion(db, { pluginName: "ddb-saved-html", pluginVersion: "1.0.0" });
    expect(ddbCandidates.map((s) => s.id).sort()).toEqual([ddbSource1.id, ddbSource2.id].sort());
    expect(ddbCandidates.every((s) => s.pluginName === "ddb-saved-html" && s.pluginVersion === "1.0.0")).toBe(true);

    const mdCandidates = await sourcesByPluginVersion(db, { pluginName: "markdown", pluginVersion: "1.0.0" });
    expect(mdCandidates.map((s) => s.id)).toEqual([mdSource.id]);

    const ghostCandidates = await sourcesByPluginVersion(db, { pluginName: "markdown", pluginVersion: "9.9.9" });
    expect(ghostCandidates).toHaveLength(0);
  });

  it("enqueues a real ingest_source job at generation+1 — it does NOT run inline (Principle IV, async-only)", async () => {
    const source = await seedIngestedSource(GOBLIN, "goblin.html", "text/html");
    expect(source.currentGeneration).toBe(1);

    const job = await reingestSource(db, { sourceId: source.id });

    expect(job.kind).toBe("ingest_source");
    expect(job.payload).toMatchObject({ sourceId: source.id, targetGeneration: 2 });
    expect(job.status).toBe("queued");

    // Nothing changed yet — re-ingestion is asynchronous like every other
    // ingestion job; the source is still at generation 1 until a worker
    // claims and runs this job.
    const [stillGen1] = await db.select().from(sources).where(sql`${sources.id} = ${source.id}`);
    expect(stillGen1!.currentGeneration).toBe(1);
  });

  it("draining the enqueued job replaces derived rows with no duplication and an untouched archive (SC-008)", async () => {
    const source = await seedIngestedSource(GOBLIN, "goblin.html", "text/html");
    const gen1ChunkIds = (
      await db.select({ id: chunks.id }).from(chunks).where(sql`${chunks.sourceId} = ${source.id}`)
    ).map((r) => r.id);

    await reingestSource(db, { sourceId: source.id });
    const claimed = await claimNext(db, { workerId: "test-worker" });
    expect(claimed?.kind).toBe("ingest_source");
    const payload = claimed!.payload as { sourceId: string; targetGeneration: number };
    await ingestSource(deps, payload);
    await db.execute(sql`UPDATE jobs SET status = 'succeeded' WHERE id = ${claimed!.id}`);

    const gen2Rows = await db.select().from(chunks).where(sql`${chunks.sourceId} = ${source.id}`);
    expect(gen2Rows.length).toBeGreaterThan(0);
    expect(gen2Rows.every((r) => r.generation === 2)).toBe(true);
    expect(gen2Rows.some((r) => gen1ChunkIds.includes(r.id))).toBe(false); // no duplication — new ids, old swept

    const [after] = await db.select().from(sources).where(sql`${sources.id} = ${source.id}`);
    expect(after!.currentGeneration).toBe(2);

    const [archive] = await db
      .select()
      .from(sourceArchives)
      .where(sql`${sourceArchives.fingerprint} = ${source.fingerprint}`);
    expect(Buffer.compare(archive!.bytes, GOBLIN)).toBe(0); // untouched (FR-023)
  });

  it("T051: a plugin-version bump makes the old version's sources re-ingestion candidates, and re-ingesting adopts the new version (US5 AC-3)", async () => {
    // demo-format is deliberately test-only (never in shipped.ts, SC-007) —
    // reused here purely because it is the cheapest fixture for a version
    // bump: no HTTP round-trip, no cheerio, just a version-bumped registry.
    const demoV1 = demoFormatPlugin;
    const demoV2 = { ...demoFormatPlugin, version: "1.1.0" };
    const v1Deps: IngestDeps = { ...deps, registry: createRegistry([demoV1]) };
    const v2Deps: IngestDeps = { ...deps, registry: createRegistry([demoV2]) };

    const fingerprint = deriveArchiveFingerprint(DEMO_DOC);
    await db
      .insert(sourceArchives)
      .values({ fingerprint, bytes: DEMO_DOC, byteSize: DEMO_DOC.length, mediaType: "application/x-stacks-demo" });
    const [source] = await db
      .insert(sources)
      .values({ corpusId, fingerprint, originalFilename: "sample.demo" })
      .returning();
    await ingestSource(v1Deps, { sourceId: source!.id, targetGeneration: 1 });

    const candidates = await sourcesByPluginVersion(db, { pluginName: "demo-format", pluginVersion: "1.0.0" });
    expect(candidates.map((s) => s.id)).toEqual([source!.id]);

    const job = await reingestSource(db, { sourceId: source!.id });
    const payload = job.payload as { sourceId: string; targetGeneration: number };
    await ingestSource(v2Deps, payload); // the worker would run the CURRENT registry — v1.1.0 now

    const [after] = await db.select().from(sources).where(sql`${sources.id} = ${source!.id}`);
    expect(after!.pluginVersion).toBe("1.1.0");
    expect(after!.currentGeneration).toBe(2);

    // The old version no longer lists this source as a candidate — it moved on.
    expect(await sourcesByPluginVersion(db, { pluginName: "demo-format", pluginVersion: "1.0.0" })).toHaveLength(0);
    expect(
      (await sourcesByPluginVersion(db, { pluginName: "demo-format", pluginVersion: "1.1.0" })).map((s) => s.id),
    ).toEqual([source!.id]);
  });

  it("refuses to re-ingest a source that was never ingested (no generation to build past)", async () => {
    const fingerprint = deriveArchiveFingerprint(GOBLIN);
    await db.insert(sourceArchives).values({ fingerprint, bytes: GOBLIN, byteSize: GOBLIN.length, mediaType: "text/html" });
    const [queuedOnly] = await db.insert(sources).values({ corpusId, fingerprint, originalFilename: "goblin.html" }).returning();

    await expect(reingestSource(db, { sourceId: queuedOnly!.id })).rejects.toThrow();
  });
});
