---
name: debug-view
description: The operator debug API (TASK-0116, specs/037-debug-api) - four read-only /dm routes (events, jobs, seed, calls), operator-only, cursor paging, the job-to-seq link through seqs lists, the dm_model_calls ledger as the cost authority, and what the debug page (TASK-0117) and the working signal (TASK-0132) can and cannot use. Read before building on or changing these routes.
kind: component
sources:
  - apps/server/src/routes/dm.ts
  - apps/server/src/dm/model-calls.ts
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/seed/views.ts
  - apps/server/src/dm/pipeline/call.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/schema/dm-model-calls.ts
  - specs/037-debug-api/contracts/debug-api.md
verified_against: 2b58684eba93e597b951465770a9fa11cc5d4a24
---

# Debug view API

Four read-only routes under `/dm` (`routes/dm.ts`, [[dm-runtime]]) let an operator, or an agent
with an operator session, see everything the DM did in one session. The planned consumer is the
debug page (TASK-0117, polling about every 2 s). The shapes are fixed in
`specs/037-debug-api/contracts/debug-api.md`.

## Auth and rules

Every route runs the `/dm` auth middleware, then `requireOperator`: no session is `401`, a
player is `403`, both before any query validation or read. Query values are Zod-checked; a
failure is `400` in the standard shape ([[error-contract]]). No route appends an event, changes
a job or enqueues work. Nothing is masked: DM-visibility events and DM-only seed fields return.
No response carries prompt or completion text. The one exception is the bounded excerpts inside
a failed job's `result.failure.detail` ([[dm-failure-and-gates]]). The routes ship in every
environment with no flag. `GET /dm/sessions/:id/turns` is unchanged.

## The routes

| route | returns | cursor |
|---|---|---|
| `GET .../events?after&limit` | every event after a seq, all visibilities, as `StoredEvent`, plus `headSeq` | `after` (seq), `nextAfter`, `hasMore`; limit 1..1000, default 500 |
| `GET .../jobs?limit&before` | DM jobs (`turn`, `companion`, `chronicle`), newest first, full `input` and `result` as stored, no claim token, with `heartbeatAt` | `before` (job id), `nextBefore`; limit 1..200, default 50; a foreign `before` is `400` |
| `GET .../seed` | `{ seedId, seed, dmOnlyPaths }` for the session's scene | none; `404` with no scene, `409` when the seed fails to load |
| `GET .../calls?after&limit` | the usage ledger rows plus `totals` over the whole session | `after` (row id), `nextAfter`, `hasMore`; limit 1..1000, default 500 |

An unknown session answers `200` with empty lists (not `seed`). `dmOnlyPaths` comes from
`dmOnlySeedPaths` (`dm/seed/views.ts`, [[dm-narration-quality]]). The jobs page uses
`listDmJobsPage` (`dm/jobs.ts`), ordered `(created_at desc, id desc)`; the older `listDmJobs`
stays as it was.

## Linking a job to its events

A job wrote seq `s` when `s` is in a `seqs` list of its result: `checkpoint.submissions[].seqs`,
`checkpoint.narration.seqs`, `plays[].submissions[].seqs`, or a chronicle's `seqs`
([[dm-turn-jobs]]). Three edges: a checkpoint stored before TASK-0116 has no narration `seqs`
(unknown, not absent); a submission recovered after a reclaim carries `seqs: []`; a fenced or
reclaimed job can have written rows no list names. A client treats `[]` on a non-refused
submission as "unknown".

## The ledger is the cost authority

`dm_model_calls` ([[database-schema]]) gets one row as each model attempt ends, so a running
turn's calls show before the job finishes. It also holds attempts `jobs.result.calls` omits
(`outcome: "aborted"`, lower `jobAttempt` after a reclaim). `totals` has `all`, `byPurpose` and
`byModel` (key `<provider>/<model>`, or `unknown`). A null token count adds 0; a null cost adds
nothing and counts in `unpricedCalls`. Sum cost from the ledger, never from `calls`.

## What consumers can and cannot use

The debug page can fold `events` with the session-model `project` call unchanged and render
jobs, seed and calls directly. These routes are operator only, so a player browser cannot call
them. TASK-0132 (show every seat that the DM is working) needs its own signal: a client fold
over the player log, or a narrow non-operator route carrying only "working" and the stage.
Neither is part of this API. Jobs stored before TASK-0116 lack the usage and `seqs` fields; a
client reads an absent field as "not recorded".
