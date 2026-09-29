# Research: Library schema

## R1 — Embeddings as their own table

- **Decision**: `library_embeddings` is a separate table, one row per `(chunk_id, model)`,
  with `model text`, `dim integer CHECK (dim = 1024)`, `embedding vector(1024)`.
- **Rationale**: decision-0002 says model and dim are stored per row and a model switch is a
  re-embed job, not a schema change. The benchmark (TASK-0029) compares models on the same
  chunks, so several models' vectors must coexist. Columns on `chunks` would need a column per
  model or overwrite the old vector.
- **Alternatives**: vector column on chunks (rejected: one model only; re-embed rewrites chunk
  rows, which the immutability trigger forbids).

## R2 — HNSW, cosine

- **Decision**: `CREATE INDEX … USING hnsw (embedding vector_cosine_ops)` with pgvector
  defaults (`m = 16`, `ef_construction = 64`); btree on `model`.
- **Rationale**: HNSW builds incrementally and needs no training data, so it is valid on an
  empty table in the first migration and stays good as books are added. IVFFlat computes its
  lists from existing rows; built on an empty table it degrades to near-random recall.
  Cosine suits text-embedding models (trained for it) and ignores norm differences between
  providers behind the gateway.
- **Alternatives**: IVFFlat (rejected above); L2 (rejected: norm-sensitive across providers);
  per-model partial HNSW indexes (deferred — `ponytail:` note; add when a second model is
  stored at scale and filtered recall measurably drops, which TASK-0029 will show).

## R3 — Full-text search

- **Decision**: `tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED` +
  `GIN (tsv)`. Drizzle 0.45 expresses it via a `customType` for `tsvector` and
  `.generatedAlwaysAs(sql\`to_tsvector('english', text)\`)`; if drizzle-kit emits it
  incorrectly, hand-edit the generated SQL.
- **Rationale**: generated means ingestion cannot forget it (spec US2 AC2); `english`
  stemming matches the corpus (Assumptions).
- **Alternatives**: expression GIN index on `to_tsvector(...)` with no column (rejected:
  every query must repeat the exact expression; easier to drift).

## R4 — Immutability

- **Decision**: one plpgsql function `library_immutable()` raising
  `'library is immutable after ingestion: % on %', TG_OP, TG_TABLE_NAME`, attached as
  `BEFORE UPDATE … FOR EACH ROW` on all three tables. DELETE is allowed. FKs are
  `ON DELETE CASCADE` (documents → chunks → embeddings).
- **Rationale**: same pattern as `events` (wiki `database-schema`): the guarantee holds even
  against a direct `psql` session (SC-004). Unlike `events`, library content must be
  removable, so only UPDATE is blocked.
- **Alternatives**: app-level only (rejected: weaker than the repo's own precedent).

## R5 — Span integrity

- **Decision**: CHECK `start_offset >= 0 AND end_offset > start_offset` on chunks.
  `storeParsedBook` validates every chunk before insert: `end <= text.length` and
  `text.slice(start, end) === chunk.text`. A mismatch throws `ValidationError` and nothing is
  written.
- **Rationale**: a DB-side equality check would compare Postgres character offsets with
  JS UTF-16 offsets; they diverge on astral characters (e.g. emoji). Offsets are defined in
  UTF-16 (the parser's unit), so the authoritative check is in TS, where the unit matches.
  The CHECK still catches reversed or empty spans from any writer.
- **Alternatives**: DB trigger comparing `substring()` (rejected: unit mismatch, false
  failures on astral text).

## R6 — Migration and test workflow

- **Decision**: edit `src/schema/library.ts` → `db:generate` → hand-add to the new SQL, in
  order: `CREATE EXTENSION IF NOT EXISTS vector;` (first statement), the trigger function and
  three triggers (last). Integration tests use the repo's loud-skip harness; locally, run
  `pnpm env:up` in the worktree and use its `TEST_DATABASE_URL`; `REQUIRE_DATABASE=1` in CI.
- **Rationale**: matches the `migrations` wiki note (generated SQL is committed; `push` never
  used). The CI Postgres service is already `pgvector/pgvector:pg17`.

## R7 — Plane boundary

- **Decision**: no new rule. `apps/server/src/library/**` is already guarded; `schema/library.ts`
  imports only `drizzle-orm`.

## R8 — Document identity and replace

- **Decision**: unique index on `lower(trim(book))`. `storeParsedBook` runs in one
  transaction: `SELECT … FOR UPDATE` on an existing document with that key, delete it
  (cascade), insert the new document and all chunks (batched), commit. Concurrent stores of
  the same book serialize on the row lock or the unique index; the loser gets a clean error.
- **Rationale**: FR-010 (no mixed versions) and the edge case for racing ingestions.
- **Source metadata**: `source jsonb` (file names, byte size) and `content_hash text` (sha-256
  of the normalized text, stdlib `node:crypto`), both nullable; ingestion (TASK-0024) fills
  them.
