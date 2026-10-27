import { z } from "zod";
import type { RecordedEvent } from "../events/log.js";
import type { PresenceEntry } from "../presence/index.js";

/**
 * The WebSocket frame schemas (contracts/ws-protocol.md, binding for
 * TASK-0016 — do not change a frame shape without an operator checkpoint).
 * Amended once by decision-0024 (TASK-0051): the optional `subscribe.presence`
 * field and the `presence` frame, plus the protocol-level heartbeat. See
 * specs/035-presence/contracts/ws-presence.md.
 */

/** Client -> server: join a session and (later, US3) begin replay. */
export const SubscribeFrame = z.object({
  type: z.literal("subscribe"),
  sessionId: z.string().uuid(),
  afterSeq: z.number().int().min(0).optional(),
  /** Opt in to `presence` frames (decision-0024). Absent or false: today's stream exactly. */
  presence: z.boolean().optional(),
});

/**
 * Client -> server: a request to record an event, not the event itself
 * (contracts/ws-protocol.md). `actor`, `seq`, and `ts` are NOT declared
 * here on purpose: a plain `z.object` strips any unrecognized key rather
 * than erroring on it, so a client that echoes them back parses fine and
 * the fields simply never reach `SendFrame["data"]` for gateway.ts to read
 * (data-model.md — a client sending them is confused, not hostile; FR-005,
 * FR-006 make the server's own values authoritative regardless).
 */
export const SendFrame = z.object({
  type: z.literal("send"),
  sessionId: z.string().uuid(),
  eventType: z.string().min(1),
  payload: z.unknown(),
  payloadVersion: z.number().int().positive(),
  visibility: z.string().min(1).optional(),
});

export const InboundFrame = z.discriminatedUnion("type", [
  SubscribeFrame,
  SendFrame,
]);

export type SubscribeFrame = z.infer<typeof SubscribeFrame>;
export type SendFrame = z.infer<typeof SendFrame>;
export type InboundFrame = z.infer<typeof InboundFrame>;

/** Server -> client: one recorded event, replayed or live (same shape for both — D1). */
export interface RecordedEventFrame {
  type: "event";
  event: {
    sessionId: string;
    seq: number;
    actor: string;
    type: string;
    payload: unknown;
    payloadVersion: number;
    visibility: string;
    ts: string;
  };
}

/** Server -> client: sent once, after the last replayed event and before live delivery. */
export interface ReplayCompleteFrame {
  type: "replay-complete";
  throughSeq: number;
}

export type ErrorKind = "validation" | "forbidden" | "internal";

/** Server -> client: a refused request. The connection stays open. */
export interface ErrorFrame {
  type: "error";
  kind: ErrorKind;
  message: string;
  /** The refusal code, when the refusal has one (spec 029 ws-delivery.md). */
  code?: string;
}

/**
 * Server -> client: the full set of humans present at the table (decision-0024).
 * Sent only to a connection whose latest subscribe had `presence: true`.
 */
export interface PresenceFrame {
  type: "presence";
  sessionId: string;
  present: readonly PresenceEntry[];
}

export type OutboundFrame =
  | RecordedEventFrame
  | ReplayCompleteFrame
  | PresenceFrame
  | ErrorFrame;

/**
 * Converts a stored event (events/log.ts) into the wire shape — used by
 * both the live-send path (gateway.ts) and the replay path (subscribe.ts)
 * so the two never drift into two different mappings of the same row
 * (contracts/ws-protocol.md: deliberately the same frame shape for both).
 */
export function toEventPayload(
  event: RecordedEvent,
): RecordedEventFrame["event"] {
  return {
    sessionId: event.sessionId,
    seq: event.seq,
    actor: event.actor,
    type: event.type,
    payload: event.payload,
    payloadVersion: event.payloadVersion,
    visibility: event.visibility,
    ts: event.ts.toISOString(),
  };
}

export type ParsedInboundFrame =
  | { ok: true; frame: InboundFrame }
  | { ok: false; message: string };

/**
 * Parses one raw WebSocket text message. Anything that isn't valid JSON,
 * or whose `type` isn't a known frame, is refused — nothing is appended
 * (contracts/ws-protocol.md, FR-003).
 */
export function parseInboundFrame(raw: string): ParsedInboundFrame {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Message must be valid JSON." };
  }
  const parsed = InboundFrame.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Message does not match a known frame shape.",
    };
  }
  return { ok: true, frame: parsed.data };
}
