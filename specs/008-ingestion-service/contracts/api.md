# Contract: Ingestion API

**Provider**: `apps/api` (Fastify). **Consumers**: the web app (through
`app/lib/api.server.ts` only — 007 FR-019) and the operator via curl. All routes sit
behind the existing session guard (D13). Error envelope and status mapping are the
skeleton's: `DomainError` classes → HTTP only in `app.ts`
(`unknown_thing` 404, `unsupported_type` 415, `dependency_down` 503, `internal_fault`
500); body shape `{ "error": { "code", "message" } }`.

## `POST /v1/uploads` — intake (FR-001..005, research R7)

`multipart/form-data`, field `file` (exactly one). Optional field `corpus` (name;
defaults to `default`).

Synchronous behavior, in order:

1. Sniff media type (magic bytes + extension); declared-vs-actual mismatch or
   unsupported type → **415**, nothing written (FR-002). Supported at intake:
   `text/html`, `text/markdown`, `text/plain`, `application/zip`.
2. Enforce `INGEST_MAX_UPLOAD_BYTES` inside the multipart stream → over-cap **415**
   with a size-limit reason, nothing written.
3. sha256 while streaming (R7).
4. One transaction: archive upsert → source (or duplicate detection) → batch row if
   ZIP → `enqueue()` job. Response < 2 s within cap (SC-002).

**201** (new single file):

```json
{
  "ticket": { "kind": "source", "id": "<uuid>" },
  "duplicate": false,
  "status": "queued"
}
```

**200** (duplicate content, FR-003): same shape with `"duplicate": true` and the
*existing* source's ticket — no new rows, and the body says why.

**201** (ZIP): `{ "ticket": { "kind": "batch", "id": "<uuid>" }, "duplicate": false,
"status": "expanding" }`. Duplicate ZIP (same archive fingerprint, same corpus) → 200 +
existing batch ticket.

## `GET /v1/uploads/:kind/:id` — ticket status (FR-010, US2)

`:kind` ∈ `source` | `batch`. Unknown id → **404** (`unknown_thing`).

**200** for `source`:

```json
{
  "ticket": { "kind": "source", "id": "…" },
  "source": {
    "originalFilename": "goblin.html",
    "status": "ingested",
    "plugin": { "name": "ddb-saved-html", "version": "1.0.0", "confidence": 0.97 },
    "generation": 1,
    "counts": { "sections": 12, "chunks": 5 },
    "lastError": null
  },
  "events": [
    { "stage": "detect", "event": "completed", "ok": true,
      "detail": { "plugin": "ddb-saved-html", "confidence": 0.97 },
      "durationMs": 12, "at": "2026-07-07T00:00:00Z" }
    // … ordered by created_at; the full append-only trail, always (US2 AC-3)
  ]
}
```

**200** for `batch`: batch status + `entryReport` (per-entry outcome with reasons,
FR-004) + a per-source summary `{ sourceId, filename, status }` for navigation.

`lastError`, when present, is the scrubbed `{ class, stage, message }` copy — full
diagnostics stay in operator-side logs and event `detail` (Principle IV).

## Non-endpoints (scope fences)

- No delete/reset/re-embed verbs (FR-025 — corpus lifecycle spec). The re-ingest verb
  (FR-023) ships as the minimal `POST /v1/sources/:id/reingest` **only if** tasks.md
  finds US5's acceptance needs it end-to-end; otherwise re-ingestion is exercised at the
  package level and the verb arrives with corpus lifecycle. Decision deferred to
  /speckit-tasks against US5's independent-test criterion.
- No search/query endpoints (FR-026 — retrieval spec).
- No archive-content viewer endpoint (artifacts are stored, viewer is a later spec).

## Web surface (FR-027, research R12)

- `GET /library/upload` (RR7 route): form posting to the API via `api.server.ts`.
- `GET /library/uploads/:kind/:id`: renders the ticket-status payload, auto-revalidates
  while non-terminal. URL-addressable (Principle V); no browser→API calls (007 FR-019).

## Environment additions (contract with `.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `INGEST_MAX_UPLOAD_BYTES` | `26214400` (25 MB) | intake + per-ZIP-entry cap |
| `INGEST_MAX_BATCH_ENTRIES` | `200` | ZIP entry cap (R6) |
| `CHUNK_TARGET_CHARS` | `4000` | chunk packing budget (R4, eval-tunable) |
| `CHUNK_OVERLAP_CHARS` | `400` | prose overlap |
| `CHUNK_MAX_CHARS` | `6000` | hard budget; larger atomic sections flag `oversized` |

Embedding role variables are the existing 007 contract (no changes).
