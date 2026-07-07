# Data Model: Extensible Ingestion Service

Storage: PostgreSQL (Drizzle schema in `packages/db/src/schema/ingestion.ts`, one
drizzle-kit migration). Conventions inherited from the skeleton: `text` + CHECK instead
of pg enums; timestamptz; append-only tables have exactly one writer function; the
un-dimensioned pgvector `customType` from `skeleton-vectors.ts` is reused.

Research references: R1 (archives), R8 (generations), R9 (IDs), R10 (jobs), R11 (events).

## Entity overview

```text
corpora 1──n sources 1──1 source_archives (by fingerprint)
                 │ 1──n document_sections (per generation)
                 │ 1──n chunks            (per generation; vector + fts live here)
                 │ 1──n ingestion_events  (append-only)
batches 1──n sources (nullable — single uploads have no batch)
jobs (existing table) ── payload references source_id / batch_id
```

## Tables

### `corpora`

One row for now (FR-022 keeps the door open, D4).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL UNIQUE | seeded `default` corpus in migration |
| created_at | timestamptz NOT NULL | |

### `source_archives` — immutable, content-addressed (R1)

Append-only BY CONSTRUCTION: sole writer is intake/expand; no UPDATE/DELETE path in
code, ever (FR-023: re-ingestion never touches archives).

| Column | Type | Notes |
|---|---|---|
| fingerprint | text PK | sha256 hex of bytes — content addressing IS the key |
| bytes | bytea NOT NULL | ≤ `INGEST_MAX_UPLOAD_BYTES` |
| byte_size | integer NOT NULL | denormalized for listing without touching bytes |
| media_type | text NOT NULL | sniffed+validated at intake (R7), not trusted from client |
| created_at | timestamptz NOT NULL | |

### `batches` — one ZIP submission (FR-004)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | claim tickets for ZIP uploads point here |
| corpus_id | uuid NOT NULL → corpora | |
| original_filename | text NOT NULL | display only, never identity |
| status | text NOT NULL CHECK in (`expanding`,`expanded`,`failed`,`empty`) | `empty` = zero ingestible entries (honest outcome, R6) |
| entry_report | jsonb NOT NULL default `[]` | per-entry `{ name, outcome: ingested\|skipped, reason?, source_id? }` — written once at expand completion |
| created_at / updated_at | timestamptz NOT NULL | |

### `sources` — one ingestible unit and its lifecycle

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| corpus_id | uuid NOT NULL → corpora | FR-022 |
| batch_id | uuid NULL → batches | NULL for single-file uploads |
| fingerprint | text NOT NULL → source_archives | UNIQUE **(corpus_id, fingerprint)** — dedupe is per corpus (FR-003) |
| original_filename | text NOT NULL | |
| status | text NOT NULL CHECK in (`queued`,`processing`,`ingested`,`failed`,`empty`) | `empty` = plugin produced no sections (spec edge case) |
| plugin_name | text NULL | set at detect; NULL until then |
| plugin_version | text NULL | with plugin_name: FR-016's re-ingestion index — `(plugin_name, plugin_version)` indexed |
| detect_confidence | real NULL | recorded detection decision (FR-011) |
| current_generation | integer NOT NULL default 0 | 0 = nothing ingested yet; flip is THE atomic commit of a run (R8) |
| contract_version | text NULL | NormalizedDocument version the current generation was produced under |
| last_error | jsonb NULL | `{ class, stage, message }` scrubbed copy for status reads |
| created_at / updated_at | timestamptz NOT NULL | |

**State machine** (`status`):

```text
queued ──claim──▶ processing ──all stages ok, generation flipped──▶ ingested
   ▲                  │  └── transform yielded no sections ──▶ empty
   └── queue retry ───┤
                      └── attempts exhausted ──▶ failed
ingested/failed/empty ──re-ingest verb (FR-023)──▶ queued (generation target +1)
```

Status is *derived convenience* for listing; the event trail is the authoritative
history (Principle IV).

### `document_sections` — the persisted normalized document (FR-017)

Persisted (not just in-pipeline) so the archive-viewer artifacts and anchors survive for
citation deep-linking (Principle III) and so future re-chunking (eval program) can skip
extract/transform. Replaced wholesale per generation (R8).

| Column | Type | Notes |
|---|---|---|
| id | text PK | deterministic: sha256(source_fingerprint : plugin@version : generation : section_index) |
| source_id | uuid NOT NULL → sources | |
| generation | integer NOT NULL | reader predicate: `generation = sources.current_generation` |
| section_index | integer NOT NULL | document order |
| path | jsonb NOT NULL | heading trail, e.g. `["Chapter 3","Goblin"]` |
| kind | text NOT NULL CHECK in (`prose`,`stat_block`,`table`,`spell_entry`,`unclassified`) | contract vocabulary v1 (contracts/normalized-document.md) |
| heading | text NULL | |
| content | text NOT NULL | extracted text |
| anchor | jsonb NOT NULL | `{ artifactId, elementId?, charStart, charEnd }` — see contract |
| display_artifact | text NULL | sanitized HTML fragment for the future viewer (R2) |
| created_at | timestamptz NOT NULL | |

Index: `(source_id, generation, section_index)`.

### `chunks` — indexed passages (FR-021): vector + FTS in one row

| Column | Type | Notes |
|---|---|---|
| id | text PK | deterministic per R9 (includes generation) |
| source_id | uuid NOT NULL → sources | |
| corpus_id | uuid NOT NULL → corpora | denormalized for retrieval-time filtering (FR-022) |
| generation | integer NOT NULL | |
| chunk_index | integer NOT NULL | order within source+generation |
| content | text NOT NULL | |
| section_ids | jsonb NOT NULL | ids of contributing document_sections (traceability, Principle III) |
| anchor | jsonb NOT NULL | first contributing section's anchor (citation deep-link target) |
| oversized | boolean NOT NULL default false | atomic section > CHUNK_MAX_CHARS (R4) |
| plugin_name / plugin_version | text NOT NULL | stamped provenance (FR-016) |
| embedding | vector NULL | NULL until embed stage writes it; un-dimensioned column, reuse skeleton customType |
| embedding_provider / embedding_model | text NULL | FR-020 stamp — NULL only while embedding is NULL |
| embedding_dimensions | integer NULL | |
| fts | tsvector GENERATED ALWAYS AS (`to_tsvector('english', content)`) STORED | R5; GIN index |
| created_at | timestamptz NOT NULL | |

Indexes: GIN on `fts`; `(source_id, generation)`; `(corpus_id, generation)`.
Vector similarity index (HNSW/IVFFlat) is deliberately deferred to the retrieval spec —
writing correct rows is this feature's job; query-time ANN tuning is that spec's.

**Write discipline**: insert with `ON CONFLICT (id) DO NOTHING` (idempotent, FR-008);
embedding columns filled by a single UPDATE per chunk keyed on id where embedding IS
NULL — a retried embed stage skips completed rows (R10).

### `ingestion_events` — append-only trail (R11, FR-007/FR-010)

Sole writer: `recordIngestionEvent()` in `@stacks/db`. No UPDATE/DELETE path — the
skeleton's construction, copied.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| source_id | uuid NULL → sources | NULL for batch-scoped events |
| batch_id | uuid NULL → batches | expand-stage events |
| stage | text NOT NULL CHECK in (`intake`,`expand`,`detect`,`extract`,`transform`,`chunk`,`embed`,`index`,`commit`) | `commit` = generation flip + sweep |
| event | text NOT NULL CHECK in (`started`,`completed`,`failed`,`skipped`) | vocabulary contract: contracts/events.md |
| ok | boolean NOT NULL | |
| detail | jsonb NOT NULL default `{}` | scrubbed (counts, reasons, durations — never bytes/secrets) |
| duration_ms | integer NULL | |
| created_at | timestamptz NOT NULL | |

Index: `(source_id, created_at)`, `(batch_id, created_at)`.
CHECK: `source_id IS NOT NULL OR batch_id IS NOT NULL`.

### `jobs` (existing — no schema change)

New `kind` values only (the table's design goal): `ingest_batch_expand`
(payload `{ batchId }`), `ingest_source` (payload `{ sourceId, targetGeneration }`).
`targetGeneration` in the payload is what makes retry-vs-re-ingest unambiguous (R8/R9):
retries re-run with the same payload; a re-ingest verb enqueues a fresh job with
generation N+1.

## Claim tickets (FR-001/FR-010)

A ticket is not a table: it is the URL-addressable identity returned by intake —
`{ kind: "source", id }` or `{ kind: "batch", id }` — resolved by
`GET /v1/uploads/:ticket` into status + event trail (contracts/api.md). Duplicate
submissions return the *existing* source's ticket with `duplicate: true` (FR-003).

## Deterministic identity summary (R9)

```text
archive.fingerprint    = sha256(bytes)
section.id             = sha256(fingerprint:plugin@ver:gen:sectionIndex)
chunk.id               = sha256(corpus:fingerprint:plugin@ver:gen:chunkIndex:sha256(content))
chunk embedding row    = the chunk row itself (no separate vector table)
```

Helpers live in `@stacks/core` beside `deriveVectorId` (same doctrine, same tests).

## Validation rules (from spec FRs)

- Intake refuses: unsupported media type (sniffed, FR-002), size > cap (FR-002),
  ZIP entry count > `INGEST_MAX_BATCH_ENTRIES` (R6). All refusals: typed
  `unsupported_type`, no rows written.
- `sources` unique `(corpus_id, fingerprint)` enforces dedupe (FR-003) at the schema
  level; the API catches the conflict and answers with the existing ticket.
- `chunks` with non-NULL embedding MUST have all three stamp columns non-NULL
  (table CHECK) — FR-020's structural detectability.
- Readers of sections/chunks MUST join through `sources.current_generation` (R8);
  the retrieval spec inherits this predicate as its contract.
