# Data model: Library schema

All three tables are library plane (constitution III). UPDATE on any of them is refused by
trigger `library_immutable` (research R4). DELETE cascades documents → chunks → embeddings.

## library_documents

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | `defaultRandom()` |
| book | text NOT NULL | display name as imported |
| text | text NOT NULL | the parser's `ParsedBook.text` (normalized full text) |
| content_hash | text NULL | sha-256 hex of `text` |
| source | jsonb NULL | `{ files?: string[], bytes?: number }` — filled by ingestion |
| imported_at | timestamptz NOT NULL | default `now()` |

Indexes: unique `library_documents_book_key` on `lower(trim(book))`.

## library_chunks

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | `defaultRandom()` |
| document_id | uuid NOT NULL | FK → library_documents.id ON DELETE CASCADE |
| ordinal | integer NOT NULL | position in the book, 0-based |
| kind | text NOT NULL | CHECK in (`heading`,`prose`,`list`,`table`,`statBlock`,`sidebar`) |
| path | text[] NOT NULL | section path (headings), outermost first |
| text | text NOT NULL | the chunk's text |
| start_offset | integer NOT NULL | UTF-16 offset into document text, inclusive |
| end_offset | integer NOT NULL | exclusive; CHECK `start_offset >= 0 AND end_offset > start_offset` |
| tsv | tsvector | GENERATED ALWAYS AS (`to_tsvector('english', text)`) STORED |

Indexes: unique `(document_id, ordinal)`; GIN on `tsv`.

Store-time invariant (TS, research R5): `end_offset <= document.text.length` and
`document.text.slice(start_offset, end_offset) === text`.

`kind` is a CHECK-constrained text column, not a Postgres enum — same reason as
`users.role` (wiki `database-schema`): adding a kind later needs no enum migration.

## library_embeddings

| Column | Type | Rules |
|---|---|---|
| id | uuid PK | `defaultRandom()` |
| chunk_id | uuid NOT NULL | FK → library_chunks.id ON DELETE CASCADE |
| model | text NOT NULL | the gateway's model name |
| dim | integer NOT NULL | CHECK `dim = 1024` |
| embedding | vector(1024) NOT NULL | |
| created_at | timestamptz NOT NULL | default `now()` |

Indexes: unique `(chunk_id, model)`; btree on `model`; HNSW on `embedding`
`vector_cosine_ops`.

## Mapping from the parser

`ParsedBook { book, text, blocks[] }` → one document (`book`, `text`) and one chunk per block
(`ordinal` = index, `kind`, `path`, `text`, `start_offset` = `anchor.start`,
`end_offset` = `anchor.end`). `anchor.book` equals the document's `book` and is not stored
twice. `table`/`statBlock` structured payloads are not stored in this task (their flattened
`text` is); add a `detail jsonb` column when a consumer needs them.
