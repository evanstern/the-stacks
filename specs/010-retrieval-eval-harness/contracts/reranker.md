# Sidecar Contract: /v1/rerank

Extends the ML sidecar (apps/ml) with a second inference endpoint. Same doctrine
as `/v1/embed` (007): inference-only, no DB access, env-first model role, honest
status codes. `/ready` gains the reranker's state.

## Role resolution (startup)

- `RERANKER_MODEL` + `RERANKER_PROVIDER` env vars (D14 — no hardcoded ids).
- Unset ⇒ role `disabled`: `/ready` reports `reranker: "disabled"`, `/v1/rerank`
  answers `503` with code `model_not_configured`. The TS engine refuses
  `RETRIEVAL_RERANK=on` at config resolution when the role is disabled — fail
  fast at boot/config time, not per request.
- Set ⇒ loaded as a background task at startup (like the embedding model — the
  hf-cache volume pays the download once); `/ready` reports
  `reranker: "loading" | "ready" | "failed"`.

## POST /v1/rerank

Request:
```json
{
  "model": "<must equal the configured RERANKER_MODEL>",
  "query": "operator's query text",
  "passages": [ { "id": "chunk-id", "text": "passage text" }, ... ]
}
```

Response `200`:
```json
{
  "model": "<the model that scored>",
  "scores": [ { "id": "chunk-id", "score": 12.37 }, ... ]
}
```

- `scores` covers every input passage exactly once, same ids, any order — the
  CALLER re-sorts (the engine owns ordering; the sidecar owns scoring).
- Scores are the cross-encoder's raw relevance logits — comparable within one
  response only; never persisted as normalized values (the run record stores
  them raw, contracts/metrics.md never mixes them across runs).

## Errors (mirrors /v1/embed exactly)

| Status | Code | When |
|---|---|---|
| 404 | `unknown_model` | body.model ≠ configured role |
| 415 | `invalid_input` | empty passages, non-string text, > 256 passages, query > 1024 chars |
| 503 | `model_loading` / `model_failed` / `model_not_configured` | not ready to score |

## Limits & determinism

- ≤ 256 passages per call (engine sends `RETRIEVAL_RERANK_DEPTH` ≤ 50 by default).
- Same model + same inputs ⇒ same scores (inference in eval mode, no sampling) —
  the property eval comparisons rely on.

## Tests (apps/ml)

pytest: role-disabled 503 path, wrong-model 404, malformed 415, happy path with a
stub CrossEncoder (monkeypatched scorer — no model download in CI), /ready state
transitions. pyright clean.
