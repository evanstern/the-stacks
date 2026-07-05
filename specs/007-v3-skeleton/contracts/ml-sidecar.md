# Contract: ML Inference Sidecar

**Provider**: `v3/apps/ml` (Python 3.12, FastAPI). **Consumers**: worker (and later,
api) over the compose-internal network. Stateless, inference-only, no DB access (D2).
Never published in prod compose; dev publishes `V3_ML_PORT` for inspection only.

## Model lifecycle & warm-up (research R4)

- The served embedding model is pinned by env: `ML_EMBEDDING_MODEL` (HF model id).
- Startup lifespan downloads (into the `hf-cache` named volume) and loads the model
  **before** readiness flips. First start pays the download once; warm starts load from
  cache (SC-001).
- The sidecar serves exactly the pinned model. This is the seam-level guard against
  silent vector-space mixing (Principle VII): a consumer configured for a different
  model gets a typed refusal, never a wrong-space embedding.

## Endpoints

### `GET /health` — liveness, unauthenticated

- 200 `{ "status": "ok" }` as soon as HTTP is served (model may still be loading).

### `GET /ready` — readiness, unauthenticated

- 200 `{ "status": "ready", "model": "<ML_EMBEDDING_MODEL>", "dimensions": <int> }`
  once the model is loaded.
- 503 `{ "status": "loading" }` while downloading/loading;
  503 `{ "status": "failed", "message": "<scrubbed>" }` if the load failed.
  (starting / ready / failed distinction — FR-003.)

### `POST /v1/embed`

Synchronous, batch-in/batch-out.

Request:

```json
{ "model": "sentence-transformers/all-MiniLM-L6-v2", "inputs": ["text one", "text two"] }
```

- `model` (required): must equal the loaded model — callers assert their configured
  identity on every call.
- `inputs` (required): 1..`EMBED_MAX_BATCH` (default 64) non-empty strings.

Response 200:

```json
{
  "model": "sentence-transformers/all-MiniLM-L6-v2",
  "dimensions": 384,
  "embeddings": [[0.01, ...], [0.02, ...]],
  "duration_ms": 88
}
```

`embeddings[i]` corresponds to `inputs[i]`; every row has exactly `dimensions` floats.

Errors (same envelope shape as the API: `{ "error": { "code", "message" } }`):

| Condition | HTTP | code |
|---|---|---|
| `model` ≠ loaded model | 404 | `unknown_thing` |
| empty `inputs`, > `EMBED_MAX_BATCH` items, or non-string/empty entries | 415 | `unsupported_type` |
| model not yet loaded / load failed | 503 | `dependency_down` |
| inference raised | 500 | `internal_fault` |

## Consumer behavior (worker)

- Call timeout `ML_REQUEST_TIMEOUT_MS` (default 15000). Connection refused, timeout, or
  503 from the sidecar → the worker records the failure as
  `{class: 'dependency_down', seam: 'inference'}` (FR-011) and lets queue retry/backoff
  handle recovery; 404/415/500 → `internal_fault` at the same seam (misconfiguration is
  our bug, not a down dependency).
- The worker asserts `response.dimensions === configured dimensions`; mismatch →
  `internal_fault` before anything is written (stamp integrity, FR-014).
