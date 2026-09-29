import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { FakeProvider } from "../../src/ai/adapters/fake.js";
import type { AiConfig } from "../../src/ai/config.js";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { createDb, probeReachable } from "../../src/db.js";
import type { Block, ParsedBook } from "../../src/library/ddb/index.js";
import type { RetrieveDeps } from "../../src/library/retrieve.js";
import { retrieve } from "../../src/library/retrieve.js";
import { attachEmbeddings, storeParsedBook } from "../../src/library/store.js";
import { libraryChunks } from "../../src/schema/library.js";

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

async function readChunks(documentId: string) {
  return requireDb()
    .select()
    .from(libraryChunks)
    .where(eq(libraryChunks.documentId, documentId))
    .orderBy(asc(libraryChunks.ordinal));
}

/** A gateway wired to one `fake` provider, with a single `embedding` purpose under `model`. */
function buildVectorGateway(fake: FakeProvider, model: string) {
  const config: AiConfig = {
    providers: {
      "fake-provider": { kind: "fake", baseUrl: "http://fake/embed" },
    },
    purposes: { embedding: { provider: "fake-provider", model, op: "embed" } },
    prices: {},
  };
  return createGateway({
    config,
    sink: memorySink(),
    adapters: { fake: () => fake },
  });
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

describe.skipIf(!reachable)("retrieve — vector mode (US2, integration)", () => {
  /** A deterministic 1024-dim unit-ish vector, distinct per label (research R9). */
  function vec(label: string): number[] {
    const v = new Array(1024).fill(0);
    for (let i = 0; i < label.length; i++) v[i % 1024] += label.charCodeAt(i);
    return v;
  }

  it("T011: filters by the model the gateway reports, never a chunk whose only vector is the decoy's", async () => {
    const model = `model-${randomUUID()}`;
    const decoyModel = `decoy-${randomUUID()}`;
    const questionVec = vec("question");

    const { documentId: targetDoc } = await storeBook("Vector Target", [
      "A paragraph about the target passage.",
    ]);
    const { documentId: decoyDoc } = await storeBook("Vector Decoy", [
      "A paragraph about the decoy passage.",
    ]);
    const [targetChunk] = await readChunks(targetDoc);
    const [decoyChunk] = await readChunks(decoyDoc);

    await attachEmbeddings(requireDb(), [
      { chunkId: targetChunk.id, model, dim: 1024, vector: questionVec },
    ]);
    // Decoy: identical vector (would be nearest by raw distance) but under a
    // different model — must never surface (invariant 5, US2 AC3).
    await attachEmbeddings(requireDb(), [
      {
        chunkId: decoyChunk.id,
        model: decoyModel,
        dim: 1024,
        vector: questionVec,
      },
    ]);

    const fake = new FakeProvider().scriptEmbed({ vectors: [questionVec] });
    const gateway = buildVectorGateway(fake, model);
    const deps: RetrieveDeps = {
      db: requireDb(),
      gateway,
      config: { mode: "vector", k: 8, embedPurpose: "embedding" },
    };

    const result = await retrieve(deps, { question: "anything" });

    expect(result.mode).toBe("vector");
    expect(result.embeddingModel).toBe(model);
    expect(result.passages.map((p) => p.chunkId)).toEqual([targetChunk.id]);
    expect(result.passages.every((p) => p.chunkId !== decoyChunk.id)).toBe(
      true,
    );
  });

  it("T011: makes exactly one embed call in vector mode, zero in fts mode (SC-003)", async () => {
    const model = `model-${randomUUID()}`;
    const questionVec = vec("count");
    const { documentId } = await storeBook("Vector Embed Count", [
      "A paragraph for counting embed calls.",
    ]);
    const [chunk] = await readChunks(documentId);
    await attachEmbeddings(requireDb(), [
      { chunkId: chunk.id, model, dim: 1024, vector: questionVec },
    ]);

    const fake = new FakeProvider().scriptEmbed({ vectors: [questionVec] });
    const gateway = buildVectorGateway(fake, model);

    await retrieve(
      {
        db: requireDb(),
        gateway,
        config: { mode: "vector", k: 8, embedPurpose: "embedding" },
      },
      { question: "anything" },
    );
    expect(fake.embedCalls).toHaveLength(1);

    await retrieve(
      {
        db: requireDb(),
        gateway,
        config: { mode: "fts", k: 8, embedPurpose: "embedding" },
      },
      { question: "anything" },
    );
    expect(fake.embedCalls).toHaveLength(1);
  });

  it("T011: config mode fts + request mode vector runs vector, and request k overrides config k (US2 AC4, SC-002)", async () => {
    const model = `model-${randomUUID()}`;
    const questionVec = vec("override");
    const { documentId } = await storeBook("Vector Override", [
      "First paragraph for override test.",
      "Second paragraph for override test.",
    ]);
    const chunks = await readChunks(documentId);
    await attachEmbeddings(requireDb(), [
      { chunkId: chunks[0].id, model, dim: 1024, vector: vec("override-a") },
      { chunkId: chunks[1].id, model, dim: 1024, vector: vec("override-b") },
    ]);

    const fake = new FakeProvider().scriptEmbed({ vectors: [questionVec] });
    const gateway = buildVectorGateway(fake, model);
    const deps: RetrieveDeps = {
      db: requireDb(),
      gateway,
      config: { mode: "fts", k: 8, embedPurpose: "embedding" },
    };

    const result = await retrieve(deps, {
      question: "anything",
      mode: "vector",
      k: 1,
    });

    expect(result.mode).toBe("vector");
    expect(result.passages).toHaveLength(1);
  });

  it("T011: an unknown embed purpose throws naming RETRIEVAL_EMBED_PURPOSE, with the gateway error as cause (invariant 6)", async () => {
    const gateway = createGateway({
      config: { providers: {}, purposes: {}, prices: {} },
      sink: memorySink(),
    });
    const deps: RetrieveDeps = {
      db: requireDb(),
      gateway,
      config: { mode: "vector", k: 8, embedPurpose: "embedding" },
    };

    // Sequential await of embed-then-search (retrieve.ts) means the vector
    // query never runs once embed rejects — no separate spy needed.
    await expect(retrieve(deps, { question: "anything" })).rejects.toThrow(
      /RETRIEVAL_EMBED_PURPOSE/,
    );
    await expect(
      retrieve(deps, { question: "anything" }),
    ).rejects.toMatchObject({
      cause: expect.any(Error),
    });
  });

  it("T011: EXPLAIN of the vector query names library_embeddings_embedding_idx", async () => {
    const vecLiteral = `[${vec("explain-probe").join(",")}]`;
    const plan = await requireDb().transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL enable_seqscan = off`);
      await tx.execute(sql`SET LOCAL enable_bitmapscan = off`);
      await tx.execute(sql`SET LOCAL enable_sort = off`);
      await tx.execute(sql`SET LOCAL hnsw.iterative_scan = strict_order`);
      await tx.execute(sql`SET LOCAL hnsw.ef_search = 100`);
      const result = await tx.execute(sql`
        EXPLAIN
        SELECT c.id
        FROM library_embeddings e
        JOIN library_chunks c ON c.id = e.chunk_id
        JOIN library_documents d ON d.id = c.document_id
        WHERE e.model = 'probe'
        ORDER BY e.embedding <=> ${vecLiteral}::vector, c.id ASC
        LIMIT 50
      `);
      return (result.rows as { "QUERY PLAN": string }[])
        .map((r) => r["QUERY PLAN"])
        .join("\n");
    });
    expect(plan).toContain("library_embeddings_embedding_idx");
  });
});
