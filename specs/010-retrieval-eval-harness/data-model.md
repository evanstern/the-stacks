# Data Model: Retrieval & Evaluation Harness

New tables live in `packages/db/src/schema/retrieval.ts` (one drizzle-kit
migration). Reads against 008's `chunks`/`sources` use the reader predicate
(`chunks.generation = sources.current_generation`) everywhere — no exceptions.

## retrieval_runs — the receipt header (append-only)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | run identity; the URL slug of the detail view |
| query | text NOT NULL | as typed, after length clamp |
| config | jsonb NOT NULL | the fully resolved config object (research R10), verbatim |
| corpus_id | uuid NOT NULL → corpora | the corpus searched |
| origin | text NOT NULL | `interactive` \| `eval` — who asked (eval runs reference their retrieval runs) |
| embedding_provider/model/dimensions | text/text/int NOT NULL | the query embedding's stamp — receipts prove the space they searched in |
| stage_timings | jsonb NOT NULL | ms per stage: embed, fts, vector, fusion, rerank (null where skipped) |
| result_count | int NOT NULL | denormalized for the list view |
| created_at | timestamptz NOT NULL default now() | |

**Invariant**: append-only BY CONSTRUCTION — the sole writer is
`recordRetrievalRun` (`packages/db/src/retrieval-runs.ts`), one transaction
inserting the run and all its results; no UPDATE/DELETE path exists in product
code. Same construction (and same teaching comment) as `recordEvent`.

## retrieval_results — the receipt lines (append-only, same writer)

| Column | Type | Notes |
|---|---|---|
| run_id | uuid NOT NULL → retrieval_runs | composite PK (run_id, rank) |
| rank | int NOT NULL | final position, 1-based |
| chunk_id | text NOT NULL | durable identity (NOT an FK — the chunk may be swept later; receipts outlive rows) |
| source_id | uuid NOT NULL → sources | sources are never deleted this cycle; safe FK for the detail view's attribution link |
| generation | int NOT NULL | the generation searched |
| content_snapshot | text NOT NULL | passage text at retrieval time (research R5) |
| anchor_snapshot | jsonb NOT NULL | citation anchor at retrieval time |
| section_ids | jsonb NOT NULL | the traceability chain, snapshotted |
| content_sha256 | text NOT NULL | supports superseded/auto-reconfirm derivations |
| fts_score / vector_score | real NULL | per-signal raw scores (null when the signal didn't propose it) |
| fused_score | real NOT NULL | RRF (or weighted) score |
| rerank_score | real NULL | null unless reranked |
| prerank_position | int NULL | fused-order position before rerank (FR-022) |

**Derived, never stored**: `superseded` — true when no chunk with `content_sha256`
exists at the source's current generation (computed by the detail-view query).

## gold_items — operator-owned labels (mutable by their author)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| corpus_id | uuid NOT NULL → corpora | |
| question | text NOT NULL | |
| expected | jsonb NOT NULL | `[{ chunkId, sourceId, contentSha256 }]` — ≥ 1 entry (research R6) |
| split | text NOT NULL | `tuning` \| `heldout` — assigned at creation (FR-013), visible always |
| notes | text NULL | labeling rationale, optional |
| created_at / updated_at | timestamptz NOT NULL | updated_at moves on re-labeling |

**Derived, never stored**: `needsReconfirmation` — true when any expected entry's
`contentSha256` has no current-generation match in its source. Auto-heals when a
re-ingest reproduces identical text under a new chunk id.

## eval_runs — the measurement receipt (append-only after completion; status while running)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| corpus_id | uuid NOT NULL → corpora | |
| config | jsonb NOT NULL | resolved config measured (may override env — the A/B mechanism) |
| config_name | text NOT NULL | human handle for comparisons (`rrf-default`, `weighted-a05`, …) |
| gold_snapshot | jsonb NOT NULL | the gold items evaluated (id, question, expected, split) — pinned so later re-labeling can't rewrite history |
| status | text NOT NULL | `running` \| `completed` \| `failed` — the ONE mutable column, owned by the job handler |
| metrics | jsonb NULL | per-slice `{ tuning: {recallAt5, recallAt10, mrr, ndcgAt10}, heldout: {...} }` per contracts/metrics.md |
| item_outcomes | jsonb NULL | per item: first-hit rank, hit set, or `unresolvable` |
| retrieval_run_ids | jsonb NULL | the underlying receipts, one per question |
| error | text NULL | scrubbed failure summary when `failed` |
| created_at / completed_at | timestamptz | |

**Invariant**: rows transition `running → completed|failed` exactly once (job
handler is the sole writer); a completed row is never modified. Eval runs pin
their gold snapshot — gold-set edits after the run change nothing retroactively.

## Configuration (not a table — research R10)

Resolved from env by `resolveRetrievalConfig`:
`RETRIEVAL_FUSION` (rrf|weighted, default rrf), `RETRIEVAL_RRF_K` (60),
`RETRIEVAL_WEIGHT_ALPHA` (0.5, weighted only), `RETRIEVAL_CANDIDATE_DEPTH` (50),
`RETRIEVAL_K` (10), `RETRIEVAL_RERANK` (off|on, default off),
`RETRIEVAL_RERANK_DEPTH` (50), plus the existing `EMBEDDING_*` role and new
`RERANKER_MODEL` / `RERANKER_PROVIDER` roles. All documented in `.env.example`
(the 009 environment contract) — none are ports; the worktree protocol is
untouched.

## Relationships & lifecycle

```text
corpora ─┬─ chunks (008, generation-flipped)   ←reads── search engine
         ├─ retrieval_runs ── retrieval_results (snapshots; chunk_id soft ref)
         ├─ gold_items (labels; content-hash refs into chunks)
         └─ eval_runs (pin gold_snapshot + config; reference retrieval_runs)
jobs (D12) ── eval_run job → worker handler → eval_runs.status/metrics
```

Deletion story this cycle: none. Runs and eval runs are receipts (append-only);
gold items are editable but not deletable from the UI this cycle (a deleted label
would orphan eval-run history silently — deferred to the corpus-lifecycle spec's
guarded-destructive machinery).
