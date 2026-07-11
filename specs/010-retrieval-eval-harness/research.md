# Research: Retrieval & Evaluation Harness

Decisions R1–R10 resolve every open question the spec deferred to planning. Each
records the decision, rationale, and alternatives considered.

## R1 — Fusion strategy: reciprocal-rank fusion (RRF), weighted-sum as the eval rival

**Decision**: fuse the FTS and vector candidate lists with RRF:
`score(chunk) = Σ_signals 1 / (rrf_k + rank_signal(chunk))`, default `rrf_k = 60`,
missing-from-a-list contributes 0. Weighted score-sum (normalized `ts_rank_cd` +
normalized cosine similarity, weight `α`) is implemented as the comparison
configuration the closing eval report measures against (SC-005).

**Rationale**: the two signals' raw scores are incomparable (`ts_rank_cd` is unbounded
and corpus-dependent; cosine distance is [0,2]) — RRF needs no normalization, is
insensitive to score-scale drift across corpora, and is the established robust
baseline. Weighted-sum can win on a tuned corpus but requires per-corpus calibration —
exactly what a single-operator product shouldn't demand. Shipping RRF as default is
still an eval-justified choice, not an assumption: the report compares both (D11,
one variable at a time).

**Alternatives considered**: CombSUM/CombMNZ (need normalization, same calibration
problem); learning-to-rank (needs training data we don't have until gold sets
mature); vector-only or FTS-only (abandons the hybrid payoff D5 was chosen for).

## R2 — No ANN index this cycle; exact scan with a documented threshold

**Decision**: vector candidates come from an exact scan ordered by cosine distance
(`embedding <=> $query` with the generation predicate), no HNSW/IVFFlat index.
Revisit when a corpus exceeds ~100k embedded chunks; the escape hatch is one
`CREATE INDEX ... USING hnsw` migration away and changes no query shape.

**Rationale**: 008's schema comment already pinned this deferral to 010, and D5's
rationale stands — single-operator corpora sit orders of magnitude below where ANN
recall/latency tradeoffs pay. Exact scan means recall@k measurements reflect the
ranking math, not index approximation — the right substrate for the harness's first
baselines. SC-003's 2-second budget holds at reference scale (seq scan of 10⁵ ×
low-hundreds-dim vectors is tens of ms).

**Alternatives considered**: HNSW now (premature: adds build-time cost and an
approximation term to every eval metric); IVFFlat (needs list-count tuning per
corpus size — calibration again).

## R3 — FTS query shape: `websearch_to_tsquery('english', $q)` + `ts_rank_cd`

**Decision**: parse operator queries with `websearch_to_tsquery` (never
`to_tsquery`), rank candidates with `ts_rank_cd` over the generated `fts` column,
`LIMIT candidate_depth`.

**Rationale**: `websearch_to_tsquery` accepts raw human input safely (no syntax
errors from quotes/operators — matches the honest-input posture of 009's
`invalid_input` work), supports phrases and negation, and pairs with the GIN index
008 already built. `ts_rank_cd` (cover density) beats `ts_rank` for passage-sized
documents where proximity matters. The 'english' config matches the indexed
expression — the generated column pins them together by construction.

**Alternatives considered**: `plainto_tsquery` (drops phrase support);
`to_tsquery` (throws on user input); trigram similarity (different tool — fuzzy
matching, not relevance ranking; may join the eval program later as a candidate).

## R4 — Query embedding reuses the ingestion embed client and role

**Decision**: `packages/retrieval` embeds queries through the existing
`createEmbedClient` (`@stacks/ingestion`) against the same `EMBEDDING_*` role the
index was stamped with; before comparing, the engine verifies the index stamp
(provider/model/dimensions from a current-generation sample) matches the client's
config and refuses with a typed `DomainError` on mismatch (FR-005).

**Rationale**: one embedding role means query and index can only drift if config
drifts, and the 008 stamp makes that drift detectable at request time (Principle
VII's "structurally detectable" promise, now enforced on the read path).
Reusing the client keeps one HTTP contract with the sidecar. `@stacks/retrieval`
importing `@stacks/ingestion` is a normal internal dependency — boundaries only
confine plugins and web.

**Alternatives considered**: duplicating a thin embed client in retrieval (two
copies of one contract to drift apart); moving the client to `@stacks/core`
(core is deliberately dependency-free — an HTTP client doesn't belong there).

## R5 — Run receipts: two tables, append-only by construction, snapshot text on results

**Decision**: `retrieval_runs` (query, full resolved config JSON, timings, stage
outcomes) + `retrieval_results` (run id, rank, chunk id, source id, snapshot
`content` + `anchor` + section ids, per-signal scores, fused score, rerank score &
input position when reranked). The ONLY writer is `recordRetrievalRun` in
`@stacks/db` — inserted in one transaction; no UPDATE/DELETE path exists anywhere
in product code (same construction as `skeleton_check_events`/`recordEvent`).
"Superseded" is DERIVED at view time (result's chunk id no longer exists at the
source's current generation), never stored.

**Rationale**: Principle III wants receipts that outlive sweeps — snapshotting
content/anchor on the result row is the only design where a run renders after its
chunks are gone without resurrecting swept generations. Deriving superseded-ness
keeps rows immutable (a stored flag would need updates — an append-only violation).
Storage cost is bounded: k results × ~1 KB × runs; runs are the product's memory,
not a cache to evict.

**Alternatives considered**: referencing chunks without snapshots (dangling after
sweeps — violates FR-009); soft-deleting swept chunks instead of sweeping
(contradicts 008's generation-flip design); a JSON blob per run (kills per-result
querying the eval harness needs).

## R6 — Gold items reference chunks by identity + content hash; re-confirmation is a flag flip by re-derivation

**Decision**: `gold_items` store question, split, and expected passages as
`[{ chunkId, sourceId, contentSha256 }]`. An item "needs re-confirmation" when its
source's current generation no longer contains a chunk with that content hash —
computed at read time (like superseded-ness), surfaced in the UI and counted as
`unresolvable` by eval runs (never silently a miss, per the spec's edge case).
Re-confirmation = the operator re-selects the expected passage, which REPLACES the
expected-passage list (gold items are operator-owned labels, not receipts — plain
rows, mutable by their author, with `updated_at`).

**Rationale**: content-hash matching survives the common case (re-ingest produced
identical text under a new chunk id — auto-resolves without operator work) while
catching the real one (text changed — a human must re-label). Gold items aren't
receipts; forcing append-only semantics on labels would only make curation clumsy.

**Alternatives considered**: storing raw question→text pairs with no chunk link
(loses the durable-identity chain and makes recall@k ambiguous); append-only gold
versions (ceremony without a consumer — eval runs pin the gold-set state they ran
against in their own record).

## R7 — Eval runs ride the D12 jobs table; the deterministic slice is a Vitest suite

**Decision**: operator-triggered eval runs are `eval_run` jobs (worker handler
executes gold set × named config via the engine, writes one `eval_runs` row with
per-slice metrics + per-item outcomes JSON; progress visible through the run row's
status). The per-PR deterministic slice is NOT a job: it's a DB-gated Vitest suite
in `packages/retrieval` (own suite database, TASK-8 helper) that seeds the fixture
corpus, runs the harness in-process against `fixture-baseline` config, and asserts
the pinned floor — so `pnpm verify` carries it into CI with zero model calls.

**Rationale**: Principle IV — a 200-question model-backed eval is slow work, so it
never runs while a request waits; the queue already owns that shape. The CI slice
must be deterministic and hermetic, which is exactly what the test suite + fixture
embeddings give; wiring it as a test means no new CI plumbing (verify already runs
in CI).

**Alternatives considered**: synchronous eval endpoint (violates IV the moment gold
sets grow); a separate CI workflow for evals (new plumbing for something
`pnpm verify` already transports).

## R8 — Deterministic fixture embeddings: hash-seeded pseudo-vectors, stamped as their own provider

**Decision**: the fixture corpus's chunks (and fixture queries) get embeddings from
a pure function `deterministicEmbedding(text, dims=32)` — bytes of
`sha256(text)` expanded via a seeded xorshift into a unit-normalized vector —
stamped `provider="fixture", model="deterministic-v1", dimensions=32`. Fixture gold
questions reuse the same function, with near-duplicate phrasing driving cosine
proximity. The fixture NEVER touches the sidecar; the stamp check (R4) naturally
prevents a fixture index from ever serving real queries.

**Rationale**: the deterministic slice must produce identical metrics on every
machine forever (FR-017). Hash-seeded vectors give stable, meaningless-but-
consistent geometry — enough to prove ranking/fusion/metric MATH, which is what the
slice guards (semantic quality is the model-backed slices' job). Stamping them as a
distinct provider makes cross-contamination structurally impossible.

**Alternatives considered**: committing real-model embeddings as fixtures (breaks
on any model change; large diffs; couples CI to a model artifact); running a tiny
real model in CI (network/weights dependency — exactly what FR-017 forbids).

## R9 — Reranker: sidecar `/v1/rerank` with a CrossEncoder role, mirroring the embed contract

**Decision**: new sidecar endpoint `POST /v1/rerank` — `{ model, query,
passages: [{id, text}] }` → `{ model, scores: [{id, score}] }` — serving the
env-first `RERANKER_MODEL` role (sentence-transformers CrossEncoder), loaded at
startup alongside the embedding model with its state reported by `/ready`;
`404` on wrong model name, `503` while loading/failed, `415` on malformed input —
the exact status semantics `/v1/embed` pinned in 007. Engine-side,
`RETRIEVAL_RERANK=off|on` gates the stage; `on` + unreachable sidecar ⇒
`dependency_down` DomainError (FR-021 — no silent fallback).

**Rationale**: cross-encoders are the standard second-stage reranker
(query+passage jointly scored — a different signal class than bi-encoder cosine);
serving it in the sidecar is exactly D2's "Python where the ML ecosystem genuinely
requires it". Mirroring the embed contract's shape and status taxonomy keeps the
sidecar's surface one idea. If `RERANKER_MODEL` is unset, `/ready` reports the
role `disabled` and the engine refuses `RETRIEVAL_RERANK=on` at config resolution —
misconfiguration fails fast, not per-request.

**Alternatives considered**: reranking in TS (no ecosystem — violates the D2
split's point); a separate rerank service (violates VI); making rerank failure
degrade to fused order (explicitly forbidden — hidden fallback).

## R10 — Config resolution: one resolved-config object, env-first, recorded verbatim on every run

**Decision**: `resolveRetrievalConfig(env)` (pure, unit-tested) produces
`{ fusion: "rrf"|"weighted", rrfK, weightAlpha, candidateDepth, k, rerank,
rerankDepth, configName }` from `RETRIEVAL_*` env vars with documented defaults
(rrf / 60 / — / 50 / 10 / off / 50). Eval runs may override per-run (that's the
A/B mechanism) — but every run record (retrieval or eval) stores the fully resolved
object it actually used, so no metric or receipt ever depends on ambient env.

**Rationale**: Principle VII end-to-end — behavior is configuration, and receipts
must pin the configuration that produced them or comparisons are meaningless
(D11's one-variable-at-a-time discipline depends on it). `.env.example` gains the
new variables as the 009 environment contract requires; none are ports, so the
worktree protocol is untouched.

**Alternatives considered**: config rows in the DB (adds a mutable authority the
env contract already provides); per-request query params for everything (the API
allows overrides for eval runs only — interactive search always uses the resolved
default, keeping the operator's mental model stable).
