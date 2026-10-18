import type { Citation, DoneSummary } from "./types";

/**
 * Pure turn reducer (plan D10). Import-type only, erasable TypeScript only
 * (research R8) — no runtime imports.
 */

export type TurnState =
  | "streaming"
  | "done"
  | "refused"
  | "interrupted"
  | "stopped";

export type TurnPart =
  | { type: "text"; text: string }
  | { type: "cite"; n: number };

export interface Turn {
  id: string;
  question: string;
  state: TurnState;
  parts: TurnPart[];
  /** First-seen citation per `n` (a repeat renders as the same reference, FR-022). */
  citations: Record<number, Citation>;
  /** Set on `done`, for `dropped` (FR-026). */
  summary: DoneSummary | null;
  /** The refusal or error message (FR-024, FR-025). */
  message: string | null;
}

export function createTurn(id: string, question: string): Turn {
  return {
    id,
    question,
    state: "streaming",
    parts: [],
    citations: {},
    summary: null,
    message: null,
  };
}

/** One parsed SSE message, JSON-decoded. */
export interface TurnEvent {
  event: string;
  data: unknown;
}

/** Applies one ask-sse.md event to a turn, returning a new turn. */
export function applyEvent(turn: Turn, msg: TurnEvent): Turn {
  switch (msg.event) {
    case "delta": {
      const { text } = msg.data as { text: string };
      const last = turn.parts[turn.parts.length - 1];
      if (last?.type === "text") {
        return {
          ...turn,
          parts: [
            ...turn.parts.slice(0, -1),
            { type: "text", text: last.text + text },
          ],
        };
      }
      return { ...turn, parts: [...turn.parts, { type: "text", text }] };
    }
    case "citation": {
      const citation = msg.data as Citation;
      const citations = turn.citations[citation.n]
        ? turn.citations
        : { ...turn.citations, [citation.n]: citation };
      return {
        ...turn,
        parts: [...turn.parts, { type: "cite", n: citation.n }],
        citations,
      };
    }
    case "done":
      return { ...turn, state: "done", summary: msg.data as DoneSummary };
    case "refusal": {
      const { message } = msg.data as { message: string };
      return { ...turn, state: "refused", parts: [], citations: {}, message };
    }
    case "error": {
      const { message } = msg.data as { message: string };
      return { ...turn, state: "interrupted", message };
    }
    default:
      return turn; // unknown events are ignored
  }
}

/** The stream ended with no terminal event (network drop, edge cases). */
export function endWithoutTerminal(turn: Turn): Turn {
  return {
    ...turn,
    state: "interrupted",
    message: "The connection closed before the answer finished.",
  };
}

/** FR-023: Stop keeps the partial text, marked "Stopped". */
export function stopTurn(turn: Turn): Turn {
  return { ...turn, state: "stopped" };
}
