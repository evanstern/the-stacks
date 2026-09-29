import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../../src/db.js";
import { ValidationError } from "../../src/errors.js";
import { parseDdbExport } from "../../src/library/ddb/index.js";
import { storeParsedBook } from "../../src/library/store.js";
import { libraryChunks, libraryDocuments } from "../../src/schema/library.js";

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
