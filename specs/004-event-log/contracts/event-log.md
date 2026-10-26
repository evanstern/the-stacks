# Contract — the event log seam

**Status:** binding for TASK-0012, and consumed by TASK-0015 (WebSocket gateway) and
TASK-0014 (auth, indirectly, as the source of the actor identity).

This is the interface every later consumer codes against. Changing a shape here after
TASK-0015 starts is an operator checkpoint, not an edit — the sweep runbook's `APP_PORT`
and `validateSession` precedents exist because seams left in prose drifted.

## Why this is a contract and not an implementation detail

TASK-0015 must append events on behalf of a connected client and replay a session from a
cursor on reconnect. Both operations are this feature's surface. If the shapes are not
fixed here, 0015 codes against a guess and reconciles at merge — which is exactly the
failure the runbook's seam doctrine is written to prevent.

## Append

Records one event at the end of a session's stream and returns it with the position it
received.

**Input**

| Field | Required | Notes |
|---|---|---|
| `sessionId` | yes | The play session. |
| `actor` | yes | Who or what caused the event. |
| `type` | yes | Event kind; opaque to the log. |
| `payload` | yes | Event details; opaque to the log. |
| `payloadVersion` | yes | Schema version of `payload`. |
| `visibility` | no | Defaults to the public marker when omitted. |

`seq` and `ts` are **not** accepted from callers. The append path assigns both
(data-model.md, Validation rules). A caller that could supply `seq` could create a gap;
a caller that could supply `ts` could rewrite the server's ordering authority.

**Output**: the recorded event, including its assigned `seq` and `ts`.

**Guarantees**

- The returned `seq` is exactly one greater than the session's previous highest, or 1 for
  the session's first event.
- Concurrent appends to one session receive distinct, consecutive positions — no gaps, no
  duplicates (FR-002, FR-008).
- A failed append consumes no position (spec edge case: "append fails partway").
- Appends to different sessions never block each other (FR-003).

## Read from a cursor

Returns a session's events strictly after a cursor, in ascending position order.

**Input**

| Field | Required | Notes |
|---|---|---|
| `sessionId` | yes | The play session to read. |
| `afterSeq` | no | Cursor; the last position already seen. Defaults to the origin (0), which returns the stream from its beginning. |
| `limit` | yes | Maximum events to return (FR-007). |

**Output**: an ordered list of events, oldest first, at most `limit` long.

**Guarantees**

- **Strictly after**: an event at position exactly `afterSeq` is never returned. A client
  that stores the `seq` of the last event it processed and passes it back receives each
  event exactly once, with no special-casing at the boundary.
- **Ascending, contiguous**: positions are ascending with no gaps between the returned
  events (FR-006).
- **Empty, not an error**: a cursor at or beyond the newest position yields an empty list
  (FR-009). "Nothing new" is a normal answer, and a reconnecting client that has missed
  nothing must not see a failure.
- **No filtering**: every event after the cursor is returned regardless of `visibility`,
  `type`, or `payloadVersion` (FR-012). Per-viewer filtering is the projection's job
  (TASK-0015), and it cannot filter what the log has already hidden from it.

## What this seam deliberately does NOT provide

Named so TASK-0015 does not wait for them:

- **No subscription or push.** The log is queried, not listened to. Live fan-out is
  TASK-0015's responsibility.
- **No per-viewer visibility filtering.** The log returns `visibility` intact; deciding
  what a given viewer may see happens at projection.
- **No payload validation.** Payload contents are opaque until the system module arrives
  in M3 (research D4).
- **No update or delete.** There is no such operation, by construction (FR-004).

> Extended by `specs/029-proposal-gate/contracts/gate-api.md` section 4: `appendBatch` takes
> an optional `expectedLastSeq` (a mismatch throws `SeqConflictError`, zero rows land), and
> `readLatestOfType` returns a session's latest row of one type.
