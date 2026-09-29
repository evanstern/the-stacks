# Contract: ingestion modules (in-process)

Directory: `apps/server/src/library/ingest/`. Library plane; imports nothing from codex or
session. Consumers: the upload route, the worker, TASK-0029 (chunker), TASK-0030 (worker,
claim).

## `zip.ts`

A thin wrapper over `yauzl@^3.4.0` (operator ruling 2026-09-29; research R2). Callers never
import `yauzl` directly.

```ts
export const MAX_ZIP_DEPTH = 3;
export const MAX_PAGE_BYTES = 16 * 1024 * 1024;
export const EXTRACT_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;

export class ZipError extends Error {}

export interface ZipEntryInfo { name: string; size: number; compressedSize: number; crc32: number; isDirectory: boolean; }

/** What the visitor wants done with an entry. */
export type EntryAction = "skip" | "read" | "extract";

export interface ZipBudget { remaining: number; }   // shared across one job's nested walk

/**
 * Open the zip file at `path` with yauzl (`lazyEntries: true`, `autoClose: false`,
 * `validateEntrySizes: true`) and visit its entries one at a time, in central-directory
 * order. The handle is closed in a finally.
 *   - "skip":    no read stream is opened; nothing is inflated.
 *   - "read":    the entry is inflated into a Buffer (≤ MAX_PAGE_BYTES), CRC-checked with
 *                zlib.crc32, and passed to onRead.
 *   - "extract": the entry is streamed, CRC-checked, into `<tmpDir>/<n>.zip`; onExtract gets
 *                the path; the file is deleted after onExtract resolves.
 * Every read/extract debits `budget.remaining` by the entry's declared size.
 */
export function walkZip(path: string, opts: {
  tmpDir: string;
  budget: ZipBudget;
  decide(entry: ZipEntryInfo): EntryAction;
  onRead(entry: ZipEntryInfo, data: Buffer): Promise<void> | void;
  onExtract(entry: ZipEntryInfo, innerZipPath: string): Promise<void>;
}): Promise<void>;
```

Throws `ZipError` (message names the problem, never entry content) on: a yauzl open error
(no End of Central Directory, malformed metadata, an invalid file name); an encrypted entry;
a compression method other than 0/8; a size mismatch (from `validateEntrySizes`); a page
over `MAX_PAGE_BYTES`; the extraction budget exhausted; a CRC mismatch. zip64 is supported.
Depth is the caller's concern (`collect.ts` passes depth through `onExtract`).

## `collect.ts`

```ts
export interface CollectedPages {
  pages: { path: string; format: "html" | "markdown"; text: string }[];  // ordered, de-duplicated
  duplicatePages: number; ignoredEntries: number; skippedEntries: number;
}
export function collectPages(filePath: string, format: "zip" | "html" | "markdown", filename: string, opts: { tmpDir: string }): Promise<CollectedPages>;
```

Rules: research R3 (filter, recurse ≤ 3 levels, numeric-collated order, sha-256 de-dup).
Implemented over `walkZip`: `decide` applies the filter (`.zip` → `extract`, page → `read`,
else `skip`); `onExtract` recurses with depth + 1 (deeper than `MAX_ZIP_DEPTH` →
`ValidationError`). Inner zips go to `tmpDir`, a per-job directory the worker owns.
Zero pages → throws `ValidationError` "No HTML or Markdown pages found in the upload."

## `markdown.ts`

```ts
export function parseMarkdown(input: { book: string; text: string }): ParsedBook;
```

Same `ParsedBook` shape and invariants as `parseDdbExport` (research R4).

## `ddb/index.ts` (changed)

```ts
export function parseDdbExport(input: ParseInput, options?: { headings?: "ddb" | "all" }): ParsedBook;
```

`headings: "all"` makes every `h1`–`h6` a section heading. Default `"ddb"` keeps today's
behaviour exactly; every existing DDB test passes unchanged.

## `chunk.ts`

```ts
export const CHUNK_MAX_CHARS = 2000;
export function chunkBook(book: ParsedBook, opts?: { maxChars?: number }): ParsedBook;
```

Invariants (each has a test):
1. Every output block satisfies `book.text.slice(anchor.start, anchor.end) === text`.
2. Every input `table`/`statBlock` block is exactly one output block, unchanged.
3. No output block contains input blocks with different `path`s.
4. A merged block's span ≤ `maxChars`, unless it is one input block.
5. Output blocks are in order and cover every input block exactly once.
6. `maxChars: 0` returns one output block per input block.
7. `book.text` is returned unchanged.

## `jobs.ts`

```ts
export const JobStatusSchema: z.ZodType<JobStatus>;       // contracts/http-ingest.md
export function enqueueIngest(db: DbClient, input: { book: string; format: Format; filename: string; bytes: number; uploadPath: string }): Promise<JobStatus>;  // ConflictError on an active job for the book
export function listJobs(db: DbClient, limit: number): Promise<JobStatus[]>;
export function getJob(db: DbClient, id: string): Promise<JobStatus | null>;
export function claimJob(db: DbClient): Promise<ClaimedJob | null>;   // research R6 SQL
export function heartbeat(db: DbClient, job: ClaimedJob): Promise<boolean>;  // false = fenced out
export function setStage(db: DbClient, job: ClaimedJob, stage: JobStage): Promise<boolean>;
export function finishJob(db: DbClient, job: ClaimedJob, outcome: { result: JobResult } | { error: string }): Promise<boolean>;
```

Every write after the claim filters on `claim_token`.

## `worker.ts`

```ts
export interface IngestWorkerDeps {
  db: DbClient;
  gateway: Pick<Gateway, "embed">;
  embedPurpose: string | null;   // null = embedding not configured (skip with reason)
  uploadDir: string;
}
export function startIngestWorker(deps: IngestWorkerDeps): { nudge(): void; stop(): Promise<void> };
export function runJob(deps: IngestWorkerDeps, job: ClaimedJob, signal: AbortSignal): Promise<JobResult>;  // exported for tests
```

`runJob` pipeline: `collectPages` → parse (`parseDdbExport` ddb/all or `parseMarkdown`) →
`chunkBook` → `storeParsedBook(db, chunked, { source: { files, bytes } })` → embed
(research R10) → result. `stop()` ends polling and awaits the current loop turn.

## Embedding obligation (from TASK-0026 `contracts/retrieval.md`)

- Embed through the `AI_PURPOSES` entry named by `RETRIEVAL_EMBED_PURPOSE` (default
  `embedding`) — the purpose retrieval embeds questions with.
- Store `EmbedVector.model` exactly as the gateway returned it in `library_embeddings.model`.
- Otherwise vector search finds nothing.
