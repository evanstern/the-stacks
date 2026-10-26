import type { StoredEvent } from "@the-stacks/session-model";
import type { ServerFrame } from "../ws/types.ts";

export interface FrameState {
  events: readonly StoredEvent[];
  highestSeq: number;
  caughtUp: boolean;
  notice: string | null;
}

export const initialFrameState: FrameState = {
  events: [],
  highestSeq: 0,
  caughtUp: false,
  notice: null,
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
  }
}
