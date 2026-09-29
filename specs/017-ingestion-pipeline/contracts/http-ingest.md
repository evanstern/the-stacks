# Contract: ingestion HTTP routes and job status

Mounted at `/library` in `createApp`, before the static catch-all. Consumers: the chat UI
(TASK-0028) shows job status; the load benchmark (TASK-0030) enqueues and polls jobs; agents
drive ingestion through the same routes (constitution I). Binding before implementation.

All three routes require a session whose role is `operator`. No session → `401
unauthorized`; any other role → `403 forbidden`. Errors use the `{ error: { kind, message,
issues? } }` shape from `errors.ts`.

## `POST /library/uploads`

Query parameters:

| Name | Required | Rule |
|---|---|---|
| `book` | yes | trimmed, 1..200 chars |
| `filename` | no | the original file name, ≤ 255 chars; used for format detection and display. Default `upload`. |

Body: the file's raw bytes. Any `Content-Type`. Not multipart, not JSON.

Format detection (research R4): body begins `PK\x03\x04` or `PK\x05\x06` → `zip`;
else `filename` ends `.md`/`.markdown` → `markdown`; else `html`.

Responses:

| Status | Body | When |
|---|---|---|
| `202` | `{ job: JobStatus }` | Body fully on disk and job queued. |
| `400 validation` | issues on `book` / `filename`, or `(root)` "Upload body is empty." | Bad query or empty body. |
| `401` / `403` | — | Auth. |
| `409 conflict` | "A job for this book is already queued or running." | Active job for the same `lower(trim(book))`. |
| `413 too_large` | "Upload exceeds the configured limit of N bytes (UPLOAD_MAX_BYTES)." | `Content-Length` or streamed bytes exceed `UPLOAD_MAX_BYTES`. |

Guarantees:
1. The body is streamed to disk; it is never held whole in memory.
2. On any non-`202` outcome, and on client disconnect, the partial file is deleted and no
   job row exists.
3. A `413` decided from `Content-Length` reads no body.
4. Zip contents are not inspected at upload time; a bad zip fails the job, not the request.

Examples:

```sh
curl -b cookies -X POST --data-binary @book.zip \
  "http://localhost:3000/library/uploads?book=Monster%20Manual&filename=monster_manual.zip"
```

```ts
await fetch(`/library/uploads?book=${encodeURIComponent(book)}&filename=${encodeURIComponent(file.name)}`,
  { method: "POST", body: file }); // streams the File
```

## `GET /library/jobs`

Query: `limit` integer 1..100, default 20. Returns `{ jobs: JobStatus[] }`, newest
`created_at` first.

## `GET /library/jobs/:id`

Returns `{ job: JobStatus }`. Unknown or malformed id → `404 not_found`.

## `JobStatus` (the job-status contract)

```ts
type JobState = "queued" | "running" | "succeeded" | "failed";
type JobStage = "extract" | "parse" | "store" | "embed";

interface JobStatus {
  id: string;
  book: string;
  status: JobState;
  stage: JobStage | null;       // non-null only while running
  format: "zip" | "html" | "markdown";
  filename: string;
  bytes: number;                // upload size
  attempts: number;             // claims so far; > 1 means it was recovered after a crash
  createdAt: string;            // ISO 8601
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;   // lease clock; stale while running ⇒ the owner died
  result: JobResult | null;     // non-null only when succeeded (data-model.md)
  error: string | null;         // non-null only when failed; never book text
}
```

Declared as a Zod schema (`JobStatusSchema`) in `apps/server/src/library/ingest/jobs.ts`;
the route serializes through it. `uploadPath` and `claim_token` are never exposed.

## Recovery semantics (for TASK-0030's "restart mid-ingest")

- A running job's owner heartbeats every 10 s. Its lease is 60 s.
- If the owning process dies, the job stays `running` with a stale `heartbeatAt` until the
  lease expires, then any worker reclaims it (`attempts` + 1) and re-runs it from `extract`.
- The re-run replaces the book wholesale; chunk and embedding counts equal a single run.
- The fourth claim (attempts > 3) marks it `failed` with "abandoned 3 times".
- Expected recovery time after restart: ≤ 60 s lease + 2 s poll from the last heartbeat.
- The upload file must still exist: survives container restart, not recreate.

## Polling guidance for clients

Poll `GET /library/jobs/:id` every 1–2 s while `status` is `queued` or `running`. There is
no push channel in this slice.
