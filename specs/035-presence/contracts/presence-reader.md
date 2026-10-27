# Contract: the presence tracker and PresenceReader

Module: `apps/server/src/presence/`. Created once in `apps/server/src/index.ts`.

```ts
interface PresenceEntry { userId: string; displayName: string }

interface PresenceReader {
  /** Present humans at the table, sorted by userId. */
  presentUsers(sessionId: string): readonly PresenceEntry[];
  /** True for any AI actor ("ai:dm", "ai:companion:<id>"); else membership by userId. */
  isPresent(sessionId: string, actor: string): boolean;
  /** Called with the sessionId after each emitted change. Returns an unsubscribe function. */
  onChange(listener: (sessionId: string) => void): () => void;
}

interface PresenceTracker {
  reader: PresenceReader;
  join(sessionId: string, conn: { connId: string; userId: string; displayName: string }): void;
  leave(sessionId: string, connId: string): void;
  /** Clears every grace timer (server shutdown, tests). */
  close(): void;
}

function createPresence(options?: {
  graceMs?: number;                       // default PRESENCE_GRACE_MS
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): PresenceTracker;
```

## Callers

| Caller | Uses | When |
|---|---|---|
| Gateway | `join`, `leave`, `onChange`, `presentUsers` | subscribe, re-subscribe, close; snapshot send |
| Gate | `presentUsers` | `recordPresence` |
| Director | none directly | reads the folded marker (`presence-marker.md`) |

No other module reads the subscriber registry to answer "who is present".

## Constants (`apps/server/src/presence/constants.ts`)

| Constant | Value |
|---|---|
| `PRESENCE_GRACE_MS` | 5000 |
| `HEARTBEAT_INTERVAL_MS` | 10000 |
| `CLEAN_LEAVE_BOUND_MS` | 10000 |
| `SILENT_LOSS_BOUND_MS` | 30000 |

The gateway accepts `heartbeatIntervalMs` and the tracker accepts `graceMs` so tests run fast.
