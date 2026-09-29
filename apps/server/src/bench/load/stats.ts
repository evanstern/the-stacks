import type {
  ConcurrencyStep,
  IngestStep,
  Verdict,
  VerdictRule,
} from "./results.js";

/**
 * Percentiles and degradation verdicts (specs/021-load-bench research R5,
 * R8). Pure functions: no database, network, or file-system access, so
 * `test/bench/load.test.ts` exercises them with no database.
 */

/** Nearest-rank percentile over an already-sorted ascending array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    throw new Error("percentile: sorted must be non-empty");
  }
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1;
  return sorted[index];
}

export interface IngestThresholds {
  throughputFloor: number;
  serviceMultiple: number;
  enqueueMultiple: number;
}

export interface ConcurrencyThresholds {
  latencyMultiple: number;
  errorRate: number;
}

/** Absolute floors (research R5): sub-floor changes never count as degraded, however large the ratio. */
const SERVICE_FLOOR_MS = 100;
const ENQUEUE_FLOOR_MS = 20;
const LATENCY_FLOOR_MS = 50;

/**
 * One ingest series (fixed worker count), steps in volume order. The first
 * step is the baseline; the first later step where any rule fires is the
 * verdict, naming every rule that fired there (research R5).
 */
export function ingestVerdict(
  steps: IngestStep[],
  t: IngestThresholds,
): Verdict {
  const [baseline, ...rest] = steps;
  if (!baseline) throw new Error("ingestVerdict: steps must be non-empty");

  for (const step of rest) {
    const rules: VerdictRule[] = [];
    if (step.throughputPerSec < t.throughputFloor * baseline.throughputPerSec) {
      rules.push("throughput");
    }
    if (
      step.serviceP95Ms > t.serviceMultiple * baseline.serviceP95Ms &&
      step.serviceP95Ms > SERVICE_FLOOR_MS
    ) {
      rules.push("service");
    }
    if (
      step.enqueueP95Ms > t.enqueueMultiple * baseline.enqueueP95Ms &&
      step.enqueueP95Ms > ENQUEUE_FLOOR_MS
    ) {
      rules.push("enqueue");
    }
    if (step.failed > 0 || step.timedOut) {
      rules.push("failed");
    }
    if (rules.length > 0) {
      return { degraded: true, at: step.volume, rules };
    }
  }
  return { degraded: false, through: steps[steps.length - 1].volume };
}

/**
 * One concurrency series, steps in user-count order. The first (lowest
 * user count) step is the baseline (research R5).
 */
export function concurrencyVerdict(
  steps: ConcurrencyStep[],
  t: ConcurrencyThresholds,
): Verdict {
  const [baseline, ...rest] = steps;
  if (!baseline) {
    throw new Error("concurrencyVerdict: steps must be non-empty");
  }

  for (const step of rest) {
    const rules: VerdictRule[] = [];
    if (
      step.httpP95Ms > t.latencyMultiple * baseline.httpP95Ms &&
      step.httpP95Ms > LATENCY_FLOOR_MS
    ) {
      rules.push("latency");
    }
    if (step.errorRate > t.errorRate) {
      rules.push("errors");
    }
    if (rules.length > 0) {
      return { degraded: true, at: step.users, rules };
    }
  }
  return { degraded: false, through: steps[steps.length - 1].users };
}
