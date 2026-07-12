# API Contract: Retrieval & Evaluation Harness

All routes sit behind the 007 global auth guard (401 pre-auth, envelope
`{error:{code,message}}` on every non-2xx — the one wire shape). Browser never
calls these directly; `apps/web`'s server layer relays (FR-019 lineage). Error
classes map to HTTP only in `apps/api/src/app.ts` (unchanged seam).

## 1. Search

`POST /api/retrieval/search` — body `{ query: string }` (1..1024 chars; schema-
validated ⇒ `invalid_input` 400 beyond).

- Runs the engine under the env-resolved config (interactive searches never
  override config — research R10) against the operator's corpus.
- `200` → `{ runId, query, config, results: [{ rank, chunkId, sourceId,
  generation, content, anchor, scores: { fts, vector, fused, rerank },
  prerankPosition }], timings }` — exactly what was recorded; the response IS the
  receipt's content.
- `503 dependency_down` — sidecar unreachable / embedding or rerank model not
  ready (stage named in the message). Never a silent partial result.
- `409`-class refusal (`invalid_input` family): embedding-space mismatch between
  query config and index stamp — message names both stamps (FR-005).
- Always records the run, including honest-empty results.

## 2. Retrieval-run records

- `GET /api/retrieval/runs?offset=&limit=` — newest-first page of run headers
  `{ id, query, origin, resultCount, createdAt, configName }` + `total`
  (paging contract identical to 009's uploads listing).
- `GET /api/retrieval/runs/:id` — full receipt: header + results, each result
  carrying `superseded: boolean` DERIVED at read time (data-model.md). `404
  unknown_thing` for absent ids.

## 3. Gold sets

- `POST /api/evals/gold` — `{ question, expected: [{ chunkId }], split?, notes? }`;
  the API resolves each chunkId to `{ chunkId, sourceId, contentSha256 }` at
  creation (must be current-generation chunks; else `invalid_input`). Split
  defaults per protocol: every 4th item `heldout` (deterministic by item count),
  overridable explicitly.
- `GET /api/evals/gold` — all items with derived `needsReconfirmation`.
- `PUT /api/evals/gold/:id` — re-label (question/expected/notes; split immutable
  after creation — moving items between splits after tuning began would let
  choices leak into the holdout).
- No DELETE this cycle (data-model.md deletion story).

## 4. Eval runs

- `POST /api/evals/runs` — `{ configName, overrides?: {...} }` → `202` +
  `{ evalRunId }`; enqueues an `eval_run` job (D12) that executes every gold item
  as a real engine search (each leaving its own retrieval run, `origin: "eval"`),
  computes contracts/metrics.md per slice, completes the row.
- `GET /api/evals/runs` / `GET /api/evals/runs/:id` — list and detail (status,
  metrics, item outcomes, links to underlying retrieval runs).
- Comparison is client-side over two completed runs (no server state):
  `/evals` UI fetches both details.

## 5. Environment contract addendum (.env.example)

```
RETRIEVAL_FUSION=rrf              # rrf | weighted — fusion strategy (research R1)
RETRIEVAL_RRF_K=60                # RRF dampening constant
RETRIEVAL_WEIGHT_ALPHA=0.5        # weighted only: vector weight (0..1)
RETRIEVAL_MIN_SIMILARITY=0.2      # vector floor: below it, a chunk is not a candidate (honest empty); real-corpus-tuned (TASK-10)
RETRIEVAL_CANDIDATE_DEPTH=50      # per-signal candidates fetched before fusion
RETRIEVAL_K=10                    # results returned/recorded
RETRIEVAL_RERANK=off              # off | on — on REQUIRES the reranker role live (R9)
RETRIEVAL_RERANK_DEPTH=50         # fused candidates sent to the reranker
RERANKER_PROVIDER=                # empty = role disabled (fail-fast at config resolution)
RERANKER_MODEL_ID=                # cross-encoder model id — never hardcoded (D14)
```

Mint-tool note: none are port-coupled; `mint-worktree-env` copies them verbatim.

## 6. Web surfaces (apps/web — server-relayed, nav-reachable)

| Route | Purpose |
|---|---|
| `/search` | the search box + results (US1); each result links to its source detail |
| `/records/retrievals` | run list (US2) |
| `/records/retrievals/:run` | receipt detail incl. superseded marks + per-stage scores |
| `/evals` | eval runs list/detail/compare (US4) |
| `/evals/gold` | gold authoring & re-confirmation queue (US3) |

Navigation: "Search" joins the primary nav; "Retrievals" joins the Records
section; "Evals" joins an operator tools section — all reachable without typing
URLs (Principle V).
