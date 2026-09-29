import { sql } from "drizzle-orm";
import type { ZodError } from "zod";
import { z } from "zod";
import type { Gateway } from "../ai/gateway.js";
import type { ErrorIssue } from "../errors.js";
import { ValidationError } from "../errors.js";
import type { DbClient } from "./store.js";

/**
 * The library plane's only read path (contracts/retrieval.md): a question
 * in, anchored passages out, by vector search, keyword search, or both
 * fused with Reciprocal Rank Fusion. Consumers: the rules answerer
 * (TASK-0027) and the retrieval benchmark (TASK-0029).
 */

export type RetrievalMode = "vector" | "fts" | "hybrid";

export interface RetrievalConfig {
  mode: RetrievalMode; // RETRIEVAL_MODE
  k: number; // RETRIEVAL_K
  embedPurpose: string; // RETRIEVAL_EMBED_PURPOSE
}

export interface RetrieveDeps {
  db: DbClient;
  gateway: Pick<Gateway, "embed">;
  config: RetrievalConfig;
}

export interface RetrieveRequest {
  question: string;
  mode?: RetrievalMode; // overrides config.mode for this call only
  k?: number; // overrides config.k for this call only; integer 1..50
  signal?: AbortSignal; // passed to gateway.embed
}

/** Same shape as the parser's Anchor (library/ddb, specs/012). */
export interface PassageAnchor {
  book: string; // library_documents.book
  path: string[]; // section headings, outermost first (the citation's "section")
  start: number; // UTF-16 offset into the document text, inclusive
  end: number; // UTF-16 offset, exclusive
}

export interface SearchSignal {
  rank: number; // 1-based position in that search's own list
  score: number; // vector: cosine similarity (1 - distance); fts: ts_rank_cd
}

export interface RetrievedPassage {
  chunkId: string;
  documentId: string;
  kind: "heading" | "prose" | "list" | "table" | "statBlock" | "sidebar";
  text: string; // the exact quote: equals documentText.slice(anchor.start, anchor.end)
  anchor: PassageAnchor;
  rank: number; // 1-based position in `passages`
  score: number; // hybrid: RRF score; vector/fts: that search's own score
  vector: SearchSignal | null; // null = the vector search did not return this chunk (or did not run)
  fts: SearchSignal | null; // null = the keyword search did not return this chunk (or did not run)
}

export interface RetrievalResult {
  mode: RetrievalMode; // the mode that actually ran
  embeddingModel: string | null; // model reported by gateway.embed; null in fts mode
  candidates: { vector: number | null; fts: number | null }; // rows each search returned; null = did not run
  passages: RetrievedPassage[]; // length <= k, best first
}

// The original RRF paper's constant (Cormack, Clarke, Büttcher, SIGIR 2009)
// and the default Elasticsearch/OpenSearch/pgvector's hybrid example use
// (research R1).
// ponytail: fixed k; make it configurable when TASK-0029's benchmark shows a
// different value scores better.
export const RRF_K = 60;

// Rows fetched per search before fusion/truncation (research R7): deep
// enough that single-list hits can still surface after fusion.
// ponytail: fixed depth; make it configurable when TASK-0029 shows depth matters.
export const CANDIDATES = 50;

const RetrievalConfigSchema = z.object({
  mode: z.enum(["vector", "fts", "hybrid"]).default("hybrid"),
  k: z.coerce.number().int().min(1).max(50).default(8),
  embedPurpose: z.string().min(1).default("embedding"),
});

/**
 * Zod-parses the env (research R5). Throws naming the variable and its
 * allowed values on an invalid value; never checks `AI_PURPOSES`, so a
 * server with no AI config still starts (contract invariant 2, FR-004).
 */
export function loadRetrievalConfig(
  env: NodeJS.ProcessEnv = process.env,
): RetrievalConfig {
  const mode = RetrievalConfigSchema.shape.mode.safeParse(env.RETRIEVAL_MODE);
  if (!mode.success) {
    throw new Error('RETRIEVAL_MODE must be one of "vector", "fts", "hybrid"');
  }
  const k = RetrievalConfigSchema.shape.k.safeParse(env.RETRIEVAL_K);
  if (!k.success) {
    throw new Error("RETRIEVAL_K must be an integer between 1 and 50");
  }
  const embedPurpose = RetrievalConfigSchema.shape.embedPurpose.safeParse(
    env.RETRIEVAL_EMBED_PURPOSE,
  );
  if (!embedPurpose.success) {
    throw new Error("RETRIEVAL_EMBED_PURPOSE must be a non-empty string");
  }
  return { mode: mode.data, k: k.data, embedPurpose: embedPurpose.data };
}

/** A ranked list entry `fuseRrf` needs both to fuse (chunkId) and to tie-break (content key). */
export interface RrfCandidate {
  chunkId: string;
  book: string;
  start: number;
}

/**
 * Pure Reciprocal Rank Fusion (research R1, contract invariant 9): each
 * list holds candidates ranked best-first. A chunk's score sums
 * `1 / (rrfK + rank)` over every list it appears in; ties break by content
 * — book, then anchor start, then chunk id as a last resort for
 * exact-duplicate anchors (operator ruling 2026-09-29: `library_chunks.id`
 * is a random UUID regenerated on every ingest, so it cannot be the primary
 * tie-break — see contracts/retrieval.md). Same inputs always produce the
 * same output (SC-005).
 */
export function fuseRrf(
  lists: { vector: RrfCandidate[]; fts: RrfCandidate[] },
  rrfK: number = RRF_K,
): { chunkId: string; score: number }[] {
  const scores = new Map<string, number>();
  const keys = new Map<string, { book: string; start: number }>();
  for (const list of [lists.vector, lists.fts]) {
    list.forEach((candidate, i) => {
      const rank = i + 1;
      scores.set(
        candidate.chunkId,
        (scores.get(candidate.chunkId) ?? 0) + 1 / (rrfK + rank),
      );
      keys.set(candidate.chunkId, {
        book: candidate.book,
        start: candidate.start,
      });
    });
  }
  return [...scores.entries()]
    .map(([chunkId, score]) => ({ chunkId, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Safe: every chunkId scored above came from a list entry, which set its key.
      const ka = keys.get(a.chunkId) as { book: string; start: number };
      const kb = keys.get(b.chunkId) as { book: string; start: number };
      if (ka.book !== kb.book) return ka.book < kb.book ? -1 : 1;
      if (ka.start !== kb.start) return ka.start - kb.start;
      return a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0;
    });
}

/** Same shape as `store.ts`'s private `zodIssues` (contract T009). */
function zodIssues(error: ZodError): ErrorIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

// Only the per-request overrides are validated here (invariant 1); a
// `RetrievalConfig` field is already valid by construction (loadRetrievalConfig).
const RequestOverrideSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "question must not be empty or whitespace-only"),
  mode: z.enum(["vector", "fts", "hybrid"]).optional(),
  k: z.number().int().min(1).max(50).optional(),
});

/** One row shared by both searches (contract's `RetrievedPassage` minus the search signals). */
interface CandidateRow {
  chunkId: string;
  documentId: string;
  kind: RetrievedPassage["kind"];
  path: string[];
  text: string;
  startOffset: number;
  endOffset: number;
  book: string;
  score: number;
}

/**
 * Keyword search (research R2, contract invariant 7): `plainto_tsquery`
 * never treats question text as query syntax; its `&` is replaced with `|`
 * for OR semantics so a multi-term natural-language question doesn't need
 * every term in one chunk.
 */
async function searchFts(
  db: DbClient,
  question: string,
  limit: number,
): Promise<CandidateRow[]> {
  const result = await db.execute(sql`
    WITH q AS (
      SELECT replace(plainto_tsquery('english', ${question})::text, ' & ', ' | ')::tsquery AS query
    )
    SELECT
      c.id AS "chunkId",
      c.document_id AS "documentId",
      c.kind AS "kind",
      c.path AS "path",
      c.text AS "text",
      c.start_offset AS "startOffset",
      c.end_offset AS "endOffset",
      d.book AS "book",
      ts_rank_cd(c.tsv, q.query) AS "score"
    FROM library_chunks c
    JOIN library_documents d ON d.id = c.document_id
    CROSS JOIN q
    WHERE c.tsv @@ q.query
    ORDER BY "score" DESC, d.book ASC, c.start_offset ASC, c.id ASC
    LIMIT ${limit}
  `);
  return result.rows as unknown as CandidateRow[];
}

/**
 * Vector search (research R3): iterative HNSW scan so the `model` filter
 * doesn't silently starve the result once a second model's vectors share the
 * index. `SET LOCAL` confines the session settings to this transaction.
 */
async function searchVector(
  db: DbClient,
  model: string,
  vector: number[],
  limit: number,
): Promise<CandidateRow[]> {
  const vecLiteral = `[${vector.join(",")}]`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL hnsw.iterative_scan = strict_order`);
    await tx.execute(sql`SET LOCAL hnsw.ef_search = 100`);
    const result = await tx.execute(sql`
      SELECT
        c.id AS "chunkId",
        c.document_id AS "documentId",
        c.kind AS "kind",
        c.path AS "path",
        c.text AS "text",
        c.start_offset AS "startOffset",
        c.end_offset AS "endOffset",
        d.book AS "book",
        1 - (e.embedding <=> ${vecLiteral}::vector) AS "score"
      FROM library_embeddings e
      JOIN library_chunks c ON c.id = e.chunk_id
      JOIN library_documents d ON d.id = c.document_id
      WHERE e.model = ${model}
      ORDER BY e.embedding <=> ${vecLiteral}::vector, d.book ASC, c.start_offset ASC, c.id ASC
      LIMIT ${limit}
    `);
    return result.rows as unknown as CandidateRow[];
  });
}

/**
 * Embeds the question through the gateway (research R4, invariant 5): the
 * vector search filters by the model the gateway reports, never a name read
 * from config. An embed failure never falls back to another mode
 * (invariant 6).
 */
async function embedQuestion(
  deps: RetrieveDeps,
  question: string,
  signal?: AbortSignal,
): Promise<{ model: string; vector: number[] }> {
  let result: Awaited<ReturnType<Gateway["embed"]>>;
  try {
    result = await deps.gateway.embed({
      purpose: deps.config.embedPurpose,
      texts: [question],
      signal,
    });
  } catch (cause) {
    throw new Error(
      `RETRIEVAL_EMBED_PURPOSE "${deps.config.embedPurpose}" could not embed the question`,
      { cause },
    );
  }
  const [vector] = result.vectors;
  return { model: vector.model, vector: vector.vector };
}

function toPassage(row: CandidateRow, rank: number): RetrievedPassage {
  return {
    chunkId: row.chunkId,
    documentId: row.documentId,
    kind: row.kind,
    text: row.text,
    anchor: {
      book: row.book,
      path: row.path,
      start: row.startOffset,
      end: row.endOffset,
    },
    rank,
    score: row.score,
    vector: null,
    fts: null,
  };
}

/** `fts`/`vector` modes: DB order is already best-first; `score` is that search's own score. */
function assembleSingle(
  mode: "fts" | "vector",
  embeddingModel: string | null,
  rows: CandidateRow[],
  k: number,
): RetrievalResult {
  const passages = rows.slice(0, k).map((row, i) => {
    const passage = toPassage(row, i + 1);
    const signal: SearchSignal = { rank: i + 1, score: row.score };
    if (mode === "fts") passage.fts = signal;
    else passage.vector = signal;
    return passage;
  });
  return {
    mode,
    embeddingModel,
    candidates: {
      vector: mode === "vector" ? rows.length : null,
      fts: mode === "fts" ? rows.length : null,
    },
    passages,
  };
}

/** `hybrid` mode: order and `score` come from `fuseRrf`; each search's own rank/score is preserved as its signal. */
function assembleHybrid(
  embeddingModel: string,
  vectorRows: CandidateRow[],
  ftsRows: CandidateRow[],
  k: number,
): RetrievalResult {
  const rowById = new Map<string, CandidateRow>();
  const signalsOf = (rows: CandidateRow[]) => {
    const signals = new Map<string, SearchSignal>();
    rows.forEach((row, i) => {
      rowById.set(row.chunkId, row);
      signals.set(row.chunkId, { rank: i + 1, score: row.score });
    });
    return signals;
  };
  const vectorSignals = signalsOf(vectorRows);
  const ftsSignals = signalsOf(ftsRows);

  const toCandidate = (r: CandidateRow): RrfCandidate => ({
    chunkId: r.chunkId,
    book: r.book,
    start: r.startOffset,
  });
  const fused = fuseRrf({
    vector: vectorRows.map(toCandidate),
    fts: ftsRows.map(toCandidate),
  });

  const passages = fused.slice(0, k).map(({ chunkId, score }, i) => {
    // Safe: every fused id comes from vectorRows/ftsRows, both of which fed rowById.
    const row = rowById.get(chunkId) as CandidateRow;
    const passage = toPassage(row, i + 1);
    passage.score = score;
    passage.vector = vectorSignals.get(chunkId) ?? null;
    passage.fts = ftsSignals.get(chunkId) ?? null;
    return passage;
  });

  return {
    mode: "hybrid",
    embeddingModel,
    candidates: { vector: vectorRows.length, fts: ftsRows.length },
    passages,
  };
}

/**
 * The library plane's only read path (contracts/retrieval.md). Validates the
 * request (invariant 1), then runs `fts`, `vector`, or both fused by
 * `fuseRrf` (invariant 8), per the resolved mode. Never writes to the
 * database (invariant 10).
 */
export async function retrieve(
  deps: RetrieveDeps,
  req: RetrieveRequest,
): Promise<RetrievalResult> {
  const parsed = RequestOverrideSchema.safeParse({
    question: req.question,
    mode: req.mode,
    k: req.k,
  });
  if (!parsed.success) throw new ValidationError(zodIssues(parsed.error));
  const { question } = parsed.data;
  const mode = parsed.data.mode ?? deps.config.mode;
  const k = parsed.data.k ?? deps.config.k;

  if (mode === "fts") {
    const rows = await searchFts(deps.db, question, CANDIDATES);
    return assembleSingle("fts", null, rows, k);
  }

  if (mode === "vector") {
    const { model, vector } = await embedQuestion(deps, question, req.signal);
    const rows = await searchVector(deps.db, model, vector, CANDIDATES);
    return assembleSingle("vector", model, rows, k);
  }

  // hybrid: the keyword query runs concurrently with the embed call; the
  // vector search itself needs the embedded vector, so it waits for it.
  const [embedded, ftsRows] = await Promise.all([
    embedQuestion(deps, question, req.signal),
    searchFts(deps.db, question, CANDIDATES),
  ]);
  const vectorRows = await searchVector(
    deps.db,
    embedded.model,
    embedded.vector,
    CANDIDATES,
  );
  return assembleHybrid(embedded.model, vectorRows, ftsRows, k);
}
