import { describe, expect, it } from "vitest";
import type { Price, UsageRecord } from "../src/ai/types.js";
import { computeCost, memorySink } from "../src/ai/usage.js";

const PRICES: Record<string, Price> = {
  "hosted/big": { inputPerMTok: 3, outputPerMTok: 15 },
};

describe("computeCost", () => {
  it("computes USD from the configured per-million-token price", () => {
    const cost = computeCost(PRICES, "hosted", "big", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18, 6);
  });

  it("returns null — never 0 — for an unpriced model (FR-008)", () => {
    expect(computeCost(PRICES, "hosted", "unknown-model", 100, 100)).toBeNull();
  });
});

describe("memorySink", () => {
  it("records usage records in order, exposed on .records", () => {
    const sink = memorySink();
    const record: UsageRecord = {
      purpose: "answering",
      provider: "hosted",
      model: "big",
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.001,
      durationMs: 42,
      attempts: 1,
      outcome: "ok",
      at: new Date().toISOString(),
    };

    sink.record(record);

    expect(sink.records).toEqual([record]);
  });
});
