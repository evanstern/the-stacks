---
name: debug-view
description: The operator debug API (TASK-0116, specs/037-debug-api) - four read-only /dm routes (events, jobs, seed, calls), operator-only, cursors, the job-to-seq link, the dm_model_calls ledger as cost authority - and the debug page on it (TASK-0117, play/:sessionId/debug) - waiting strip with Retry, linked columns, poll cadence, scrub, panels - and what TASK-0132 can reuse.
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
  - apps/web/app/debug/activity.ts
  - apps/web/app/debug/api-types.ts
  - apps/web/app/debug/client.ts
  - apps/web/app/debug/components/cost-panel.tsx
  - apps/web/app/debug/components/debug-gate.tsx
  - apps/web/app/debug/components/debug-view.tsx
  - apps/web/app/debug/components/event-log.tsx
  - apps/web/app/debug/components/job-card.tsx
  - apps/web/app/debug/components/job-timeline.tsx
  - apps/web/app/debug/components/journal-panel.tsx
  - apps/web/app/debug/components/ledger-panel.tsx
  - apps/web/app/debug/components/seed-panel.tsx
  - apps/web/app/debug/components/state-column.tsx
  - apps/web/app/debug/components/type-filter.tsx
  - apps/web/app/debug/components/waiting-strip.tsx
  - apps/web/app/debug/event-filter.ts
  - apps/web/app/debug/job-view.ts
  - apps/web/app/debug/labels.ts
  - apps/web/app/debug/poller.ts
  - apps/web/app/debug/read-result.ts
  - apps/web/app/debug/scrub.ts
  - apps/web/app/debug/seq-index.ts
  - apps/web/app/debug/snapshot.ts
  - apps/web/app/debug/use-debug-session.ts
  - apps/web/app/debug/waiting.ts
  - apps/web/app/routes/play-debug.tsx
verified_against: 98787267ceb9b464788faea18ab76a51a199a95b
---

# Debug view API

Four read-only routes under `/dm` (`routes/dm.ts`, [[dm-runtime]]) let an operator, or an agent
with an operator session, see everything the DM did in one session. The consumer is the debug
page (TASK-0117, see "The debug page" below). The shapes are fixed in
`specs/037-debug-api/contracts/debug-api.md`.

## Auth and rules

Every route runs the `/dm` auth middleware, then `requireOperator`: no session is `401`, a
player is `403`, both before any query validation or read. Query values are Zod-checked; a
failure is `400` in the standard shape ([[error-contract]]). No route appends an event, changes
a job or enqueues work. Nothing is masked: DM-visibility events and DM-only seed fields return.
No response carries prompt or completion text. The one exception is the bounded excerpts inside
a failed job's `result.failure.detail` ([[dm-failure-and-gates]]). A turn job's `result` also
carries `presenceSeq` and, when the pre-pipeline marker write fails, `failure.node = "presence"`
([[dm-turn-jobs]]); the routes return them as stored. The routes ship in every
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

## The debug page

Route `play/:sessionId/debug` (`routes/play-debug.tsx`, client-only like [[play-route]]; the
operator reaches it from the Debug link in the play header). `DebugGate` renders
`OperatorOnly` for anyone but an operator and makes no `/dm` request. The code lives in
`apps/web/app/debug/`; the pure modules (`snapshot`, `read-result`, `waiting`, `scrub`,
`poller`, `activity`, `labels`, `seq-index`, `job-view`) have no React import.

**Polling.** `use-debug-session.ts` reads the seed once, then pages events by `after` seq, jobs
by newest-first, and calls by row id. `poller.ts` is settle-then-schedule: ticks never overlap,
a hidden tab schedules nothing and a return to visible ticks at once. `activity.ts` sets the
delay: 2 s while any job is queued or running, an event arrived in the last 30 s, or a retry
went out in the last 30 s; else 10 s. Times are page-clock receipt times, so server clock skew
cannot matter. An auth error stops the poller. Older jobs load on demand through `nextBefore`.

**The strip.** A sticky `WaitingStrip` answers "why is the table waiting?" from `waiting.ts`
(`toWaitingSummary`): table mode (free, or turn with the active actor and round), each live job
with its stage, attempts and heartbeat age, uncommitted actions (`declared` or `discussed`),
pending proposals, held turns that still wait on their companion job, and the latest failed turn
that no narration has followed. Retry shows when there is such a failure, or when the table is
stuck: a newer `action.committed` than any `narration`, no live turn or companion job, and
15 s (`STUCK_AFTER_MS`) since the commit. Retry is `POST /dm/sessions/:id/turn`. It shows "Queued
job <id>" on `202`, the server message on a refusal, "Not allowed: the operator only." on an auth
error, and "Network error. Try again." otherwise. A retry kicks the poller at once.

**Three columns.** Jobs (a timeline of cards, one per job, seven turn sections from Assemble to
Failure, with "not run" placeholders for stages a failed turn never reached; follow-bottom keeps
a viewer who is at the end of the list at the end as jobs arrive), Events (every event, a type
filter combobox, no modal) and State (the projection, folded with `project` as the DM viewer).
`seq-index.ts` joins a job to the seqs it wrote (the "Linking a job to its events" rule). Selecting
a job highlights its events; selecting an event highlights its job. A job with no `seqs` on a
non-refused submission reads as "link unknown" and highlights nothing, which is also what a
failed turn shows (it writes no events).

**The scrub.** Clicking an event pins the State column to that seq: `scrub.ts`'s `createFolder`
folds `applyEvent` incrementally and saves a projection every 250 events, so a pin folds at most
249 events past a checkpoint. The column shows "pinned at seq N" with a back-to-live control.

**Panels.** State opens one of four slide-out panels (Seed, Ledger, Journal, Cost), one at a
time, closed by Escape; none is a modal. Seed marks DM-only text: the server's `dmOnlyPaths`
are JSON Pointers (`/beats/0/summary`), so `seed-panel.tsx` converts them with `pointerToPath`
before matching (a live check found zero marks before this). Ledger and Cost render the
`/calls` rows and `totals`; Cost reports a null price as `unpriced`.

**Layout.** On `xl` the board is `h-dvh` with three columns that scroll on their own; under
`xl` the jobs column is capped at 60 dvh. The jobs timeline box, not the column section, is the
scroller that follow-bottom and scroll-into-view act on.

**Known limit.** The env-configured `fake` provider returns an empty body for every call, so a
live stack cannot produce narration: every turn fails at the director, and "events written by a
job" highlighting is unexercised live (the unit tests cover it). A scriptable env fake is
TASK-0158.

## What consumers can and cannot use

The debug page folds `events` with the session-model `project` call unchanged and renders
jobs, seed and calls directly. These routes are operator only, so a player browser cannot call
them. TASK-0132 (show every seat that the DM is working) needs its own signal: a client fold
over the player log, or a narrow non-operator route carrying only "working" and the stage.
Neither is part of this API. Jobs stored before TASK-0116 lack the usage and `seqs` fields; a
client reads an absent field as "not recorded".

TASK-0132 can reuse two pieces from the page. `waiting.ts` folds "a commit with no narration yet"
(the newest `action.committed` seq above the newest `narration` seq) over an event list, with no
operator-only input. `labels.ts` holds the stage labels (`TURN_NODES`, `nodeName`) and
`ageText`. Both are pure; the jobs and seed inputs stay operator-only.
