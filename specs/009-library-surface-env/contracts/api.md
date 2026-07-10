# Contract: Library Listing API

**Feature**: 009-library-surface-env | Extends 008's `contracts/api.md` (intake +
ticket status). One new endpoint; nothing existing changes. Read-only end to end
(spec FR-009): this contract adds no verb that creates, mutates, or deletes.

## GET /api/uploads

Session-guarded like every non-health route (the global auth hook registered in
`app.ts` covers it by construction). Consumed only by the web app's server side via
`lib/api.server.ts` (007 FR-019 — the browser never calls this).

### Query parameters

| Param | Type | Default | Constraints |
|---|---|---|---|
| `limit` | integer | 50 | clamped to [1, 200] |
| `offset` | integer | 0 | ≥ 0 |

Malformed paging values (non-numeric, negative) → `400` with envelope
`{"error":{"code":"invalid_input","message":"querystring/… must be integer"}}`.
Mechanism: Fastify querystring schema validation, mapped at the app.ts boundary to the
API-only `invalid_input` code (joining `unauthorized` — the shared ErrorClass taxonomy
stays untouched; mapping still lives in app.ts only).

### Response — `200`

```jsonc
{
  "items": [
    {
      "kind": "source",                    // standalone sources only (batch_id IS NULL)
      "id": "uuid",
      "originalFilename": "goblin.html",
      "status": "ingested",                // queued | processing | ingested | failed | empty
      "plugin": {                          // null until detect ran
        "name": "ddb-saved-html",
        "version": "1.0.0",
        "confidence": 0.95
      },
      "generation": 1,                     // 0 = nothing ingested yet
      "counts": { "sections": 12, "chunks": 34 },   // CURRENT generation only
      "lastError": null,                   // scrubbed {class, stage, message} when failed
      "createdAt": "2026-07-09T…Z",
      "updatedAt": "2026-07-09T…Z"
    },
    {
      "kind": "batch",
      "id": "uuid",
      "originalFilename": "export.zip",
      "status": "expanded",                // expanding | expanded | failed | empty
      "entrySummary": { "ingested": 8, "skipped": 2, "failed": 1, "total": 11 },
      "createdAt": "2026-07-09T…Z",
      "updatedAt": "2026-07-09T…Z"
    }
  ],
  "total": 42,                             // all submissions, for "showing X of Y"
  "limit": 50,
  "offset": 0
}
```

### Semantics

- **Ordering**: `createdAt` DESC, id DESC as tiebreaker — newest first (FR-002).
- **Row population**: submissions only — standalone sources + batches; batch members
  are represented by their batch's `entrySummary` and reachable via the batch detail
  (research R2).
- **Counts**: computed over `generation = current_generation` (the 008 reader
  predicate); a source mid-re-ingest never shows the aside-written next generation.
- **Empty library**: `200` with `items: [], total: 0` — an empty list is a normal
  answer, not an error (FR-007's honest empty state is the web layer's job).
- **Ticket mapping**: every item's `(kind, id)` is exactly the existing detail route's
  `/api/uploads/:kind/:id` params — and the web detail page's URL params (FR-003).

### Auth

- No/invalid session → `401` (global hook; identical to every protected route).
