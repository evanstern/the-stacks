/**
 * T003 (010 Foundational): resolveRetrievalConfig, TDD'd before it exists.
 * The contract (research R10, contracts/api.md §5): behavior is env-first
 * configuration; every run records the RESOLVED object verbatim, so
 * resolution must be pure, validated, and fail-fast — a bad knob dies at
 * boot/config time with a message naming the variable, never mid-request.
 */
import { describe, expect, it } from "vitest";

import { resolveRetrievalConfig } from "./config";

const EMPTY_ENV = {};

describe("resolveRetrievalConfig", () => {
  it("resolves the documented defaults from an empty env", () => {
    const config = resolveRetrievalConfig(EMPTY_ENV);
    expect(config).toEqual({
      configName: "env-default",
      fusion: "rrf",
      rrfK: 60,
      weightAlpha: 0.5,
      candidateDepth: 50,
      k: 10,
      rerank: false,
      rerankDepth: 50,
    });
  });

  it("reads each RETRIEVAL_* knob from env", () => {
    const config = resolveRetrievalConfig({
      RETRIEVAL_FUSION: "weighted",
      RETRIEVAL_RRF_K: "30",
      RETRIEVAL_WEIGHT_ALPHA: "0.7",
      RETRIEVAL_CANDIDATE_DEPTH: "100",
      RETRIEVAL_K: "20",
      RETRIEVAL_RERANK: "on",
      RETRIEVAL_RERANK_DEPTH: "40",
      RERANKER_PROVIDER: "local-sidecar",
      RERANKER_MODEL_ID: "cross-encoder/ms-marco-MiniLM-L-6-v2",
    });
    expect(config.fusion).toBe("weighted");
    expect(config.rrfK).toBe(30);
    expect(config.weightAlpha).toBe(0.7);
    expect(config.candidateDepth).toBe(100);
    expect(config.k).toBe(20);
    expect(config.rerank).toBe(true);
    expect(config.rerankDepth).toBe(40);
  });

  it("REFUSES rerank=on when the reranker role is disabled (fail fast, research R9)", () => {
    // Empty provider = role disabled — the misconfiguration must die at
    // resolution, not as a per-request sidecar 503.
    expect(() =>
      resolveRetrievalConfig({ RETRIEVAL_RERANK: "on", RERANKER_PROVIDER: "" }),
    ).toThrow(/RETRIEVAL_RERANK.*RERANKER_PROVIDER/s);
  });

  it("rejects malformed knobs with the variable named", () => {
    expect(() => resolveRetrievalConfig({ RETRIEVAL_FUSION: "vibes" })).toThrow(/RETRIEVAL_FUSION/);
    expect(() => resolveRetrievalConfig({ RETRIEVAL_RRF_K: "zero" })).toThrow(/RETRIEVAL_RRF_K/);
    expect(() => resolveRetrievalConfig({ RETRIEVAL_WEIGHT_ALPHA: "1.5" })).toThrow(/RETRIEVAL_WEIGHT_ALPHA/);
    expect(() => resolveRetrievalConfig({ RETRIEVAL_K: "0" })).toThrow(/RETRIEVAL_K/);
    // k can't exceed what fusion produces
    expect(() =>
      resolveRetrievalConfig({ RETRIEVAL_CANDIDATE_DEPTH: "10", RETRIEVAL_K: "20" }),
    ).toThrow(/RETRIEVAL_K/);
    // rerank depth is capped by the sidecar contract (≤ 256, contracts/reranker.md)
    expect(() => resolveRetrievalConfig({ RETRIEVAL_RERANK_DEPTH: "500" })).toThrow(/RETRIEVAL_RERANK_DEPTH/);
  });

  it("applies eval overrides after env, same validation, custom name (the A/B mechanism)", () => {
    const config = resolveRetrievalConfig(
      { RETRIEVAL_FUSION: "rrf" },
      { configName: "weighted-a05", fusion: "weighted", weightAlpha: 0.5 },
    );
    expect(config.configName).toBe("weighted-a05");
    expect(config.fusion).toBe("weighted");
    // overrides go through the same guards
    expect(() => resolveRetrievalConfig(EMPTY_ENV, { k: 999 })).toThrow(/RETRIEVAL_K/);
    expect(() =>
      resolveRetrievalConfig({ RERANKER_PROVIDER: "" }, { rerank: true }),
    ).toThrow(/RERANKER_PROVIDER/);
  });
});
