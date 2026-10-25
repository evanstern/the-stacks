/**
 * Ask-stream event shapes, restated from
 * specs/018-rules-answerer/contracts/ask-sse.md (plan D10, constitution
 * III). Import-type only, erasable TypeScript only (research R8) — this
 * file has no runtime imports and no exports beyond types.
 */

export interface Span {
  start: number;
  end: number;
}

export type PassageKind =
  | "heading"
  | "prose"
  | "list"
  | "table"
  | "statBlock"
  | "sidebar";

export interface Passage {
  kind: PassageKind;
  text: string;
  span: Span;
}

/** The `citation` event's data (ask-sse.md). */
export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  book: string;
  section: string[];
  quote: string;
  span: Span;
  passage: Passage;
  quoteInPassage: Span;
}

/** The `delta` event's data. */
export interface DeltaData {
  text: string;
}

/** The `done` event's data (terminal). */
export interface DoneSummary {
  citations: number;
  dropped: number;
  passages: number;
  promptVersion: string;
}

export type RefusalReason =
  | "nothing_relevant"
  | "model_declined"
  | "unverified";

/** The `refusal` event's data (terminal). */
export interface RefusalData {
  reason: RefusalReason;
  message: string;
}

export type AskErrorKind =
  | "config"
  | "auth"
  | "rate_limit"
  | "upstream"
  | "retrieval"
  | "internal";

/** The `error` event's data (terminal). */
export interface AskErrorData {
  kind: AskErrorKind;
  message: string;
}
