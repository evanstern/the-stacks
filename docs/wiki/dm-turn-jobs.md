---
name: dm-turn-jobs
description: How DM work rides the shared jobs queue (TASK-0046, specs/031-dm-runtime) - kinds turn/floor/companion/chronicle and their payloads, the gate listener that enqueues turns and arms floor waits, the priority claim, lease/heartbeat/fencing in jobs/queue.ts, checkpoints, resume after approval, beats, the resolve-order contract, reclaim idempotence (markers, landed narration, marker numbering across a deploy) and start-up reconcile (turn and floor). Pipeline logic is dm-runtime.
kind: pipeline
sources:
  - apps/server/src/jobs/queue.ts
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/dm/resume.ts
  - apps/server/src/dm/pipeline/runner.ts
  - apps/server/src/dm/pipeline/context.ts
  - apps/server/src/dm/enqueue.ts
  - apps/server/src/schema/jobs.ts
  - apps/server/src/schema/dm-model-calls.ts
  - apps/server/src/dm/model-calls.ts
  - apps/server/drizzle/0004_glamorous_warlock.sql
  - apps/server/drizzle/0005_unknown_lizard.sql
  - apps/server/drizzle/0007_aromatic_baron_zemo.sql
  - apps/server/src/dm/nodes/resolve.ts
  - apps/server/src/dm/companion.ts
  - apps/server/src/dm/chronicle.ts
size_budget_exempt: both notes sat within 30 chars of the 8000 budget before TASK-0180; the talk path got its own note (dm-talk-triggers) and only a pointer line lands here; the rest is one pipeline each, not splittable without a TASK of its own
verified_against: ed3949ce7a0aa83c9dd732137ab346ad1df8b7e0
---

# DM turn jobs

The DM runtime ([[dm-runtime]]) does not run in the request path. It enqueues rows on the
**same `jobs` table** that [[ingestion]] uses ([[database-schema]], migration 0004) and a
worker in the server process drains them.

## Kinds and payloads

| kind | one row is | claim priority |
|---|---|---|
| `turn` | one beat of one session | 1 |
| `floor` | a code-only floor check ([[turn-floor]]) | 2 |
| `companion` | one or more AI companions acting once | 3 |
| `chronicle` | one journal pass for a session | 4 |

A `companion` payload's `reason` is `hold`, `turn`, `prompt` or `react`; `react` also
carries `firstReactionAt` and `notBefore` (ISO UTC; specs/036-companion-react).

Payloads are Zod schemas in `dm/jobs.ts` (`TurnJobInput`, `FloorJobInput`, `CompanionJobInput`,
`ChronicleJobInput`, all `v: 1`, each with `sessionId`). `TurnTriggerSchema`: `commit`,
`approval`, `npc-turn`, `scene-start`, `manual`, `reconcile`, `talk` ([[dm-talk-triggers]]). `book` is null and `session_id` required (CHECK constraints).

## Enqueue

`createDmEnqueuer(...).onAppended` (`dm/enqueue.ts`) is registered with `gate.onAppended` in
`index.ts` ([[server-entrypoint-and-app]]). An `action.committed` row enqueues a `commit` turn.
A `proposal.approved` or `proposal.rejected` row for an `ai:dm` proposal (found
in the DM projection) enqueues an `approval` turn so the DM resumes. Floor follow-ups and waits arm here too ([[turn-floor]]). Then it calls `nudge()`; reconcile repairs a failure. A human `action.commented` row on an
open action of an AI companion also calls `enqueueCompanionReact`
(quiet 3 s, max wait 10 s): one queued `react` job per session
(`jobs_companion_react_queued_key`); a further reaction merges its companion id into it. `enqueueTurn` is `INSERT ... ON CONFLICT
DO NOTHING` on `jobs_turn_queued_key`, so one beat is queued per session.
Rule 7: a `talk` row queues a coalesced `talk` turn ([[dm-talk-triggers]]).

## Claim, lease, fencing

`claimDmJob` is ingest's `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)`, ordered: an expired running job first, then by kind priority, then age. A queued turn, floor or
companion job is skipped while another `turn`/`companion`/`floor` job of the session holds a live
lease, and a `react` or `floor` job until its `notBefore` passes; `jobs_session_running_key` (unique index) backs that. Chronicle jobs are not serialized. `jobs/queue.ts` holds the kind-generic fenced writes (`heartbeat`, `setStage`,
`saveResult`, `finishJob`) and the constants `LEASE_MS` 60 s, `HEARTBEAT_MS` 10 s, `POLL_MS`
2 s, `MAX_ATTEMPTS` 3; every write filters on `claim_token`, and `false` means fenced out. The
worker aborts an in-flight `chat()` on a lost lease. Resolve heartbeats before each `gate.submit`.

## Resume after approval

After a human DM approves an `ai:dm` proposal, the `approval` turn does not interpret that action again (TASK-0168, specs/057). The worker passes `loadPriorTurns` (`loadPriorTurnCheckpoints`: the session's earlier checkpointed turn jobs, newest first) to assemble, which reads it only when an `ai:dm` proposal names a beat action. `TurnCheckpoint.resumed` freezes the plans (absent on older rows). A rejected proposal yields no plan; that action interprets again. Since spec 082 `findResumedPlans` re-parses each frozen plan with the current reading and step schemas and skips one that no longer parses (a v10 plan with model-written numbers), so that action interprets again. A resolved attack also submits `damage.apply` from the attack entry (key `<key>:dmg`) before its `onHit` effects.

## Beats

The beat is frozen at assemble and stored in the checkpoint. A commit landing mid-turn
never joins the running beat. After a turn,
the worker queues follow-up jobs: a companion job for an AI companion's turn, an `npc-turn`
turn when the DM acts next, a companion `hold` job when the director held, and a chronicle job
when narration shipped. A failed turn queues nothing. An action awaiting a human DM's ruling is left out of every turn's beat.

## Resolve order

Opening moves (the Director's `arrivals` rows log first; then encounter start, where a seed-presence group logs the encounter beat's `arrived` rows, [[seed-npc-presence]]), rulings, actions, NPC, closing moves, turn advance; hold runs only the two Director groups. The TASK-0147 batch gate slots before turn advance. The plan gate runs first (a passing group may carry `pull` ids resolve adds to the scene before its steps, spec 068) and refuses a group naming an unknown or absent combatant or a contradicting step text ([[dm-failure-and-gates]]). A `presence` effect submits a `scene-presence` proposal through the gate. When the active combatant left the order during the turn, `initiative.leave` already handed the turn on, so resolve skips the closing `turn.advance` and still settles (spec 048). On a reclaim, `activeLeaverFromLog` reads the active-at-start combatant from the log. After an encounter start and after each turn advance, `settleTurn` (`nodes/settle.ts`, code only) settles each downed combatant reached: a dying one rolls `death-save.roll`, then `turn.advance` passes it; a stable or unable one passes; a natural 20 revives it and keeps the turn. Contract: `specs/031-dm-runtime/contracts/turn-jobs.md`.

## Reclaim idempotence

A check `Submission` also carries `band` (read from `check.resolved`, also by `findLanded` and `refreshSubmission`) and the step's `stakes` (spec 070), `reveals` and `revealedText` (spec 080; absent on an older checkpoint). Every submission is checkpointed (`saveCheckpoint`, fenced) in `jobs.result.checkpoint`, which claim never clears. A reclaimed job replays recorded submissions and looks
for the one in flight: proposals carry a marker `[<jobId>#<n>]` in their reason text, and the
checkpoint's `lastSeq` bounds the search. Narration rows carry no marker: `findLandedNarration` finds an `ai:dm` narration row after the job's
last seq, and the runner then skips narrate and audit. A deploy that shifts step numbers could mismatch a marker (accepted). `TurnCheckpoint.cut` (TASK-0182) marks the cut done. An `advance` submission in the checkpoint ends the turn; a reclaim still settles and sets the mode. A claim past `MAX_ATTEMPTS` marks the job `failed` with a failure notice.

## Failed turns

A failed turn ends `status = 'failed'` with `jobs.error` a fixed string (`stopped at <node>:
<kind>`) and `jobs.result` a `TurnFailureResult` (shape and excerpt bounds: [[dm-failure-and-gates]]). The worker writes it for a node failure and the bad-seed path (`kind` `seed`). A fenced or aborted run writes nothing.

**The presence marker.** The worker takes `gate: Pick<Gate, "submit" | "recordPresence">`.
Before the pipeline of each claimed `turn` job it calls `gate.recordPresence(sessionId, {
purpose: "director" })` once, so the log holds who was at the table (decision-0024, [[presence]]). Every `turn` job result carries `presenceSeq`, the marker's `seq`
(`null` when none was written). A refusal or a throw
finishes the job `failed` with `failure.node = "presence"` and `jobs.error` `stopped at presence:
<kind>` (`gate` or `internal`); the pipeline stops.

## Calls, usage and the ledger

Each `ModelCallRecord` in `jobs.result.calls` (outcome `ok`, `invalid-json`, `truncated`, `error`) carries provider, model, tokens, `costUsd` and `durationMs` ([[ai-gateway]]). As each attempt ends, the worker's `recordCall` seam inserts
one `dm_model_calls` row (`dm/model-calls.ts`; table in [[database-schema]]), bound to the job
id, session id, kind and `jobs.attempts` of the claim. The ledger also holds attempts `calls` omits: an aborted attempt (`outcome: "aborted"`) and calls of a reclaimed attempt. So
the ledger, not `calls`, is the cost authority. Every submission names the seqs the gate
returned: `Submission.seqs`, `TurnCheckpoint.narration.seqs`, `CompanionSubmission.seqs` and the
chronicle's `seqs` (`[]` on a refusal or on a submission recovered after reclaim). That is the
job-to-event link; routes in [[debug-view]].

**Snapshot seams.** `DmWorkerDeps.loadProjectionsThrough` and the seed loader go to the chronicle job, which builds the state at its `throughSeq` ([[actor-snapshot]]). A companion overflow records an `error` play, a chronicle overflow returns `entries: 0`; neither fails the job. A turn's overflow
fails the turn (`state-overflow`, [[dm-failure-and-gates]]).

## Reconcile

At worker start `reconcileTurnJobs(db)` finds sessions with an `action.committed` row that has no
later `action.resolved` and no queued or running turn job, and enqueues a `reconcile` turn for each (unchanged by TASK-0168; the turn's beat omits an awaiting action, so it spends no interpret call); `reconcileFloorJobs` follows ([[turn-floor]]). `GET /dm/sessions/:id/turns` lists a session's DM jobs.
