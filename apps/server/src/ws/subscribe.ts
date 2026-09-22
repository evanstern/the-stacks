import type { DbClient } from "../auth/session.js";
import { readFrom } from "../events/log.js";
import type { RecordedEventFrame, ReplayCompleteFrame } from "./protocol.js";
import { toEventPayload } from "./protocol.js";
import type { Connection, Registry } from "./registry.js";
import { isVisible } from "./registry.js";

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
 * 4. Drain the queue, skipping anything at or before the last replayed
 *    position — the position-based skip that makes the unavoidable
 *    overlap harmless instead of duplicated — then switch to direct
 *    delivery by clearing the queue.
 */
export async function subscribe(
  db: DbClient,
  registry: Registry,
  conn: Connection,
  sessionId: string,
  afterSeq: number,
): Promise<void> {
  conn.pendingQueue = [];
  registry.subscribe(conn, sessionId);

  let throughSeq = afterSeq;
  for (;;) {
    const batch = await readFrom(db, {
      sessionId,
      afterSeq: throughSeq,
      limit: REPLAY_BATCH_SIZE,
    });
    for (const event of batch) {
      if (isVisible(conn, event)) {
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
  const queued = conn.pendingQueue;
  conn.pendingQueue = null;
  for (const event of queued ?? []) {
    if (event.seq <= throughSeq) continue;
    sendFrame(conn, { type: "event", event });
  }
}
