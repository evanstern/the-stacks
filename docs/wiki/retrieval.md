---
name: retrieval
description: Query-side hybrid retrieval and the eval harness (spec 010) — FTS + vector fusion under the reader predicate, append-only run receipts that outlive re-ingestion, content-hash gold labels, pinned metrics with a deterministic CI floor, and the optional sidecar reranker.
kind: pipeline
sources:
  - packages/retrieval/src/config.ts
  - packages/retrieval/src/fusion.ts
  - packages/retrieval/src/search.ts
  - packages/retrieval/src/rerank-client.ts
  - packages/retrieval/src/gold.ts
  - packages/retrieval/src/eval/metrics.ts
  - packages/retrieval/src/eval/run-eval.ts
  - packages/retrieval/src/eval/fixture/deterministic-embedding.ts
  - packages/db/src/schema/retrieval.ts
  - packages/db/src/retrieval-runs.ts
  - apps/api/src/retrieval/routes.ts
  - apps/worker/src/handlers/eval-run.ts
  - apps/ml/src/ml/main.py
  - specs/010-retrieval-eval-harness/contracts/metrics.md
verified_against: dacd6c245d7f333752adcddf3e523477b523bd15
---

# Retrieval

The query side of the corpus [[ingestion]] built (spec 010): one operator query
fans out to the two signals every chunk already carries — the generated FTS
`tsvector` and the pgvector embedding — and comes back as one ranked, recorded,
attributed answer. This page is the durable summary; full detail lives in
`specs/010-retrieval-eval-harness/` (plan, research R1–R10, contracts,
quickstart).

## The engine

```text
query ─► stamp check ─► embed (sidecar) ─► FTS ∥ vector (exact scan) ─► fuse
      ─► (rerank, optional) ─► RECORD receipt ─► results
```

- Both candidate queries read strictly under the **reader predicate**
  (`chunks.generation = sources.current_generation`) — a mid-re-ingest source
  never yields mixed generations (008 R8, FR-002).
- **Fusion is RRF by default** (`1/(k+rank)` summed across signals, `k=60`):
  `ts_rank_cd` and cosine similarity are incomparable scales, and RRF needs no
  per-corpus calibration. Weighted-sum (min-max normalized, `α` on the vector
  side) exists as the measured rival. Ties break lexicographically — receipts
  and metrics never depend on iteration order.
- **The vector signal has a floor** (`RETRIEVAL_MIN_SIMILARITY`, default 0.2):
  pure nearest-neighbor always answers with *something*, so honest empty
  results require dropping candidates below the floor. The 0.2 default is
  real-corpus-tuned (TASK-10, `docs/eval-reports/010-retrieval-baseline.md`):
  0.3 dropped natural-question phrasings whose answer is one sentence buried in
  a multi-topic chunk (cosine ~0.21), while 0.0 regressed ranking by admitting
  weak matches above the true answer. The deterministic CI-floor fixture pins
  its *own* floor at 0.3 — its constructed hash embeddings lack real MiniLM's
  "unrelated sits near 0" property, so its honest-empty guarantee needs 0.3.
- **Embedding-space mismatch refuses at read time**: the engine samples the
  index's provider/model/dimensions stamp and compares it to the query
  embedder's; a mismatch is an `invalid_input` DomainError naming both stamps
  (Principle VII's detectability, enforced on the read path). This is also why
  the fixture provider (`fixture/deterministic-v1`) can never serve real
  queries.
- **FTS uses `websearch_to_tsquery`** (safe raw human input) — note its AND
  semantics: a multi-term query missing one word from a passage misses that
  passage entirely; the vector signal is what absorbs this in production
  (recorded as a known characteristic in the 010 eval report).
- **No ANN index** below ~100k embedded chunks (exact scan): recall metrics
  reflect ranking math, not index approximation. The escape hatch is one HNSW
  migration with no query-shape change.

## Receipts (Principle III)

Every retrieval — interactive or harness-driven — writes `retrieval_runs` +
`retrieval_results` in one transaction via `recordRetrievalRun`, the **sole
writer**; no UPDATE/DELETE path exists (same construction as
`skeleton_check_events`). Results **snapshot** passage text, anchor, and
section ids at retrieval time, so a receipt renders forever — even after a
re-ingest sweeps the live rows. "Superseded" is **derived at view time** (no
current-generation chunk carries the result's content hash), never stored:
identical re-ingested text keeps the hash alive and the mark off. Runs are
operator-visible at `/records/retrievals` (list + URL-addressable detail).

## Gold sets and the harness (D11)

- **Gold items** are operator-owned labels: question + expected passages
  referenced by `{chunkId, sourceId, contentSha256}`, resolved server-side at
  labeling time (non-current-generation chunks refused). Content-hash
  referencing auto-heals across identical re-ingests and flags rewritten
  passages for re-confirmation; eval runs count flagged items `unresolvable`,
  never silent misses. Splits (tuning/heldout, every 4th item held out by
  default) are **immutable after creation** — moving items would leak tuning
  choices into the holdout (FR-013).
- **Eval runs** ride the D12 jobs table (`eval_run` handler): the API snapshots
  the gold set into the run row (`running`) and enqueues; the worker executes
  every question as a real engine search (each leaving an `origin: "eval"`
  receipt), computes the pinned metrics (recall@5/10, MRR, nDCG@10 — exact
  definitions in `contracts/metrics.md`, per split, never blended), and flips
  status exactly once. The gold snapshot pins history: later re-labeling
  changes nothing retroactively.
- **The deterministic CI floor** (`ci-floor.test.ts`) runs inside
  `pnpm verify`: a synthetic fixture corpus with hash-seeded deterministic
  embeddings executes the real harness in-process and asserts pinned metric
  floors — zero model calls, zero network beyond Postgres. Breaking fusion,
  the reader predicate, or metric math fails the build naming the regression.

## The reranker (optional, spec 010 US5)

`POST /v1/rerank` on the [[walking-skeleton]]'s sidecar serves an env-first
cross-encoder role (`RERANKER_PROVIDER`/`RERANKER_MODEL_ID`; empty = disabled,
reported additively on `/ready`). Engine-side, `RETRIEVAL_RERANK=on` re-orders
the top `RETRIEVAL_RERANK_DEPTH` fused candidates by cross-encoder score,
recording pre-rerank positions and scores on the receipt. **No silent
fallback anywhere**: rerank-on with the role disabled refuses at config
resolution; a failing scorer fails the search (typed `dependency_down`, no
receipt) rather than quietly returning the unreranked order (FR-021).

## Configuration (Principle VII)

All knobs are `RETRIEVAL_*` env variables (`.env.example` is the contract);
`resolveRetrievalConfig` validates once — env and eval overrides share the
same guards — and **every run records the fully resolved config verbatim**,
so no receipt or measurement ever depends on ambient env. Shipped defaults
are eval-justified (D11): see `docs/eval-reports/010-retrieval-baseline.md`.
