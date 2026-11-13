/** The client's view of contracts/ws-protocol.md — binding, do not change a shape here. */

export interface RecordedEvent {
  sessionId: string;
  seq: number;
  actor: string;
  type: string;
  payload: unknown;
  payloadVersion: number;
  visibility: string;
  ts: string;
}

/** One human at the table (specs/035-presence/contracts/ws-presence.md). */
export interface PresenceEntry {
  userId: string;
  displayName: string;
}

/** The subscribe frame a client sends; `presence` opts in to presence frames. */
export interface SubscribeFrame {
  type: "subscribe";
  sessionId: string;
  afterSeq: number;
  presence?: boolean;
}

export type ServerFrame =
  | { type: "event"; event: RecordedEvent }
  | { type: "replay-complete"; throughSeq: number }
  | { type: "presence"; sessionId: string; present: PresenceEntry[] }
  | {
      /** Ephemeral in-flight narration part (spec 108); never in the log. */
      type: "narration-stream";
      sessionId: string;
      jobId: string;
      slot: "rows" | "restate" | "describe" | "ask" | "end";
      text: string;
    }
  | {
      type: "error";
      kind: "validation" | "forbidden" | "internal";
      message: string;
      /** The gate's refusal code (specs/029-proposal-gate/contracts/ws-delivery.md). */
      code?: string;
    };
