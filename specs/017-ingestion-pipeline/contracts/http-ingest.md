# Contract: ingestion HTTP routes and job status

Mounted at `/library` in `createApp`, before the static catch-all. Consumers: the chat UI
(TASK-0028) shows job status; the load benchmark (TASK-0030) enqueues and polls jobs; agents
drive ingestion through the same routes (constitution I). Binding before implementation.

All three routes require a session whose role is `operator`. No session → `401
unauthorized`; any other role → `403 forbidden`. Errors use the `{ error: { kind, message,
issues? } }` shape from `errors.ts`.

## `POST /library/uploads`

Request: `Content-Type: multipart/form-data` (operator ruling 2026-09-29; research R1).
The body is streamed through `busboy` and never buffered.

| Part | Kind | Required | Rule |
|---|---|---|---|
| `book` | text field | yes | trimmed, 1..200 chars. May come before or after `file`; send it first. |
| `file` | file part | yes, exactly one | the export. Its `Content-Disposition` `filename` is the original name (≤ 255 chars; default `upload`), used for format detection and display. |

Unknown text fields are ignored (at most 4 fields, 1 KiB each, 5 parts in all).

Format detection (research R4): file bytes begin `PK\x03\x04` or `PK\x05\x06` → `zip`;
else `filename` ends `.md`/`.markdown` → `markdown`; else `html`.

Responses:

| Status | Body | When |
|---|---|---|
| `202` | `{ job: JobStatus }` | File part fully on disk and job queued. |
| `400 validation` | issues on `book`, `file`, or `(root)` | Not multipart; missing or invalid `book`; no `file` part; a file part under another name; more than one file part; an empty file; field limits exceeded. |
| `401` / `403` | — | Auth. |
| `409 conflict` | "A job for this book is already queued or running." | Active job for the same `lower(trim(book))`. |
| `413 too_large` | "Upload exceeds the configured limit of N bytes (UPLOAD_MAX_BYTES)." | `Content-Length` over `UPLOAD_MAX_BYTES` + 1 MiB (framing allowance), or the file part's streamed bytes over `UPLOAD_MAX_BYTES`. |

Guarantees:
1. The body is streamed to disk; it is never held whole in memory. `parseBody` is never
   called.
2. On any non-`202` outcome, and on client disconnect, the partial file is deleted and no
   job row exists.
3. A `413` decided from `Content-Length` reads no body.
4. An early refusal while the client is still sending responds with `Connection: close`.
5. Zip contents are not inspected at upload time; a bad zip fails the job, not the request.
6. The `413` limit applies to the file part's bytes, not the multipart framing.

Examples:

```sh
curl -b cookies -F 'book=Monster Manual' -F 'file=@monster_manual.zip' \
  http://localhost:3000/library/uploads
```

How TASK-0028's UI uploads — `FormData` + `fetch`. Do not set `Content-Type`; the browser
sets it with the boundary. The browser streams the `File` from disk.

```ts
const form = new FormData();
form.append("book", book);            // field first
form.append("file", file, file.name); // a File from <input type="file">
const res = await fetch("/library/uploads", { method: "POST", body: form, credentials: "same-origin" });
if (res.status === 202) { const { job } = await res.json(); /* poll GET /library/jobs/:id */ }
```

`fetch` exposes no upload progress. `ponytail:` if TASK-0028 needs a progress bar, send the
same `FormData` with `XMLHttpRequest` and `upload.onprogress`; the server contract does not
change.

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
