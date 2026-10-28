# Data model: Talk CONFLICT retry (TASK-0157)

No table, column, migration, event type or payload changes. The log is still the only game
state (constitution IV).

## In-memory state (server process, not persisted)

| Name | Owner | Shape | Lifetime |
|---|---|---|---|
| Session write queue | `createGate` closure (`apps/server/src/gate/gate.ts`) | `Map<string, Promise<void>>`: session id → tail of that session's queued gate work | An entry exists only while the session has queued or running gate work. A restart drops it with no loss: a queued request that never ran wrote nothing, and its caller's socket is gone. |

## New gate dependency (test seam)

| Field | Type | Default | Purpose |
|---|---|---|---|
| `GateDeps.retryDelayMs` | `(attempt: number) => number` | `() => 10 + randomInt(0, 41)` | Milliseconds to wait after a `SeqConflictError` on `attempt` (1 or 2) before the next attempt. Never called after attempt 3. |

## Unchanged

- `GateResult`, `GateRefusal`, `RecordPresenceResult`: unchanged. `CONFLICT` keeps its message
  "the log kept changing; try again".
- `ErrorFrame`: unchanged (`kind: "internal"`, `code: "CONFLICT"`).
