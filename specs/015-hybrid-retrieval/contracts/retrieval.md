# Contract: library retrieval

Module: `apps/server/src/library/retrieve.ts`. The only read path from a question to library
passages. Consumers: the rules answerer (TASK-0027) and the retrieval benchmark (TASK-0029).
This contract is binding before the internals land; consumers build against these types.

## Signature

```ts
import type { Gateway } from "../ai/gateway.js";
import type { DbClient } from "./store.js";

export type RetrievalMode = "vector" | "fts" | "hybrid";

export interface RetrievalConfig {
  mode: RetrievalMode;       // RETRIEVAL_MODE
  k: number;                 // RETRIEVAL_K
  embedPurpose: string;      // RETRIEVAL_EMBED_PURPOSE
}

/** Zod-parses the env. Throws on an invalid value, naming the variable and allowed values. */
export function loadRetrievalConfig(env?: NodeJS.ProcessEnv): RetrievalConfig;

export interface RetrieveDeps {
  db: DbClient;
  gateway: Pick<Gateway, "embed">;
  config: RetrievalConfig;
}

export interface RetrieveRequest {
  question: string;
  mode?: RetrievalMode;      // overrides config.mode for this call only
  k?: number;                // overrides config.k for this call only; integer 1..50
  signal?: AbortSignal;      // passed to gateway.embed
}

export function retrieve(
  deps: RetrieveDeps,
  req: RetrieveRequest,
): Promise<RetrievalResult>;

/** Pure Reciprocal Rank Fusion; exported for the benchmark and for unit tests. */
export function fuseRrf(
  lists: { vector: string[]; fts: string[] },  // chunk ids, best first
  rrfK?: number,                                // default RRF_K = 60
): { chunkId: string; score: number }[];        // best first, ties by chunkId ascending
```

## Result type

```ts
/** Same shape as the parser's Anchor (library/ddb, specs/012). */
export interface PassageAnchor {
  book: string;              // library_documents.book
  path: string[];            // section headings, outermost first (the citation's "section")
  start: number;             // UTF-16 offset into the document text, inclusive
  end: number;               // UTF-16 offset, exclusive
}

export interface SearchSignal {
  rank: number;              // 1-based position in that search's own list
  score: number;             // vector: cosine similarity (1 - distance); fts: ts_rank_cd
}

export interface RetrievedPassage {
  chunkId: string;
  documentId: string;
  kind: "heading" | "prose" | "list" | "table" | "statBlock" | "sidebar";
  text: string;              // the exact quote: equals documentText.slice(anchor.start, anchor.end)
  anchor: PassageAnchor;
  rank: number;              // 1-based position in `passages`
  score: number;             // hybrid: RRF score; vector/fts: that search's own score
  vector: SearchSignal | null;   // null = the vector search did not return this chunk (or did not run)
  fts: SearchSignal | null;      // null = the keyword search did not return this chunk (or did not run)
}

export interface RetrievalResult {
  mode: RetrievalMode;                        // the mode that actually ran
  embeddingModel: string | null;              // model reported by gateway.embed; null in fts mode
  candidates: { vector: number | null; fts: number | null };  // rows each search returned; null = did not run
  passages: RetrievedPassage[];               // length <= k, best first
}
```

A citation for TASK-0027 is `{ book: anchor.book, section: anchor.path, quote: text, span:
[anchor.start, anchor.end) }`. All four come from stored data; none is generated.

## Configuration

| Variable | Values | Default | Read by |
|---|---|---|---|
| `RETRIEVAL_MODE` | `vector` \| `fts` \| `hybrid` | `hybrid` | `loadRetrievalConfig` |
| `RETRIEVAL_K` | integer 1..50 | `8` | `loadRetrievalConfig` |
| `RETRIEVAL_EMBED_PURPOSE` | name of an `AI_PURPOSES` entry with `op: "embed"` | `embedding` | `loadRetrievalConfig` |

`RRF_K = 60` and `CANDIDATES = 50` (rows fetched per search) are code constants, not env vars.
All three variables are optional. An unset environment yields the defaults and never fails.

## Invariants (each has a test)

1. An empty or whitespace-only `question` throws `ValidationError` before any database or
   gateway call. A `k` outside 1..50 or an unknown `mode` in the request throws
   `ValidationError` the same way.
2. `loadRetrievalConfig` throws on an invalid `RETRIEVAL_MODE` or `RETRIEVAL_K`, naming the
   variable. It never checks `AI_PURPOSES`, so a server with no AI config still starts.
3. Every passage satisfies `documentText.slice(anchor.start, anchor.end) === text`.
4. `fts` mode makes zero `gateway.embed` calls. `embeddingModel` is `null`; `candidates.vector`
   is `null`.
5. `vector` and `hybrid` modes call `gateway.embed({ purpose: config.embedPurpose, texts:
   [question] })` exactly once. The vector search compares only rows whose `model` equals the
   model the gateway reported for that call.
6. If `gateway.embed` throws (for example `unknown purpose "embedding"`), `retrieve` throws an
   `Error` whose message names `RETRIEVAL_EMBED_PURPOSE` and keeps the original as `cause`.
   It never falls back to another mode.
7. Keyword search matches a chunk containing any non-stop-word term of the question (OR
   semantics). Question text is never parsed as query syntax: `& | ! ( ) : * '` are plain text.
8. `hybrid` returns each chunk at most once, ordered by `fuseRrf`. A chunk found by one
   search only is still eligible.
9. `fuseRrf` score is `Σ 1 / (rrfK + rank)` over the lists containing the chunk. Ties break by
   `chunkId` ascending. The same inputs always produce the same output.
10. `retrieve` never writes to the database.

## Obligations on other tasks

- **TASK-0024 (ingestion)** MUST embed chunks through the same `AI_PURPOSES` entry that
  `RETRIEVAL_EMBED_PURPOSE` names, and MUST store the model name the gateway returns
  (`EmbedVector.model`) in `library_embeddings.model`. Otherwise vector search finds nothing.
- **TASK-0027 (answerer)** judges "nothing relevant" from `passages.length` and the per-search
  signals. `retrieve` applies no relevance threshold.
- **TASK-0029 (benchmark)** compares modes by passing `mode` per request against one config.

Errors use the existing typed errors in `apps/server/src/errors.ts`.
