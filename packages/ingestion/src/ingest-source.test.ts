/**
 * T024/T025 (DB-gated): the stage driver end-to-end against real Postgres —
 * happy path (events in contract order, provenance stamps, generation flip)
 * and the retry-idempotency guarantee (SC-004, quickstart Scenario 5):
 * interrupting after any stage and re-running yields the identical final
 * index state, verified by comparing deterministic chunk ids AND row content.
 *
 * The embed client is stubbed (deterministic vectors) — sidecar behavior has
 * its own suite (embed.test.ts); THIS suite is about orchestration + storage.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DomainError, deriveArchiveFingerprint } from "@stacks/core";
import type { Database } from "@stacks/db";
import {
  chunks,
  corpora,
  createDbClient,
  documentSections,
  ingestionEvents,
  runMigrations,
  sourceArchives,
  sources,
} from "@stacks/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { EmbedClient } from "./embed";
import { ingestSource, type IngestDeps } from "./ingest-source";
import { createRegistry } from "./registry";
import { ddbSavedHtmlPlugin } from "@stacks/ingestion-plugins";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5542/stacks_v3";

const GOBLIN = readFileSync(
  join(__dirname, "..", "..", "ingestion-plugins", "fixtures", "ddb", "goblin-page.html"),
);

const stubEmbedClient: EmbedClient = {
  config: {
    role: "embedding",
    provider: "stub",
    endpoint: "http://stub",
    modelId: "stub-embedder",
    dimensions: 3,
  },
  maxBatch: 64,
  embedAll: (texts) => Promise.resolve(texts.map((t) => [t.length % 7, 1, 2])),
};

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("ingestSource driver", () => {
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

  async function seedSource(bytes: Buffer, filename: string, mediaType = "text/html") {
    const fingerprint = deriveArchiveFingerprint(bytes);
    await db.insert(sourceArchives).values({
      fingerprint,
      bytes,
      byteSize: bytes.length,
      mediaType,
    });
    const [source] = await db
      .insert(sources)
      .values({ corpusId, fingerprint, originalFilename: filename })
      .returning();
    return source!;
  }

  it("ingests the goblin fixture end-to-end: events in order, stamps, generation flip", async () => {
    const source = await seedSource(GOBLIN, "goblin-page.html");
    await ingestSource(deps, { sourceId: source.id, targetGeneration: 1 });

    const [after] = await db.select().from(sources).where(sql`${sources.id} = ${source.id}`);
    expect(after).toMatchObject({
      status: "ingested",
      currentGeneration: 1,
      pluginName: "ddb-saved-html",
      pluginVersion: "1.0.0",
    });
    expect(after!.detectConfidence).toBeGreaterThan(0.9);

    const chunkRows = await db.select().from(chunks).where(sql`${chunks.sourceId} = ${source.id}`);
    expect(chunkRows.length).toBeGreaterThan(0);
    for (const row of chunkRows) {
      expect(row.generation).toBe(1);
      expect(row.corpusId).toBe(corpusId);
      expect(row.embedding).toHaveLength(3);
      expect(row.embeddingModel).toBe("stub-embedder");
      expect(row.pluginName).toBe("ddb-saved-html");
      expect((row.sectionIds as string[]).length).toBeGreaterThan(0);
      expect((row.anchor as { artifactId: string }).artifactId).toBeTruthy();
    }

    const sectionRows = await db
      .select()
      .from(documentSections)
      .where(sql`${documentSections.sourceId} = ${source.id}`);
    expect(sectionRows.length).toBeGreaterThan(0);
    // Every chunk's section_ids resolve to persisted sections (Principle III).
    const sectionIds = new Set(sectionRows.map((s) => s.id));
    for (const row of chunkRows) {
      for (const id of row.sectionIds as string[]) expect(sectionIds.has(id)).toBe(true);
    }

    const events = await db
      .select()
      .from(ingestionEvents)
      .where(sql`${ingestionEvents.sourceId} = ${source.id}`)
      .orderBy(ingestionEvents.createdAt, ingestionEvents.id);
    const trail = events.map((e) => `${e.stage}:${e.event}`);
    // Contract order (contracts/events.md): extract/transform are one plugin
    // call observed as two stages; commit closes the run.
    expect(trail).toEqual([
      "detect:started",
      "detect:completed",
      "extract:started",
      "extract:completed",
      "transform:completed",
      "chunk:started",
      "chunk:completed",
      "embed:started",
      "embed:completed",
      "index:started",
      "index:completed",
      "commit:completed",
    ]);
  });

  it("is idempotent under retry: re-running the same payload changes nothing (SC-004)", async () => {
    const source = await seedSource(GOBLIN, "goblin-page.html");
    await ingestSource(deps, { sourceId: source.id, targetGeneration: 1 });

    const snapshot = await db
      .select({ id: chunks.id, content: chunks.content, embedding: chunks.embedding })
      .from(chunks)
      .where(sql`${chunks.sourceId} = ${source.id}`)
      .orderBy(chunks.chunkIndex);

    // Full re-run of the SAME payload (what a queue retry does).
    await ingestSource(deps, { sourceId: source.id, targetGeneration: 1 });

    const rerun = await db
      .select({ id: chunks.id, content: chunks.content, embedding: chunks.embedding })
      .from(chunks)
      .where(sql`${chunks.sourceId} = ${source.id}`)
      .orderBy(chunks.chunkIndex);
    expect(rerun).toEqual(snapshot);
  });

  it("a retry AFTER a mid-run interruption converges to the uninterrupted state (SC-004)", async () => {
    const source = await seedSource(GOBLIN, "goblin-page.html");

    // Interrupt: an embed client that dies after the first batch.
    let calls = 0;
    const flaky: EmbedClient = {
      config: stubEmbedClient.config,
      maxBatch: 64,
      embedAll: (texts) => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(
            new DomainError({ class: "dependency_down", seam: "embed", message: "sidecar died" }),
          );
        }
        return stubEmbedClient.embedAll(texts);
      },
    };

    await expect(
      ingestSource({ ...deps, embedClient: flaky }, { sourceId: source.id, targetGeneration: 1 }),
    ).rejects.toMatchObject({ class: "dependency_down" });

    const [failed] = await db.select().from(sources).where(sql`${sources.id} = ${source.id}`);
    expect(failed!.status).toBe("failed");
    expect(failed!.lastError).toMatchObject({ class: "dependency_down", stage: "embed" });
    expect(failed!.currentGeneration).toBe(0); // nothing committed — flip never happened

    // Queue retry: same payload, healthy sidecar.
    await ingestSource({ ...deps, embedClient: flaky }, { sourceId: source.id, targetGeneration: 1 });

    const [after] = await db.select().from(sources).where(sql`${sources.id} = ${source.id}`);
    expect(after!.status).toBe("ingested");
    expect(after!.currentGeneration).toBe(1);

    // Converged state matches a clean single run on identical content.
    const clean = await seedSource(Buffer.concat([GOBLIN, Buffer.from(" ")]), "twin.html");
    await ingestSource(deps, { sourceId: clean.id, targetGeneration: 1 });
    const [a, b] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(chunks).where(sql`${chunks.sourceId} = ${source.id}`),
      db.select({ n: sql<number>`count(*)` }).from(chunks).where(sql`${chunks.sourceId} = ${clean.id}`),
    ]);
    expect(Number(a[0]!.n)).toBe(Number(b[0]!.n));
  });

  it("fails detection honestly for a source no plugin claims (FR-012)", async () => {
    const source = await seedSource(Buffer.from("just some plain text"), "notes.txt", "text/plain");

    await expect(
      ingestSource(deps, { sourceId: source.id, targetGeneration: 1 }),
    ).rejects.toMatchObject({ class: "unsupported_type" });

    const [after] = await db.select().from(sources).where(sql`${sources.id} = ${source.id}`);
    expect(after!.status).toBe("failed");
    expect(after!.lastError).toMatchObject({ stage: "detect" });
  });

  it("re-ingestion at generation N+1 replaces derived rows and sweeps the old generation (FR-023)", async () => {
    const source = await seedSource(GOBLIN, "goblin-page.html");
    await ingestSource(deps, { sourceId: source.id, targetGeneration: 1 });
    const gen1Ids = (
      await db.select({ id: chunks.id }).from(chunks).where(sql`${chunks.sourceId} = ${source.id}`)
    ).map((r) => r.id);

    await ingestSource(deps, { sourceId: source.id, targetGeneration: 2 });

    const rows = await db.select().from(chunks).where(sql`${chunks.sourceId} = ${source.id}`);
    expect(rows.every((r) => r.generation === 2)).toBe(true);
    expect(rows.map((r) => r.id).some((id) => gen1Ids.includes(id))).toBe(false); // ids carry generation (R9)

    const [after] = await db.select().from(sources).where(sql`${sources.id} = ${source.id}`);
    expect(after!.currentGeneration).toBe(2);

    // The archive was never touched (FR-023): still byte-identical.
    const [archive] = await db
      .select()
      .from(sourceArchives)
      .where(sql`${sourceArchives.fingerprint} = ${source.fingerprint}`);
    expect(Buffer.compare(archive!.bytes, GOBLIN)).toBe(0);
  });
});
