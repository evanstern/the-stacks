# Data model: the debug page (TASK-0117)

Client-side shapes only. Nothing here is stored. Wire shapes are TASK-0116's
(`specs/037-debug-api/contracts/debug-api.md`); `api-types.ts` mirrors them by hand.

## Wire mirrors (`app/debug/api-types.ts`, type-only)

`EventsPage { events: StoredEvent[]; nextAfter; hasMore; headSeq }`,
`JobsPage { jobs: DebugJob[]; nextBefore: string | null }`,
`CallsPage { calls: DebugCall[]; nextAfter; hasMore; totals: { all; byPurpose; byModel } }`,
`SeedResult = { kind: "ok"; seedId; seed: unknown; dmOnlyPaths: string[] } | { kind: "none" }
| { kind: "failed" }` (404 → `none`, 409 → `failed`), `DebugJob`, `DebugCall`, `UsageTotals`, as
in the contract. `StoredEvent` comes from `@the-stacks/session-model`.

## Client errors (`client.ts`)

`DebugError = { kind: "auth"; status: 401 | 403 } | { kind: "http"; status: number } |
{ kind: "network" }`. `auth` stops the poller.

## DebugSnapshot (`snapshot.ts`)

| Field | Type | Rule |
|---|---|---|
| `events` | `StoredEvent[]` | ascending seq, no duplicates; `mergeEvents` drops a seq already held |
| `eventsAfter` | `number` | last `nextAfter` |
| `headSeq` | `number` | from the last events page |
| `lastEventAt` | `number \| null` | page-clock ms when a new seq last arrived |
| `jobs` | `Map<string, DebugJob>` | `mergeJobs` replaces by id |
| `olderJobsBefore` | `string \| null \| undefined` | `undefined` until the first page; `null` when no older jobs |
| `calls` | `DebugCall[]` | ascending id |
| `callsAfter` | `number` | last `nextAfter` |
| `totals` | `CallsPage["totals"] \| null` | latest |
| `seed` | `SeedResult \| null` | `null` until fetched |
| `seedFor` | `string \| null` | the `scene.sceneId` the seed was fetched for |
| `notice` | `string \| null` | "Poll failed, retrying." or "Signed out: polling stopped." |

All reducers are pure and return a new snapshot.

## Turn result reading (`read-result.ts`)

```ts
type Recorded<T> = T | undefined;            // undefined = "not recorded" (old row)
interface ReadCall { purpose: string; promptVersion: string; attempt: number; outcome: string;
  errorKind: string | null; usage: { provider; model; inputTokens; outputTokens; costUsd;
  durationMs } | null }                       // null = usage not recorded
interface ReadSubmission { stepRef; key; kind; result; refusalCode: string | null;
  batchId; proposalId; seqs: Recorded<number[]> }
interface ReadTurn { checkpoint: { beat: string[] | null; npcTurn; director: unknown;
  interpret: unknown; adjudicate: unknown; submissions: ReadSubmission[];
  narration: { attempts: ReadAttempt[]; shipped: boolean; seqs: Recorded<number[]> } | null } | null;
  outcome: string | null; audit: unknown; calls: ReadCall[]; failure: ReadFailure | null }
interface ReadAttempt { words: number | null; blocking: Issue[]; advisory: Issue[];
  proseHash: string | null }
```

`readCompanionResult` → `{ plays: { companion; submissions: { kind; ok; code; seqs }[] }[]; calls }`.
`readChronicleResult` → `{ entries: number; seqs: Recorded<number[]>; calls }`.
`readTrigger(job)` → the turn trigger, the companion reason, or `"chronicle"`.
Every reader returns a value for any input, including `null` and malformed objects.

## JobView (`job-view.ts`)

| Field | Rule |
|---|---|
| `id`, `kind`, `status`, `stage`, `attempts`, `trigger` | from the job |
| `badge` | `queued`, `running`, `failed`; else turn outcome: `completed` + fallback shipped → `fallback`, `completed` → `shipped`, `held` → `held`, `empty-beat` → `empty`; companion/chronicle succeeded → `shipped` |
| `durationMs` | `finishedAt − startedAt`, or `now − startedAt` while running, or `null` |
| `totals` | `{ calls, inputTokens, outputTokens, costUsd, unpricedCalls }` from ledger rows with this `jobId` |
| `sections` | turn: `assemble, director, interpret, adjudicate, resolve, narrate-audit, failure`, each `{ node, ran: boolean, data, calls: ReadCall[] }` |
| `wroteSeqs` | `ReadonlySet<number>` (R8) |
| `linkUnknown` | boolean (R8) |
| `heldBy` | for a held turn, the companion job whose `input.beatJobId` is this id |

## WaitingSummary (`waiting.ts`)

`{ active: { id; kind; stage; attempts; heartbeatAgeMs | null }[]; uncommitted: { actionId;
actorLabel; status }[]; mode: { kind: "free" } | { kind: "turn"; actorLabel; round };
proposals: { proposalId; kind; policy }[]; holds: { turnJobId; companionJobId | null;
companionStatus | null }[]; latestFailure: { jobId; node; kind; message; finishedAt } | null;
stuck: boolean; showRetry: boolean }`. Input: snapshot, the live DM projection, `now`.

## Selection (component state in `debug-view.tsx`)

`{ jobId: string | null; seq: number | null; pinnedSeq: number | null }`. Clicking an event sets
`seq` and `pinnedSeq`. Selecting a job sets `jobId` and clears `seq`. "Back to live" clears
`pinnedSeq` only.

## EventFilter (`event-filter.ts`)

`{ types: string[]; actors: string[]; visibilities: string[] }`; empty list = no constraint;
AND across lists, OR within a list. `distinctValues(events)` → sorted unique types, actors and
visibilities. `windowRows(rows, count)` → the last `count` rows.

## Folder (`scrub.ts`)

`createFolder(viewer, every = 250)` → `{ live(events): SessionProjections; through(events, seq):
SessionProjections }`. `through` equals `project(events.filter(e => e.seq <= seq), viewer)`
(tested).
