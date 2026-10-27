import type { StoredEvent } from "@the-stacks/session-model";
import type { PresenceEntry, ServerFrame } from "../ws/types.ts";

export interface FrameState {
  events: readonly StoredEvent[];
  highestSeq: number;
  caughtUp: boolean;
  notice: string | null;
  /** Who is at the table; null until the first presence frame (or on an older server). */
  present: readonly PresenceEntry[] | null;
}

export const initialFrameState: FrameState = {
  events: [],
  highestSeq: 0,
  caughtUp: false,
  notice: null,
  present: null,
};

/**
 * One inbound frame into the live table state. Replayed and live events take the same path;
 * the highest seq is a max across gaps (visibility filtering makes gaps correct), never a
 * guess at the next one.
 */
export function reduceFrame(state: FrameState, frame: ServerFrame): FrameState {
  switch (frame.type) {
    case "event":
      return {
        ...state,
        events: [...state.events, frame.event],
        highestSeq: Math.max(state.highestSeq, frame.event.seq),
      };
    case "replay-complete":
      return { ...state, caughtUp: true };
    case "error":
      return {
        ...state,
        notice: frame.code ? `${frame.message} (${frame.code})` : frame.message,
      };
    case "presence":
      return { ...state, present: frame.present };
    default:
      // An unknown frame type changes nothing, so the next additive frame needs no opt-in.
      return state;
  }
}
