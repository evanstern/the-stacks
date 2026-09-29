import type { Gateway } from "../../ai/gateway.js";
import type { Provider } from "../../ai/types.js";

/**
 * The bench's own deterministic embedding (research R8): a hashed
 * bag-of-words, injected as the gateway's `fake` adapter so `bow` runs give
 * real (non-random) vector/hybrid recall with no network and no cost.
 */

const DIM = 1024;

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "are",
  "it",
  "this",
  "that",
  "with",
  "as",
  "at",
  "by",
  "be",
  "i",
  "you",
  "my",
  "your",
  "if",
  "do",
  "does",
  "can",
  "what",
  "when",
  "how",
]);

function fnv1a(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function l2normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return norm === 0 ? vector : vector.map((x) => x / norm);
}

/**
 * Lowercase, split on non-letters, drop stop words, strip a trailing "s",
 * hash each token into one of `DIM` buckets with a hash-derived sign,
 * L2-normalize (contract invariant 3: deterministic, unit-norm, length
 * `DIM`; shared content words raise cosine similarity).
 */
export function bowEmbed(text: string): number[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
    .map((t) => (t.length > 1 && t.endsWith("s") ? t.slice(0, -1) : t));

  const vector = new Array<number>(DIM).fill(0);
  for (const token of tokens) {
    const hash = fnv1a(token);
    vector[hash % DIM] += hash & 1 ? 1 : -1;
  }
  return l2normalize(vector);
}

/**
 * First `dim` components, L2-renormalized, zero-padded back to 1024
 * (research R5, contract invariant 4).
 */
export function truncateVector(vector: number[], dim: number): number[] {
  const truncated = l2normalize(vector.slice(0, dim));
  const out = new Array<number>(vector.length).fill(0);
  for (let i = 0; i < truncated.length; i++) out[i] = truncated[i];
  return out;
}

/** A `Provider` (kind "fake") built on `bowEmbed`, for the bench's own gateway. */
export const bowProvider: Provider = {
  ops: new Set(["embed"]),
  async embed(_model, texts) {
    return {
      vectors: texts.map(bowEmbed),
      inputTokens: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
    };
  },
};

/**
 * Wraps a gateway's `embed` so every returned vector is truncated to `dim`
 * and its model name gets a `@<dim>` suffix — including at 1024, so every
 * dim uses the same naming rule (research R5).
 */
export function withDim(
  gateway: Pick<Gateway, "embed">,
  dim: number,
): Pick<Gateway, "embed"> {
  return {
    async embed(req) {
      const result = await gateway.embed(req);
      return {
        usage: result.usage,
        vectors: result.vectors.map((v) => ({
          vector: truncateVector(v.vector, dim),
          model: `${v.model}@${dim}`,
          dim: v.dim,
        })),
      };
    },
  };
}
