# Contract: the answering module

Modules: `apps/server/src/library/answer.ts` (orchestration) and `apps/server/src/library/cite.ts`
(pure parsing and verification). The route in `apps/server/src/routes/library.ts` is a thin
adapter over `answer()`. An agent calls `answer()` directly (constitution I).

## Signatures

```ts
import type { Gateway } from "../ai/gateway.js";
import type { RetrievalConfig, RetrievedPassage } from "./retrieve.js";
import type { DbClient } from "./store.js";

export const ANSWER_PURPOSE = "answering";
export const PROMPT_VERSION = "answer-v1";
export const QUESTION_MAX = 2000;

export interface AnswerConfig {
  minSimilarity: number;        // ASK_MIN_SIMILARITY, 0..1, default 0.3
}

/** Zod-parses the env. Throws on an invalid value, naming ASK_MIN_SIMILARITY. */
export function loadAnswerConfig(env?: NodeJS.ProcessEnv): AnswerConfig;

export interface AnswerDeps {
  db: DbClient;
  gateway: Pick<Gateway, "chat" | "embed">;
  retrieval: RetrievalConfig;
  config: AnswerConfig;
  /** Defaults to retrieve.ts's `retrieve`; pure tests inject a scripted result. */
  retrieve?: typeof import("./retrieve.js").retrieve;
}

export interface AnswerRequest {
  question: string;             // validated by the caller or by answer(): 1..QUESTION_MAX after trim
  signal?: AbortSignal;
}

/** research R2. Pure. */
export function isRelevant(p: RetrievedPassage, minSimilarity: number): boolean;

/** Yields zero or more delta/citation events, then exactly one terminal event. Never throws after its first yield. */
export function answer(deps: AnswerDeps, req: AnswerRequest): AsyncIterable<AnswerEvent>;
```

`AnswerEvent` is the discriminated union of the five events in `ask-sse.md`, each as
`{ type: "<event name>", ...payload }`. The route writes `event: <type>` and the payload
without `type`.

```ts
// cite.ts
export interface QuoteMatch { start: number; end: number }   // offsets into passageText

/** research R1 step 3. Pure. null = reject. */
export function locateQuote(passageText: string, quote: string): QuoteMatch | null;

export type CiteToken =
  | { type: "text"; text: string }
  | { type: "cite"; p: string; quote: string }      // raw, unverified
  | { type: "malformed" }                            // unterminated or oversized marker
  | { type: "refuse" };                              // <refuse/> seen

/** Incremental parser. push() returns the tokens complete so far; end() flushes. */
export function createCiteParser(): { push(text: string): CiteToken[]; end(): CiteToken[] };
```

## Invariants (each has a test)

1. An invalid question makes no database or gateway call. `answer()` throws `ValidationError`
   before its first yield; the route turns that into a 400 before opening the stream.
2. No relevant passage → exactly one event, `refusal{nothing_relevant}`, and zero `chat` calls.
3. Only relevant passages are sent to the model, in retrieval order, numbered from 1.
4. Every emitted `citation` satisfies the three guarantees in `ask-sse.md`.
5. A citation whose quote is not in its passage (per `locateQuote`), or whose `p` is unknown, is
   never emitted. `done.dropped` counts it. No `delta` contains `<cite`, `</cite>`, or
   `<refuse`.
6. A marker split across any number of `text` chunks parses the same as unsplit.
7. `<refuse/>`, or a gateway `error` of kind `refusal`, ends with `refusal{model_declined}` and
   aborts the model call.
8. A model that finishes with zero verified citations ends with `refusal{unverified}`.
9. A gateway `error` (other than `refusal` and `cancelled`) ends with `error{kind}` using the
   fixed message for that kind. A `retrieve()` failure ends with `error{retrieval}`.
10. Exactly one terminal event, always last, except on cancellation, which ends with none.
11. The answerer writes nothing to the database and logs no question, passage, or answer text.
