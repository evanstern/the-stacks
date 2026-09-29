import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../../src/db.js";
import type { Block, ParsedBook } from "../../src/library/ddb/index.js";
import type { RetrieveDeps } from "../../src/library/retrieve.js";
import { retrieve } from "../../src/library/retrieve.js";
import { storeParsedBook } from "../../src/library/store.js";

/**
 * Integration tests for `retrieve` (specs/015-hybrid-retrieval/tasks.md
 * T008, T011, T013) against a REAL Postgres — RRF fusion and index usage
 * depend on the database's own query planner, not a fake.
 *
 * Pattern copied from store.integration.test.ts (loud-skip harness).
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/library/retrieve.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `These are the retrieval integration tests (spec 015); a skip here proves NOTHING about ` +
    `search or fusion behavior. Start one with: pnpm env:up, then set ` +
    `TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) {
    throw new Error("retrieve integration tests require a reachable database");
  }
  return db;
}

/** A fresh, unique book name per test — `library_documents.book` is unique. */
function freshBookName(label: string): string {
  return `${label} ${randomUUID()}`;
}

/** A nonce word per test (research R9): keyword-isolates results from other suites. */
function nonceWord(): string {
  return `nonce${randomUUID().replace(/-/g, "")}`;
}

/** Builds a small synthetic `ParsedBook`: one prose block per paragraph, correctly anchored. */
function makeBook(book: string, paragraphs: string[]): ParsedBook {
  let text = "";
  const blocks: Block[] = paragraphs.map((p, i) => {
    if (i > 0) text += "\n\n";
    const start = text.length;
    text += p;
    const end = text.length;
    const path = [`Section ${i + 1}`];
    return {
      kind: "prose" as const,
      path,
      text: p,
      anchor: { book, path, start, end },
    };
  });
  return { book, text, blocks };
}

async function storeBook(label: string, paragraphs: string[]) {
  const book = freshBookName(label);
  const parsed = makeBook(book, paragraphs);
  const result = await storeParsedBook(requireDb(), parsed);
  return { book, parsed, documentId: result.documentId };
}

/** A gateway double that fails the test if `embed` is ever called (invariant 4). */
const untouchableGateway: RetrieveDeps["gateway"] = {
  embed() {
    throw new Error("must not call gateway.embed");
  },
};

function ftsDeps(k = 8): RetrieveDeps {
  return {
    db: requireDb(),
    gateway: untouchableGateway,
    config: { mode: "fts", k, embedPurpose: "embedding" },
  };
}

/** Runs `query` with seq scans disabled and returns the EXPLAIN output as one string. */
async function explain(query: ReturnType<typeof sql>): Promise<string> {
  return requireDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL enable_seqscan = off`);
    const plan = await tx.execute(sql`EXPLAIN ${query}`);
    return (plan.rows as { "QUERY PLAN": string }[])
      .map((r) => r["QUERY PLAN"])
      .join("\n");
  });
}

describe.skipIf(!reachable)("retrieve — fts mode (US1, integration)", () => {
  it("T008: the nonce-word passage ranks first and its span slices back to its text", async () => {
    const nonce = nonceWord();
    const { parsed } = await storeBook("Fts Ranking", [
      `A paragraph about ${nonce} and grappling rules.`,
      "An unrelated paragraph about something else entirely.",
      "Another unrelated paragraph about a different topic.",
    ]);

    const result = await retrieve(ftsDeps(), { question: nonce });

    expect(result.mode).toBe("fts");
    expect(result.embeddingModel).toBeNull();
    expect(result.candidates.vector).toBeNull();
    expect(result.candidates.fts).toBeGreaterThan(0);
    expect(result.passages.length).toBeGreaterThan(0);
    const top = result.passages[0];
    expect(top.text).toContain(nonce);
    expect(top.fts).not.toBeNull();
    expect(top.vector).toBeNull();

    for (const passage of result.passages) {
      expect(passage.anchor.book).toBe(parsed.book);
      expect(Array.isArray(passage.anchor.path)).toBe(true);
      expect(passage.kind).toBe("prose");
      expect(parsed.text.slice(passage.anchor.start, passage.anchor.end)).toBe(
        passage.text,
      );
    }
  });

  it("T008: a question matching nothing returns passages: []", async () => {
    const nonce = nonceWord();
    await storeBook("Fts No Match", [`Content about ${nonce}.`]);

    const result = await retrieve(ftsDeps(), { question: nonceWord() });

    expect(result.passages).toEqual([]);
    expect(result.candidates.fts).toBe(0);
  });

  it("T008: query-syntax characters in the question never throw (invariant 7)", async () => {
    const nonce = nonceWord();
    await storeBook("Fts Syntax Chars", [`Content about ${nonce}.`]);

    await expect(
      retrieve(ftsDeps(), { question: `${nonce} & | ! ( ) : * '` }),
    ).resolves.not.toThrow();
  });

  it("T008: a stop-word-only question returns []", async () => {
    const nonce = nonceWord();
    await storeBook("Fts Stop Words", [`Content about ${nonce}.`]);

    const result = await retrieve(ftsDeps(), { question: "the a an of" });

    expect(result.passages).toEqual([]);
  });

  it("T008: EXPLAIN of the keyword query names library_chunks_tsv_idx", async () => {
    const plan = await explain(sql`
      WITH q AS (
        SELECT replace(plainto_tsquery('english', 'grapple')::text, ' & ', ' | ')::tsquery AS query
      )
      SELECT c.id
      FROM library_chunks c
      JOIN library_documents d ON d.id = c.document_id
      CROSS JOIN q
      WHERE c.tsv @@ q.query
      ORDER BY ts_rank_cd(c.tsv, q.query) DESC, c.id ASC
      LIMIT 50
    `);
    expect(plan).toContain("library_chunks_tsv_idx");
  });
});
