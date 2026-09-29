import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { asc, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { FakeProvider } from "../../src/ai/adapters/fake.js";
import { createDb, probeReachable } from "../../src/db.js";
import { ConflictError, ValidationError } from "../../src/errors.js";
import { parseDdbExport } from "../../src/library/ddb/index.js";
import { attachEmbeddings, storeParsedBook } from "../../src/library/store.js";
import {
  libraryChunks,
  libraryDocuments,
  libraryEmbeddings,
} from "../../src/schema/library.js";

/**
 * Integration tests for `storeParsedBook` (specs/013-library-schema
 * tasks.md T005, US1) against a REAL Postgres — the round-trip guarantee
 * (contracts/library-store.md invariants 1-4) depends on the database's
 * own storage and retrieval, not a fake.
 *
 * Pattern copied from events.integration.test.ts (T015 loud-skip harness).
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/library/store.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `These are the library store integration tests (spec 013 US1); a skip here proves ` +
    `NOTHING about storage/round-trip/replace behavior. Start one with: ` +
    `pnpm env:up, then set TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) {
    throw new Error(
      "library store integration tests require a reachable database",
    );
  }
  return db;
}

function readFixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/ddb/${name}`, import.meta.url)),
    "utf8",
  );
}

const basicRules = readFixture("basic-rules.html");
const bestiary = readFixture("bestiary.html");

/** A fresh book name per test — `library_documents.book` is unique. */
function freshBookName(label: string): string {
  return `${label} ${randomUUID()}`;
}

async function readChunks(documentId: string) {
  return requireDb()
    .select()
    .from(libraryChunks)
    .where(eq(libraryChunks.documentId, documentId))
    .orderBy(asc(libraryChunks.ordinal));
}

describe.skipIf(!reachable)("storeParsedBook (US1, integration)", () => {
  it("T005: stores basic-rules.html and every chunk round-trips (invariants 1, 3, 4)", async () => {
    const book = freshBookName("Basic Rules");
    const parsed = parseDdbExport({ book, pages: [basicRules] });

    const result = await storeParsedBook(requireDb(), parsed);

    expect(result.replaced).toBe(false);
    expect(result.chunkCount).toBe(parsed.blocks.length);

    const [doc] = await requireDb()
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, result.documentId));
    expect(doc.text).toBe(parsed.text);

    const chunks = await readChunks(result.documentId);
    expect(chunks).toHaveLength(parsed.blocks.length);
    chunks.forEach((chunk, i) => {
      const block = parsed.blocks[i];
      expect(chunk.ordinal).toBe(i);
      expect(chunk.kind).toBe(block.kind);
      expect(chunk.path).toEqual(block.path);
      expect(chunk.text).toBe(block.text);
      expect(chunk.startOffset).toBe(block.anchor.start);
      expect(chunk.endOffset).toBe(block.anchor.end);
      // The round-trip invariant itself (SC-001): slicing the STORED
      // document text by the STORED span reproduces the STORED chunk text.
      expect(doc.text.slice(chunk.startOffset, chunk.endOffset)).toBe(
        chunk.text,
      );
    });
  });

  it("T005: stores bestiary.html and every chunk round-trips (invariants 1, 3, 4)", async () => {
    const book = freshBookName("Bestiary");
    const parsed = parseDdbExport({ book, pages: [bestiary] });

    const result = await storeParsedBook(requireDb(), parsed);

    const chunks = await readChunks(result.documentId);
    expect(chunks).toHaveLength(parsed.blocks.length);
    chunks.forEach((chunk, i) => {
      const block = parsed.blocks[i];
      expect(chunk.kind).toBe(block.kind);
      expect(chunk.path).toEqual(block.path);
      expect(parsed.text.slice(chunk.startOffset, chunk.endOffset)).toBe(
        chunk.text,
      );
    });
  });

  it("T005: storing the same book again (different case) replaces it wholesale (invariant 2)", async () => {
    const book = freshBookName("Replace Me");
    const first = parseDdbExport({ book, pages: [basicRules] });
    const firstResult = await storeParsedBook(requireDb(), first);
    const oldChunkIds = (await readChunks(firstResult.documentId)).map(
      (c) => c.id,
    );
    expect(oldChunkIds.length).toBeGreaterThan(0);

    const second = parseDdbExport({
      book: `  ${book.toUpperCase()}  `,
      pages: [basicRules],
    });
    const secondResult = await storeParsedBook(requireDb(), second);

    expect(secondResult.replaced).toBe(true);
    expect(secondResult.documentId).not.toBe(firstResult.documentId);

    // The old document is gone entirely (cascade removed its chunks).
    const oldDoc = await requireDb()
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, firstResult.documentId));
    expect(oldDoc).toHaveLength(0);

    const newChunks = await readChunks(secondResult.documentId);
    const newChunkIds = new Set(newChunks.map((c) => c.id));
    for (const oldId of oldChunkIds) {
      expect(newChunkIds.has(oldId)).toBe(false);
    }
  });

  it("T005: a validation failure mid-book leaves the previous version intact (invariants 1, 2)", async () => {
    const book = freshBookName("Stays Intact");
    const good = parseDdbExport({ book, pages: [basicRules] });
    const goodResult = await storeParsedBook(requireDb(), good);
    const chunksBefore = await readChunks(goodResult.documentId);

    // Same book name, but corrupt one block's span deep in the list so a
    // buggy implementation that validated-then-partially-inserted would
    // still be caught.
    const bad = parseDdbExport({ book, pages: [basicRules] });
    const target = bad.blocks[bad.blocks.length - 1];
    target.anchor.end = target.anchor.start; // now empty — invalid

    await expect(storeParsedBook(requireDb(), bad)).rejects.toBeInstanceOf(
      ValidationError,
    );

    const [doc] = await requireDb()
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, goodResult.documentId));
    expect(doc).toBeDefined();
    const chunksAfter = await readChunks(goodResult.documentId);
    expect(chunksAfter).toHaveLength(chunksBefore.length);
  });
});

/** Runs `sql` with seq scans disabled and returns the EXPLAIN output as one string. */
async function explain(query: ReturnType<typeof sql>): Promise<string> {
  return requireDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL enable_seqscan = off`);
    const plan = await tx.execute(sql`EXPLAIN ${query}`);
    return (plan.rows as { "QUERY PLAN": string }[])
      .map((r) => r["QUERY PLAN"])
      .join("\n");
  });
}

describe.skipIf(!reachable)(
  "storeParsedBook — keyword search (US2, integration)",
  () => {
    // Appears in exactly one block of basic-rules.html (verified against the
    // fixture); scoped further to this test's own document below so that
    // other tests storing the same fixture text can't create a false match.
    const UNIQUE_TERM = "circumstances";

    it("T007: tsv is populated on insert and served by the GIN index (invariant 9, SC-002)", async () => {
      const book = freshBookName("Keyword Search");
      const parsed = parseDdbExport({ book, pages: [basicRules] });
      const result = await storeParsedBook(requireDb(), parsed);

      const chunks = await readChunks(result.documentId);
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        expect(chunk.tsv).toBeTruthy();
      }

      const matches = await requireDb()
        .select({ id: libraryChunks.id })
        .from(libraryChunks)
        .where(
          sql`${libraryChunks.documentId} = ${result.documentId} AND ${libraryChunks.tsv} @@ plainto_tsquery('english', ${UNIQUE_TERM})`,
        );
      expect(matches).toHaveLength(1);

      // Query-plan check (SC-002): no document filter here, so the GIN index
      // on tsv is the only index that can satisfy the `@@` operator at all.
      const plan = await explain(
        sql`SELECT id FROM library_chunks WHERE tsv @@ plainto_tsquery('english', ${UNIQUE_TERM})`,
      );
      expect(plan).toContain("library_chunks_tsv_idx");
    });
  },
);

describe.skipIf(!reachable)("attachEmbeddings (US3, integration)", () => {
  const fake = new FakeProvider();

  /** Deterministic, no-network vector (research R6) via the AI gateway's fake adapter. */
  async function vector(label: string): Promise<number[]> {
    const { vectors } = await fake.embed("probe-model", [label]);
    return vectors[0];
  }

  async function storeOneChunkBook(label: string) {
    const book = freshBookName(label);
    const parsed = parseDdbExport({ book, pages: [basicRules] });
    const result = await storeParsedBook(requireDb(), parsed);
    const chunks = await readChunks(result.documentId);
    return { documentId: result.documentId, chunkId: chunks[0].id };
  }

  async function readEmbeddings(chunkId: string) {
    return requireDb()
      .select()
      .from(libraryEmbeddings)
      .where(eq(libraryEmbeddings.chunkId, chunkId));
  }

  it("T009: two models' vectors on one chunk coexist (AC1)", async () => {
    const { chunkId } = await storeOneChunkBook("Embeddings Coexist");

    const result = await attachEmbeddings(requireDb(), [
      { chunkId, model: "a", dim: 1024, vector: await vector("model-a") },
      { chunkId, model: "b", dim: 1024, vector: await vector("model-b") },
    ]);
    expect(result.inserted).toBe(2);

    const rows = await readEmbeddings(chunkId);
    expect(rows.map((r) => r.model).sort()).toEqual(["a", "b"]);
    for (const row of rows) {
      expect(row.dim).toBe(1024);
    }
  });

  it("T009: a duplicate (chunk, model) is refused and the call writes nothing (invariant 6)", async () => {
    const { chunkId } = await storeOneChunkBook("Embeddings Duplicate");
    await attachEmbeddings(requireDb(), [
      { chunkId, model: "a", dim: 1024, vector: await vector("dup-a") },
    ]);

    await expect(
      attachEmbeddings(requireDb(), [
        { chunkId, model: "c", dim: 1024, vector: await vector("dup-c") },
        { chunkId, model: "a", dim: 1024, vector: await vector("dup-a-again") },
      ]),
    ).rejects.toBeInstanceOf(ConflictError);

    // The whole call — including the non-duplicate "c" row — wrote nothing.
    const rows = await readEmbeddings(chunkId);
    expect(rows.map((r) => r.model)).toEqual(["a"]);
  });

  it("T009: deleting a document removes its embeddings (invariant 8)", async () => {
    const { documentId, chunkId } =
      await storeOneChunkBook("Embeddings Cascade");
    await attachEmbeddings(requireDb(), [
      { chunkId, model: "a", dim: 1024, vector: await vector("cascade") },
    ]);
    expect(await readEmbeddings(chunkId)).toHaveLength(1);

    await requireDb()
      .delete(libraryDocuments)
      .where(eq(libraryDocuments.id, documentId));

    expect(await readEmbeddings(chunkId)).toHaveLength(0);
  });

  it("T009: a nearest-neighbour query restricted to one model uses the HNSW index (SC-003)", async () => {
    const { chunkId } = await storeOneChunkBook("Embeddings HNSW");
    const probeVec = await vector("hnsw-probe");
    await attachEmbeddings(requireDb(), [
      { chunkId, model: "a", dim: 1024, vector: probeVec },
    ]);
    const vecLiteral = `[${probeVec.join(",")}]`;

    // enable_bitmapscan/enable_sort are also disabled: on a tiny table the
    // planner otherwise prefers the model btree index plus an in-memory
    // sort over the (more expensive-looking, but the one under test) HNSW
    // index scan; forcing them off leaves the HNSW index as the only path.
    const plan = await requireDb().transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL enable_seqscan = off`);
      await tx.execute(sql`SET LOCAL enable_bitmapscan = off`);
      await tx.execute(sql`SET LOCAL enable_sort = off`);
      const result = await tx.execute(
        sql`EXPLAIN SELECT id FROM library_embeddings WHERE model = 'a' ORDER BY embedding <=> ${vecLiteral}::vector LIMIT 5`,
      );
      return (result.rows as { "QUERY PLAN": string }[])
        .map((r) => r["QUERY PLAN"])
        .join("\n");
    });
    expect(plan).toContain("library_embeddings_embedding_idx");
  });
});

describe.skipIf(!reachable)(
  "library immutability (Phase 5, integration)",
  () => {
    async function expectImmutableRejection(query: Promise<unknown>) {
      await expect(query).rejects.toSatisfy((err: unknown) => {
        const cause = err instanceof Error ? err.cause : undefined;
        const message = cause instanceof Error ? cause.message : String(cause);
        return /library is immutable/i.test(message);
      });
    }

    it("T011: a raw UPDATE on each of the three tables is rejected (invariant 7, SC-004)", async () => {
      const book = freshBookName("Immutable");
      const parsed = parseDdbExport({ book, pages: [basicRules] });
      const result = await storeParsedBook(requireDb(), parsed);
      const [chunk] = await readChunks(result.documentId);
      const fake = new FakeProvider();
      const { vectors } = await fake.embed("probe-model", ["immutable"]);
      await attachEmbeddings(requireDb(), [
        { chunkId: chunk.id, model: "a", dim: 1024, vector: vectors[0] },
      ]);

      await expectImmutableRejection(
        requireDb().execute(
          sql`UPDATE library_documents SET book = 'tampered' WHERE id = ${result.documentId}`,
        ),
      );
      await expectImmutableRejection(
        requireDb().execute(
          sql`UPDATE library_chunks SET text = 'tampered' WHERE id = ${chunk.id}`,
        ),
      );
      await expectImmutableRejection(
        requireDb().execute(
          sql`UPDATE library_embeddings SET model = 'tampered' WHERE chunk_id = ${chunk.id}`,
        ),
      );
    });

    it("T011: a raw DELETE of a document succeeds and cascades", async () => {
      const book = freshBookName("Deletable");
      const parsed = parseDdbExport({ book, pages: [basicRules] });
      const result = await storeParsedBook(requireDb(), parsed);
      const [chunk] = await readChunks(result.documentId);
      const fake = new FakeProvider();
      const { vectors } = await fake.embed("probe-model", ["deletable"]);
      await attachEmbeddings(requireDb(), [
        { chunkId: chunk.id, model: "a", dim: 1024, vector: vectors[0] },
      ]);

      await requireDb().execute(
        sql`DELETE FROM library_documents WHERE id = ${result.documentId}`,
      );

      const remainingChunks = await readChunks(result.documentId);
      expect(remainingChunks).toHaveLength(0);
      const remainingEmbeddings = await requireDb()
        .select()
        .from(libraryEmbeddings)
        .where(eq(libraryEmbeddings.chunkId, chunk.id));
      expect(remainingEmbeddings).toHaveLength(0);
    });
  },
);
