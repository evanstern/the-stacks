import { PRESENCE_GRACE_MS } from "./constants.js";

/** One present human, as sent on the wire. */
export interface PresenceEntry {
  userId: string;
  displayName: string;
}

/** The one interface that answers "who is at the table" (contracts/presence-reader.md). */
export interface PresenceReader {
  /** Present humans at the table, sorted by userId. */
  presentUsers(sessionId: string): readonly PresenceEntry[];
  /** True for any AI actor ("ai:dm", "ai:companion:<id>"); else membership by userId. */
  isPresent(sessionId: string, actor: string): boolean;
  /** Called with the sessionId after each emitted change. Returns an unsubscribe function. */
  onChange(listener: (sessionId: string) => void): () => void;
}

export interface PresenceConn {
  connId: string;
  userId: string;
  displayName: string;
}

export interface PresenceTracker {
  reader: PresenceReader;
  join(sessionId: string, conn: PresenceConn): void;
  leave(sessionId: string, connId: string): void;
  /** Clears every grace timer (server shutdown, tests). */
  close(): void;
}

export interface PresenceOptions {
  graceMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

interface UserState {
  displayName: string;
  connIds: Set<string>;
  leaveTimer: unknown | null;
}

/**
 * In-memory presence (data-model.md, "Tracker state"). A user is present from
 * their first connection until the grace timer fires after their last one
 * closes. A process restart empties the state; nothing is persisted.
 */
export function createPresence(options: PresenceOptions = {}): PresenceTracker {
  const graceMs = options.graceMs ?? PRESENCE_GRACE_MS;
  const setTimer =
    options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) => clearTimeout(handle as NodeJS.Timeout));

  const tables = new Map<string, Map<string, UserState>>();
  const listeners = new Set<(sessionId: string) => void>();

  function emit(sessionId: string): void {
    for (const listener of [...listeners]) {
      try {
        listener(sessionId);
      } catch (err) {
        console.error("presence: change listener threw", err);
      }
    }
  }

  function join(sessionId: string, conn: PresenceConn): void {
    let table = tables.get(sessionId);
    if (!table) {
      table = new Map();
      tables.set(sessionId, table);
    }
    const user = table.get(conn.userId);
    if (!user) {
      table.set(conn.userId, {
        displayName: conn.displayName,
        connIds: new Set([conn.connId]),
        leaveTimer: null,
      });
      emit(sessionId);
      return;
    }
    user.connIds.add(conn.connId);
    if (user.leaveTimer !== null) {
      clearTimer(user.leaveTimer);
      user.leaveTimer = null;
    }
  }

  function leave(sessionId: string, connId: string): void {
    const table = tables.get(sessionId);
    if (!table) return;
    for (const [userId, user] of table) {
      if (!user.connIds.delete(connId)) continue;
      if (user.connIds.size === 0 && user.leaveTimer === null) {
        user.leaveTimer = setTimer(() => {
          const current = tables.get(sessionId);
          const state = current?.get(userId);
          if (!current || state !== user) return;
          current.delete(userId);
          if (current.size === 0) tables.delete(sessionId);
          emit(sessionId);
        }, graceMs);
      }
      return;
    }
  }

  function close(): void {
    for (const table of tables.values()) {
      for (const user of table.values()) {
        if (user.leaveTimer !== null) {
          clearTimer(user.leaveTimer);
          user.leaveTimer = null;
        }
      }
    }
  }

  const reader: PresenceReader = {
    presentUsers(sessionId) {
      const table = tables.get(sessionId);
      if (!table) return [];
      return [...table.entries()]
        .map(([userId, user]) => ({ userId, displayName: user.displayName }))
        .sort((a, b) =>
          a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0,
        );
    },
    isPresent(sessionId, actor) {
      if (actor.startsWith("ai:")) return true;
      return tables.get(sessionId)?.has(actor) ?? false;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return { reader, join, leave, close };
}
