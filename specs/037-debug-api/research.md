# Research: debug API and persisted model-call usage (TASK-0116)

Grounded at `1cbe060` (branch `task-0116-debug-api`, cut from `origin/main` `a4aab3c`).

## R1 — Where usage is stored: a per-call ledger table plus the job's call list

**Decision**: store usage twice, each for its own reader.

- `jobs.result.calls[]` (`ModelCallRecord`) gains the six usage fields (card AC #1, design D4).
  It is the job's own summary and the timeline card reads it.
- A new table `dm_model_calls` stores one row per DM model call, inserted when the call ends.
  It is the authority for cost totals and the runbook merge condition ("each model call in a
  full fake-gateway turn persists its usage row").

**Rationale** — the call list in `jobs.result` misses calls today:

- `jobs.result` gets `calls` only at `finishJob`. A running turn saves `{ checkpoint }` only, so
  a live view sees no calls until the turn ends.
- `worker.ts` stores `calls: []` for a `held` outcome (`outcome.status === "completed" ?
  outcome.calls : []`). `runner.ts` collects the director and resolve calls, then drops them.
- A fenced or aborted attempt returns without `finishJob`. A reclaim starts a fresh call list.
  Those calls were paid for and leave no record.

The ledger closes all three. The held-turn drop is also fixed in `jobs.result` (FR-004).

**Alternatives**: jsonb only, no migration — loses abandoned attempts and live progress;
rejected. Ledger only — fails card AC #1, which names the stored call record; rejected. A
generic `ai_usage` table for every gateway caller (ingest, `/library/ask`) — out of the card's
scope; the ledger is DM-scoped and named for it.

## R2 — How the DM runtime gets the gateway's usage record

**Decision**: add an optional per-call callback to the gateway's `ChatRequest`:
`onUsage?: (r: UsageRecord) => void`. `createGateway().chat()` calls it in the same `finally`
block that calls `sink.record`, with the same record.

**Rationale**: the gateway already computes provider, model, tokens, `costUsd` (via
`computeCost`, `null` when unpriced) and `durationMs`. The DM must not re-time or re-price a call
(CR-003). `for await` runs the generator's `finally` before the loop exits (on `done` and on an
early `return`), so `collect()` in `dm/pipeline/call.ts` holds the record when it returns. The
change is additive: no event shape changes, no adapter changes.

**Alternatives**: put the record on the `done`/`error` event — changes the ChatEvent contract
every consumer sees; rejected. Correlate `logSink` lines by time — racy; rejected. A per-job
wrapped sink — cannot tell two calls apart; rejected.

## R3 — Who writes the ledger row

**Decision**: `dm/pipeline/call.ts` writes it through a new optional dep
`recordCall?: (call: RecordedCall) => Promise<void>`, after it classifies each attempt.
`RecordedCall` is `ModelCallRecord` with `outcome` widened by `"aborted"`. The worker binds
`recordCall` per claimed job (job id, session id, kind, `jobs.attempts`) for turn, companion and
chronicle deps.

**Rationale**: only `call.ts` knows the DM outcome (`ok`, `invalid-json`, `error`) and the call
attempt. The dep is optional, so the many test fixtures that build `NodeDeps` stay valid. A
worker test asserts the worker always wires it.

**Failure rule**: the worker's `recordCall` catches its own insert error, logs
`{ event: "dm.call.record-failed", jobId, purpose }`, and resolves. A ledger outage never fails a
turn (FR-005).

## R4 — Linking a job to the events it wrote

**Decision**: every stored gate submission gains `seqs: number[]`, copied from the gate result's
`events` (`GateResult` returns `events` on every `ok` variant). This covers `Submission`
(resolve), `TurnCheckpoint.narration.seqs` (the shipped narration), `CompanionSubmission`, and a
chronicle result's `seqs`.

**Rationale**: design D5 makes the job-to-seq cross-link the point of the view (TASK-0117 AC #6).
Events carry no job id. `batchId` matching covers resolve but not companion plays, which store
no batch id. Recording seqs at write time is exact and costs nothing at read time. Old
checkpoints lack `seqs`; a replayed submission keeps the seqs it stored.

## R5 — Route paths and mount (design open question 2)

**Decision**: four `GET` routes under the existing `/dm` mount:
`/dm/sessions/:sessionId/{events,jobs,seed,calls}`.

**Rationale**: `/dm` already carries the auth middleware, `requireOperator` and the
`sessionIdOf` validator. A `/debug` mount would duplicate them. The paths name the resource, not
the page, so an agent can use them outside the debug view.

## R6 — Page sizes and cursors (design open question 1)

**Decision**: events and calls page by an increasing cursor (`seq`, ledger `id`) with
`limit` default 500, maximum 1000, plus `hasMore`. Jobs page newest first by `(createdAt, id)`
with `limit` default 50, maximum 200, and a `before` job id.

**Rationale**: an M2 demo session holds hundreds to low thousands of events, so a full load is a
few pages. Jobs change in place, so a seq-style cursor cannot work for them; newest-first plus
`before` lets the page re-poll the live head and page history once. The ledger `id` is a
`bigint` identity column, so it never repeats or reorders.

## R7 — Seed DM-only marking

**Decision**: add `dmOnlySeedPaths(seed): string[]` (JSON Pointers) to `dm/seed/views.ts`, and
re-express `dmOnlySeedText` over it. A test asserts the two agree on the shipped seed.

**Rationale**: one list of DM-only fields, two views of it. The page marks fields without
re-deriving the field classes from contracts/player-facing-context.md (spec 034).

## R8 — Hosted dev (design open question 4)

**Decision (default; for the operator)**: no feature flag. The routes run wherever the server
runs, vm-104 included, behind the operator gate. The operator confirms or rules otherwise.

## R9 — Poll back-off (design open question 3)

**Decision**: a client concern, handed to TASK-0117. The server side needs nothing: an idle poll
of each route is one indexed read returning empty lists.

## R10 — Migration mechanics

**Decision**: edit `apps/server/src/schema/` and run `pnpm --filter @the-stacks/server
db:generate`. drizzle-kit writes `apps/server/drizzle/0005_<generated-name>.sql`, its snapshot,
and the `meta/_journal.json` entry. Never hand-edit the journal. If another branch lands a
migration first, merge `origin/main`, delete this branch's generated files, and regenerate
(runbook concurrency doctrine).
