import type { Price, UsageRecord, UsageSink } from "./types.js";

/**
 * Cost in USD for a call, keyed `"<provider>/<model>"` (research R5). Returns
 * `null` — never 0 — when the model has no configured price (FR-008).
 */
export function computeCost(
  prices: Record<string, Price>,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = prices[`${provider}/${model}`];
  if (!price) return null;
  return (
    (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) /
    1_000_000
  );
}

/** Emits one JSON line per call to the server log. Never logs prompt/completion text (FR-011). */
export const logSink: UsageSink = {
  record(r: UsageRecord) {
    console.log(JSON.stringify({ type: "ai_usage", ...r }));
  },
};

/** In-process sink for tests and benchmarks (research R4). */
export function memorySink(): UsageSink & { records: UsageRecord[] } {
  const records: UsageRecord[] = [];
  return {
    records,
    record(r: UsageRecord) {
      records.push(r);
    },
  };
}
