# Data model: debug API and persisted model-call usage (TASK-0116)

## Table `dm_model_calls` (new; migration 0005)

Schema file: `apps/server/src/schema/dm-model-calls.ts`, exported from the schema index that
`drizzle.config.ts` reads. Operational state beside `jobs`, not the session plane: it is not an
event and no projection reads it.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `bigint` generated always as identity | no | Primary key; the `/calls` cursor. |
| `job_id` | `uuid` | no | FK → `jobs.id`, `ON DELETE CASCADE`. |
| `session_id` | `uuid` | no | Copied from the job, for the per-session read. |
| `job_kind` | `text` | no | Check: `turn`, `companion`, `chronicle`. |
| `job_attempt` | `integer` | no | `jobs.attempts` at the claim that made the call. |
| `purpose` | `text` | no | A `DmPurpose`. |
| `prompt_version` | `text` | no | |
| `call_attempt` | `integer` | no | Check: 1 or 2. |
| `outcome` | `text` | no | Check: `ok`, `invalid-json`, `schema-mismatch` (TASK-0203, migration 0009), `truncated`, `error`, `aborted`. |
| `error_kind` | `text` | yes | Gateway `ErrorKind`, or null. |
| `provider` | `text` | yes | Null when the gateway made no usage record. |
| `model` | `text` | yes | |
| `input_tokens` | `integer` | yes | |
| `output_tokens` | `integer` | yes | |
| `cost_usd` | `double precision` | yes | Null when unpriced or unrecorded; never 0 for unpriced. |
| `duration_ms` | `integer` | yes | |
| `http_attempts` | `integer` | yes | `UsageRecord.attempts`. |
| `created_at` | `timestamptz` | no | Default `now()`; the call's end. |

Indexes: `dm_model_calls_session_idx` on `(session_id, id)` (the `/calls` page and totals);
`dm_model_calls_job_idx` on `(job_id)`.

No text column holds model input or output. Code only inserts; nothing updates a row.

## `ModelCallRecord` (extended; `dm/pipeline/context.ts`)

Adds `provider`, `model`, `inputTokens`, `outputTokens`, `costUsd`, `durationMs`, each
`T | null`. Filled from the gateway's `UsageRecord` for that attempt (research R2). The shape is
in [contracts/debug-api.md](contracts/debug-api.md).

## `RecordedCall` (new; `dm/pipeline/context.ts`)

`Omit<ModelCallRecord, "outcome"> & { outcome: ModelCallRecord["outcome"] | "aborted";
httpAttempts: number | null }`. The value `recordCall` receives. An aborted attempt is
recorded to the ledger and, as today, not pushed to `calls`.

## Submission seqs (extended)

- `Submission.seqs: number[]` (`dm/nodes/resolve.ts`).
- `TurnCheckpoint.narration.seqs: number[]` (`dm/jobs.ts`), the shipped narration's rows.
- `CompanionSubmission.seqs: number[]` (`dm/companion.ts`).
- `ChronicleResult.seqs: number[]` (`dm/chronicle.ts`).

Each is the `seq` list of the `events` the gate returned for that submission, ascending; `[]` on
a refusal. Readers treat an absent list (pre-0116 rows) as unknown.

## `DmJobRow` (extended; `dm/jobs.ts`)

Adds `heartbeatAt: Date | null`. A new `listDmJobsPage(db, sessionId, { limit, before })`
returns rows ordered `(created_at desc, id desc)`. `listDmJobs` and the `/turns` route keep their
behavior.

## Gateway `ChatRequest` (extended; `ai/types.ts`)

Adds `onUsage?: (r: UsageRecord) => void`. Called once per `chat()` that emits a usage record,
with the record `sink.record` receives. Not called for an unknown purpose (no record exists).
