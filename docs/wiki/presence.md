---
name: presence
description: Who is at the table (TASK-0051, decision-0024, specs/035-presence) - the in-memory tracker and PresenceReader with a 5 s grace window and a 10 s heartbeat, the opt-in presence frame, the logged presence.recorded marker the gate writes once per DM turn job, how assemble reads it, and the client strip.
kind: component
sources:
  - apps/server/src/presence/constants.ts
  - apps/server/src/presence/tracker.ts
  - apps/server/src/presence/index.ts
  - apps/server/src/gate/gate.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/dm/nodes/assemble.ts
  - packages/session-model/src/events/presence.ts
  - apps/web/app/play/presence.ts
verified_against: ff78b96b37569e59be1f03b49f518c516043574c
---

# Presence

Presence answers "which humans are at this table right now" two ways, by decision-0024 (option
D, `backlog/decisions/`): a **live** answer held in server memory and pushed to clients that
ask, and a **logged** answer, the `presence.recorded` marker, written at decision points so a
later reader can see who was there. Spec: `specs/035-presence/` (contracts under
`contracts/`). The multi-process revisit is TASK-0136.

## The tracker and the reader

`createPresence(options?)` (`presence/tracker.ts`) returns `{ reader, join, leave, close }`,
created once in `index.ts` ([[server-entrypoint-and-app]]) before the gate. State is a map of
table to user to `{ displayName, connIds, leaveTimer }`. Nothing is persisted: a restart gives
an empty tracker and each client's reconnect rebuilds it.

- A user is present from their first connection. A second tab adds a `connId` and emits
  nothing. When the last `connId` leaves, a grace timer starts; a rejoin inside the window
  clears it and emits nothing. When the timer fires the user is removed and a change emits.
- `PresenceReader` is the one interface for "who is at the table": `presentUsers(sessionId)`
  (sorted by `userId`), `isPresent(sessionId, actor)` (true for any `ai:` actor, else
  membership) and `onChange(listener)`. The gateway ([[websocket-gateway]]) calls `join` and
  `leave`; the gate reads `presentUsers`. No module infers presence from the subscriber
  registry.
- Options `graceMs`, `setTimer` and `clearTimer` let tests inject time. `close()` clears the
  timers; only tests call it so far.

`presence/constants.ts`: `PRESENCE_GRACE_MS` 5000, `HEARTBEAT_INTERVAL_MS` 10000,
`CLEAN_LEAVE_BOUND_MS` 10000 (a clean close shows within this) and `SILENT_LOSS_BOUND_MS` 30000
(a connection lost without a close shows within this; the worst case is two heartbeat
intervals plus the grace window, 25 s).

## Live delivery

A connection opts in with `subscribe { presence: true }` ([[ws-protocol]]). On every subscribe
the gateway moves the connection's `join` to the new table, whether or not it opted in, so the
Director's marker counts every human. Opted-in subscribers get a `presence` frame, a full
snapshot, after `replay-complete` and on every tracker change
([[replay-live-boundary]], [[subscriber-registry]]'s `sendPresence`). Silent loss is found by the
gateway's protocol-level ping: a connection that misses a pong is terminated, which runs the
ordinary close path and starts its grace window ([[websocket-gateway]]).

## The marker

`presence.recorded` v1 (`session-model/src/events/presence.ts`) is a catalogued `marker` with
`present` (sorted, unique user ids, at most 64), `purpose` (`director`, `signoff` or `floor`) and
optional `actionId` ([[session-model]]). `gate.recordPresence` is the only writer: a `system`
actor, visibility `public`, no deduplication ([[proposal-gate]]). `purpose: "director"` is the
only value written so far; TASK-0049 and TASK-0050 reserve `signoff` and `floor`. The DM worker
writes one per claimed `turn` job, before the pipeline, and stores its `seq` as `presenceSeq` in
the job result; a failed write fails the turn at node `presence`
([[dm-turn-jobs]], [[dm-failure-and-gates]]). The DM enqueuer ignores the row, so a marker never
queues a turn. The playtest harness injects a reader that names the scripted seat present
([[playtest-harness]]).

## The Director's read path

`project()` folds the latest marker into `SessionProjections.presence`. The `assemble` node
turns it into `AssembleOutput.presence`: `present`, `absent` (human party controllers missing
from the marker) and `seq`, or `null` before any marker ([[dm-runtime]]). No Director prompt
text uses it yet; TASK-0050 decides how.

## The client strip

`useSession` sends `presence: true` and exposes `present`; `reduceFrame` replaces it on a
`presence` frame and ignores frame types it does not know. `play/presence.ts`'s `presenceRows`
turns the list and the projection into one row per user marked `dm`, `player` or `observer`,
and `PresenceStrip` renders the rows in the table header ([[play-route]],
[[client-session-hook]]).

## Connections

Fed by [[websocket-gateway]]; read by [[proposal-gate]] and the client. The frame shape is part
of the frozen [[ws-protocol]], amended once by decision-0024.

## Operational notes

Presence is per process. With more than one server process each tracker sees only its own
connections; TASK-0136 carries that revisit. A table with no humans records `present: []`.
