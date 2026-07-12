# Quickstart: validating Retrieval & Evaluation Harness

End-to-end proof scenarios, in dependency order. Prereqs: the compose stack up
(`docker compose up -d --build --wait`), at least one source ingested (008's
quickstart), `.env` carrying the new `RETRIEVAL_*` defaults (mint/check via the
009 tooling after `.env.example` changes).

## 1. Search returns cited passages (US1)

1. Open `/search` from the nav. Search a term you know appears verbatim in an
   ingested source; expect the passage in the top results with source name and
   a working link to the source detail view.
2. Search a paraphrase of another passage (no shared keywords); expect the
   meaning-matched passage in the top results (vector signal).
3. Search gibberish (`zqxv kjw`); expect the honest empty state, and (step 2
   below) a recorded run with zero results.
4. API-level: `POST /api/retrieval/search` unauthenticated → 401; body
   `{"query": ""}` → 400 `invalid_input`.

## 2. Runs are receipts (US2)

1. Open `/records/retrievals`; the searches from step 1 are listed newest-first.
   Open one — the URL is shareable/bookmarkable; the detail shows per-signal
   scores, fused rank, config, timings.
2. Re-ingest the searched source (008 quickstart re-upload). Revisit the SAME
   run URL: results still render from snapshots; any passage whose text changed
   is marked superseded.
3. Confirm append-only: `grep -rn "UPDATE retrieval_runs\|DELETE FROM retrieval"`
   over the repo returns nothing; `recordRetrievalRun` is the only writer.

## 3. Gold set authoring (US3)

1. On `/evals/gold`, author ≥ 8 items from real searches (mark expected
   passages). Confirm the split assignment shows on each (≈ every 4th heldout).
2. Re-ingest a labeled source with changed text; the affected item shows
   needs-reconfirmation; re-label it and the flag clears. A re-ingest with
   UNCHANGED text auto-heals (hash match) with no flag.

## 4. Eval runs and comparison (US4)

1. `POST /api/evals/runs` (or the `/evals` UI button) with `configName:
   "rrf-default"` → 202; watch status flip running → completed on `/evals`.
2. Run again with `overrides: { fusion: "weighted", weightAlpha: 0.5 }`,
   `configName: "weighted-a05"`. Compare the two runs on `/evals`: per-slice
   recall@5/10, MRR, nDCG@10 deltas render; each item links to its underlying
   retrieval run.
3. Confirm the eval-justification chain: the shipped default's eval report
   exists in the repo and cites these run ids (SC-005 — authored at
   convergence).

## 5. Deterministic CI slice (US4/SC-004)

1. `pnpm --filter @stacks/retrieval test` with DB env: the fixture suite seeds
   the synthetic corpus (deterministic embeddings, provider `fixture`), runs the
   harness in-process, and asserts the pinned metric floor. Zero network beyond
   Postgres.
2. Prove the gate bites: on a scratch branch, break fusion (e.g. invert a rank
   sign), run the suite — it fails naming the metric that regressed. Revert.

## 6. Reranker (US5)

1. Set `RERANKER_PROVIDER`/`RERANKER_MODEL_ID` (a small cross-encoder), restart the
   sidecar; `/ready` reports `reranker: "ready"`. Set `RETRIEVAL_RERANK=on`.
2. Repeat a step-1 search: the run detail shows prerank vs postrank ordering and
   rerank scores with the model identity.
3. Stop the sidecar; search again → honest `503 dependency_down` naming the
   rerank stage (never a silent unreranked result). Restart.
4. Run the eval pair rerank-off vs rerank-on; the comparison shows the delta
   that justifies the shipped default (SC-006).

## 7. Boundaries & gates hold

- `pnpm verify` green (includes the new suites + deterministic slice).
- `cd apps/ml && pytest && pyright --project .` green (rerank contract tests).
- Wiki: `docs/wiki/retrieval.md` added and pinned; freshness gate green.
- Board: TASK-9 reflects phase progress via `/spec-bridge:sync`.
