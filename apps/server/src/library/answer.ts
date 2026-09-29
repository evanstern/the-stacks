import { z } from "zod";
import type { Gateway } from "../ai/gateway.js";
import type {
  RetrievalConfig,
  RetrievedPassage,
  retrieve,
} from "./retrieve.js";
import type { DbClient } from "./store.js";

/**
 * The rules answerer (specs/018-rules-answerer, contracts/answer.md): turns a
 * question plus retrieved passages into a streamed, cited answer. This file
 * currently holds Phase 1 (config and types) only — `answer()` itself is
 * Phase 2.
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
