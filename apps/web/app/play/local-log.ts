import type { StoredEvent } from "@the-stacks/session-model";

export interface LocalEventInput {
  eventType: string;
  payload: unknown;
  payloadVersion: number;
}

const EMPTY_LOG_TS = "2026-01-01T00:00:00.000Z";

/**
 * A new array with one appended event: seq = last + 1, ts = last + 1 s (no clock read),
 * visibility public. Never mutates `events`.
 */
export function appendLocal(
  events: readonly StoredEvent[],
  input: LocalEventInput,
  actor: string,
): StoredEvent[] {
  const last = events.at(-1);
  const ts = new Date(
    Date.parse(last?.ts ?? EMPTY_LOG_TS) + (last ? 1000 : 0),
  ).toISOString();
  return [
    ...events,
    {
      sessionId: last?.sessionId ?? "00000000-0000-4000-8000-000000000000",
      seq: (last?.seq ?? 0) + 1,
      actor,
      type: input.eventType,
      payload: input.payload,
      payloadVersion: input.payloadVersion,
      visibility: "public",
      ts,
    },
  ];
}
