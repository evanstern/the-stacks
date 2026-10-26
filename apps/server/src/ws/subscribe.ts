import { canSee, type DmSeat } from "@the-stacks/session-model";
import type { DbClient } from "../auth/session.js";
import { readFrom } from "../events/log.js";
import { loadDmSeat } from "../session/events.js";
import type { RecordedEventFrame, ReplayCompleteFrame } from "./protocol.js";
import { toEventPayload } from "./protocol.js";
import type { Connection, Registry } from "./registry.js";
import { viewerFor } from "./registry.js";

/**
 * Bounded per FR-010 — a reconnecting client with a long history must not
 * be able to exhaust the server with one unbounded read (T026).
 */
const REPLAY_BATCH_SIZE = 200;

function sendFrame(
  conn: Connection,
  frame: RecordedEventFrame | ReplayCompleteFrame,
): void {
  if (conn.socket.readyState !== conn.socket.OPEN) return;
  conn.socket.send(JSON.stringify(frame));
}

/**
 * Implements the replay/live boundary for a `subscribe` frame (research
 * D1). Both obvious orderings are wrong — see research.md D1 for the full
 * argument — so this does neither:
 *
 * 1. Join the registry NOW, with outbound delivery queued rather than sent
 *    (`conn.pendingQueue`). This closes the window: from this line on,
 *    nothing appended to the session can be lost — it lands in the replay
 *    read below, in this queue, or (harmlessly) both.
 * 2. Replay from the cursor via `readFrom` in bounded batches. Stopping
 *    once a batch comes back short of the limit is enough to terminate
 *    correctly even in a busy session — this loop never has to "catch"
 *    the live edge exactly, because anything it doesn't reach is already
 *    safe in the queue from step 1.
 * 3. Send `replay-complete` once, before live delivery.
 * 4. Record the replay floor (`conn.replayedThroughSeq`), then drain the
 *    queue, skipping anything at or before it — the position-based skip
 *    that makes the unavoidable overlap harmless instead of duplicated —
 *    then switch to direct delivery by clearing the queue. The floor is set
 *    BEFORE the queue is cleared and outlives it: `broadcast` applies the
 *    same skip on the direct path, closing the case where an event read by
 *    the replay is broadcast only after the queue is gone (TASK-0095).
 */
/**
 * Seam for testing the replay/live boundary deterministically.
 *
 * The window this algorithm closes is a SYNCHRONOUS gap in the broken
 * ordering, so no amount of concurrent write pressure reliably lands an
 * append inside it — the end-to-end test (T022) was measured catching a
 * reintroduced bug only about 1 run in 7. Injecting the log read lets a
 * test append at exactly the right moment instead of racing for it, which
 * is what makes ws.subscribe.test.ts deterministic.
 *
 * A default parameter, not test-only scaffolding: production callers omit
 * it and get the real `readFrom`.
 */
export interface SubscribeDeps {
  readFrom: typeof readFrom;
  /** Loads the session's DM seat when the registry has none cached. */
  loadDmSeat?: (db: DbClient, sessionId: string) => Promise<DmSeat>;
}

export async function subscribe(
  db: DbClient,
  registry: Registry,
  conn: Connection,
  sessionId: string,
  afterSeq: number,
  deps: SubscribeDeps = { readFrom },
): Promise<void> {
  conn.pendingQueue = [];
  conn.replayedThroughSeq = afterSeq;
  registry.subscribe(conn, sessionId);

  // The seat decides what this connection may see (ws-delivery.md). Load it
  // once per session; a seat set by a concurrent broadcast wins over the load.
  let seat = registry.seatOf(sessionId);
  if (!seat) {
    const loaded = await (deps.loadDmSeat ?? loadDmSeat)(db, sessionId);
    seat = registry.seatOf(sessionId);
    if (!seat) {
      registry.setSeat(sessionId, loaded);
      seat = loaded;
    }
  }
  const viewer = viewerFor(conn, seat);

  let throughSeq = afterSeq;
  for (;;) {
    const batch = await deps.readFrom(db, {
      sessionId,
      afterSeq: throughSeq,
      limit: REPLAY_BATCH_SIZE,
    });
    for (const event of batch) {
      if (canSee(viewer, event.visibility)) {
        sendFrame(conn, { type: "event", event: toEventPayload(event) });
      }
    }
    if (batch.length > 0) {
      throughSeq = batch[batch.length - 1].seq;
    }
    if (batch.length < REPLAY_BATCH_SIZE) break;
  }

  sendFrame(conn, { type: "replay-complete", throughSeq });

  // Visibility was already decided once, at broadcast time (registry.ts,
  // research D2) — only events this connection is entitled to see were
  // ever queued, so draining needs only the position-based skip, no
  // second filtering pass.
  conn.replayedThroughSeq = throughSeq;
  const queued = conn.pendingQueue;
  conn.pendingQueue = null;
  for (const event of queued ?? []) {
    if (event.seq <= conn.replayedThroughSeq) continue;
    sendFrame(conn, { type: "event", event });
  }
}
