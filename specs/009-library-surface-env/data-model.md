# Data Model: Library Operator Surface & Worktree Environment Protocol

**Feature**: 009-library-surface-env | **Date**: 2026-07-09

**No schema changes.** Part A reads the 008 tables exactly as they are
(`packages/db/src/schema/ingestion.ts`); Part B's "entity" is a file format, not a
table. Everything below is a read-model or an artifact shape.

## Read models (Part A)

### LibraryListItem (API wire shape, contracts/api.md)

A discriminated union over `kind`, mirroring the ticket vocabulary so every item maps
1:1 onto `/library/uploads/:kind/:id`.

**Common fields** (both kinds):

| Field | Source | Notes |
|---|---|---|
| `kind` | discriminator | `"source"` \| `"batch"` |
| `id` | `sources.id` / `batches.id` | ticket id |
| `originalFilename` | same-named column | |
| `status` | same-named column | source: queued/processing/ingested/failed/empty; batch: expanding/expanded/failed/empty |
| `createdAt`, `updatedAt` | same-named columns | listing orders by `createdAt` DESC |

**`kind: "source"`** (standalone sources only — `batch_id IS NULL`, research R2):

| Field | Source | Notes |
|---|---|---|
| `plugin` | `pluginName`/`pluginVersion`/`detectConfidence` | `null` until detect ran (US3 AC-1) |
| `generation` | `currentGeneration` | 0 = nothing ingested yet |
| `counts` | grouped aggregates (research R3) | `{ sections, chunks }` over the CURRENT generation only |
| `lastError` | `sources.lastError` | scrubbed `{class, stage, message}`; drives the failure row treatment (US3 AC-2) |

**`kind: "batch"`**:

| Field | Source | Notes |
|---|---|---|
| `entrySummary` | computed in TS from `batches.entryReport` | `{ ingested, skipped, failed, total }` (US3 AC-3) — `failed` derives from member-source statuses when the report outcome alone can't say |

### ListUploadsPage (envelope)

| Field | Notes |
|---|---|
| `items` | `LibraryListItem[]`, newest first |
| `total` | count of all submissions (standalone sources + batches) — powers "showing X of Y" (FR-008) |
| `limit` / `offset` | echoed request paging (default 50, max 200 — research R4) |

**Validation rules**: `limit` clamped to [1, 200]; `offset` ≥ 0; non-numeric paging
values are a typed `DomainError` (`unsupported_type` → 400 via app.ts mapping), never a
silent default.

**Invariant carried from 008**: counts filter on `generation = current_generation` —
the listing must never observe a half-swapped re-ingest (008 research R8's reader
predicate applies to every reader, including this one).

## Artifact shapes (Part B)

### Worktree environment profile (a worktree's `.env`, minted by the tool)

| Group | Keys | Derivation (research R6/R7) |
|---|---|---|
| Identity | `COMPOSE_PROJECT_NAME` | `the-stacks-<worktree-dirname>`; `main/` keeps `the-stacks-v3` |
| Ports | `V3_WEB_PORT`, `V3_API_PORT`, `V3_ML_PORT`, `V3_POSTGRES_PORT` | default + `10 × NNN` (feature number); `main/` = offset 0 |
| Port-coupled | `API_INTERNAL_URL` | `http://api:<derived V3_API_PORT>` — derived, never hand-maintained |
| Secrets | `OPERATOR_PASSWORD_HASH`, `SESSION_SECRET` | copied from `--secrets-from` or left blank with warning; never generated silently, never committed |
| Everything else | remaining `.env.example` keys | template defaults pass through untouched |

**State transitions**: mint (create; refuses if `.env` exists) → check (drift report,
read-only) → re-mint with `--force` (deliberate overwrite). There is no in-place
mutation path — reconciliation is re-mint or manual edit, both explicit.

### Port block registry (implicit)

No registry file exists — determinism replaces registration: block uniqueness is
inherited from feature-number uniqueness. The mint tool's sibling scan
(`../*/.env`) is a *verification* of the invariant, not the source of it.
