---
id: decision-0024
title: >-
  D16 Presence: an opt-in presence frame plus a logged presence marker at
  decision points
date: '2026-10-27 03:39'
status: accepted
---
## Context

M3 seats several humans at one table (TASK-0051, spec `specs/035-presence/`). Two consumers
need to know who is connected. TASK-0049 group sign-off commits a party action only after every
present player approves; counting absent players would block the table. The Director must not
wait on an absent player; TASK-0050 (floor passing) adds its first wait on a human.

The WebSocket protocol omits presence by design (decision-0014). Its frame shapes are a frozen
contract (`specs/006-ws-gateway/contracts/ws-protocol.md`, wiki `ws-protocol`). Changing them is
an operator checkpoint (runbook checkpoint C2).

Facts from the code shaped the options:

- The gateway, the gate and the DM worker run in one Node process (`apps/server/src/index.ts`).
- Fan-out is an in-memory registry. A connection already carries its authenticated `userId`.
- There is no heartbeat. A half-open socket (laptop sleep, network loss) is never closed.
- The web client's `reduceFrame` has no `default` branch. An unknown frame type breaks the
  table, and a stale tab reconnects to a new server within a second.
- Constitution IV: "Client state and agent context MUST both be projections of the log."
- The write boundary lets only `apps/server/src/gate/` append catalogued events.

The operator ruled on 2026-10-26 at checkpoint C2, recorded on the TASK-0051 card:

- Carriage: "D: frame + log marker". The reason given is Constitution IV.
- Observers: "Show as observer".
- Timings: "Timings stand".
- Multi-process: "Card the revisit". An absent human DM gets no new behaviour beyond the strip.

## Decision

1. **Live presence is connection state, carried by a new frame.** The server tracks it in
   memory. It reaches only clients that opt in. It is never replayed.
2. **The `subscribe` frame gains one optional field.**
   `{ "type": "subscribe", "sessionId", "afterSeq", "presence": true }`. Absent or `false`
   means today's stream exactly. An older server strips the key, so a new client degrades to
   no presence.
3. **A new server-to-client `presence` frame carries a full snapshot.**
   `{ "type": "presence", "sessionId", "present": [{ "userId", "displayName" }] }`. It is sent
   once after `replay-complete`, then on every change. `present` is sorted by `userId`, holds
   humans only, and names each user once. It carries no role: the client derives DM, player
   or observer from its own projection of the log. No join or leave deltas exist.
4. **Presence that feeds a decision is written to the log.** A new catalogued marker event,
   `presence.recorded` v1, records the present set at the moment a decision reads it. Its
   purposes are `director`, `signoff` and `floor`. The gate is its only writer, as for every
   catalogued type. The Director reads the present set from the projection of that marker, so
   its context is a projection of the log.
5. **One marker per decision read.** Each decision that reads presence appends its own marker.
   The marker is not deduplicated against the previous one: the ruling asks for a record
   whenever presence feeds a decision.
6. **Observers are shown.** A connected user who holds no DM seat and controls no party
   character appears in the strip as an observer.
7. **Timings stand.** A 5-second reconnect grace, a 10-second protocol-level heartbeat, a clean
   leave visible within 10 seconds, and a silent loss visible within 30 seconds.
8. **One server process.** The presence tracker is in memory. TASK-0136 revisits a shared store
   when a second server process is planned.
9. **An absent human DM changes nothing but the strip.** The strip shows the seat holder as
   absent. No AI cover and no pause follow.

### The marker event

| Field | Value |
|---|---|
| type, version | `presence.recorded`, 1 (`current: true`) |
| kind | `marker` |
| catalog visibility | `any`; the row is stored `public` |
| actor | `system` (a reserved actor in `ids.ts`) |
| payload | `{ present: uuid[] (sorted, unique, at most 64), purpose: "director" \| "signoff" \| "floor", actionId?: RefId }` |

The gate appends it through `gate.recordPresence(sessionId, { purpose, actionId? })`. The DM
worker calls that before each `turn` job's pipeline runs, with purpose `director`. TASK-0049
and TASK-0050 append it with `signoff` and `floor`, in the same batch as the commit it fed.

## Alternatives considered

- **A: frame only, presence outside the log.** Recommended by the draft. Rejected by the
  operator: the Director's prompt context would hold a fact that is not a projection of the log.
- **B: `presence.joined` / `presence.left` events for every connection change.** Satisfies
  Constitution IV literally and needs no new frame. Rejected: append-only rows cannot be
  retracted after a crash, a heartbeat timeout becomes a log write from a timer, every reload
  becomes a locked append, and replays fold thousands of rows that mean nothing to the game.
- **C: HTTP polling of a presence route.** No WebSocket change. Rejected: the server still
  tracks connections, latency adds a poll interval, and silent loss still needs a heartbeat.
- **D: the frame of A plus a log marker at decision points.** Chosen.
- **E: a synthetic `event` frame with no log row.** Rejected outright: every `event` frame must
  be a stored row with a real `seq`, which the client's resume cursor depends on.
- **Deduplicated markers (append only when the set changed).** Smaller log. Rejected: a decision
  with an unchanged set would leave no row naming it, against the ruling.

## Consequences

- **This amends the frozen ws-protocol contract.** `specs/006-ws-gateway/contracts/ws-protocol.md`
  gains the `subscribe.presence` field and the `presence` frame. Wiki `ws-protocol` moves
  presence out of "deliberately does not provide". `apps/web/app/ws/types.ts` gains both shapes.
- The session-model catalog gains `presence.recorded` v1 and a `presence` projection view.
- The gate gains `recordPresence`. Its `submit` and `handle` behaviour does not change.
- The gateway gains a heartbeat and a presence tracker. The server exposes one `PresenceReader`
  to the gateway and the gate.
- The web client's `reduceFrame` gains a `presence` branch and a `default` branch that ignores
  unknown frame types, so the next additive frame needs no opt-in.
- Every DM turn appends one public marker row. Clients fold it into the `presence` view and do
  not show it in the transcript.
- TASK-0049 and TASK-0050 read presence through the gate's `PresenceReader` and append the
  marker with `signoff` or `floor`.
- TASK-0136 carries the multi-process revisit (trigger: a second server process is planned).
