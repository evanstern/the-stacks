import type { WebSocket } from "ws";
import type { Role } from "../auth/session.js";
import type { RecordedEventFrame } from "./protocol.js";

/**
 * One open, authenticated WebSocket (data-model.md, "Connection"). Built
 * once at upgrade time (research D4) and never rebuilt for the
 * connection's life — `userId`/`role` are the identity established then,
 * not re-derived per message.
 *
 * No password, token, or session-token hash is held here — the connection
 * knows *who* it is, not *how* it proved it (data-model.md).
 */
export interface Connection {
  socket: WebSocket;
  userId: string;
  role: Role;
  /** The play session subscribed to, or null until a `subscribe` frame arrives. */
  sessionId: string | null;
  /**
   * Live events buffered while a replay is in flight (research D1). `null`
   * means "not replaying" — deliver directly. Non-null (even `[]`) means
   * "queue instead of sending"; subscribe.ts sets this the moment a
   * connection joins a session and clears it once the queue is drained.
   *
   * data-model.md also names `deliveredThroughSeq` on this entity. That
   * running watermark is still omitted — see `replayedThroughSeq` below
   * for why it would be wrong — but TASK-0095 added a narrower field.
   */
  pendingQueue: RecordedEventFrame["event"][] | null;
  /**
   * The highest seq this connection's most recent subscribe replay covered
   * (starts at that subscribe's `afterSeq`; 0 before any subscribe).
   * `broadcast` skips any event at or below it (TASK-0095).
   *
   * The race it closes: gateway.ts appends, THEN broadcasts. A subscriber
   * mid-replay can read the just-committed event via `readFrom`, send it,
   * and clear `pendingQueue` before that broadcast runs — which would then
   * send it a second time. The queue-drain skip only covers queued events.
   *
   * This is a replay floor, deliberately NOT a running delivered-through
   * watermark updated on every send: broadcasts from concurrent senders are
   * not guaranteed to run in seq order, so a running watermark could drop a
   * lower seq whose broadcast runs late. Every seq at or below the replay's
   * throughSeq was in the replay read (the event log's advisory lock commits
   * seqs in order), so skipping exactly those is lossless.
   */
  replayedThroughSeq: number;
}

/**
 * Visibility is minimal in M0 (spec.md assumptions): the public marker
 * reaches everyone; any other value reaches only the connection whose
 * `userId` it names — whisper-style per-person visibility (spec 005
 * contract, validate-session.md). Exported so subscribe.ts's replay path
 * makes the exact same decision as the live path below (research D2) —
 * one function, not two implementations that could drift.
 */
export function isVisible(
  conn: Connection,
  event: { visibility: string },
): boolean {
  return event.visibility === "public" || event.visibility === conn.userId;
}

/**
 * The whole of fan-out (data-model.md, "SubscriberRegistry"): a map from
 * `sessionId` to the set of connections subscribed to it. A connection
 * subscribes to at most one session at a time in M0 — a second `subscribe`
 * replaces the first.
 */
export function createRegistry() {
  const bySession = new Map<string, Set<Connection>>();

  function subscribe(conn: Connection, sessionId: string): void {
    if (conn.sessionId !== null) {
      unsubscribe(conn);
    }
    conn.sessionId = sessionId;
    let set = bySession.get(sessionId);
    if (!set) {
      set = new Set();
      bySession.set(sessionId, set);
    }
    set.add(conn);
  }

  /** Removes `conn` from its session's set, deleting an emptied set (data-model.md — no per-session-ever-visited leak). */
  function unsubscribe(conn: Connection): void {
    if (conn.sessionId === null) return;
    const set = bySession.get(conn.sessionId);
    if (set) {
      set.delete(conn);
      if (set.size === 0) {
        bySession.delete(conn.sessionId);
      }
    }
    conn.sessionId = null;
  }

  /**
   * Sends `frame` to every subscriber of `sessionId`, independently
   * (research D5, T015). Deliberately NOT `Promise.all` / a single
   * try/catch around the loop: one dead or closing socket must never stop
   * — or roll back — delivery to every other subscriber of an event the
   * log has already committed. A closed socket is pruned from the
   * registry as it's found, same as an explicit disconnect.
   *
   * `isVisible` is the single per-recipient filtering decision (research
   * D2) — applied here for every live event, and by subscribe.ts's replay
   * loop for every replayed one, so a filtered recipient never receives
   * the event through either path. A connection mid-replay (`pendingQueue`
   * non-null) gets the event queued instead of sent (research D1) — only
   * events that pass this same filter ever enter the queue, so draining it
   * later needs no second filtering decision.
   */
  function broadcast(sessionId: string, frame: RecordedEventFrame): void {
    const set = bySession.get(sessionId);
    if (!set) return;
    const message = JSON.stringify(frame);
    for (const conn of set) {
      if (conn.socket.readyState !== conn.socket.OPEN) {
        set.delete(conn);
        continue;
      }
      if (!isVisible(conn, frame.event)) continue;
      // Already delivered by this connection's replay (TASK-0095) — see
      // `Connection.replayedThroughSeq`. Shared by the queue and send paths.
      if (frame.event.seq <= conn.replayedThroughSeq) continue;
      if (conn.pendingQueue) {
        conn.pendingQueue.push(frame.event);
        continue;
      }
      try {
        conn.socket.send(message);
      } catch (err) {
        console.error("ws: send failed, dropping subscriber", err);
        set.delete(conn);
      }
    }
    if (set.size === 0) {
      bySession.delete(sessionId);
    }
  }

  function subscriberCount(sessionId: string): number {
    return bySession.get(sessionId)?.size ?? 0;
  }

  return { subscribe, unsubscribe, broadcast, subscriberCount };
}

export type Registry = ReturnType<typeof createRegistry>;
