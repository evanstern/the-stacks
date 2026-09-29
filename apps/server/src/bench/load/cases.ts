import type { Profile, Tier } from "./profile.js";
import type { CaseOutcome } from "./results.js";

/**
 * The case registry (specs/021-load-bench research R10): every case
 * declares exactly one tier and a target. `run` bodies are filled in by
 * later phases (US1-US3); here they stub out `fail: not implemented` so
 * `list` and `selectCases` are usable from Phase 2 on.
 */

export interface RunContext {
  runId: string;
}

export interface Case {
  id: string;
  tier: Tier;
  target: "local" | "dev";
  summary: string;
  run: (ctx: RunContext, profile: Profile) => Promise<CaseOutcome>;
}

function notImplemented(
  id: string,
  tier: Tier,
  target: "local" | "dev",
): Case["run"] {
  return async () => ({
    id,
    tier,
    target,
    status: "fail",
    reason: "not implemented",
    durationMs: 0,
  });
}

export const CASES: readonly Case[] = [
  {
    id: "ingest-smoke",
    tier: "commit",
    target: "local",
    summary:
      "2 steps (3, 6 jobs), 1 in-process worker; every job succeeds, one document per book.",
    run: notImplemented("ingest-smoke", "commit", "local"),
  },
  {
    id: "concurrency-smoke",
    tier: "commit",
    target: "local",
    summary:
      "In-process app on port 0, 3 users, 2 s; zero errors, every WebSocket round trip arrives.",
    run: notImplemented("concurrency-smoke", "commit", "local"),
  },
  {
    id: "ingest-scaling",
    tier: "demand",
    target: "local",
    summary:
      "The decision-0005 measurement: ingest throughput by worker count and volume.",
    run: notImplemented("ingest-scaling", "demand", "local"),
  },
  {
    id: "concurrency-local",
    tier: "demand",
    target: "local",
    summary:
      "Users 1-100 against the built app: HTTP and WebSocket latency and errors.",
    run: notImplemented("concurrency-local", "demand", "local"),
  },
  {
    id: "db-exhaustion",
    tier: "demand",
    target: "local",
    summary:
      "Disrupts every connection to the test stack server; measures degrade and recovery.",
    run: notImplemented("db-exhaustion", "demand", "local"),
  },
  {
    id: "restart-mid-ingest",
    tier: "demand",
    target: "local",
    summary:
      "Kills a worker mid-embed; measures lease reclaim and no duplicate documents.",
    run: notImplemented("restart-mid-ingest", "demand", "local"),
  },
  {
    id: "concurrency-dev",
    tier: "dev",
    target: "dev",
    summary:
      "Read-only concurrency probe against the real deployed dev target.",
    run: notImplemented("concurrency-dev", "dev", "dev"),
  },
];

export interface SelectCasesResult {
  run: Case[];
  skipped: CaseOutcome[];
}

function skip(c: Case, reason: string): CaseOutcome {
  return {
    id: c.id,
    tier: c.tier,
    target: c.target,
    status: "skipped",
    reason,
    durationMs: 0,
  };
}

/**
 * Splits the registry into the cases a run selected and every other case as
 * a `skipped` outcome with a fixed reason (contracts/bench-cli.md, research
 * R10). `run` ∪ `skipped` is always all of `CASES`.
 */
export function selectCases(
  tier: Tier,
  only: string[] | undefined,
): SelectCasesResult {
  const run: Case[] = [];
  const skipped: CaseOutcome[] = [];
  for (const c of CASES) {
    if (c.tier !== tier) {
      skipped.push(skip(c, `tier ${c.tier} not selected`));
      continue;
    }
    if (only && only.length > 0 && !only.includes(c.id)) {
      skipped.push(skip(c, "not selected by --case"));
      continue;
    }
    run.push(c);
  }
  return { run, skipped };
}
