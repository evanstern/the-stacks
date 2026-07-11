/**
 * Retrieval configuration — env-first, validated, fail-fast (research R10,
 * contracts/api.md §5). Behavior is configuration (Principle VII): fusion
 * strategy, depths, and the rerank toggle all live in RETRIEVAL_* variables,
 * and every run records the RESOLVED object verbatim so no receipt or
 * metric ever depends on ambient env.
 *
 * Eval runs pass `overrides` — the one-variable-at-a-time A/B mechanism
 * (D11). Overrides go through exactly the same guards as env: there is one
 * validation path, so an eval can't measure a configuration the product
 * would refuse to run.
 *
 * Failure style matches @stacks/core model-roles: plain Error naming the
 * offending variable — misconfiguration dies at boot/config time with an
 * operator-actionable message, never as a mystery mid-request.
 */

export type FusionStrategy = "rrf" | "weighted";

export interface ResolvedRetrievalConfig {
  /** Human handle recorded on runs; eval comparisons key on it. */
  configName: string;
  fusion: FusionStrategy;
  /** RRF dampening constant (research R1; the canonical 60). */
  rrfK: number;
  /** weighted only: the vector signal's weight in [0,1]; FTS gets 1 - alpha. */
  weightAlpha: number;
  /** Vector floor: candidates below this cosine similarity are dropped —
   *  pure nearest-neighbor always answers with SOMETHING, so honest empty
   *  results (US1) require a floor. */
  minSimilarity: number;
  /** Per-signal candidates fetched before fusion. */
  candidateDepth: number;
  /** Results returned and recorded. */
  k: number;
  rerank: boolean;
  /** Fused candidates sent to the reranker (≤ 256, contracts/reranker.md). */
  rerankDepth: number;
}

export type RetrievalOverrides = Partial<Omit<ResolvedRetrievalConfig, "configName">> & {
  configName?: string;
};

type Env = Record<string, string | undefined>;

function envInt(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer, got: ${raw}`);
  }
  return value;
}

function envFloat(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a number, got: ${raw}`);
  }
  return value;
}

/** Resolve from env, then apply eval overrides, then validate ONCE. */
export function resolveRetrievalConfig(
  env: Env,
  overrides: RetrievalOverrides = {},
): ResolvedRetrievalConfig {
  const fusionRaw = env.RETRIEVAL_FUSION ?? "rrf";
  if (fusionRaw !== "rrf" && fusionRaw !== "weighted") {
    throw new Error(`RETRIEVAL_FUSION must be "rrf" or "weighted", got: ${fusionRaw}`);
  }
  const rerankRaw = env.RETRIEVAL_RERANK ?? "off";
  if (rerankRaw !== "on" && rerankRaw !== "off") {
    throw new Error(`RETRIEVAL_RERANK must be "on" or "off", got: ${rerankRaw}`);
  }

  const config: ResolvedRetrievalConfig = {
    configName: overrides.configName ?? "env-default",
    fusion: overrides.fusion ?? fusionRaw,
    rrfK: overrides.rrfK ?? envInt(env, "RETRIEVAL_RRF_K", 60),
    weightAlpha: overrides.weightAlpha ?? envFloat(env, "RETRIEVAL_WEIGHT_ALPHA", 0.5),
    minSimilarity: overrides.minSimilarity ?? envFloat(env, "RETRIEVAL_MIN_SIMILARITY", 0.3),
    candidateDepth: overrides.candidateDepth ?? envInt(env, "RETRIEVAL_CANDIDATE_DEPTH", 50),
    k: overrides.k ?? envInt(env, "RETRIEVAL_K", 10),
    rerank: overrides.rerank ?? rerankRaw === "on",
    rerankDepth: overrides.rerankDepth ?? envInt(env, "RETRIEVAL_RERANK_DEPTH", 50),
  };

  if (config.rrfK < 1) throw new Error(`RETRIEVAL_RRF_K must be >= 1, got: ${config.rrfK}`);
  if (config.weightAlpha < 0 || config.weightAlpha > 1) {
    throw new Error(`RETRIEVAL_WEIGHT_ALPHA must be in [0,1], got: ${config.weightAlpha}`);
  }
  if (config.minSimilarity < -1 || config.minSimilarity > 1) {
    throw new Error(`RETRIEVAL_MIN_SIMILARITY must be in [-1,1], got: ${config.minSimilarity}`);
  }
  if (config.candidateDepth < 1 || config.candidateDepth > 500) {
    throw new Error(`RETRIEVAL_CANDIDATE_DEPTH must be in [1,500], got: ${config.candidateDepth}`);
  }
  if (config.k < 1 || config.k > config.candidateDepth) {
    throw new Error(
      `RETRIEVAL_K must be in [1, RETRIEVAL_CANDIDATE_DEPTH=${config.candidateDepth}], got: ${config.k}`,
    );
  }
  if (config.rerankDepth < 1 || config.rerankDepth > 256) {
    // 256 is the sidecar's hard per-call cap (contracts/reranker.md).
    throw new Error(`RETRIEVAL_RERANK_DEPTH must be in [1,256], got: ${config.rerankDepth}`);
  }
  if (config.rerank && !env.RERANKER_PROVIDER) {
    // Fail fast (research R9): turning the stage on with a disabled role is a
    // configuration contradiction — refuse here, not per-request via 503s.
    throw new Error(
      "RETRIEVAL_RERANK=on requires the reranker role: set RERANKER_PROVIDER and RERANKER_MODEL_ID (empty provider = role disabled)",
    );
  }

  return config;
}
