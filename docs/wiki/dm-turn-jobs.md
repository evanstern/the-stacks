---
name: dm-turn-jobs
description: How DM work rides the shared jobs queue (TASK-0046, specs/031-dm-runtime) - kinds turn/companion/chronicle and their payloads, the gate listener that enqueues turns, the priority claim serialized per session, lease/heartbeat/fencing in jobs/queue.ts, checkpoints, beats, reclaim idempotence (markers, landed-narration detection) and start-up reconcile. Pipeline logic is dm-runtime.
kind: pipeline
sources:
  - apps/server/src/jobs/queue.ts
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/dm/enqueue.ts
  - apps/server/src/schema/jobs.ts
  - apps/server/drizzle/0004_glamorous_warlock.sql
  - apps/server/src/dm/nodes/resolve.ts
verified_against: 3d8f3a8d9de03d84962c501c6c32aa0895f3a36c
---

# DM turn jobs

The DM runtime ([[dm-runtime]]) does not run in the request path. It enqueues rows on the
**same `jobs` table** that [[ingestion]] uses ([[database-schema]], migration 0004) and a
worker in the server process drains them. Nothing here is a new queue technology.

## Kinds and payloads

| kind | one row is | claim priority |
|---|---|---|
| `turn` | one beat of one session | 1 |
| `companion` | one or more AI companions acting once | 2 |
| `chronicle` | one journal pass for a session | 3 |

A `companion` payload's `reason` is `hold`, `turn`, `prompt` or `react`. A `react` payload also
carries `firstReactionAt` and `notBefore` (ISO UTC, database time; specs/036-companion-react).

Payloads are Zod schemas in `dm/jobs.ts` (`TurnJobInput`, `CompanionJobInput`,
`ChronicleJobInput`, all `v: 1`, each with `sessionId`). `TurnTriggerSchema`: `commit`,
`approval`, `npc-turn`, `scene-start`, `manual`, `reconcile`. Stages are the node names plus
`companion` and `chronicle`. `book` is null and `session_id` is required for these kinds
(CHECK constraints).

## Enqueue

`dm/enqueue.ts` `createDmEnqueuer(...).onAppended` is registered with `gate.onAppended` in
`index.ts` ([[server-entrypoint-and-app]]). An `action.committed` row enqueues a `commit` turn.
A `proposal.approved` or `proposal.rejected` row whose proposal's proposer is `ai:dm` (found
in the DM projection) enqueues an `approval` turn so the DM resumes. Then it calls `nudge()`. A
failure is logged, not thrown; reconcile repairs it. A human `action.commented` row on an
open (`declared` or `discussed`) action of an AI companion also calls `enqueueCompanionReact`
(quiet window 3 s, maximum wait 10 s, injectable): one queued `react` job per session
(`jobs_companion_react_queued_key`), a further reaction merges its companion id into the
queued job and moves `notBefore` to `least(now + quiet, firstReactionAt + maxWait)`. `enqueueTurn` is `INSERT ... ON CONFLICT
DO NOTHING` on `jobs_turn_queued_key`, so at most one beat is queued per session.

## Claim, lease, fencing

`claimDmJob` is one `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)` like ingest's, but
ordered: an expired running job first, then by kind priority, then age. A queued turn or
companion job is skipped while another `turn`/`companion` job for the same session holds a live
lease, and a `react` companion job is also skipped until its `notBefore` has passed;
`jobs_session_running_key` backs that with a unique index. Chronicle jobs are not
serialized. `jobs/queue.ts` holds the kind-generic fenced writes (`heartbeat`, `setStage`,
`saveResult`, `finishJob`, which takes `{ result }` or `{ error, result? }`) and the constants `LEASE_MS` 60 s, `HEARTBEAT_MS` 10 s, `POLL_MS`
2 s, `MAX_ATTEMPTS` 3; every write filters on `claim_token`, and `false` means fenced out. The
worker aborts its `AbortController` on a lost lease, which cancels an in-flight `chat()`. Gate
writes cannot be fenced by the table, so resolve heartbeats immediately before each
`gate.submit`.

## Beats

The beat is frozen at assemble and stored in the checkpoint. A commit that lands while a turn
runs queues the next turn (or finds it queued); it never joins the running beat. After a turn,
the worker queues follow-up jobs: a companion job for an AI companion's turn, an `npc-turn`
turn when the DM acts next, a companion `hold` job when the director held, and a chronicle job
when narration shipped. A failed turn queues nothing; the actions stay committed.

## Reclaim idempotence

Every submission is checkpointed (`saveCheckpoint`, fenced) in `jobs.result.checkpoint`, which
claim never clears. A reclaimed job replays recorded submissions from the checkpoint and looks
for the one in flight: proposals carry a marker `[<jobId>#<n>]` in their reason text, and the
checkpoint's `lastSeq` bounds the search. Narration rows carry no marker, so
`findLandedNarration` detects a narration by position: an `ai:dm` narration row after the job's
last known seq. When one exists the runner skips narrate and audit, spends no model calls, and
never duplicates the narration. A claim past `MAX_ATTEMPTS` marks the job `failed` and appends a failure notice.

## Failed turns

A failed turn ends `status = 'failed'` with `jobs.error` a fixed string (`stopped at <node>:
<kind>`) and `jobs.result` a `TurnFailureResult` (`TurnFailure` in `dm/jobs.ts`): checkpoint,
`outcome.status = "failed"`, `audit: null`, the model calls made, and `failure` (`node`, `kind`,
`message`, `detail`). The worker writes it for a node failure and for the bad-seed path (`kind`
`seed`, no calls). A fenced or aborted run writes nothing and is left for reclaim. Excerpt bounds
and the `invalid-output` detail are in [[dm-runtime]].

## Reconcile

At worker start `reconcileTurnJobs(db)` finds sessions with an `action.committed` row that has no
later `action.resolved` and no queued or running turn job, and enqueues a `reconcile` turn for
each. `GET /dm/sessions/:id/turns` lists a session's DM jobs (`listDmJobs`) with outcome and
audit metadata.
