import type { AiConfig } from "../ai/config.js";
import type { EmbedRequest, Gateway } from "../ai/gateway.js";
import type {
  ChatEvent,
  ChatRequest,
  UsageRecord,
  UsageSink,
} from "../ai/types.js";
import { DM_PURPOSES, PURPOSE_MAX_TOKENS } from "../dm/purposes.js";
import {
  PLAYTEST_AUDIT_MAX_TOKENS,
  PLAYTEST_AUDIT_PURPOSE,
} from "./purpose.js";
import type { Scenario } from "./scenario.js";

/**
 * Modes and the cost guard (specs/032-playtest-harness contracts/cost-guard.md).
 * The estimate, the counting sink, the budget wrapper around the gateway and
 * the provider preflight. No function here reads or writes a key.
 */

// ---------------------------------------------------------------------------
// The estimate
// ---------------------------------------------------------------------------

/** Embedding model purpose used by retrieval when none is configured. */
export const DEFAULT_EMBED_PURPOSE = "embedding";

interface Row {
  /** Expected calls, as a function of T (expected turns). */
  expected: (t: number) => number;
  /** Upper-bound calls, as a function of Tmax (max turns). */
  upper: (tMax: number) => number;
  inputTokens: number;
}

/** The pinned per-purpose table of contracts/cost-guard.md. */
export const ESTIMATE_TABLE: Record<string, Row> = {
  "dm.director": { expected: (t) => t, upper: (m) => m, inputTokens: 6000 },
  "dm.interpret": { expected: (t) => t, upper: (m) => m, inputTokens: 5500 },
  "dm.adjudicate": { expected: () => 2, upper: (m) => m, inputTokens: 6500 },
  "dm.narrate": { expected: (t) => t, upper: (m) => 3 * m, inputTokens: 4500 },
  "dm.chronicle": { expected: (t) => t, upper: (m) => m, inputTokens: 3500 },
  "dm.companion": {
    expected: (t) => 2 * t,
    upper: (m) => 2 * m,
    inputTokens: 4500,
  },
  [PLAYTEST_AUDIT_PURPOSE]: {
    expected: (t) => t,
    upper: (m) => 2 * m,
    inputTokens: 5500,
  },
};
const EMBED_ROW: Row = { expected: () => 2, upper: (m) => m, inputTokens: 200 };

export interface EstimateLine {
  purpose: string;
  provider: string;
  model: string;
  expectedCalls: number;
  upperCalls: number;
  inputTokensPerCall: number;
  outputTokensPerCall: number;
  /** `null` when the model has no price. */
  expectedUsd: number | null;
  upperUsd: number | null;
}

export interface Estimate {
  /** Expected and upper-bound turn counts the table was evaluated at. */
  turns: { expected: number; max: number };
  lines: EstimateLine[];
  expectedUsd: number | null;
  upperUsd: number | null;
}

export interface EstimateInput {
  scenario: Pick<Scenario, "moves" | "limits">;
  aiConfig: AiConfig;
  /** Audit-only estimate: expected calls = segments, upper = 2 x segments. */
  segments?: number;
  /** Which groups to include. Default: the DM purposes and the auditor. */
  include?: { dm?: boolean; audit?: boolean };
  /** The retrieval embed purpose; included when configured. */
  embedPurpose?: string;
}

function outputCap(purpose: string, configured?: number): number {
  if (configured !== undefined) return configured;
  if (purpose === PLAYTEST_AUDIT_PURPOSE) return PLAYTEST_AUDIT_MAX_TOKENS;
  return (
    (PURPOSE_MAX_TOKENS as Record<string, number | undefined>)[purpose] ?? 600
  );
}

function usd(
  aiConfig: AiConfig,
  provider: string,
  model: string,
  calls: number,
  input: number,
  output: number,
): number | null {
  const price = aiConfig.prices[`${provider}/${model}`];
  if (!price) return null;
  return (
    (calls * (input * price.inputPerMTok + output * price.outputPerMTok)) /
    1_000_000
  );
}

const sum = (xs: (number | null)[]): number | null =>
  xs.some((x) => x === null)
    ? null
    : xs.reduce<number>((a, x) => a + (x as number), 0);

/**
 * The cost estimate. Printed as an estimate only: the ceiling, not the
 * estimate, is enforced at run time.
 */
export function estimate(input: EstimateInput): Estimate {
  const { scenario, aiConfig } = input;
  const include = { dm: true, audit: true, ...input.include };
  const t =
    input.segments !== undefined
      ? input.segments
      : scenario.moves.free.length + 6;
  const tMax =
    input.segments !== undefined
      ? input.segments
      : scenario.limits.maxMoves * 2;

  const purposes: { name: string; row: Row }[] = [];
  if (include.dm) {
    for (const p of DM_PURPOSES) {
      purposes.push({ name: p, row: ESTIMATE_TABLE[p] as Row });
    }
  }
  if (include.audit) {
    const base = ESTIMATE_TABLE[PLAYTEST_AUDIT_PURPOSE] as Row;
    purposes.push({
      name: PLAYTEST_AUDIT_PURPOSE,
      row:
        input.segments !== undefined
          ? { ...base, expected: () => t, upper: () => 2 * t }
          : base,
    });
  }
  const embed = input.embedPurpose ?? DEFAULT_EMBED_PURPOSE;
  if (include.dm && aiConfig.purposes[embed]?.op === "embed") {
    purposes.push({ name: embed, row: EMBED_ROW });
  }

  const lines: EstimateLine[] = [];
  for (const { name, row } of purposes) {
    const cfg = aiConfig.purposes[name];
    if (!cfg) continue;
    const out =
      name === embed && row === EMBED_ROW ? 0 : outputCap(name, cfg.maxTokens);
    const expectedCalls = row.expected(t);
    const upperCalls = row.upper(tMax);
    lines.push({
      purpose: name,
      provider: cfg.provider,
      model: cfg.model,
      expectedCalls,
      upperCalls,
      inputTokensPerCall: row.inputTokens,
      outputTokensPerCall: out,
      expectedUsd: usd(
        aiConfig,
        cfg.provider,
        cfg.model,
        expectedCalls,
        row.inputTokens,
        out,
      ),
      upperUsd: usd(
        aiConfig,
        cfg.provider,
        cfg.model,
        upperCalls,
        row.inputTokens,
        out,
      ),
    });
  }
  return {
    turns: { expected: t, max: tMax },
    lines,
    expectedUsd: sum(lines.map((l) => l.expectedUsd)),
    upperUsd: sum(lines.map((l) => l.upperUsd)),
  };
}

/** Text for stdout: the estimate table and the "estimate, not a cap" note. */
export function formatEstimate(e: Estimate): string {
  const money = (v: number | null) =>
    v === null ? "unpriced" : `$${v.toFixed(4)}`;
  const rows = e.lines.map(
    (l) =>
      `  ${l.purpose.padEnd(15)} ${`${l.provider}/${l.model}`.padEnd(32)} calls ${String(l.expectedCalls).padStart(4)}..${String(l.upperCalls).padEnd(4)} tokens/call ${l.inputTokensPerCall} in, ${l.outputTokensPerCall} out   ${money(l.expectedUsd)} .. ${money(l.upperUsd)}`,
  );
  return [
    `Estimate (turns: expected ${e.turns.expected}, upper bound ${e.turns.max}):`,
    ...rows,
    `  total: expected ${money(e.expectedUsd)}, upper bound ${money(e.upperUsd)}`,
    "This is an estimate. The spend ceiling, not the estimate, is enforced.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// The ceiling at run time
// ---------------------------------------------------------------------------

export interface Totals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface CountingSink extends UsageSink {
  totals(): Totals;
  records: UsageRecord[];
}

/** Counts every usage record and forwards it to `inner`. */
export function countingSink(inner: UsageSink): CountingSink {
  const records: UsageRecord[] = [];
  return {
    records,
    record(r: UsageRecord) {
      records.push(r);
      inner.record(r);
    },
    totals() {
      return {
        calls: records.length,
        inputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
        outputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
        // An unpriced record counts as 0; the preflight refuses unpriced models.
        costUsd: records.reduce((s, r) => s + (r.costUsd ?? 0), 0),
      };
    },
  };
}

export const CEILING_MESSAGE = "playtest spend ceiling reached";

/**
 * Wraps a gateway: at or over the ceiling, `chat` yields one `cancelled`
 * error and `embed` throws, and neither reaches the provider. Overshoot is
 * bounded by the calls already in flight when the ceiling is crossed.
 */
export function budgetGateway(
  gateway: Gateway,
  sink: CountingSink,
  ceilingUsd: number,
): Gateway {
  const over = () => sink.totals().costUsd >= ceilingUsd;
  return {
    async *chat(req: ChatRequest): AsyncIterable<ChatEvent> {
      if (over()) {
        yield {
          type: "error",
          kind: "cancelled",
          message: CEILING_MESSAGE,
          usage: { inputTokens: 0, outputTokens: 0 },
        };
        return;
      }
      yield* gateway.chat(req);
    },
    async embed(req: EmbedRequest) {
      if (over()) throw new Error(CEILING_MESSAGE);
      return gateway.embed(req);
    },
  };
}

// ---------------------------------------------------------------------------
// The provider preflight
// ---------------------------------------------------------------------------

export interface PreflightNeeds {
  /** The seven `dm.*` purposes (a `run`). */
  dm: boolean;
  /** `playtest.audit`. */
  audit: boolean;
  embedPurpose?: string;
}

export interface Refusal {
  /** The step of contracts/cost-guard.md. */
  step: 1 | 2 | 3;
  message: string;
}

/**
 * Steps 1 to 3 of the preflight, in order: `CI` set; a missing purpose;
 * a model with no price. Every refusal found is returned, step 1 first.
 */
export function providerPreflight(
  env: NodeJS.ProcessEnv,
  aiConfig: AiConfig,
  needs: PreflightNeeds,
): Refusal[] {
  const refusals: Refusal[] = [];
  if (env.CI) {
    refusals.push({
      step: 1,
      message: "provider mode is refused under CI",
    });
  }
  const wanted: string[] = [];
  if (needs.dm) wanted.push(...DM_PURPOSES);
  if (needs.audit) wanted.push(PLAYTEST_AUDIT_PURPOSE);
  const missing = wanted.filter((p) => !aiConfig.purposes[p]);
  if (missing.length > 0) {
    refusals.push({
      step: 2,
      message: `purposes not configured in AI_PURPOSES: ${missing.join(", ")}`,
    });
  }
  const embed = needs.embedPurpose ?? DEFAULT_EMBED_PURPOSE;
  const used = [...wanted];
  if (needs.dm && aiConfig.purposes[embed]) used.push(embed);
  const unpriced = [
    ...new Set(
      used
        .map((p) => aiConfig.purposes[p])
        .filter((c): c is NonNullable<typeof c> => c !== undefined)
        .map((c) => `${c.provider}/${c.model}`)
        .filter((key) => !aiConfig.prices[key]),
    ),
  ];
  if (unpriced.length > 0) {
    refusals.push({
      step: 3,
      message: `models with no AI_PRICES entry: ${unpriced.join(", ")}`,
    });
  }
  return refusals;
}
