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

export type ServerFrame =
  | { type: "event"; event: RecordedEvent }
  | { type: "replay-complete"; throughSeq: number }
  | {
      type: "error";
      kind: "validation" | "forbidden" | "internal";
      message: string;
    };
