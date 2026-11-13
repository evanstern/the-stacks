import type { StoredEvent } from "@the-stacks/session-model";
import type { PresenceEntry, ServerFrame } from "../ws/types.ts";
import { refusalLabel } from "./labels.ts";

/** The in-flight narration (spec 108): parts so far, per slot. Describe parts are deltas. */
export interface NarrationStream {
  jobId: string;
  rows: string;
  restate: string;
  describe: string;
  ask: string;
}

export interface FrameState {
  events: readonly StoredEvent[];
  highestSeq: number;
  caughtUp: boolean;
  notice: string | null;
  /** Who is at the table; null until the first presence frame (or on an older server). */
  present: readonly PresenceEntry[] | null;
  /** The in-flight narration; null when none. Cleared by `end` and by the settled row. */
  stream: NarrationStream | null;
}

export const initialFrameState: FrameState = {
  events: [],
  highestSeq: 0,
  caughtUp: false,
  notice: null,
  present: null,
  stream: null,
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
        // The settled narration row replaces the block.
        stream:
          frame.event.type === "narration" && frame.event.actor === "ai:dm"
            ? null
            : state.stream,
      };
    case "narration-stream": {
      if (frame.slot === "end") {
        return state.stream?.jobId === frame.jobId
          ? { ...state, stream: null }
          : state;
      }
      const base: NarrationStream =
        state.stream?.jobId === frame.jobId
          ? state.stream
          : {
              jobId: frame.jobId,
              rows: "",
              restate: "",
              describe: "",
              ask: "",
            };
      return {
        ...state,
        stream: { ...base, [frame.slot]: base[frame.slot] + frame.text },
      };
    }
    case "replay-complete":
      return { ...state, caughtUp: true };
    case "error":
      return {
        ...state,
        notice: frame.code
          ? `${refusalLabel(frame.code) ?? frame.message} (${frame.code})`
          : frame.message,
      };
    case "presence":
      return { ...state, present: frame.present };
    default:
      // An unknown frame type changes nothing, so the next additive frame needs no opt-in.
      return state;
  }
}
