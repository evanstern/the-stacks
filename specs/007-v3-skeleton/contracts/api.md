# Contract: v3 API (Fastify)

**Consumer**: the web app's server-side client only (research R9). The browser never
calls the API directly. All routes are JSON over HTTP. Fastify route schemas double as
validation and OpenAPI source (D3).

## Error envelope & mapping convention (FR-018)

Domain errors are typed by cause and translated to transport codes **only** at the API
boundary. Every non-2xx response uses:

```json
{ "error": { "code": "<error_class>", "message": "<scrubbed, user-safe>" } }
```

| Error class | HTTP | Meaning | Pinned by |
|---|---|---|---|
| `unknown_thing` | 404 | Requested entity doesn't exist (e.g. unknown check-run id) | ≥1 contract test |
| `unsupported_type` | 415 | Payload/type the system doesn't handle | ≥1 contract test |
| `dependency_down` | 503 | A dependency (DB, sidecar) is unavailable | ≥1 contract test |
| `internal_fault` | 500 | Our bug; details logged operator-side, never in the body | ≥1 contract test |
| `unauthorized` (auth only) | 401 | Missing/invalid session or failed sign-in | auth contract tests |

Messages are scrubbed of secrets and internals; full diagnostics go to structured logs
(Principle IV).

## Auth (FR-006, FR-007)

### `POST /api/auth/login`

- Body: `{ "password": string }` (single operator — no username, D13)
- 200: `{ "ok": true }` + `Set-Cookie: stacks_v3_session=<sealed>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000[; Secure]`
- 401: fixed non-revealing body `{ "error": { "code": "unauthorized", "message": "Sign-in failed." } }` — identical for wrong password and any other credential-shaped failure; no session cookie set.

### `POST /api/auth/logout`

- 200: `{ "ok": true }` + expired `Set-Cookie` clearing the session.

### `GET /api/auth/session`

- 200: `{ "authenticated": true }` with a valid session cookie
- 401: envelope above — used by web loaders to gate routes.

## Health & readiness (FR-003) — unauthenticated

### `GET /health`

- 200 `{ "status": "ok" }` as soon as the process serves HTTP (liveness).

### `GET /ready`

- 200 when migrations have applied and the DB pool answers `select 1`:
  `{ "status": "ready", "checks": { "database": "ready", "migrations": "applied" } }`
- 503 (`dependency_down` envelope + same `checks` shape with the failing entry marked
  `"failed"` or `"starting"`) otherwise. Readiness implies schema-current (research R10).

Every other route requires a valid session; without one → 401 `unauthorized`.

## Skeleton checks (FR-008…FR-012)

### `POST /api/skeleton-checks`

Accept-then-async (Principle IV). Creates a run + enqueues its job in one transaction.

- Body: none (input text is the built-in synthetic fixture)
- **202**: `{ "run": { "id": "<uuid>", "status": "accepted", "createdAt": "<iso>" } }`
- 503 `dependency_down`: DB unavailable (nothing was accepted).

### `GET /api/skeleton-checks`

- 200: `{ "runs": [ <RunSummary>, ... ] }` newest-first, capped at 50.
  `RunSummary = { id, status, createdAt, completedAt }`

### `GET /api/skeleton-checks/:id`

- 200:

```json
{
  "run": {
    "id": "uuid",
    "status": "accepted | running | succeeded | failed",
    "createdAt": "iso", "startedAt": "iso|null", "completedAt": "iso|null",
    "outcome": { "class": "dependency_down", "seam": "inference", "message": "..." },
    "vector": {
      "id": "sha256-hex",
      "provider": "local-sidecar",
      "model": "<from env>",
      "dimensions": 384,
      "readbackDistance": 0.0
    },
    "events": [
      { "seam": "queued",          "ok": true, "durationMs": 3,   "detail": {}, "at": "iso" },
      { "seam": "claimed",         "ok": true, "durationMs": 1204,"detail": {}, "at": "iso" },
      { "seam": "inference",       "ok": true, "durationMs": 88,  "detail": { "model": "..." }, "at": "iso" },
      { "seam": "vector_write",    "ok": true, "durationMs": 12,  "detail": { "deduplicated": false }, "at": "iso" },
      { "seam": "vector_readback", "ok": true, "durationMs": 9,   "detail": { "distance": 0.0 }, "at": "iso" },
      { "seam": "completed",       "ok": true, "durationMs": null,"detail": {}, "at": "iso" }
    ]
  }
}
```

  `outcome` present only when `status="failed"`; `vector` only when `"succeeded"`.
  Events are returned in insertion order and are append-only upstream (FR-010).
- 404 `unknown_thing`: no such run id.

## Status codes summary

`202` accept; `200` reads; `401` unauthenticated; `404/415/503/500` per the mapping
table. No other codes are part of the contract.
