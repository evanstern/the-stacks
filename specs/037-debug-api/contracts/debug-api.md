# Contract: the operator debug API (TASK-0116)

Module: `apps/server/src/routes/dm.ts`, mounted at `/dm` in `app.ts`, beside the routes in
`specs/031-dm-runtime/contracts/dm-api.md`. The consumer is the debug page, TASK-0117
(`play/:sessionId/debug`), polling about every 2 s (design D3). An agent drives the same routes
with an operator session (Constitution I).

## Common rules

- **Auth.** Every route runs the `/dm` auth middleware, then `requireOperator`: no session →
  `401 unauthorized`; a role other than `operator` → `403 forbidden`. Both run before any
  validation or read.
- **Validation.** `sessionId` is a UUID. Query values are checked by Zod. A failure is
  `400 validation` with `issues[]` in the standard error shape (`docs/wiki/error-contract.md`).
- **Read only.** No route appends an event, changes a job or enqueues work. Retry stays on
  `POST /dm/sessions/:sessionId/turn` (dm-api.md).
- **No text.** No response carries prompt text, completion text or retrieved passages. The one
  exception is the bounded failure excerpts already stored in a failed job's `result`
  (`specs/033-director-robustness/contracts/failure-record.md`).
- **Unknown session.** A UUID with no events or jobs answers `200` with empty lists. The seed
  route answers `404` (below).
- **Spoilers.** Nothing is masked (D2). DM-visibility rows and DM-only seed fields return.
- **Old rows.** Jobs stored before TASK-0116 lack the call usage fields and the submission
  `seqs`. They return as stored. A client treats an absent field as "not recorded". The routes ship in
every environment behind the operator gate, with no flag (spec open question 1).

## GET /dm/sessions/:sessionId/events?after=0&limit=500

The session's event log after a seq cursor, every visibility, in ascending seq order.

| Query | Type | Default | Rule |
|---|---|---|---|
| `after` | integer ≥ 0 | `0` | Return events with `seq > after`. |
| `limit` | integer 1..1000 | `500` | Page size. |

Response `200`:

```ts
{
  events: StoredEvent[];   // @the-stacks/session-model StoredEvent, as toStoredEvent() builds it
  nextAfter: number;       // seq of the last event returned; equals `after` when `events` is empty
  hasMore: boolean;        // true when events with seq > nextAfter exist
  headSeq: number;         // the session's highest seq; 0 for an empty log
}
```

`StoredEvent` is the shape the socket's `event` frame carries, so the client folds it with
`project(events, viewer)` unchanged. The route does not filter by `canSee`.

**Client use.** Start with `after=0` and follow `nextAfter` while `hasMore`. Then poll with the
last `nextAfter`. An empty poll costs one indexed read.

## GET /dm/sessions/:sessionId/jobs?limit=50&before=<jobId>

The session's DM jobs (`turn`, `companion`, `chronicle`), newest first, as stored.

| Query | Type | Default | Rule |
|---|---|---|---|
| `limit` | integer 1..200 | `50` | Page size. |
| `before` | UUID | absent | Return jobs strictly older than this job, ordered by `(createdAt, id)` descending. An id that is not a DM job of this session is `400 validation`. |

Response `200`:

```ts
{
  jobs: DebugJob[];
  nextBefore: string | null;  // id of the oldest job returned when older jobs exist, else null
}

interface DebugJob {
  id: string;
  kind: "turn" | "companion" | "chronicle";
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string | null;        // the running node, or null
  attempts: number;
  input: unknown;              // TurnJobInput | CompanionJobInput | ChronicleJobInput, as stored
  result: unknown;             // as stored: see "Result shapes"
  error: string | null;        // a fixed, safe string (worker.ts)
  createdAt: string;           // ISO 8601
  startedAt: string | null;
  heartbeatAt: string | null;  // lease clock; the page shows its age
  finishedAt: string | null;
}
```

The claim token is never returned.

**Client use.** Poll the newest page (no `before`). Jobs change in place while queued or running,
so the client replaces each job by `id`. Terminal jobs do not change; page older ones with
`before` once.

### Result shapes

`result` returns exactly as `jobs.result` stores it:

- **Turn, running:** `{ checkpoint: TurnCheckpoint }` — saved after each node.
- **Turn, finished:** `{ checkpoint, outcome: { status }, audit: AuditRecord | null,
  calls: ModelCallRecord[] }`. `status` is `completed`, `empty-beat` or `held`. A held turn now
  keeps its calls.
- **Turn, failed:** `TurnFailureResult` — the above plus `failure` (failure-record.md).
- **Companion:** `{ plays: CompanionPlay[], calls: ModelCallRecord[], outcome: { status: "completed" } }`.
- **Chronicle:** `{ entries: number, seqs: number[], calls: ModelCallRecord[], outcome: { status:
  "completed" } }`.
- **Any job, queued:** `null`.

The shapes TASK-0116 extends:

```ts
interface ModelCallRecord {
  purpose: DmPurpose;
  promptVersion: string;
  attempt: number;                        // 1, or 2 for the JSON repair re-ask
  outcome: "ok" | "invalid-json" | "schema-mismatch" | "truncated" | "error"; // "truncated": TASK-0192; "schema-mismatch": TASK-0203
  errorKind: ErrorKind | null;
  // New in TASK-0116. null when the gateway emitted no usage record for the call.
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;                 // null also when the model has no configured price
  durationMs: number | null;
}

interface Submission {                    // TurnCheckpoint.submissions[]
  stepRef: string; key: string; kind: ProposalKind;
  result: "applied" | "pending" | "suggested" | "refused";
  refusal: GateRefusal | null; batchId: string | null; proposalId: string | null;
  outcome: string | null;
  seqs: number[];                         // New: seqs the gate returned; [] on refusal
}

interface CompanionSubmission { kind: string; ok: boolean; code: string | null;
  seqs: number[] }                        // New
```

The shipped narration's seqs are recorded in `TurnCheckpoint.narration.seqs: number[]` (new).

**Linking a job to its events.** A job wrote seq `s` when `s` is in any `seqs` list of its
result: `checkpoint.submissions[].seqs`, `checkpoint.narration.seqs`,
`plays[].submissions[].seqs`, or a chronicle's `seqs`. Gate rows other jobs wrote never appear
in these lists.

Three edges, as built:

- `checkpoint.narration.seqs` covers the narration submission only. A checkpoint stored before
  TASK-0116 has no `seqs` there: the narration's rows are unknown, not absent.
- A submission recovered by `findLanded` after a reclaim carries `seqs: []`. The gate rows
  exist in the log, but the replay cannot name them. A client reading `[]` on a non-refused
  submission treats the link as unknown.
- A job that was fenced out or reclaimed can have written rows that no `seqs` list names.

## GET /dm/sessions/:sessionId/seed

The scene seed the session plays, as `loadSeed` returns it.

1. Fold the DM projection. No `scene` → `404 not_found` ("The session has no scene.").
2. Load the seed named by `scene.sceneId`. A load failure → `409 conflict` ("The session's seed
   did not load."); the seed's issues are logged, not returned.

Response `200`:

```ts
{
  seedId: string;
  seed: SceneSeed;            // apps/server/src/dm/seed/schema.ts, every field
  dmOnlyPaths: string[];      // JSON Pointers into `seed` of every DM-only field
}
```

`dmOnlyPaths` lists the same fields `dmOnlySeedText` collects (`dm/seed/views.ts`): for example
`/goal/success`, `/location/hooks/secrets/0`, `/npcs/1/hooks/knows/0`, `/beats/0/summary`,
`/beats/0/clues/2/text`. The page marks those fields as DM only.

## GET /dm/sessions/:sessionId/calls?after=0&limit=500

The session's usage ledger: one row per DM model call, in write order, with session totals.

| Query | Type | Default | Rule |
|---|---|---|---|
| `after` | integer ≥ 0 | `0` | Return rows with `id > after`. |
| `limit` | integer 1..1000 | `500` | Page size. |

Response `200`:

```ts
{
  calls: DebugCall[];
  nextAfter: number;          // id of the last row returned; equals `after` when empty
  hasMore: boolean;
  totals: {                   // over the whole session, not the page
    all: UsageTotals;
    byPurpose: Record<string, UsageTotals>;
    byModel: Record<string, UsageTotals>;   // key "<provider>/<model>"; "unknown" when null
  };
}

interface DebugCall {
  id: number;                 // ledger cursor, increasing
  jobId: string;
  jobKind: "turn" | "companion" | "chronicle";
  jobAttempt: number;         // jobs.attempts at the claim that made the call
  purpose: DmPurpose;
  promptVersion: string;
  callAttempt: number;        // 1, or 2 for the JSON repair re-ask
  outcome: "ok" | "invalid-json" | "schema-mismatch" | "truncated" | "error" | "aborted"; // "truncated": TASK-0192; "schema-mismatch": TASK-0203
  errorKind: ErrorKind | null;
  provider: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  httpAttempts: number | null; // provider-level retries (UsageRecord.attempts)
  at: string;                  // ISO 8601, when the row was stored (the call's end)
}

interface UsageTotals {
  calls: number;
  inputTokens: number;        // nulls count as 0
  outputTokens: number;
  costUsd: number;            // sum of priced calls only
  unpricedCalls: number;      // calls with costUsd null
  durationMs: number;
}
```

A row is stored when the call ends, so a running turn's calls appear before the job finishes.
Rows include calls of abandoned attempts (`outcome: "aborted"`, or a lower `jobAttempt` than the
job's current one). This makes the ledger, not `jobs.result.calls`, the authority for cost.

An aborted row, or a call whose gateway emitted no usage record, can have null `provider`,
`model`, `inputTokens`, `outputTokens`, `costUsd` and `durationMs`. `byModel` counts those rows
under `"unknown"`. `at` is the row's `created_at`. `id` is a JSON number (a `bigint` column read
in number mode).

## Unchanged

`GET /dm/sessions/:sessionId/turns` keeps its dm-api.md response field for field. Its `calls`
items still carry only `purpose`, `promptVersion` and `outcome`. `POST .../start` and
`POST .../turn` do not change. The WebSocket protocol and `viewerFor` do not change.

## What TASK-0132 would need (not provided here)

TASK-0132 shows every seat that the DM is working. These routes are operator only, so a player
browser cannot use them. A seat-visible signal is TASK-0132's own design: a client fold over the
player log (an `action.committed` with no later narration), or a narrow non-operator signal
carrying only "working" and the stage. Neither is part of this contract.
