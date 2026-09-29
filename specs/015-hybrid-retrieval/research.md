# Research: Hybrid retrieval

## R1 — Fusion method: Reciprocal Rank Fusion, k = 60

- **Decision**: hybrid mode fuses the two ranked lists with Reciprocal Rank Fusion:
  `score(chunk) = Σ 1 / (60 + rank)` over each list containing the chunk, rank 1-based. Ties
  break by chunk id ascending. `RRF_K = 60` is a code constant.
- **Rationale**: the two searches score on incomparable scales. Cosine similarity lives in
  [-1, 1]; `ts_rank_cd` is unbounded and depends on document length and term frequency. RRF
  uses ranks only, so it needs no score normalization and no tuned weights. k = 60 is the
  value from the original paper (Cormack, Clarke, Büttcher, SIGIR 2009) and the default in
  Elasticsearch, OpenSearch, and pgvector's own hybrid-search example. A larger k flattens
  the gap between rank 1 and rank 10; 60 keeps a both-lists hit above any single-list hit at a
  similar rank, which is the property spec US3 AC1 asks for.
- **Alternatives**: weighted sum of min-max-normalized scores (rejected: normalization is
  unstable per query and the weight needs tuning data TASK-0029 does not have yet);
  convex combination with a learned alpha (deferred: add when the benchmark shows RRF losing
  recall). `ponytail:` comment on `RRF_K` names the benchmark as the upgrade path.

## R2 — Keyword query: OR semantics from `plainto_tsquery`

- **Decision**: build the tsquery as
  `replace(plainto_tsquery('english', $q)::text, ' & ', ' | ')::tsquery`, match with
  `tsv @@ query`, rank with `ts_rank_cd(tsv, query)`.
- **Rationale**: `plainto_tsquery` parses the question as plain text, so no user character is
  ever query syntax (contract invariant 7), and it drops stop words and stems. It ANDs the
  terms, though, and a natural-language question ("how does grappling work while prone")
  rarely has every term in one chunk. Replacing its `&` with `|` gives OR semantics while
  keeping its escaping; `ts_rank_cd` then rewards chunks that match more terms, closer
  together. A stop-word-only question yields an empty tsquery, which matches nothing and
  raises no error.
- **Alternatives**: `websearch_to_tsquery` (rejected: still AND, and treats `-` and `"` as
  syntax); `to_tsquery` on hand-escaped tokens (rejected: our own escaping is a bug surface);
  AND semantics (rejected: near-zero recall on questions).

## R3 — Vector query: pgvector iterative scan

- **Decision**: in one read-only transaction, `SET LOCAL hnsw.ef_search = 100` and
  `SET LOCAL hnsw.iterative_scan = strict_order`, then
  `SELECT … FROM library_embeddings e JOIN library_chunks c … JOIN library_documents d …
  WHERE e.model = $model ORDER BY e.embedding <=> $vec LIMIT 50`. Score is `1 - distance`.
- **Rationale**: the HNSW index is shared by every model (spec 013 `ponytail`). Without
  iterative scan, HNSW returns at most `ef_search` (default 40) nearest rows and the `model`
  filter runs after, so a second stored model silently shrinks the result, possibly to zero.
  pgvector 0.8 iterative scan keeps scanning until the filtered `LIMIT` is met;
  `strict_order` keeps exact distance order. The compose image ships pgvector 0.8.4
  (checked: `vector--0.8.4.sql` in `pgvector/pgvector:pg17`). `SET LOCAL` confines the
  settings to the transaction, so no pooled connection is left altered.
- **Alternatives**: per-model partial HNSW indexes (deferred by spec 013 until TASK-0029
  shows filtered recall dropping; needs a migration per model); a large `ef_search` alone
  (rejected: still no guarantee once a second model dominates the table).

## R4 — Embedding the question through the gateway

- **Decision**: `retrieve` calls `deps.gateway.embed({ purpose: config.embedPurpose, texts:
  [question], signal })`. It filters stored vectors by `result.vectors[0].model`, the model
  the gateway reports, not by a model name read from config.
- **Rationale**: decision-0007 puts every model call behind the gateway and names models only
  in `AI_PURPOSES`. Reading the model from the gateway's reply keeps one source of truth: the
  purpose config. The gateway already enforces length 1024 (decision-0002), records usage, and
  maps errors. Ingestion (TASK-0024) must store that same reported name; the contract states
  the obligation.
- **Alternatives**: a `RETRIEVAL_EMBED_MODEL` env var (rejected: a second place to name the
  model, which drifts from `AI_PURPOSES`).

## R5 — Configuration home and failure policy

- **Decision**: `loadRetrievalConfig(env)` lives in `apps/server/src/library/retrieve.ts`,
  Zod-parses `RETRIEVAL_MODE` (default `hybrid`), `RETRIEVAL_K` (default 8, 1..50), and
  `RETRIEVAL_EMBED_PURPOSE` (default `embedding`), and is called once in `index.ts` at startup
  so a bad value fails boot (FR-004). It does not cross-check `AI_PURPOSES`. A missing
  purpose surfaces at call time (contract invariant 6).
- **Rationale**: `config.ts` must stay free of relative imports because host scripts load it
  (wiki `configuration`); the AI config set the precedent of loading beside its consumer.
  Cross-checking the purpose at boot would make the default mode (`hybrid`) refuse to start a
  server with no AI config, which the AI gateway explicitly supports. The default purpose name
  `embedding` matches the `.env.example` sample, so a deployment following the sample works
  with no retrieval variables at all.
- **Alternatives**: fields on `ServerConfig` (rejected: host-script import rule); cross-check
  at boot only when the default mode needs vectors (rejected: a per-request override still
  needs the runtime check, so the boot check adds code without removing any).

## R6 — No silent mode fallback

- **Decision**: vector or hybrid with an unusable embedding purpose throws. Hybrid with zero
  vector candidates (no vectors for that model) returns keyword results and reports
  `candidates.vector = 0`.
- **Rationale**: the benchmark compares modes. A "hybrid" run that quietly ran as FTS would
  report FTS numbers under the hybrid label. Zero candidates is data, not a config error, so it
  is reported, not thrown.

## R7 — Candidate depth and k bounds

- **Decision**: each search fetches `CANDIDATES = 50` rows. `k` is 1..50, default 8.
- **Rationale**: RRF needs lists deeper than k so single-list hits can surface. 50 is a
  common default and cheap at single-tenant scale (≤ ~100k chunks). Capping k at 50 keeps the
  candidate lists at least as long as the result. `ponytail:` comment on `CANDIDATES`; make it
  configurable when TASK-0029 shows depth matters.

## R8 — No migration

- **Decision**: no schema change.
- **Rationale**: spec 013 already ships everything retrieval reads: the generated `tsv` column
  with GIN index `library_chunks_tsv_idx`, `library_embeddings.model` with a btree, and HNSW
  `vector_cosine_ops` index `library_embeddings_embedding_idx`. Cosine matches `<=>`. Iterative
  scan is a session setting, not DDL. Integration tests assert both indexes are used by
  retrieval's own queries.

## R9 — Tests use the fake provider

- **Decision**: unit tests (no DB) cover config parsing, request validation, and `fuseRrf`
  against hand-computed values. Integration tests build the gateway with
  `createGateway({ config, sink: memorySink(), adapters: { fake: () => fake } })`, where
  `fake` is a `FakeProvider` instance the test holds. Each test stores a synthetic book whose
  text carries a per-test nonce word (keyword isolation) and attaches vectors under a
  per-test model name (vector isolation), then scripts `fake.scriptEmbed({ vectors: [v] })`
  so the question embeds to a known vector. `fake.embedCalls.length` proves invariant 4.
- **Rationale**: the integration database is shared with other suites, and retrieval searches
  every book. Nonce words and per-test model names isolate results without adding a book
  filter to the contract. The fake's hash embeddings carry no meaning, so scripted vectors make
  rank order deterministic.

## R10 — Dependencies

- **Decision**: no new runtime dependency. `drizzle-orm` (`sql`, `cosineDistance`), `zod`, and
  `pg` are installed. pgvector 0.8.4 is already in the compose image.
