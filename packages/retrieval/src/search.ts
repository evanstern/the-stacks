/**
 * The hybrid search engine (spec 010 US1). One query fans out to the two
 * signals 008 indexed on every chunk — the generated FTS tsvector and the
 * pgvector embedding — both read STRICTLY under the reader predicate
 * (chunks.generation = sources.current_generation, FR-002), fused by the
 * pure math in fusion.ts, and recorded as an append-only receipt before the
 * caller sees a single result (Principle III: the answer IS the record).
 *
 * The query embedder is INJECTED (QueryEmbedder): apps/api wires the real
 * sidecar client; tests and the deterministic eval slice wire fixture
 * vectors. Before comparing anything, the engine samples the index's
 * embedding stamp and refuses a space mismatch (research R4) — Principle
 * VII's "structurally detectable" promise, enforced on the read path with
 * both stamps named in the message.
 *
 * Stage order: stamp check → embed → FTS ∥ vector → fuse → (rerank, US5) →
 * record. Timings per stage land on the receipt; a skipped stage records
 * null, never a fake zero.
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

import { DomainError } from "@stacks/core";
import {
  recordRetrievalRun,
  type Database,
  type RetrievalResultLine,
} from "@stacks/db";

import type { ResolvedRetrievalConfig } from "./config";
import { fuse, type SignalCandidate } from "./fusion";
import type { RerankScorer } from "./rerank-client";

export type { RerankScorer } from "./rerank-client";

export type QueryEmbedder = (text: string) => Promise<{
  vector: number[];
  provider: string;
  model: string;
  dimensions: number;
}>;

export interface SearchDeps {
  db: Database;
  embedQuery: QueryEmbedder;
  /** Required when config.rerank is on; its absence then is a WIRING bug
   *  (internal_fault), never a silent skip — FR-021. */
  rerank?: RerankScorer;
}

export interface SearchInput {
  corpusId: string;
  query: string;
  config: ResolvedRetrievalConfig;
  origin?: "interactive" | "eval";
}

export interface CompletedSearch {
  runId: string;
  query: string;
  config: ResolvedRetrievalConfig;
  results: RetrievalResultLine[];
  stageTimings: Record<string, number | null>;
}

/** Everything a result line needs, fetched once per candidate row. The
 *  index signature satisfies drizzle's execute<T> row constraint. */
interface CandidateRow extends Record<string, unknown> {
  id: string;
  source_id: string;
  generation: number;
  content: string;
  anchor: unknown;
  section_ids: unknown;
  score: number;
}

export const QUERY_MAX_CHARS = 1024;

export async function searchCorpus(
  deps: SearchDeps,
  input: SearchInput,
): Promise<CompletedSearch> {
  const { db } = deps;
  const { corpusId, config } = input;
  const query = input.query.trim();
  if (query.length === 0 || query.length > QUERY_MAX_CHARS) {
    throw new DomainError({
      class: "invalid_input",
      message: `Query must be 1..${QUERY_MAX_CHARS} characters after trimming.`,
    });
  }

  const timings: Record<string, number | null> = {
    embed: null,
    fts: null,
    vector: null,
    fusion: null,
    rerank: null,
  };
  const timed = async <T>(stage: string, work: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      return await work();
    } finally {
      timings[stage] = Math.round(performance.now() - start);
    }
  };

  // The index's embedding stamp, sampled from ONE current-generation row.
  // Stamps are uniform per index by 008's CHECK constraint + single role.
  const stampRows = await db.execute<{
    embedding_provider: string;
    embedding_model: string;
    embedding_dimensions: number;
  }>(sql`
    SELECT c.embedding_provider, c.embedding_model, c.embedding_dimensions
    FROM chunks c JOIN sources s ON s.id = c.source_id
    WHERE c.corpus_id = ${corpusId}
      AND c.embedding IS NOT NULL
      AND c.generation = s.current_generation
    LIMIT 1
  `);
  const indexStamp = stampRows.rows[0] ?? null;

  let queryStamp: Awaited<ReturnType<QueryEmbedder>> | null = null;
  let vectorCandidateRows: CandidateRow[] = [];
  if (indexStamp) {
    queryStamp = await timed("embed", () => deps.embedQuery(query));
    if (
      queryStamp.provider !== indexStamp.embedding_provider ||
      queryStamp.model !== indexStamp.embedding_model ||
      queryStamp.dimensions !== indexStamp.embedding_dimensions
    ) {
      throw new DomainError({
        class: "invalid_input",
        seam: "retrieval",
        message:
          `Embedding-space mismatch: the query role is ` +
          `${queryStamp.provider}/${queryStamp.model}@${queryStamp.dimensions}, but the index ` +
          `is stamped ${indexStamp.embedding_provider}/${indexStamp.embedding_model}@` +
          `${indexStamp.embedding_dimensions}. Comparing them would be meaningless — re-embed ` +
          `the corpus or fix the EMBEDDING_* role.`,
      });
    }

    const vectorLiteral = `[${queryStamp.vector.join(",")}]`;
    // Exact scan by design (research R2): no ANN index below ~100k chunks,
    // so recall measurements reflect ranking math, not index approximation.
    vectorCandidateRows = await timed("vector", async () => {
      const res = await db.execute<CandidateRow>(sql`
        SELECT c.id, c.source_id, c.generation, c.content, c.anchor,
               c.section_ids, 1 - (c.embedding <=> ${vectorLiteral}::vector) AS score
        FROM chunks c JOIN sources s ON s.id = c.source_id
        WHERE c.corpus_id = ${corpusId}
          AND c.embedding IS NOT NULL
          AND c.generation = s.current_generation
          AND 1 - (c.embedding <=> ${vectorLiteral}::vector) >= ${config.minSimilarity}
        ORDER BY c.embedding <=> ${vectorLiteral}::vector
        LIMIT ${config.candidateDepth}
      `);
      return res.rows;
    });
  }
  // No embedded current-generation chunks: there is nothing to compare in
  // vector space, so the stage is SKIPPED and recorded as null. This is not
  // the forbidden silent fallback (FR-021 is about a live index with a dead
  // dependency) — an un-embedded corpus has exactly one signal.

  // websearch_to_tsquery accepts raw human input safely (research R3);
  // ts_rank_cd rewards proximity in passage-sized documents.
  const ftsCandidateRows = await timed("fts", async () => {
    const res = await db.execute<CandidateRow>(sql`
      SELECT c.id, c.source_id, c.generation, c.content, c.anchor,
             c.section_ids, ts_rank_cd(c.fts, q.tsq) AS score
      FROM chunks c
      JOIN sources s ON s.id = c.source_id,
      LATERAL (SELECT websearch_to_tsquery('english', ${query}) AS tsq) q
      WHERE c.corpus_id = ${corpusId}
        AND c.generation = s.current_generation
        AND c.fts @@ q.tsq
      ORDER BY score DESC
      LIMIT ${config.candidateDepth}
    `);
    return res.rows;
  });

  const byId = new Map<string, CandidateRow>();
  for (const row of [...ftsCandidateRows, ...vectorCandidateRows]) byId.set(row.id, row);
  const asSignal = (rows: CandidateRow[]): SignalCandidate[] =>
    rows.map((r) => ({ chunkId: r.id, score: Number(r.score) }));

  const fusionStart = performance.now();
  const fused = fuse(config, asSignal(ftsCandidateRows), asSignal(vectorCandidateRows));
  timings.fusion = Math.round(performance.now() - fusionStart);

  // The rerank stage (US5): the top rerankDepth fused candidates are
  // re-scored by the cross-encoder and re-ordered by its scores (ties keep
  // fused order — determinism again). A failing scorer FAILS the search
  // (FR-021: never silently the unreranked order); a missing scorer with
  // rerank=on is a wiring bug, since config resolution already proved the
  // role live.
  let ordered: Array<{ candidate: (typeof fused)[number]; rerankScore: number | null; prerankPosition: number | null }>;
  if (config.rerank) {
    if (!deps.rerank) {
      throw new DomainError({
        class: "internal_fault",
        seam: "rerank",
        message: "RETRIEVAL_RERANK=on but no rerank client is wired — composition bug.",
      });
    }
    const rerankInput = fused.slice(0, config.rerankDepth);
    const scores = await timed("rerank", () =>
      deps.rerank!.rerank(
        query,
        rerankInput.map((candidate) => ({
          id: candidate.chunkId,
          text: byId.get(candidate.chunkId)!.content,
        })),
      ),
    );
    ordered = rerankInput
      .map((candidate, index) => ({
        candidate,
        rerankScore: scores.get(candidate.chunkId)!,
        prerankPosition: index + 1,
      }))
      .sort((a, b) => b.rerankScore! - a.rerankScore! || a.prerankPosition! - b.prerankPosition!);
  } else {
    ordered = fused.map((candidate) => ({ candidate, rerankScore: null, prerankPosition: null }));
  }

  const results: RetrievalResultLine[] = ordered.slice(0, config.k).map((entry, index) => {
    const row = byId.get(entry.candidate.chunkId)!;
    return {
      rank: index + 1,
      chunkId: entry.candidate.chunkId,
      sourceId: row.source_id,
      generation: row.generation,
      contentSnapshot: row.content,
      anchorSnapshot: row.anchor,
      sectionIds: row.section_ids,
      contentSha256: createHash("sha256").update(row.content, "utf8").digest("hex"),
      ftsScore: entry.candidate.ftsScore,
      vectorScore: entry.candidate.vectorScore,
      fusedScore: entry.candidate.fusedScore,
      rerankScore: entry.rerankScore,
      prerankPosition: entry.prerankPosition,
    };
  });

  const run = await recordRetrievalRun(db, {
    query,
    config,
    corpusId,
    origin: input.origin ?? "interactive",
    // An un-embedded corpus records the CONFIGURED-role-less reality: the
    // receipt says "none" rather than inventing a stamp it never used.
    embeddingProvider: queryStamp?.provider ?? "none",
    embeddingModel: queryStamp?.model ?? "none",
    embeddingDimensions: queryStamp?.dimensions ?? 0,
    stageTimings: timings,
    results,
  });

  return { runId: run.id, query, config, results, stageTimings: timings };
}
