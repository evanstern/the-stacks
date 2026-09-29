# Feature Specification: Ingestion pipeline

**Feature Branch**: `task-0024-ingestion-pipeline`
**Created**: 2026-09-29
**Status**: Draft
**Board task**: TASK-0024 (ACs #1–#7)
**Input**: "A9 pipeline minus the D&D Beyond parser, on the jobs table per decision-0005."
The operator uploads a book export. The system queues a job, and an in-process worker
parses, chunks, stores, and embeds it. The operator watches the job's status.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Upload a D&D Beyond export as delivered (Priority: P1) 🎯 MVP

The operator has a D&D Beyond export on disk. It arrives in one of three shapes: a zip of
chapter pages, a zip of per-chapter zips, or one saved HTML page. The operator uploads the
file as-is under a book name. The system accepts it and queues an ingestion job. The worker
turns the export into a stored, searchable book.

**Why this priority**: M1's demo needs real books in the library. Nothing downstream
(retrieval, answering, the chat UI) has content without this.

**Independent Test**: Upload a synthetic zip of chapter pages and a synthetic zip of zips.
Each returns an accepted job. Each job finishes `succeeded` with a chunk count above zero.

**Acceptance Scenarios**:

1. **Given** a signed-in operator and a zip of chapter pages, **When** they upload it under
   the name "Basic Rules", **Then** the response is "accepted" with a queued job, and the job
   later reaches `succeeded` with the book stored.
2. **Given** a zip whose entries are per-chapter zips, **When** it is uploaded, **Then** every
   chapter's HTML page is ingested, in chapter order, into one book.
3. **Given** a zip containing `__MACOSX/` entries, `.DS_Store` files, `._*` resource forks,
   and saved-page asset folders (`*_files/`: images, scripts, stylesheets), **When** it is
   uploaded, **Then** none of those entries reaches the parser, and the job's result counts
   them as skipped.
4. **Given** a single saved HTML page, **When** it is uploaded, **Then** it is ingested as a
   one-page book.
5. **Given** a signed-in player (not the operator), or no session, **When** they upload,
   **Then** the upload is refused (forbidden / unauthorized) and no job exists.

---

### User Story 2 — Large exports upload without a low size limit (Priority: P1)

A real export is 40–310 MB. The Monster Manual export is 128 MB compressed and 307.6 MB
uncompressed across 3,219 entries. The operator uploads it, and it succeeds. The server
never holds the whole upload in memory.

**Why this priority**: the operator's own books are this size (AC #7). A low limit blocks
the demo outright.

**Independent Test**: Upload a file above 300 MB to a running stack. The app's memory stays
well below the file size while the upload streams to disk.

**Acceptance Scenarios**:

1. **Given** the default configuration, **When** the operator uploads a 310 MB export,
   **Then** it is accepted.
2. **Given** a configured ceiling, **When** an upload exceeds it, **Then** the upload is
   refused as too large, the partial file is deleted, and no job exists.
3. **Given** an upload in progress, **When** the client disconnects, **Then** the partial
   file is deleted and no job exists.
4. **Given** no ceiling is configured, **Then** the ceiling is 1 GiB, and the setting is
   documented where the operator configures the server.

---

### User Story 3 — Chunks keep structure and anchors (Priority: P1)

Stored chunks are the units retrieval returns and citations quote. A chunk never splits a
table or a stat block. A chunk never spans two sections. Every chunk records its source
anchor: book, section path, and the exact span in the book's text.

**Why this priority**: constitution V. A citation must click through to the exact passage.

**Independent Test**: Ingest a fixture containing a heading, several short paragraphs, a
large table, and a stat block. Inspect the stored chunks.

**Acceptance Scenarios**:

1. **Given** a section with a heading and short paragraphs, **When** it is chunked,
   **Then** the heading and its following paragraphs share a chunk until the size budget
   is reached.
2. **Given** a table or stat block of any size, **When** it is chunked, **Then** it is
   exactly one chunk, whole.
3. **Given** two adjacent sections, **When** they are chunked, **Then** no chunk contains
   text from both.
4. **Given** any stored chunk, **Then** the book text sliced at the chunk's span equals the
   chunk's text exactly.

---

### User Story 4 — Generic HTML and Markdown (Priority: P2)

The operator uploads a non-D&D-Beyond book: a plain HTML page or a Markdown file. It is
ingested best-effort (architecture A9): headings become sections; tables and lists stay
whole.

**Why this priority**: AC #1 names HTML and Markdown. D&D Beyond is first-class; others are
best-effort.

**Independent Test**: Upload a Markdown file with headings, a pipe table, a list, and a code
fence. Upload a plain HTML page with `h1`–`h3` headings and no D&D Beyond markup. Both jobs
succeed with section paths taken from the headings.

**Acceptance Scenarios**:

1. **Given** a plain HTML page with unclassed `h2`/`h3` headings, **When** ingested,
   **Then** each heading starts a section and its text appears in chunk paths.
2. **Given** a Markdown file, **When** ingested, **Then** `#` headings define sections, a
   pipe table is one whole chunk, and a fenced code block is never split.

---

### User Story 5 — Job status and recovery (Priority: P2)

The operator sees each job's state: queued, running (with its current stage), succeeded
(with counts), or failed (with a reason). A job interrupted by an app restart resumes
without operator action and without duplicate chunks. Re-uploading a book replaces it.

**Why this priority**: AC #4 and #5. TASK-0028 shows this status; TASK-0030 restarts the app
mid-ingest and expects recovery.

**Independent Test**: Queue a job, mark it running under a stale lease, and start a worker.
The worker reclaims it, finishes it, and the book has exactly one set of chunks.

**Acceptance Scenarios**:

1. **Given** a queued job, **When** the operator lists jobs, **Then** they see its status,
   stage, book name, size, and timestamps.
2. **Given** a running job whose process died, **When** the lease expires, **Then** another
   worker claims and completes it, and the book has no duplicate chunks.
3. **Given** a job that keeps dying (three claims), **Then** it ends `failed` with a reason
   naming the repeated abandonment, instead of looping forever.
4. **Given** a stored book, **When** the operator uploads the same book name again,
   **Then** the new job replaces the old chunks and embeddings wholesale; the chunk count
   matches a fresh ingest.
5. **Given** a queued or running job for a book, **When** the operator uploads the same
   book name again, **Then** the upload is refused as a conflict.
6. **Given** a failed parse, **Then** the job's reason names the problem without quoting
   book text.

### Edge Cases

- A zip nested inside a zip that contains no HTML (the LMoP export's 208-byte
  "07 - Appendix B - Monsters.zip" holds only a directory): contributes nothing, not an error.
- The same chapter delivered twice in one upload (a directory holding both per-chapter zips
  and the combined zip): identical pages are ingested once.
- An upload with zero HTML or Markdown pages after filtering: the job fails with "no pages".
- Nesting deeper than three zip levels: the job fails with a clear reason.
- A zip using an unsupported feature (encryption, zip64, a compression method other than
  stored/deflate): the job fails naming the feature.
- A zip whose entries inflate beyond their declared size, or beyond the extraction budget:
  the job fails (zip-bomb guard).
- The embedding purpose is not configured: the job still succeeds with chunks stored; its
  result states embedding was skipped and why.
- The embedding provider errors: the job fails at the embedding stage; chunks stay stored
  and keyword search works; a re-upload retries.
- The app is recreated (not just restarted) and the upload's temp file is gone: the job fails
  with "upload file missing"; the operator re-uploads.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (AC #1): The operator MUST be able to upload a book file under a book name. The
  system MUST accept zip, HTML, and Markdown uploads and respond with a queued job.
- **FR-002** (AC #1): Only the operator role MAY upload or view jobs. No session is
  unauthorized; a non-operator is forbidden.
- **FR-003** (AC #6): A zip upload MUST be read recursively through nested zips up to three
  levels. HTML pages MUST be collected from every level.
- **FR-004** (AC #6): Entries under `__MACOSX/`, `.DS_Store` files, `._*` files, and entries
  inside a saved-page asset folder (`*_files/`) MUST be ignored. Entries that are neither
  HTML, Markdown, nor zip MUST be skipped without being decompressed. The job result MUST
  count ignored and skipped entries.
- **FR-005** (AC #6): Pages MUST be ordered deterministically by their path within the
  upload, with numeric-aware ordering, so "02 - …" precedes "10 - …". Byte-identical pages
  MUST be ingested once.
- **FR-006** (AC #7): The upload body MUST be streamed to disk and never held whole in
  memory. The size ceiling MUST default to 1 GiB, MUST be configurable, and MUST be
  documented. An upload over the ceiling MUST be refused as too large.
- **FR-007** (AC #7): A refused, failed, or aborted upload MUST leave no temp file and no job.
- **FR-008** (AC #2): Jobs MUST be stored in a jobs table and claimed by an in-process worker
  using `FOR UPDATE SKIP LOCKED` (decision-0005). No external queue and no second process.
- **FR-009** (AC #5, recovery): A running job MUST hold a lease renewed by heartbeat. A job
  whose lease expired MUST be claimable again. A job claimed three times without finishing
  MUST end `failed`. A stale worker MUST NOT overwrite the state of a job reclaimed by
  another claim.
- **FR-010** (AC #3): Chunking MUST keep every table and stat block whole as one chunk, MUST
  never merge blocks from different sections, and MUST merge a heading with the blocks that
  follow it in its section up to a size budget.
- **FR-011** (AC #3): Every chunk MUST record book, section path, and a span into the book's
  text such that the text at that span equals the chunk text.
- **FR-012** (AC #4): Re-running a document's job — by lease reclaim or by re-upload under
  the same book name — MUST replace that book's chunks and embeddings wholesale, with no
  duplicates.
- **FR-013**: At most one queued or running job MAY exist per book name
  (case- and whitespace-insensitive). A second upload for that book MUST be refused as a
  conflict.
- **FR-014** (AC #1): D&D Beyond pages MUST go through the existing D&D Beyond parser.
  HTML without D&D Beyond markup MUST go through a generic HTML path where every `h1`–`h6`
  starts a section. Markdown MUST be parsed with `#` headings as sections, pipe tables and
  code fences kept whole.
- **FR-015**: When an embedding purpose is configured, every stored chunk MUST be embedded
  through the AI gateway under the same purpose retrieval uses, and the model name the
  gateway reports MUST be stored with each vector (TASK-0026 contract).
- **FR-016** (AC #5): The operator MUST be able to list recent jobs and fetch one job, seeing
  status, stage, book, format, size, attempts, timestamps, result counts, and failure reason.
- **FR-017**: A temp upload file MUST be deleted when its job reaches a terminal state.
  Orphaned temp files MUST be removed at worker start.
- **FR-018** (constitution VIII): Job records, error messages, and logs MUST NOT contain book
  text. No real export may be committed.

### Key Entities

- **Ingestion job**: one upload's processing record — book name, format, byte size, temp
  file location, status, current stage, attempt count, lease heartbeat, timestamps, result
  counts, failure reason.
- **Upload file**: the streamed request body on local disk, owned by one job, deleted when
  the job ends.
- **Page**: one HTML or Markdown document collected from the upload, with its path inside
  the upload.
- **Chunk**: a contiguous span of the book's text — one or more parser blocks from a single
  section — with its section path and anchor. Stored through the existing library write path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Each of the operator's five real exports, uploaded in its delivered form,
  returns "accepted"; PHB, LMoP, DMG, and MM reach `succeeded` with a chunk count recorded.
  XGtE's outcome is recorded; its failure is carded, not blocking, unless it crashes the
  worker.
- **SC-002**: During the Monster Manual upload, the app's peak memory rises by less than
  half the upload's size.
- **SC-003**: Uploading the same book twice leaves exactly the chunk count of one ingest.
- **SC-004**: After the app is killed mid-job, the job completes on its own within two
  minutes of the app returning, with no duplicate chunks.
- **SC-005**: 100% of stored chunks satisfy the span-equals-text check; 0 tables or stat
  blocks are split across chunks.
- **SC-006**: Job status is visible within one poll of any state change.

## Assumptions

- The operator supplies the book name at upload. Names are compared case- and
  whitespace-insensitively, as the library already does.
- "Re-running a job" means lease reclaim after a crash or a re-upload of the same book name.
  No re-run button is in scope; the upload file is deleted when the job ends.
- A Markdown upload is one `.md` file. A zip is searched for HTML pages only.
- Pages are UTF-8.
- The worker runs one job at a time in the existing Node process. TASK-0030 measures whether
  that holds.
- Embedding against a paid provider is an operator checkpoint. The merge-condition run uses
  the gateway's free `fake` provider kind, which proves the embedding path end to end.
- Job rows are kept indefinitely; pruning is out of scope.
- The chat UI (TASK-0028) renders status; this feature ships the routes it reads.
