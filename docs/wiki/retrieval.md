---
name: retrieval
description: The library plane's read path (apps/server/src/library/retrieve.ts) — vector, fts, or hybrid search fused by Reciprocal Rank Fusion (k=60), an OR-semantics keyword query, iterative HNSW scan, and the model filter. Load for any "how does search/retrieval work" question.
kind: component
sources:
  - apps/server/src/library/retrieve.ts
  - apps/server/src/index.ts
  - .env.example
verified_against: c732622ca88b9055779079909e330d034bb329d6
---

# Retrieval

`apps/server/src/library/retrieve.ts` is the library plane's only **read** path
(contracts/retrieval.md, spec 015): a question in, cited passages out, via keyword search
(`fts`), vector search (`vector`), or both fused with Reciprocal Rank Fusion (`hybrid`, the
default). It never writes to the database. `retrieve()` itself is still uncalled — the
declared consumers are the rules answerer (TASK-0027) and the retrieval benchmark
(TASK-0029) — but its config has a caller already: TASK-0024's [[ingestion]] reads
`loadRetrievalConfig(...).embedPurpose` to pick which [[ai-gateway]] purpose embeds each
stored chunk, so the two features share one "which purpose is embedding" answer.

## How it works

**Config** (`loadRetrievalConfig(env)`): three optional env vars, Zod-parsed with defaults —
`RETRIEVAL_MODE` (`vector`/`fts`/`hybrid`, default `hybrid`), `RETRIEVAL_K` (integer 1-50,
default 8), `RETRIEVAL_EMBED_PURPOSE` (non-empty string, default `"embedding"`). An invalid
value throws naming the variable and its allowed values; the function never checks
`AI_PURPOSES` itself, so a server with no AI config configured still starts (a bad
`RETRIEVAL_EMBED_PURPOSE` only surfaces when a `vector`/`hybrid` call actually tries to embed).
`RETRIEVAL_EMBED_PURPOSE` must name the same [[ai-gateway]] purpose [[ingestion]] (TASK-0024)
used to embed the library's chunks — retrieval embeds the question with this purpose and
filters `library_embeddings` by the model *that purpose's provider reports back*, never a name
read from config, so a mismatched purpose finds nothing rather than erroring.

**Per-request overrides**: `retrieve(deps, req)` takes `{question, mode?, k?, signal?}`.
`question` must be non-empty after trimming; `mode`/`k` override the config for that call only.
A validation failure throws `ValidationError` in the same shape `store.ts` uses ([[error-contract]]).

**Keyword search** (`searchFts`) runs `plainto_tsquery('english', question)` — so question text
is never treated as `tsquery` syntax — then replaces its `&` joins with `|` before casting back
to `tsquery`, giving OR semantics: a multi-term natural-language question doesn't need every
term present in one chunk to match. Ranked by `ts_rank_cd` against `library_chunks.tsv` (the
generated column from [[library-schema]]), ties broken by chunk id.

**Vector search** (`searchVector`) embeds the question through the gateway, then queries
`library_embeddings` filtered to that exact model, ordered by cosine distance
(`e.embedding <=> vector`). It runs inside a transaction with `SET LOCAL hnsw.iterative_scan =
strict_order` and `hnsw.ef_search = 100` — the iterative scan means the per-model `WHERE e.model
= ...` filter doesn't silently starve results once a second model's vectors share the same HNSW
index (one shared index across all models, per [[library-schema]]). An embed failure (bad
purpose, provider error) throws immediately and never falls back to keyword search.

**Fusion** (`fuseRrf`, pure function): each of up to two ranked chunk-id lists (`CANDIDATES = 50`
rows fetched per search before fusion/truncation — deep enough that a single-list hit can still
surface after fusion) contributes `1 / (RRF_K + rank)` per list it appears in, `RRF_K = 60` (the
original RRF paper's constant, and the default several vector databases' hybrid examples use).
Ties break by chunk id ascending, so identical inputs always produce identical output.
`ponytail:` both `RRF_K` and `CANDIDATES` are fixed constants — make configurable when
TASK-0029's benchmark shows a different value scores better.

**Modes**: `fts` and `vector` run one search and return it best-first, `score` being that
search's own signal (`ts_rank_cd` or cosine similarity). `hybrid` runs the keyword query and the
question embed concurrently, then the vector search (which needs the embedded vector), fuses
both id lists with `fuseRrf`, and reassembles passages in fused order with `score` = the RRF
score. Every `RetrievedPassage` carries both `vector` and `fts` `SearchSignal | null` fields
(`{rank, score}` in that search's own list, `null` if that search didn't return the chunk, or
didn't run at all) — so a caller can always see which search(es) found a passage, not just the
final fused rank. `embeddingModel` is `null` in `fts` mode (no embed call made) and the actual
model name otherwise. `candidates.vector`/`candidates.fts` report each search's row count, `null`
for a search that didn't run.

## Connections

Reads [[library-schema]]'s `library_chunks`/`library_embeddings` (never writes); embeds through
[[ai-gateway]]'s `embed()`, matched to [[ingestion]]'s purpose (TASK-0024). Config is loaded
and validated at boot by [[server-entrypoint-and-app]]'s `index.ts`, alongside
[[configuration]]'s `loadConfig` and the AI gateway's own config; `embedPurpose` is read by
[[ingestion]]'s worker at boot, but the `retrieve()` read path itself is unused until TASK-0027
wires a route to it. `.env.example` documents the three `RETRIEVAL_*` vars under "Retrieval"
(see [[configuration]]).

## Operational notes

All three env vars are optional; unset, retrieval defaults to `hybrid` mode, `k=8`, embed
purpose `"embedding"`. A `vector`/`hybrid` request against an `AI_PURPOSES` config that doesn't
declare that purpose fails at the embed call, not at boot. `RETRIEVAL_EMBED_PURPOSE` not
matching the purpose [[ingestion]]'s job used to embed chunks is a silent-empty-results
trap, not an error — the model filter just won't match any row.
