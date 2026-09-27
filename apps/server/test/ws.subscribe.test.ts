import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { RecordedEventFrame } from "../src/ws/protocol.js";
import { toEventPayload } from "../src/ws/protocol.js";
import type { Connection, Registry } from "../src/ws/registry.js";
import { subscribe } from "../src/ws/subscribe.js";

/**
 * A DETERMINISTIC guard for the replay/live boundary (research D1).
 *
 * T022 drives this through real sockets, which is the honest end-to-end
 * check — but it is probabilistic. The Phase 4-7 implementer measured it
 * catching a reintroduced replay-then-subscribe bug only about 1 run in 7,
 * and diagnosed why: the vulnerable window in that broken ordering is a
 * SYNCHRONOUS, no-`await` gap between the replay loop exiting and the
 * registry join. Nothing else in a single-threaded Node process can
 * interleave inside it, so no amount of concurrent write pressure reliably
 * lands a commit in that slot.
 *
 * That diagnosis is exactly what makes a deterministic test possible. The
 * window is unreachable by racing, but it is trivially reachable by
 * controlling the clock: this file calls `subscribe()` directly against a
 * fake log and a fake registry, and appends an event DURING the replay's
 * own await. No timing, no flake, no test-only seam in production code —
 * the fakes are the seam.
 *
 * Both tests are kept. This one fails every time on a broken ordering;
 * T022 proves the whole stack agrees.
 */

type WireEvent = RecordedEventFrame["event"];

/** A stored row as `readFrom` returns it — `ts` is a Date, not a string. */
function row(seq: number, sessionId: string) {
  return {
    sessionId,
    seq,
    actor: "test-actor",
    type: "chat",
    payload: { i: seq },
    payloadVersion: 1,
    visibility: "public",
    ts: new Date(),
  };
}

/** Captures what a connection was actually sent, in order. */
function fakeConnection(): Connection & {
  sent: WireEvent[];
  frames: string[];
} {
  const sent: WireEvent[] = [];
  const frames: string[] = [];
  const socket = {
    readyState: 1,
    OPEN: 1,
    send(raw: string) {
      const frame = JSON.parse(raw);
      frames.push(frame.type);
      if (frame.type === "event") sent.push(frame.event);
    },
  };
  return {
    socket,
    userId: "user-1",
    role: "player",
    sessionId: null,
    pendingQueue: null,
    sent,
    frames,
  } as unknown as Connection & { sent: WireEvent[]; frames: string[] };
}

describe("replay/live boundary (research D1, deterministic)", () => {
  it("delivers an event appended DURING replay exactly once, in order", async () => {
    const sessionId = randomUUID();
    const conn = fakeConnection();

    // The log holds 1..3 when the subscribe begins.
    const log = [1, 2, 3].map((s) => row(s, sessionId));

    // The fake registry is what a correct implementation joins BEFORE
    // replaying. Broadcasting while `pendingQueue` is non-null must queue
    // rather than send — that is the behavior under test.
    const registry = {
      subscribe(c: Connection, sid: string) {
        c.sessionId = sid;
      },
      broadcast(_sid: string, frame: RecordedEventFrame) {
        if (conn.pendingQueue) conn.pendingQueue.push(frame.event);
        else conn.socket.send(JSON.stringify(frame));
      },
    } as unknown as Registry;

    // The fake log appends seq 4 during the FIRST read's await — precisely
    // the window a replay-then-subscribe ordering loses. A correct
    // implementation has already joined the registry, so the broadcast is
    // queued and drained afterwards.
    let firstRead = true;
    const db = {} as never;
    const readFromFake = async (
      _db: unknown,
      opts: { afterSeq?: number; limit: number },
    ) => {
      const after = opts.afterSeq ?? 0;
      if (firstRead) {
        firstRead = false;
        const appended = row(4, sessionId);
        log.push(appended);
        registry.broadcast(sessionId, {
          type: "event",
          event: toEventPayload(appended),
        });
      }
      return log.filter((e) => e.seq > after).slice(0, opts.limit);
    };

    await subscribe(db, registry, conn, sessionId, 0, {
      readFrom: readFromFake,
    });

    const seqs = conn.sent.map((e) => e.seq);

    // No gap: 1,2,3,4 — the event appended mid-replay is present.
    expect(seqs).toEqual([1, 2, 3, 4]);
    // No duplicate: 4 arrived once, not once from replay and once from the queue.
    expect(new Set(seqs).size).toBe(seqs.length);
    // Ascending.
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    // The queue was released rather than left holding events forever.
    expect(conn.pendingQueue).toBeNull();
  });

  it("skips a queued event the replay already covered (no duplicate at the boundary)", async () => {
    const sessionId = randomUUID();
    const conn = fakeConnection();
    const log = [1, 2].map((s) => row(s, sessionId));

    const registry = {
      subscribe(c: Connection, sid: string) {
        c.sessionId = sid;
      },
      broadcast(_sid: string, frame: RecordedEventFrame) {
        if (conn.pendingQueue) conn.pendingQueue.push(frame.event);
        else conn.socket.send(JSON.stringify(frame));
      },
    } as unknown as Registry;

    // Seq 2 is broadcast while the replay is in flight AND is already in
    // the log, so it arrives by both paths. The position skip is what makes
    // the overlap harmless instead of a duplicate (research D1).
    let firstRead = true;
    const readFromFake = async (
      _db: unknown,
      opts: { afterSeq?: number; limit: number },
    ) => {
      const after = opts.afterSeq ?? 0;
      if (firstRead) {
        firstRead = false;
        const already = log[1];
        if (already) {
          registry.broadcast(sessionId, {
            type: "event",
            event: toEventPayload(already),
          });
        }
      }
      return log.filter((e) => e.seq > after).slice(0, opts.limit);
    };

    await subscribe({} as never, registry, conn, sessionId, 0, {
      readFrom: readFromFake,
    });

    expect(conn.sent.map((e) => e.seq)).toEqual([1, 2]);
  });
});
