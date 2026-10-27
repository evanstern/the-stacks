---
title: 'DRAFT — Presence is a server-to-client snapshot frame, opt-in on subscribe, outside the log'
date: '2026-10-26'
status: draft (awaiting operator ruling at checkpoint C2; not yet in backlog/decisions)
task: TASK-0051
---

## Context

M3 seats several humans at one table. Two consumers need to know who is connected:

- **TASK-0049 group sign-off.** A party-scope action commits only after every *present* player
  approves (card AC #2). Today `commitAuthority` counts every human who controls a party
  character and refuses `GROUP_SIGNOFF_REQUIRED` when there are two or more. Counting absent
  players would block the table forever.
- **The Director.** It must not wait on an absent player. Today its only wait (`hold`) names AI
  companions, so it never waits on a human. TASK-0050 (floor passing) adds a human wait — the
  active player in turn mode — and needs the present set then.

The WebSocket contract (`specs/006-ws-gateway/contracts/ws-protocol.md`, wiki `ws-protocol`)
is frozen, and omits presence by design (decision-0014: "presence is out of the First Scene;
TASK-0051 decides how to add it"). Changing a frame shape is an operator checkpoint.

Facts from the code that shape the options:

- The gateway, the gate and the DM worker run in one Node process (`apps/server/src/index.ts`).
- Fan-out is an in-memory `sessionId → Set<Connection>` registry. A connection already carries
  its authenticated `userId`; `close` already unsubscribes it.
- There is no heartbeat. A half-open TCP socket (laptop sleep, network loss) is never closed.
- The current web client's `reduceFrame` switch has no `default` branch. An unknown frame
  `type` returns `undefined` as the whole frame state, and the table breaks. A tab running an
  old bundle reconnects to a freshly deployed server within a second, so any new frame type sent
  unconditionally breaks every stale tab.
- Constitution IV: "Client state and agent context MUST both be projections of the log."

## Decision (proposed)

Presence is **connection state, not game state**. It is tracked in server memory, sent to
clients that opt in as a full snapshot frame, and never written to the event log.

### Changed frame: `subscribe` (client → server), one optional field added

```json
{ "type": "subscribe", "sessionId": "<uuid>", "afterSeq": 0, "presence": true }
```

- `presence` is optional; absent or `false` means today's behaviour exactly.
- An older server strips the unknown key (`z.object` strips), so a new client against an old
  server degrades to "no presence", never to an error.

### New frame: `presence` (server → client)

```json
{
  "type": "presence",
  "sessionId": "<uuid>",
  "present": [
    { "userId": "<uuid>", "displayName": "Ana" },
    { "userId": "<uuid>", "displayName": "Ben" }
  ]
}
```

- **A full snapshot, every time.** No join/leave deltas. A snapshot is idempotent, needs no
  ordering or sequence number, and a client recovers by replacing its set. Tables are small
  (single-digit humans), so the cost is negligible.
- **When sent:** once per opted-in subscribe, immediately after `replay-complete`; then to every
  opted-in subscriber of the table whenever the set changes.
- **Ordering:** `present` is sorted by `userId`, so equal sets serialize equally and tests compare
  frames directly.
- **No role field.** The client derives DM / player / observer from its own projection (`gate.seat`
  and `party`), which already arrives through the log. Roles stay a projection of the log; the
  frame carries only the connection fact.
- **No AI actors.** The AI DM and AI companions are always present by definition; the client and
  the server reader both treat them so. Listing them would add nothing.
- **Humans only, deduplicated.** A user with three tabs appears once.

### No other frame changes

No client→server `leave` frame: leaving is a socket close or a subscribe to another table. No
change to `event`, `replay-complete` or `error`.

### Timing (named constants)

| Constant | Value | Meaning |
|---|---|---|
| `PRESENCE_GRACE_MS` | 5 000 | A user whose last connection closes stays present this long; a reconnect inside it cancels the leave. |
| `HEARTBEAT_INTERVAL_MS` | 10 000 | The server pings every connection at this interval. A connection that has not answered the previous ping is terminated. |
| Clean-leave bound | ≤ 10 s | Close → grace (5 s) → snapshot. |
| Silent-loss bound | ≤ 30 s | Up to two intervals to detect (≤ 20 s) + grace (5 s), rounded up. |

The heartbeat uses WebSocket protocol-level ping/pong, which browsers answer automatically, so
no client code and no frame is needed for it.

### The one server-side interface

A `PresenceReader`, created once in `index.ts` beside the registry and passed to the gateway,
the gate and the DM worker:

- `presentUsers(sessionId): ReadonlySet<string>` — present human user ids.
- `isPresent(sessionId, actor): boolean` — true for any AI actor; else membership.
- `onChange(listener)` — the gateway's snapshot sender subscribes here.

Only the presence module reads the registry for this purpose. The Director's turn context
carries `presentUsers` at assemble time, and the turn record (`jobs.result`) stores that set, so
an audit can check a decision against who was present. The gate receives the reader now and
changes no behaviour; TASK-0049 decides how sign-off uses it.

### Why

- **Presence is not history.** A log records what happened in the game. "Ben's laptop slept for
  forty seconds" is not part of the game; replaying it next week means nothing.
- **Correctness under crash.** Append-only presence events cannot be retracted. A server crash
  leaves every "joined" row without a "left", and every reader must guess. In memory, a restart
  empties presence, and reconnects rebuild it exactly.
- **No write amplification.** Every reload, tab and network blip would be a gated, locked append
  (advisory lock, `expectedLastSeq` retries) competing with real play.
- **Compatibility by construction.** The opt-in means a stale tab never sees the new frame.
- **The audit need is met where audits look.** The Director's decision is recorded with the
  present set it saw, which is the only point where presence affects play.

## Alternatives considered

**B — Presence as session-model events in the log** (`presence.joined` / `presence.left`,
public, appended by the gateway through the gate's catalog).

- For: satisfies Constitution IV literally; replay-deterministic; no new frame; the existing
  `event` frame and `project()` fold carry it; the playtest auditor sees it in the log.
- Against: unretractable after a crash (needs a startup sweep that appends `left` for everyone,
  itself a guess); a heartbeat-driven leave is a log write from a timer; write traffic on every
  reload; the grace period would have to be implemented as delayed appends; clients replaying a
  long session fold thousands of meaningless rows; presence events would need a carve-out from
  "every catalogued type goes through the gate" or a new non-proposal gate path. Rejected.

**C — HTTP polling** (`GET /play/:sessionId/presence`, every N seconds).

- For: no WebSocket contract change at all; trivially compatible.
- Against: the server still has to track connections (the same in-memory state as A), so it
  saves nothing server-side; latency is the poll interval on top of detection; a second
  authenticated path and per-client polling load; still no heartbeat for silent loss. Rejected.

**D — Hybrid: live frame (A) plus a log marker only at decision points.** The Director (and,
later, the gate on sign-off) appends a public marker event naming the present set it acted on.

- For: the log alone explains why a sign-off counted two players, not three.
- Against: a new catalogued event type and a write in the DM path for information the turn
  record already holds. A's turn-record entry covers the Director. Worth revisiting in TASK-0049
  if a sign-off must be explainable from the log alone. Not recommended now; offered if the
  operator reads Constitution IV as covering this.

**E — A synthetic `event` frame with no log row.** Reuse the `event` frame for presence without
appending. Rejected outright: it breaks the invariant that every `event` frame is a stored row
with a real `seq`, which the client's `highestSeq` resume cursor depends on.

## Compatibility

- **Old client, new server:** sends no `presence` flag, receives no `presence` frame — byte-for-byte
  today's stream. A test pins this (spec SC-005).
- **New client, old server:** the flag is stripped; no presence frame arrives; the strip shows
  only what the log implies (AI DM present). No error.
- **New client, new server:** the client must add a `presence` branch to `reduceFrame` and a
  `default` branch that ignores unknown frame types, so the next additive frame needs no opt-in.
- **Contract docs:** `specs/006-ws-gateway/contracts/ws-protocol.md` gains the field and the
  frame; wiki `ws-protocol` moves "presence" out of "deliberately does not provide"; client
  `apps/web/app/ws/types.ts` (a hand-kept copy) gains both shapes.
- **Agents:** the playtest harness and any agent client opt in the same way a browser does
  (Constitution I).

## What the gate and the Director read

| Reader | Reads | When | Effect in TASK-0051 | Effect later |
|---|---|---|---|---|
| Gateway | `onChange`, `presentUsers` | each change; after replay | sends snapshots | — |
| Director | `presentUsers` via the turn context | assemble, each turn | in prompt context and turn record; no decision change | TASK-0050: skip an absent active player instead of waiting |
| Gate | `presentUsers` / `isPresent` | per commit check | dependency only; no behaviour change | TASK-0049: sign-off counts present party players only |

## Rulings requested

1. Approve option A, or choose B, C or D.
2. Rule whether Constitution IV's "client state MUST be a projection of the log" covers
   connection state. A assumes it does not; if it does, A needs an amendment, or D applies.
3. Approve the timing constants (5 s grace, 10 s heartbeat, 10 s / 30 s bounds).
