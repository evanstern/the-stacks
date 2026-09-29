---
name: library-schema
description: The library plane's storage (spec 013) — library_documents/library_chunks/library_embeddings, their immutability trigger, and the one write path (storeParsedBook, attachEmbeddings) that validates spans and dimensions before any database call.
kind: component
sources:
  - apps/server/src/schema/library.ts
  - apps/server/src/library/store.ts
  - apps/server/drizzle/0002_tiny_odin.sql
verified_against: 3e10556dd63b63882ae5af22da7a9d29b0c32d9f
---

# Library schema

`apps/server/src/schema/library.ts` and `apps/server/src/library/store.ts` are the library
plane's only storage and only write path (constitution III: three planes; the library plane
was empty at M0 and lands here, TASK-0022). Three tables hold an imported book: one
`library_documents` row, its ordered `library_chunks`, and per-model `library_embeddings`.
Nothing else in the codebase writes to these tables.

## How it works

**`library_documents`** — one row per imported book: `book` (display name), `text` (the
parser's full normalized text), `content_hash` (sha-256 hex of `text`), `source` (jsonb,
filled by ingestion), `imported_at`. Unique index `library_documents_book_key` on
`lower(trim(book))` — "Basic Rules" and " basic rules " are the same book, and re-storing one
replaces it wholesale rather than coexisting.

**`library_chunks`** — one row per parser block: `document_id` (FK, cascade), `ordinal`
(0-based position), `kind` (CHECK-constrained text, not an enum — `heading`/`prose`/`list`/
`table`/`statBlock`/`sidebar` — same reasoning as `users.role` in [[database-schema]]),
`path` (section headings, outermost first), `text`, `start_offset`/`end_offset` (UTF-16
offsets into the document's `text`; CHECK `start_offset >= 0 AND end_offset > start_offset`),
and `tsv` — a **generated** `tsvector` column (`GENERATED ALWAYS AS (to_tsvector('english',
"text")) STORED`), so keyword search data exists the instant a chunk is inserted with no
separate indexing step to forget. A GIN index (`library_chunks_tsv_idx`) serves it; a unique
index on `(document_id, ordinal)` guards position. The store-time round-trip invariant
(`document.text.slice(start_offset, end_offset) === chunk.text`) is checked in **TypeScript**,
not SQL — offsets are UTF-16, the same unit the parser and `String.slice` use, and a
Postgres-side `substring()` check would compare character offsets instead, diverging on
astral text.

**`library_embeddings`** — one row per chunk per model: `chunk_id` (FK, cascade), `model`
(the gateway's model name), `dim` (CHECK `= 1024`), `embedding` (`vector(1024)`,
`vector_cosine_ops`), `created_at`. Unique index on `(chunk_id, model)` — one vector per model
per chunk; btree on `model` for the equality half of a per-model nearest-neighbour query; HNSW
on `embedding` for the similarity half (chosen over IVFFlat because it builds incrementally
with no training step, so it's valid starting from an empty table). One HNSW index is shared
across every model — no per-model partial indexes (`ponytail` comment in the schema; add one
when TASK-0029 shows filtered recall dropping at scale).

**The write path** (`apps/server/src/library/store.ts`) exposes two functions, both usable by
ingestion or by an agent through the same interface (constitution I):

- `storeParsedBook(db, book, meta?)` — Zod-validates the book, then in TypeScript checks
  every block's span is non-empty, in-bounds, and slices back to that block's own text
  (throwing `ValidationError` before any database call on the first failure). One
  transaction: `SELECT ... FOR UPDATE` locks any existing document under the same
  case/whitespace-insensitive book name, deletes it (cascading to its chunks and
  embeddings), inserts the new document (with a sha-256 `content_hash`) and its chunks in
  batches of 2000 rows (comfortably under Postgres's 65,535-parameter-per-statement limit,
  so an ~8,000-chunk book completes in a handful of round trips inside the one transaction).
  A unique-constraint race on the book name surfaces as `ConflictError`.
- `attachEmbeddings(db, rows)` — validates every row's `dim`/`vector.length === 1024` before
  any database call, then inserts all rows in one transaction. A duplicate `(chunkId, model)`
  anywhere in the batch throws `ConflictError` and writes nothing from that call — Postgres's
  unique-violation error (`23505`) arrives wrapped in a `DrizzleQueryError`, detected by the
  shared `isUniqueViolation` in [[database-access]]'s `db.ts` (also used by [[invitations]]'s
  redeem path), which checks both `err.code` and `err.cause.code`.

**Immutability is a database trigger, not application logic** (research R4), the same pattern
as `events`' append-only guard in [[database-schema]]: `library_immutable()` raises on any
`UPDATE` against `library_documents`, `library_chunks`, or `library_embeddings`, including
from a direct `psql` session. `DELETE` is allowed and cascades via each table's
`ON DELETE CASCADE` FK — replacing or removing a book is the only way to change library
content.

## Connections

Depends on [[ddb-parser]]'s `ParsedBook` shape as `storeParsedBook`'s input, and on
[[ai-gateway]]'s `embed()` output shape (`{vector, model, dim}`) as `attachEmbeddings`'s
input — neither module imports the other directly. Migration mechanics (hand-added
`CREATE EXTENSION IF NOT EXISTS vector;` and the trigger) follow the pattern in
[[migrations]]. Shares its unique-violation detector with [[invitations]] via
[[database-access]]. See [[database-schema]] for the session/auth-plane tables this note
doesn't cover.

## Operational notes

Retrieval queries, ingestion jobs, and chunking strategy are out of scope here (TASK-0024,
TASK-0026) — this schema only guarantees the indexes those later features need exist and are
used, which the integration suite checks directly: `EXPLAIN` with `enable_seqscan = off`
must name `library_chunks_tsv_idx` for a keyword query, and `library_embeddings_embedding_idx`
for a per-model nearest-neighbour query (with `enable_bitmapscan`/`enable_sort` also disabled
in the test — on a tiny table Postgres otherwise prefers the `model` btree index plus an
in-memory sort over the HNSW scan).
