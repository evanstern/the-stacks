import { z } from "zod";
import type { Gateway } from "../ai/gateway.js";
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

/**
 * Pure Reciprocal Rank Fusion (research R1, contract invariant 9): each
 * list holds chunk ids ranked best-first. A chunk's score sums
 * `1 / (rrfK + rank)` over every list it appears in; ties break by chunk id
 * ascending. Same inputs always produce the same output (SC-005).
 */
export function fuseRrf(
  lists: { vector: string[]; fts: string[] },
  rrfK: number = RRF_K,
): { chunkId: string; score: number }[] {
  const scores = new Map<string, number>();
  for (const list of [lists.vector, lists.fts]) {
    list.forEach((chunkId, i) => {
      const rank = i + 1;
      scores.set(chunkId, (scores.get(chunkId) ?? 0) + 1 / (rrfK + rank));
    });
  }
  return [...scores.entries()]
    .map(([chunkId, score]) => ({ chunkId, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0;
    });
}
