# Data model: Ingestion pipeline

## Table `jobs` (new; migration `0003_*`)

Operational state of the library plane: one row per upload. Not book content, so the
`library_immutable` trigger does not apply; rows are updated as the job progresses.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `kind` | text | no | `'ingest'` | CHECK `kind IN ('ingest')`. decision-0005 names one `jobs` table; later job kinds extend the CHECK. |
| `book` | text | no | — | Book name as uploaded. |
| `status` | text | no | `'queued'` | CHECK `IN ('queued','running','succeeded','failed')` |
| `stage` | text | yes | — | CHECK `IN ('extract','parse','store','embed')`; null when queued or terminal |
| `attempts` | integer | no | `0` | Incremented by each claim. |
| `claim_token` | uuid | yes | — | New per claim; fences every worker write. |
| `heartbeat_at` | timestamptz | yes | — | Lease clock. |
| `input` | jsonb | no | — | `{ format: "zip"\|"html"\|"markdown", filename: string, bytes: number, uploadPath: string }` |
| `result` | jsonb | yes | — | See `JobResult`. Set on `succeeded`. |
| `error` | text | yes | — | Failure reason, set on `failed`. Never contains book text. |
| `created_at` | timestamptz | no | `now()` | |
| `started_at` | timestamptz | yes | — | First claim. |
| `finished_at` | timestamptz | yes | — | Terminal transition. |

Indexes:
- `jobs_claim_idx ON jobs (status, created_at)` — serves the claim query.
- `jobs_active_book_key UNIQUE ON jobs (lower(trim(book))) WHERE status IN ('queued','running')`
  — at most one active job per book (R7).

Drizzle: `apps/server/src/schema/jobs.ts`, exported through the schema directory that
`drizzle.config.ts` already scans. Generate with `pnpm db:generate`; the partial unique
index and CHECKs are expressible in Drizzle, so no hand-added SQL is expected. Any hand
edit gets a SQL comment.

## State machine

```
queued ──claim──▶ running ──ok──▶ succeeded
   ▲                 │  └─error──▶ failed
   └──(lease expiry: claimable again, attempts+1; attempts > 3 ⇒ failed)
```

- `stage` advances `extract → parse → store → embed` within `running`.
- Terminal rows (`succeeded`, `failed`) never change again. Their upload file is deleted.

## `JobResult` (jsonb)

```ts
interface JobResult {
  pages: number;            // HTML/Markdown pages ingested (after de-duplication)
  duplicatePages: number;   // byte-identical pages dropped
  ignoredEntries: number;   // __MACOSX, .DS_Store, ._*, *_files/, directories
  skippedEntries: number;   // other non-page, non-zip entries (never inflated)
  parser: "ddb" | "html" | "markdown";
  documentId: string;
  chunkCount: number;
  replaced: boolean;        // an earlier book of the same name was replaced
  embedding:
    | { status: "embedded"; model: string; count: number }
    | { status: "skipped"; reason: string };
}
```

## Chunk (existing table `library_chunks`, unchanged)

A chunk is a `ParsedBook` block produced by `chunkBook` (research R5) and stored by the
unchanged `storeParsedBook`: `kind` (single-block kind, or `prose` when merged), `path`
(section), `text` (= document text sliced at the span), `start_offset`/`end_offset`.

## Embedding (existing table `library_embeddings`, unchanged)

`model` MUST be the `EmbedVector.model` the gateway returned for the purpose named by
`RETRIEVAL_EMBED_PURPOSE` (TASK-0026 contract). `dim` is the gateway's `dim` (1024).

## Configuration

| Variable | Default | Read by |
|---|---|---|
| `UPLOAD_MAX_BYTES` | `1073741824` (1 GiB) | `loadConfig` → `ServerConfig.uploadMaxBytes` |
| `RETRIEVAL_EMBED_PURPOSE` | `embedding` | shared with TASK-0026 (research R10) |

Code constants (not env): `LEASE_MS = 60_000`, `HEARTBEAT_MS = 10_000`, `POLL_MS = 2_000`,
`MAX_ATTEMPTS = 3`, `MAX_ZIP_DEPTH = 3`, `CHUNK_MAX_CHARS = 2000`, `EMBED_BATCH = 256`,
request timeout one hour.
