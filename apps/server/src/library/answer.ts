import type { ZodError } from "zod";
import { z } from "zod";
import type { Gateway } from "../ai/gateway.js";
import type { ErrorIssue } from "../errors.js";
import { ValidationError } from "../errors.js";
import type { CiteToken } from "./cite.js";
import { createCiteParser, locateQuote } from "./cite.js";
import type {
  RetrievalConfig,
  RetrievalResult,
  RetrievedPassage,
} from "./retrieve.js";
import { retrieve } from "./retrieve.js";
import type { DbClient } from "./store.js";

/**
 * The rules answerer (specs/018-rules-answerer, contracts/answer.md): turns a
 * question plus retrieved passages into a streamed, cited answer.
 */

/** research R3: a code constant, not an env var — see research.md R3. */
export const ANSWER_PURPOSE = "answering";

/** research R6: reported in `done` for prompt-template versioning (A7). */
export const PROMPT_VERSION = "answer-v1";

/** contracts/ask-sse.md: question length ceiling, after trimming. */
export const QUESTION_MAX = 2000;

export interface AnswerConfig {
  /** ASK_MIN_SIMILARITY, 0..1, default 0.3 (research R2). */
  minSimilarity: number;
}

export interface AnswerDeps {
  db: DbClient;
  gateway: Pick<Gateway, "chat" | "embed">;
  retrieval: RetrievalConfig;
  config: AnswerConfig;
  /** Defaults to retrieve.ts's `retrieve`; pure tests inject a scripted result. */
  retrieve?: typeof retrieve;
}

export interface AnswerRequest {
  /** Validated by answer(): 1..QUESTION_MAX characters after trim. */
  question: string;
  signal?: AbortSignal;
}

export interface Span {
  start: number;
  end: number;
}

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  book: string;
  section: string[];
  quote: string;
  span: Span;
  passage: {
    kind: RetrievedPassage["kind"];
    text: string;
    span: Span;
  };
  quoteInPassage: Span;
}

export type RefusalReason =
  | "nothing_relevant"
  | "model_declined"
  | "unverified";

/** ask-sse.md's error table, minus the gateway-internal "refusal"/"cancelled" kinds. */
export type AnswerErrorKind =
  | "config"
  | "auth"
  | "rate_limit"
  | "upstream"
  | "retrieval"
  | "internal";

export type AnswerEvent =
  | { type: "delta"; text: string }
  | ({ type: "citation" } & Citation)
  | {
      type: "done";
      citations: number;
      dropped: number;
      passages: number;
      promptVersion: string;
    }
  | { type: "refusal"; reason: RefusalReason; message: string }
  | { type: "error"; kind: AnswerErrorKind; message: string };

const AnswerConfigSchema = z.object({
  minSimilarity: z.coerce.number().min(0).max(1).default(0.3),
});

/**
 * Zod-parses the env (research R2). Throws naming ASK_MIN_SIMILARITY on an
 * invalid value.
 *
 * ponytail: 0.3 is a guess, not a calibrated floor; TASK-0029's retrieval
 * benchmark (refusal precision/recall per model) is the trigger to change the
 * default. Upgrade path: same schema, a different default.
 */
export function loadAnswerConfig(
  env: NodeJS.ProcessEnv = process.env,
): AnswerConfig {
  const minSimilarity = AnswerConfigSchema.shape.minSimilarity.safeParse(
    env.ASK_MIN_SIMILARITY,
  );
  if (!minSimilarity.success) {
    throw new Error("ASK_MIN_SIMILARITY must be a number between 0 and 1");
  }
  return { minSimilarity: minSimilarity.data };
}

/**
 * research R2: a passage is relevant when its keyword signal is present, or
 * its vector signal meets the floor. Pure.
 */
export function isRelevant(
  p: RetrievedPassage,
  minSimilarity: number,
): boolean {
  return (
    p.fts !== null || (p.vector !== null && p.vector.score >= minSimilarity)
  );
}

/** Same shape as retrieve.ts's/store.ts's private zodIssues. */
function zodIssues(error: ZodError): ErrorIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

const QuestionSchema = z.string().trim().min(1).max(QUESTION_MAX);

/** Invariant 1: throws before any database or gateway call. */
function validateQuestion(question: string): string {
  const parsed = QuestionSchema.safeParse(question);
  if (!parsed.success) throw new ValidationError(zodIssues(parsed.error));
  return parsed.data;
}

/** contracts/ask-sse.md's `refusal` table: fixed, display-safe message per reason. */
const REFUSAL_MESSAGES: Record<RefusalReason, string> = {
  nothing_relevant: "The library has nothing relevant to this question.",
  model_declined: "The library passages found do not answer this question.",
  unverified: "No answer could be verified against the library.",
};

/** contracts/ask-sse.md's `error` table: fixed, display-safe message per kind. */
const ERROR_MESSAGES: Record<AnswerErrorKind, string> = {
  config: "The rules answerer is not configured.",
  auth: "The AI provider rejected the configured credentials.",
  rate_limit: "The AI provider is rate limiting requests. Try again shortly.",
  upstream: "The model provider failed. Try again.",
  retrieval: "The library search failed.",
  internal: "An internal error occurred.",
};

/** research R6: states the citation syntax and the refusal rule; names no game system. */
function buildSystemPrompt(): string {
  return [
    'Answer the question using only the numbered passages given below, each marked `p="N"`.',
    'State each claim in your own words first, then append a citation: `<cite p="N">exact words copied from passage N</cite>`. The citation holds only the supporting quote, copied verbatim. Example: `A round lasts about six seconds <cite p="1">about 6 seconds in the game world</cite>.` Never paraphrase inside a citation, and use no other syntax that looks like a citation.',
    "Answer only from the passages given. If they are silent on part of the question, say so.",
    "If the passages do not answer the question at all, respond with exactly `<refuse/>` and nothing else.",
  ].join("\n");
}

/** research R6: `<passage p="N" book="…" section="A › B">text</passage>` blocks, then the question. */
function buildUserMessage(
  passages: RetrievedPassage[],
  question: string,
): string {
  const blocks = passages
    .map((p, i) => {
      const section = p.anchor.path.join(" › ");
      return `<passage p="${i + 1}" book="${p.anchor.book}" section="${section}">${p.text}</passage>`;
    })
    .join("\n\n");
  return `${blocks}\n\n${question}`;
}

/**
 * Resolves and verifies one citation token against the numbered passages
 * (research R1 step 3/4). `null` means drop-and-count: unknown/non-numeric
 * `p`, or a quote `locateQuote` cannot place.
 */
function verifyCitation(
  token: Extract<CiteToken, { type: "cite" }>,
  relevant: RetrievedPassage[],
): Citation | null {
  const index = Number(token.p);
  const passage = Number.isInteger(index) ? relevant[index - 1] : undefined;
  if (!passage) return null;
  const match = locateQuote(passage.text, token.quote);
  if (!match) return null;
  return {
    n: 0, // assigned by the caller, which tracks first-appearance order
    chunkId: passage.chunkId,
    documentId: passage.documentId,
    book: passage.anchor.book,
    section: passage.anchor.path,
    quote: passage.text.slice(match.start, match.end),
    span: {
      start: passage.anchor.start + match.start,
      end: passage.anchor.start + match.end,
    },
    passage: {
      kind: passage.kind,
      text: passage.text,
      span: { start: passage.anchor.start, end: passage.anchor.end },
    },
    quoteInPassage: match,
  };
}

/**
 * Turns one batch of parser tokens (from a `push` or the final `end`) into
 * answer events, tracking dedup/dropped state shared across the whole
 * stream. Returns `true` if a `<refuse/>` marker was seen — the caller
 * aborts the chat call and stops on that signal.
 */
function* emitFromTokens(
  tokens: CiteToken[],
  relevant: RetrievedPassage[],
  citationsByKey: Map<string, number>,
  onDropped: () => void,
): Generator<AnswerEvent, boolean> {
  for (const token of tokens) {
    if (token.type === "text") {
      if (token.text.length > 0) yield { type: "delta", text: token.text };
      continue;
    }
    if (token.type === "refuse") return true;
    if (token.type === "malformed") {
      onDropped();
      continue;
    }
    const citation = verifyCitation(token, relevant);
    if (!citation) {
      onDropped();
      continue;
    }
    const key = `${citation.chunkId}:${citation.span.start}:${citation.span.end}`;
    let n = citationsByKey.get(key);
    if (n === undefined) {
      n = citationsByKey.size + 1;
      citationsByKey.set(key, n);
    }
    yield { type: "citation", ...citation, n };
  }
  return false;
}

/**
 * Turns a question plus retrieved passages into a streamed, verified,
 * cited answer (contracts/answer.md). Never throws after its first yield;
 * an invalid question throws `ValidationError` before any database or
 * gateway call (invariant 1).
 */
export async function* answer(
  deps: AnswerDeps,
  req: AnswerRequest,
): AsyncIterable<AnswerEvent> {
  const question = validateQuestion(req.question);
  const retrieveFn = deps.retrieve ?? retrieve;

  // Anything below throws only on a genuine bug or a failed retrieve() call
  // (invariant: answer() never lets an exception escape once it may have
  // already opened the stream) — mapped to a terminal `error` event instead
  // of propagating, and logged server-side only (T018).
  try {
    let result: RetrievalResult;
    try {
      result = await retrieveFn(
        { db: deps.db, gateway: deps.gateway, config: deps.retrieval },
        { question, signal: req.signal },
      );
    } catch {
      yield {
        type: "error",
        kind: "retrieval",
        message: ERROR_MESSAGES.retrieval,
      };
      return;
    }

    const relevant = result.passages.filter((p) =>
      isRelevant(p, deps.config.minSimilarity),
    );
    if (relevant.length === 0) {
      yield {
        type: "refusal",
        reason: "nothing_relevant",
        message: REFUSAL_MESSAGES.nothing_relevant,
      };
      return;
    }

    // A per-call controller chained to req.signal (research R5/R2): lets a
    // `<refuse/>` marker abort just the chat call, independent of the
    // caller's own cancellation.
    const chatController = new AbortController();
    const onAbort = () => chatController.abort();
    if (req.signal) {
      if (req.signal.aborted) chatController.abort();
      else req.signal.addEventListener("abort", onAbort);
    }

    const citationsByKey = new Map<string, number>();
    let dropped = 0;
    const countDropped = () => {
      dropped += 1;
    };
    const parser = createCiteParser();

    try {
      const chat = deps.gateway.chat({
        purpose: ANSWER_PURPOSE,
        system: buildSystemPrompt(),
        messages: [
          { role: "user", content: buildUserMessage(relevant, question) },
        ],
        signal: chatController.signal,
      });

      for await (const event of chat) {
        if (event.type === "text") {
          const gen = emitFromTokens(
            parser.push(event.text),
            relevant,
            citationsByKey,
            countDropped,
          );
          let step = gen.next();
          while (!step.done) {
            yield step.value;
            step = gen.next();
          }
          if (step.value) {
            chatController.abort();
            yield {
              type: "refusal",
              reason: "model_declined",
              message: REFUSAL_MESSAGES.model_declined,
            };
            return;
          }
          continue;
        }

        if (event.type === "done") {
          const gen = emitFromTokens(
            parser.end(),
            relevant,
            citationsByKey,
            countDropped,
          );
          let step = gen.next();
          while (!step.done) {
            yield step.value;
            step = gen.next();
          }
          if (step.value) {
            chatController.abort();
            yield {
              type: "refusal",
              reason: "model_declined",
              message: REFUSAL_MESSAGES.model_declined,
            };
            return;
          }
          if (citationsByKey.size === 0) {
            yield {
              type: "refusal",
              reason: "unverified",
              message: REFUSAL_MESSAGES.unverified,
            };
            return;
          }
          yield {
            type: "done",
            citations: citationsByKey.size,
            dropped,
            passages: relevant.length,
            promptVersion: PROMPT_VERSION,
          };
          return;
        }

        // event.type === "error"
        if (event.kind === "cancelled") return; // no terminal event on cancellation
        if (event.kind === "refusal") {
          yield {
            type: "refusal",
            reason: "model_declined",
            message: REFUSAL_MESSAGES.model_declined,
          };
          return;
        }
        // config/auth/rate_limit/upstream: fixed message per kind.
        yield {
          type: "error",
          kind: event.kind,
          message: ERROR_MESSAGES[event.kind],
        };
        return;
      }
    } finally {
      req.signal?.removeEventListener("abort", onAbort);
    }
  } catch (err) {
    console.error(err);
    yield { type: "error", kind: "internal", message: ERROR_MESSAGES.internal };
  }
}
