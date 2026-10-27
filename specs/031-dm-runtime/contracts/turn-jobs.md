# Contract: DM jobs on the jobs queue (payload, lifecycle, lease, fencing, reclaim, beats)

Modules: `apps/server/src/jobs/queue.ts` (kind-generic fenced writes, extracted from
`library/ingest/jobs.ts`), `apps/server/src/dm/jobs.ts` (DM claim, enqueue, checkpoint,
reconcile), `apps/server/src/dm/worker.ts` (the loop), `apps/server/src/dm/enqueue.ts` (the
gate listener). Schema: `apps/server/src/schema/jobs.ts`, migration `0004_*`. Queue origin:
`specs/017-ingestion-pipeline` (research R6), decision-0005.

## Job kinds

| Kind | One row is | Stages | Claim priority |
|---|---|---|---|
| `ingest` | one book upload (unchanged) | `extract`, `parse`, `store`, `embed` | ingest worker only |
| `turn` | one beat of one session | `assemble`, `director`, `interpret`, `adjudicate`, `resolve`, `narrate`, `audit` | 1 |
| `floor` | one absence or stall check for one session; no model call | none (`stage` stays null) | 2 |
| `companion` | one or more AI companions acting once | `companion` | 3 |
| `chronicle` | one journal pass for one session | `chronicle` | 4 |

Amended 2026-10-27 (TASK-0050, operator ruling FT-3). The operator said: "TASK-0050: I accept
the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the frozen-contract amendments
to 029, 031 and 044 and the one jobs migration." The `floor` kind is serialised with `turn`
and `companion` per session. Its `input.notBefore` gates the claim, as the `react` companion
job's does. Payload and result: `specs/049-turn-floor/data-model.md`.

## Payloads (`jobs.input`)

```ts
export const TurnTriggerSchema = z.enum([
  "commit",       // gate appended action.committed
  "approval",     // gate appended proposal.approved or proposal.rejected
  "npc-turn",     // a turn job ended with a monster active in turn mode
  "scene-start",  // POST /dm/sessions/:id/start
  "manual",       // POST /dm/sessions/:id/turn
  "reconcile",    // worker start found an unanswered commit (FR-008)
]);

export const TurnJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  trigger: TurnTriggerSchema,
  triggerSeq: z.number().int().min(1).nullable(),   // the row that caused the enqueue
  forceResolve: z.boolean().default(false),          // set by a companion job ending a hold
  start: z.object({                                  // scene-start only
    seedId: z.string().regex(/^[a-z0-9-]{1,64}$/),
    seats: z.record(RefIdSchema, z.uuid()),          // human characterId -> userId
  }).nullable().default(null),
});

export const CompanionJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  companions: z.array(RefIdSchema).min(1).max(4),
  reason: z.enum(["hold", "turn", "prompt", "react"]),
  beatJobId: z.uuid().nullable(),                    // the held turn job, for reason "hold"
  firstReactionAt: z.iso.datetime().optional(),      // react only: database time of the first reaction
  notBefore: z.iso.datetime().optional(),            // react only: earliest claim time
});

export const ChronicleJobInput = z.object({
  v: z.literal(1),
  sessionId: z.uuid(),
  throughSeq: z.number().int().min(0),               // chronicle covers rows up to here
});
```

`jobs.result` for a turn job holds `{ checkpoint, outcome, audit, calls }` (below and
[audit.md](audit.md)).

Amended by specs/033-director-robustness/contracts/failure-record.md.

## Schema changes (migration `0004`)

| Change | Why |
|---|---|
| `kind` CHECK → `IN ('ingest','turn','companion','chronicle')` | new kinds; migration `0007` adds `'floor'` and `jobs_floor_queued_key` (TASK-0050, FT-3) |
| `stage` CHECK adds `assemble`, `director`, `interpret`, `adjudicate`, `resolve`, `narrate`, `audit`, `companion`, `chronicle` | per-kind stages |
| `book` → nullable; CHECK `kind <> 'ingest' OR book IS NOT NULL` | DM jobs have no book |
| add `session_id uuid` nullable; CHECK `kind = 'ingest' OR session_id IS NOT NULL` | DM jobs belong to a session |
| `jobs_active_book_key` gains `AND kind = 'ingest'` | keep the ingest rule exact |
| new unique `jobs_turn_queued_key (session_id) WHERE kind='turn' AND status='queued'` | one queued beat per session (FR-003) |
| new unique `jobs_chronicle_queued_key (session_id) WHERE kind='chronicle' AND status='queued'` | one queued chronicle per session (FR-080) |
| new unique `jobs_session_running_key (session_id) WHERE kind IN ('turn','companion') AND status='running'` | one acting job per session (FR-003); migration `0007` adds `'floor'` (TASK-0050, FT-3) |
| new index `jobs_dm_session_idx (session_id, kind, status)` | enqueue and reconcile reads |

Generate it with `drizzle-kit generate` from the schema. No hand-added statement is expected.
After merging `origin/main`, regenerate rather than hand-merge the journal (runbook).

## Lifecycle

```
queued ──claim──▶ running(stage…) ──finish──▶ succeeded | failed
                     │  lease expires (no heartbeat for LEASE_MS)
                     └──────────────▶ reclaimable: next claim → running, attempts+1, new claim token
attempts > MAX_ATTEMPTS at claim ──▶ failed "abandoned 3 times"
```

Constants reuse the queue's: `LEASE_MS` 60 s, `HEARTBEAT_MS` 10 s, `POLL_MS` 2 s,
`MAX_ATTEMPTS` 3.

## Claim (DM)

One statement, priority then age, serialized per session:

```sql
UPDATE jobs SET status='running', attempts=attempts+1, claim_token=gen_random_uuid(),
       heartbeat_at=now(), started_at=coalesce(started_at, now()),
       stage = CASE kind WHEN 'turn' THEN 'assemble' WHEN 'companion' THEN 'companion' WHEN 'floor' THEN NULL ELSE 'chronicle' END
WHERE id = (
  SELECT j.id FROM jobs j
  WHERE j.kind IN ('turn','floor','companion','chronicle')
    AND ( (j.status='running' AND j.heartbeat_at < now() - <LEASE_MS>)
       OR (j.status='queued' AND (j.kind='chronicle' OR NOT EXISTS (
             SELECT 1 FROM jobs r WHERE r.session_id=j.session_id AND r.kind IN ('turn','companion','floor')
               AND r.status='running' AND r.heartbeat_at >= now() - <LEASE_MS>))) )
  ORDER BY (j.status='running') DESC,
           CASE j.kind WHEN 'turn' THEN 1 WHEN 'floor' THEN 2 WHEN 'companion' THEN 3 ELSE 4 END,
           j.created_at
  FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING …;
```

- A queued companion job whose `input->>'notBefore'` is set is claimable only when
  `(input->>'notBefore')::timestamptz <= now()`. Rows without `notBefore` are unaffected.
  Amended by specs/036-companion-react.
- A reclaim of an expired job comes first.
- A unique violation on `jobs_session_running_key` (a race between a reclaim and a queued
  claim for the same session) returns "nothing claimed". The loop polls again.
- `attempts > MAX_ATTEMPTS` → mark `failed` (fenced) and append the failure notice (FR-012).

## Fencing

Every write after a claim filters on `id` and `claim_token`: `heartbeat`, `setStage`,
`saveCheckpoint`, `finishJob`. A `false` return means fenced out. The worker then aborts the
job's `AbortController`, which cancels any in-flight `chat()` call.

Gate submissions are not database writes the queue can fence. Resolve calls `deps.fence()`
(a heartbeat) immediately before each `gate.submit`, so a stale worker stops at its next
submission. The window between that check and the append is covered by the marker rule in
[resolve.md](resolve.md).

## Checkpoint

```ts
export interface TurnCheckpoint {
  beat: string[] | null;                       // frozen action ids, or null before assemble
  npcTurn: { combatantId: string } | null;
  director: DirectorOutput | null;
  interpret: InterpretOutput | null;
  adjudicate: AdjudicateOutput | null;
  submissions: Submission[];                   // resolve.md
  lastSeq: number;                             // highest seq the gate returned to this job
  narration: { attempts: AuditRecord["attempts"]; shipped: boolean } | null;
}
```

`saveCheckpoint` writes `result.checkpoint` (fenced). Claim never clears `result`, so a
reclaimed job reads the previous attempt's checkpoint.

## Enqueue (the gate listener)

`createDmEnqueuer({ db, nudge })` returns `onAppended(sessionId, rows)`; `index.ts` registers
it with `gate.onAppended`. For each call:

1. If any row is `action.committed` → `enqueueTurn(sessionId, "commit", seq)`.
2. If any row is `proposal.approved` or `proposal.rejected` whose proposal came from `ai:dm`
   → `enqueueTurn(sessionId, "approval", seq)`.
3. For each human `action.commented` row on an open action whose actor is
   `ai:companion:<id>` → `enqueueCompanionReact(sessionId, id, { quietMs, maxWaitMs })`.
   Comments by any `ai:` actor queue none. A failure is logged and never fails the human's
   submission. Amended by specs/036-companion-react.
4. For each `table-mode.changed` row in turn mode whose actor is a human (a `floor` request:
   End turn, Pass, Take floor or Return floor): `after` names `ai:dm` →
   `enqueueTurn(sessionId, "npc-turn", seq)`; `after` names `ai:companion:<id>` →
   `enqueueCompanion` with reason `turn` for that character. Rows written by `ai:dm` queue
   none: their producer (resolve's `nextJob`) queues its own follow-up. Amended 2026-10-27
   (TASK-0050, operator rulings FT-3, Q6; specs/049-turn-floor R8).
5. Under an AI seat, when the enqueuer has a presence reader, arm the floor waits
   (`dm/floor.ts` runs them). Amended 2026-10-27 (TASK-0050, operator ruling FT-3;
   specs/049-turn-floor R10):
   - `table-mode.changed` in turn mode naming an absent human (any actor): arm `absence`,
     `notBefore = now() + FLOOR_ABSENCE_WAIT_MS`.
   - `action.declared` with scope `party`, two or more party humans: arm `stall`,
     `notBefore = now() + FLOOR_STALL_WINDOW_MS`.
   - `action.commented` on such an open action: re-arm `stall` (`notBefore` and `stanceSeq`).
   - `action.committed` or `action.withdrawn`: cancel that action's queued `stall`.
   - `onPresenceChange(sessionId)`, called from the presence reader's `onChange`: arm
     `absence` when the active human is now absent.
6. Call `nudge()` so the worker polls at once.

`enqueueFloorCheck` inserts `ON CONFLICT DO NOTHING` on the partial unique index
`jobs_floor_queued_key` (`session_id`, `input->>'check'`, `coalesce(input->>'actionId','')`
where `kind = 'floor'` and `status = 'queued'`). On conflict it moves `holder`, `stanceSeq`
and `notBefore` on the queued row and loops when that row was claimed in between.
`cancelFloorCheck` deletes the queued row. Times are database time (migration `0007`).

`enqueueTurn` is `INSERT … ON CONFLICT ON jobs_turn_queued_key DO NOTHING`. A queued job
already covers the next beat. A listener failure is logged, and FR-008's reconcile repairs
it at the next worker start.

`enqueueTurnForced(sessionId)` is the companion job's upsert: insert with
`forceResolve: true`, or update the queued row's `input.forceResolve` to `true`.

`enqueueCompanionReact` inserts a `react` companion job `ON CONFLICT` on the partial unique
index `jobs_companion_react_queued_key` (`session_id` where `kind = 'companion'`,
`status = 'queued'` and `input->>'reason' = 'react'`). On conflict it merges the companion id
into `input.companions` and sets `input.notBefore` to
`least(now() + quietMs, firstReactionAt + maxWaitMs)` in one statement, and loops when the
queued row was claimed in between. Both times are database time (migration `0005`).
Amended by specs/036-companion-react.

`enqueueCompanion` and `enqueueChronicle` insert their kinds (`chronicle` with `ON CONFLICT
DO NOTHING`).

## After a turn job

| Turn outcome | Next jobs |
|---|---|
| `completed`, turn mode, next active actor is an AI companion | companion job `{ companions: [it], reason: "turn" }` |
| `completed`, turn mode, next active actor is `ai:dm` | turn job, trigger `npc-turn` |
| `completed`, free mode, `companionPrompts` non-empty | companion job `{ reason: "prompt" }` |
| `completed`, narration applied | chronicle job |
| `held` | companion job `{ reason: "hold", beatJobId }` |
| `failed` | none; the failure notice is appended; the actions stay committed |

## Beats (AC #9)

- The beat is frozen at assemble (FR-004) and stored in the checkpoint.
- A commit appended while a turn job runs inserts the session's queued turn job, or finds it
  already there. It never joins the running beat.
- The queued job can be claimed only after the running one ends (the claim's `NOT EXISTS`).
- The next beat resolves every committed action in commit `seq` order.

## Resolve order (decision-0025 §4)

`resolve` runs six groups in this order. This section amends the resolve-then-narrate order of
decision-0017 in place, as decision-0025 §4 directs. [resolve.md](resolve.md) "Order of work" and
[director.md](director.md) state the same order.

1. **Opening moves** (Director): the scene-start setup, and the `turn` table-mode decision
   (monster combatants added, initiative rolled, turn mode set).
2. **Rulings**: one `journal` proposal per ruling.
3. **Action groups**, in commit `seq` order.
4. **NPC group**, for an `npc-turn` trigger.
5. **Closing moves** (Director): tracker advances, the `free` table-mode decision (encounter
   end, then free mode), and the scene end.
6. **Turn advance**, only while the encounter is active, the mode is turn and the mode did not
   start this turn.

Decision-0025 §4 says: "`resolve`: action groups first, then the Director group, then the batch
gate." Decision-0025 §4 names the Director group as one unit. This contract splits that unit
into opening moves and closing moves. The operator approved this split on 2026-10-27 ("Approved"). Decision-0025 §4 gives the rationale: a Director
move sees the results of the actions. Closing moves follow that rationale.

Encounter start and scene-start setup are opening moves. An action may name a combatant that the
opening move adds. Run after the actions, the action would refuse with `UNKNOWN_COMBATANT`.
Decision-0025 §2.5 passes encounter start: "Encounter start passes, because initiative is a roll."

Hold runs the opening moves, then the closing moves. Hold runs no ruling, action, NPC or turn
advance group.

The batch gate (decision-0025 §3.3, TASK-0147) will run between the closing moves and the turn
advance. That slot is empty until TASK-0147 lands.

**Reclaim across a deploy.** The in-flight marker `<jobId>#<n>` counts submissions. The n-th
submission is a different step under the old order and the new order. A job checkpointed by the
old code and reclaimed by the new code could match a landed row to the wrong step. The window is
one in-flight job per session, at the moment of a deploy. This contract accepts the risk (spec
045, OQ-2 option (a)). Revisit card: TASK-0156.

## Reconcile (FR-008)

At worker start, `reconcileTurnJobs(db)` finds sessions whose log holds an
`action.committed` row with no later `action.resolved` row for the same action id, and no
`queued` or `running` turn job. It enqueues one turn job each with trigger `reconcile`. The
query reads `events` by type and `payload->>'actionId'`; its cost is bounded by the number of
sessions with play.

Amended 2026-10-27 (TASK-0050, operator ruling FT-3): at worker start, after
`reconcileTurnJobs`, `reconcileFloorJobs` arms `absence` for each turn-mode session whose
holder is an absent human, and `stall` for each open multi-human party action with no queued
`stall`, under an AI seat. It reads only sessions with an event in the last 24 hours
(`FLOOR_RECONCILE_LOOKBACK_MS`). It runs only when the worker has a presence reader.

## Floor constants

Amended 2026-10-27 (TASK-0050, operator ruling FT-3): `FLOOR_ABSENCE_WAIT_MS = 30_000`,
`FLOOR_STALL_WINDOW_MS = 120_000`. Both are injectable through `createDmEnqueuer` and the
worker deps (`floorAbsenceWaitMs`, `floorStallWindowMs`), as `reactQuietMs` is for react.

## Ingestion changes

- `claimJob` in `library/ingest/jobs.ts` adds `kind = 'ingest'` to its inner `WHERE`.
- `listJobs` and `getJob` filter `kind = 'ingest'`.
- Fenced writes move to `jobs/queue.ts`; `jobs.ts` keeps its exported names and signatures.
- The ingestion suites run unchanged and pass.
